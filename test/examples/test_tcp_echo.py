from __future__ import annotations

import importlib.util
import socket
import socketserver
import sys
import threading
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path
from types import ModuleType
from unittest import mock


def load_tcp_echo() -> ModuleType:
    path = Path(__file__).parents[2] / "examples" / "contrib" / "tcp_echo.py"
    spec = importlib.util.spec_from_file_location("tcp_echo_example", path)
    assert spec
    assert spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


tcp_echo = load_tcp_echo()


class FakeSocks5Proxy(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True
    daemon_threads = True
    username: str | None = None
    password: str | None = None


class FakeSocks5Handler(socketserver.BaseRequestHandler):
    server: FakeSocks5Proxy

    def handle(self) -> None:
        version, method_count = self._recv_exact(2)
        assert version == 0x05
        methods = self._recv_exact(method_count)

        if self.server.username is not None:
            assert 0x02 in methods
            self.request.sendall(b"\x05\x02")
            self._handle_userpass_auth()
        else:
            assert 0x00 in methods
            self.request.sendall(b"\x05\x00")

        version, command, reserved, atyp = self._recv_exact(4)
        assert (version, command, reserved) == (0x05, 0x01, 0x00)
        host = self._read_address(atyp)
        port = int.from_bytes(self._recv_exact(2), byteorder="big")

        with socket.create_connection((host, port)) as upstream:
            self.request.sendall(b"\x05\x00\x00\x01\x00\x00\x00\x00\x00\x00")
            while data := self.request.recv(65536):
                upstream.sendall(data)
            upstream.shutdown(socket.SHUT_WR)
            while data := upstream.recv(65536):
                self.request.sendall(data)

    def _handle_userpass_auth(self) -> None:
        version, username_length = self._recv_exact(2)
        assert version == 0x01
        username = self._recv_exact(username_length).decode()
        password_length = self._recv_exact(1)[0]
        password = self._recv_exact(password_length).decode()
        assert username == self.server.username
        assert password == self.server.password
        self.request.sendall(b"\x01\x00")

    def _read_address(self, atyp: int) -> str:
        if atyp == 0x01:
            return socket.inet_ntop(socket.AF_INET, self._recv_exact(4))
        if atyp == 0x04:
            return socket.inet_ntop(socket.AF_INET6, self._recv_exact(16))
        assert atyp == 0x03
        length = self._recv_exact(1)[0]
        return self._recv_exact(length).decode("idna")

    def _recv_exact(self, size: int) -> bytes:
        chunks = bytearray()
        while len(chunks) < size:
            data = self.request.recv(size - len(chunks))
            assert data
            chunks.extend(data)
        return bytes(chunks)


@contextmanager
def running_server(server: socketserver.BaseServer) -> Iterator[None]:
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield
    finally:
        server.shutdown()
        thread.join(timeout=2)


def test_echo_client_direct_roundtrip() -> None:
    with tcp_echo.TcpEchoServer(("127.0.0.1", 0)) as echo_server:
        with running_server(echo_server):
            response = tcp_echo.echo_client(
                "127.0.0.1",
                echo_server.server_address[1],
                b"hello over tcp",
            )

    assert response == b"hello over tcp"


def test_echo_client_socks5_roundtrip() -> None:
    with (
        tcp_echo.TcpEchoServer(("127.0.0.1", 0)) as echo_server,
        FakeSocks5Proxy(("127.0.0.1", 0), FakeSocks5Handler) as socks_server,
    ):
        with running_server(echo_server), running_server(socks_server):
            proxy = tcp_echo.Socks5Proxy("127.0.0.1", socks_server.server_address[1])
            response = tcp_echo.echo_client(
                "127.0.0.1",
                echo_server.server_address[1],
                b"hello through socks5",
                proxy=proxy,
            )

    assert response == b"hello through socks5"


def test_echo_client_socks5_userpass_roundtrip() -> None:
    with (
        tcp_echo.TcpEchoServer(("127.0.0.1", 0)) as echo_server,
        FakeSocks5Proxy(("127.0.0.1", 0), FakeSocks5Handler) as socks_server,
    ):
        socks_server.username = "user"
        socks_server.password = "pass"
        with running_server(echo_server), running_server(socks_server):
            proxy = tcp_echo.parse_socks5_proxy(
                f"socks5://user:pass@127.0.0.1:{socks_server.server_address[1]}"
            )
            response = tcp_echo.echo_client(
                "localhost",
                echo_server.server_address[1],
                b"hello through authenticated socks5",
                proxy=proxy,
            )

    assert response == b"hello through authenticated socks5"


def test_echo_client_interactive_roundtrip(capsys) -> None:
    with tcp_echo.TcpEchoServer(("127.0.0.1", 0)) as echo_server:
        with running_server(echo_server):
            stdin = mock.Mock()
            stdin.buffer.readline.side_effect = [b"first\n", b"second\n", b""]
            with mock.patch.object(sys, "stdin", stdin):
                tcp_echo.interactive_echo_client(
                    "127.0.0.1",
                    echo_server.server_address[1],
                )

    assert capsys.readouterr().out == "first\nsecond\n"
