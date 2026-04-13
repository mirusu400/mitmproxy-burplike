서버:

uv run python examples/contrib/tcp_echo.py server --listen-host 127.0.0.1 --port 9000

다른 터미널에서 mitmproxy SOCKS5:

uv run mitmdump --mode socks5@127.0.0.1:1080 --tcp-hosts '.*'

클라이언트:

uv run python examples/contrib/tcp_echo.py client 127.0.0.1 9000 --socks5 127.0.0.1:1080 --message hello
uv run python examples/contrib/tcp_echo.py client 127.0.0.1 9000 --socks5 127.0.0.1:1080 --interactive