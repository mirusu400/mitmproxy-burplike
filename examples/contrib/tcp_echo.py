"""
Small TCP echo server/client for exercising mitmproxy SOCKS5 TCP flows.

Examples:

    python examples/contrib/tcp_echo.py server --listen-host 127.0.0.1 --port 9000
    python examples/contrib/tcp_echo.py client 127.0.0.1 9000 --message hello
    python examples/contrib/tcp_echo.py client 127.0.0.1 9000 --socks5 127.0.0.1:1080 --message hello
"""

from __future__ import annotations

import argparse
import dataclasses
import ipaddress
import socket
import socketserver
import sys
from collections.abc import Sequence

DEFAULT_CHUNK_SIZE = 65536
DEFAULT_TIMEOUT = 10.0


class TcpEchoServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True
    daemon_threads = True

    def __init__(
        self,
        server_address: tuple[str, int],
        chunk_size: int = DEFAULT_CHUNK_SIZE,
    ) -> None:
        self.chunk_size = chunk_size
        super().__init__(server_address, TcpEchoHandler)


class TcpEchoHandler(socketserver.BaseRequestHandler):
    server: TcpEchoServer

    def handle(self) -> None:
        while data := self.request.recv(self.server.chunk_size):
            self.request.sendall(data)


@dataclasses.dataclass(frozen=True)
class Socks5Proxy:
    host: str
    port: int
    username: str | None = None
    password: str | None = None


class Socks5Error(OSError):
    pass


SOCKS5_REPLY_CODES = {
    0x01: "general SOCKS server failure",
    0x02: "connection not allowed by ruleset",
    0x03: "network unreachable",
    0x04: "host unreachable",
    0x05: "connection refused",
    0x06: "TTL expired",
    0x07: "command not supported",
    0x08: "address type not supported",
}


def parse_host_port(value: str, default_port: int | None = None) -> tuple[str, int]:
    host, separator, port_str = value.rpartition(":")
    if not separator:
        if default_port is None:
            raise argparse.ArgumentTypeError(f"expected HOST:PORT, got {value!r}")
        return value, default_port

    if host.startswith("[") and host.endswith("]"):
        host = host[1:-1]

    try:
        port = int(port_str)
    except ValueError:
        raise argparse.ArgumentTypeError(f"invalid port: {port_str!r}") from None

    if not 0 <= port <= 65535:
        raise argparse.ArgumentTypeError(f"invalid port: {port}")

    return host, port


def parse_socks5_proxy(value: str) -> Socks5Proxy:
    if value.startswith("socks5://"):
        value = value.removeprefix("socks5://")

    credentials: str | None = None
    if "@" in value:
        credentials, value = value.rsplit("@", 1)

    host, port = parse_host_port(value)
    username = password = None

    if credentials is not None:
        username, _, password = credentials.partition(":")

    return Socks5Proxy(host=host, port=port, username=username, password=password)


def _recv_exact(sock: socket.socket, size: int) -> bytes:
    chunks = bytearray()
    while len(chunks) < size:
        data = sock.recv(size - len(chunks))
        if not data:
            raise Socks5Error("SOCKS5 proxy closed the connection unexpectedly")
        chunks.extend(data)
    return bytes(chunks)


def _socks5_address(host: str) -> bytes:
    try:
        ip = ipaddress.ip_address(host)
    except ValueError:
        encoded = host.encode("idna")
        if len(encoded) > 255:
            raise Socks5Error("SOCKS5 domain names must be at most 255 bytes")
        return bytes([0x03, len(encoded)]) + encoded

    if ip.version == 4:
        return b"\x01" + ip.packed
    return b"\x04" + ip.packed


def _read_socks5_address(sock: socket.socket, atyp: int) -> bytes:
    if atyp == 0x01:
        return _recv_exact(sock, 4)
    if atyp == 0x04:
        return _recv_exact(sock, 16)
    if atyp == 0x03:
        length = _recv_exact(sock, 1)[0]
        return _recv_exact(sock, length)
    raise Socks5Error(f"SOCKS5 proxy returned unknown address type: {atyp:#x}")


def socks5_connect(
    proxy: Socks5Proxy,
    host: str,
    port: int,
    timeout: float = DEFAULT_TIMEOUT,
) -> socket.socket:
    sock = socket.create_connection((proxy.host, proxy.port), timeout=timeout)
    try:
        methods = [0x00]
        if proxy.username is not None:
            methods.append(0x02)

        sock.sendall(bytes([0x05, len(methods), *methods]))
        version, method = _recv_exact(sock, 2)
        if version != 0x05:
            raise Socks5Error(f"invalid SOCKS5 greeting version: {version:#x}")
        if method == 0xFF:
            raise Socks5Error("SOCKS5 proxy did not accept any offered auth method")
        if method == 0x02:
            username = (proxy.username or "").encode()
            password = (proxy.password or "").encode()
            if len(username) > 255 or len(password) > 255:
                raise Socks5Error("SOCKS5 username/password must be at most 255 bytes")
            sock.sendall(
                b"\x01"
                + bytes([len(username)])
                + username
                + bytes([len(password)])
                + password
            )
            auth_version, status = _recv_exact(sock, 2)
            if auth_version != 0x01 or status != 0x00:
                raise Socks5Error("SOCKS5 username/password authentication failed")
        elif method != 0x00:
            raise Socks5Error(f"SOCKS5 proxy selected unsupported auth method: {method:#x}")

        request = (
            b"\x05\x01\x00" + _socks5_address(host) + port.to_bytes(2, byteorder="big")
        )
        sock.sendall(request)

        version, reply, _reserved, atyp = _recv_exact(sock, 4)
        if version != 0x05:
            raise Socks5Error(f"invalid SOCKS5 response version: {version:#x}")
        _read_socks5_address(sock, atyp)
        _recv_exact(sock, 2)
        if reply != 0x00:
            reason = SOCKS5_REPLY_CODES.get(reply, f"unknown error {reply:#x}")
            raise Socks5Error(f"SOCKS5 CONNECT failed: {reason}")
    except Exception:
        sock.close()
        raise
    return sock


def open_connection(
    host: str,
    port: int,
    proxy: Socks5Proxy | None = None,
    timeout: float = DEFAULT_TIMEOUT,
) -> socket.socket:
    if proxy is not None:
        return socks5_connect(proxy, host, port, timeout)
    return socket.create_connection((host, port), timeout=timeout)


def echo_client(
    host: str,
    port: int,
    payload: bytes,
    proxy: Socks5Proxy | None = None,
    timeout: float = DEFAULT_TIMEOUT,
) -> bytes:
    with open_connection(host, port, proxy=proxy, timeout=timeout) as sock:
        sock.sendall(payload)
        sock.shutdown(socket.SHUT_WR)
        chunks = []
        while data := sock.recv(DEFAULT_CHUNK_SIZE):
            chunks.append(data)
        return b"".join(chunks)


def interactive_echo_client(
    host: str,
    port: int,
    proxy: Socks5Proxy | None = None,
    timeout: float = DEFAULT_TIMEOUT,
) -> None:
    with open_connection(host, port, proxy=proxy, timeout=timeout) as sock:
        while payload := sys.stdin.buffer.readline():
            sock.sendall(payload)
            remaining = len(payload)
            while remaining:
                response = sock.recv(remaining)
                if not response:
                    return
                remaining -= len(response)
                sys.stdout.buffer.write(response)
                sys.stdout.buffer.flush()


def serve(
    host: str,
    port: int,
    *,
    chunk_size: int = DEFAULT_CHUNK_SIZE,
    once: bool = False,
) -> None:
    with TcpEchoServer((host, port), chunk_size=chunk_size) as server:
        listen_host, listen_port = server.server_address
        print(f"tcp echo server listening on {listen_host}:{listen_port}", flush=True)
        if once:
            server.handle_request()
        else:
            server.serve_forever()


def _payload_from_args(args: argparse.Namespace) -> bytes:
    if args.hex is not None:
        return bytes.fromhex(args.hex)
    if args.message is not None:
        return args.message.encode()
    return sys.stdin.buffer.read()


def make_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="TCP echo server/client with optional SOCKS5 client support."
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    server = subparsers.add_parser("server", help="run a TCP echo server")
    server.add_argument("--listen-host", default="127.0.0.1")
    server.add_argument("--port", type=int, default=9000)
    server.add_argument("--chunk-size", type=int, default=DEFAULT_CHUNK_SIZE)
    server.add_argument("--once", action="store_true", help="handle one connection and exit")

    client = subparsers.add_parser("client", help="send one payload to an echo server")
    client.add_argument("host")
    client.add_argument("port", type=int)
    client.add_argument("--message", help="UTF-8 payload to send")
    client.add_argument("--hex", help="hex-encoded payload to send")
    client.add_argument(
        "-i",
        "--interactive",
        action="store_true",
        help="keep the connection open and send stdin line by line",
    )
    client.add_argument(
        "--socks5",
        type=parse_socks5_proxy,
        help="SOCKS5 proxy as HOST:PORT, socks5://HOST:PORT, or socks5://USER:PASS@HOST:PORT",
    )
    client.add_argument("--timeout", type=float, default=DEFAULT_TIMEOUT)

    return parser


def main(argv: Sequence[str] | None = None) -> int:
    parser = make_parser()
    args = parser.parse_args(argv)

    if args.command == "server":
        serve(
            args.listen_host,
            args.port,
            chunk_size=args.chunk_size,
            once=args.once,
        )
        return 0

    if args.command == "client":
        if args.interactive:
            if args.message is not None or args.hex is not None:
                parser.error("--interactive cannot be combined with --message or --hex")
            interactive_echo_client(
                args.host,
                args.port,
                proxy=args.socks5,
                timeout=args.timeout,
            )
            return 0

        payload = _payload_from_args(args)
        response = echo_client(
            args.host,
            args.port,
            payload,
            proxy=args.socks5,
            timeout=args.timeout,
        )
        sys.stdout.buffer.write(response)
        return 0

    raise AssertionError(f"unknown command: {args.command}")


if __name__ == "__main__":
    raise SystemExit(main())
