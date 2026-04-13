# mitmproxy-custom



[![Continuous Integration Status](https://github.com/mitmproxy/mitmproxy/actions/workflows/main.yml/badge.svg?branch=main)](https://github.com/mitmproxy/mitmproxy/actions?query=branch%3Amain)
[![Codacy Badge](https://app.codacy.com/project/badge/Grade/a38b0325dfb944839c0c8da354f70b1b)](https://app.codacy.com/gh/mitmproxy/mitmproxy/dashboard)
[![autofix.ci: enabled](https://shields.mitmproxy.org/badge/autofix.ci-yes-success?logo=data:image/svg+xml;base64,PHN2ZyBmaWxsPSIjZmZmIiB2aWV3Qm94PSIwIDAgMTI4IDEyOCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCB0cmFuc2Zvcm09InNjYWxlKDAuMDYxLC0wLjA2MSkgdHJhbnNsYXRlKC0yNTAsLTE3NTApIiBkPSJNMTMyNSAtMzQwcS0xMTUgMCAtMTY0LjUgMzIuNXQtNDkuNSAxMTQuNXEwIDMyIDUgNzAuNXQxMC41IDcyLjV0NS41IDU0djIyMHEtMzQgLTkgLTY5LjUgLTE0dC03MS41IC01cS0xMzYgMCAtMjUxLjUgNjJ0LTE5MSAxNjl0LTkyLjUgMjQxcS05MCAxMjAgLTkwIDI2NnEwIDEwOCA0OC41IDIwMC41dDEzMiAxNTUuNXQxODguNSA4MXExNSA5OSAxMDAuNSAxODAuNXQyMTcgMTMwLjV0MjgyLjUgNDlxMTM2IDAgMjU2LjUgLTQ2IHQyMDkgLTEyNy41dDEyOC41IC0xODkuNXExNDkgLTgyIDIyNyAtMjEzLjV0NzggLTI5OS41cTAgLTEzNiAtNTggLTI0NnQtMTY1LjUgLTE4NC41dC0yNTYuNSAtMTAzLjVsLTI0MyAtMzAwdi01MnEwIC0yNyAzLjUgLTU2LjV0Ni41IC01Ny41dDMgLTUycTAgLTg1IC00MS41IC0xMTguNXQtMTU3LjUgLTMzLjV6TTEzMjUgLTI2MHE3NyAwIDk4IDE0LjV0MjEgNTcuNXEwIDI5IC0zIDY4dC02LjUgNzN0LTMuNSA0OHY2NGwyMDcgMjQ5IHEtMzEgMCAtNjAgNS41dC01NCAxMi41bC0xMDQgLTEyM3EtMSAzNCAtMiA2My41dC0xIDU0LjVxMCA2OSA5IDEyM2wzMSAyMDBsLTExNSAtMjhsLTQ2IC0yNzFsLTIwNSAyMjZxLTE5IC0xNSAtNDMgLTI4LjV0LTU1IC0yNi41bDIxOSAtMjQydi0yNzZxMCAtMjAgLTUuNSAtNjB0LTEwLjUgLTc5dC01IC01OHEwIC00MCAzMCAtNTMuNXQxMDQgLTEzLjV6TTEyNjIgNjE2cS0xMTkgMCAtMjI5LjUgMzQuNXQtMTkzLjUgOTYuNWw0OCA2NCBxNzMgLTU1IDE3MC41IC04NXQyMDQuNSAtMzBxMTM3IDAgMjQ5IDQ1LjV0MTc5IDEyMXQ2NyAxNjUuNWg4MHEwIC0xMTQgLTc3LjUgLTIwNy41dC0yMDggLTE0OXQtMjg5LjUgLTU1LjV6TTgwMyA1OTVxODAgMCAxNDkgMjkuNXQxMDggNzIuNWwyMjEgLTY3bDMwOSA4NnE0NyAtMzIgMTA0LjUgLTUwdDExNy41IC0xOHE5MSAwIDE2NSAzOHQxMTguNSAxMDMuNXQ0NC41IDE0Ni41cTAgNzYgLTM0LjUgMTQ5dC05NS41IDEzNHQtMTQzIDk5IHEtMzcgMTA3IC0xMTUuNSAxODMuNXQtMTg2IDExNy41dC0yMzAuNSA0MXEtMTAzIDAgLTE5Ny41IC0yNnQtMTY5IC03Mi41dC0xMTcuNSAtMTA4dC00MyAtMTMxLjVxMCAtMzQgMTQuNSAtNjIuNXQ0MC41IC01MC41bC01NSAtNTlxLTM0IDI5IC01NCA2NS41dC0yNSA4MS41cS04MSAtMTggLTE0NSAtNzB0LTEwMSAtMTI1LjV0LTM3IC0xNTguNXEwIC0xMDIgNDguNSAtMTgwLjV0MTI5LjUgLTEyM3QxNzkgLTQ0LjV6Ii8+PC9zdmc+)](https://autofix.ci)
[![Coverage Status](https://shields.mitmproxy.org/codecov/c/github/mitmproxy/mitmproxy/main.svg?label=codecov)](https://codecov.io/gh/mitmproxy/mitmproxy)
[![Latest Version](https://shields.mitmproxy.org/pypi/v/mitmproxy.svg)](https://pypi.python.org/pypi/mitmproxy)
[![Supported Python versions](https://shields.mitmproxy.org/pypi/pyversions/mitmproxy.svg)](https://pypi.python.org/pypi/mitmproxy)

* I add burp-suite like functions for pentesting, you can find changes in [Changelog](./CHANGELOG.md)

## 빠른 시작 (Quick Start)

### 전제 조건 (Prerequisites)

| 도구 | 용도 | 설치 |
|------|------|------|
| [uv](https://docs.astral.sh/uv/) | Python 패키지/런타임 관리 | `curl -LsSf https://astral.sh/uv/install.sh \| sh` |
| [Node.js + npm](https://nodejs.org/) | 프론트엔드 빌드 (개발 시만 필요) | https://nodejs.org |

> **참고**: 단순 실행만 할 경우 Node.js는 필요 없습니다. 빌드된 정적 파일이 저장소에 포함되어 있습니다.

### 처음 설치 및 실행

```bash
git clone https://github.com/mirusu400/mitmproxy-burplike
cd mitmproxy-burplike

# Python 환경은 uv가 자동으로 구성합니다 (venv 생성, 의존성 설치 포함)
uv run mitmproxy --version  # 13.0.0.dev-custom 이 나와야 합니다

# mitmweb 실행
uv run mitmweb
```

브라우저에서 `http://127.0.0.1:8081` 접속.

### 프론트엔드 소스 수정 후 (개발자용)

TypeScript/CSS 파일을 수정한 경우에는 반드시 빌드 후 재시작해야 합니다.

```bash
# 프론트엔드 의존성 설치 (최초 1회)
cd web && npm install && cd ..

# 프론트엔드 빌드 (소스 수정 시마다)
cd web && npm run ci-build-release && cd ..

# 브라우저 Hard Refresh (Cmd+Shift+R / Ctrl+Shift+R)
uv run mitmweb
```

## TCP Stream Data 직접 전송 기능

TCP flow의 **Stream Data** 탭에서 캡처된 payload를 바로 편집·재전송할 수 있습니다.

### 사용 예시 (SOCKS5 + TCP echo)

```bash
# 터미널 1: echo 서버 실행
uv run python examples/contrib/tcp_echo.py server --listen-host 127.0.0.1 --port 9000

# 터미널 2: mitmweb SOCKS5 모드로 실행
uv run mitmweb --mode socks5@127.0.0.1:1080 --tcp-hosts '.*'

# 터미널 3: SOCKS5 프록시를 통해 echo 클라이언트 실행
uv run python examples/contrib/tcp_echo.py client 127.0.0.1 9000 \
    --socks5 127.0.0.1:1080 --message hello
```

mitmweb(`http://127.0.0.1:8081`)에서 캡처된 TCP flow를 클릭하면:

- **Stream Data 탭** → 하단 **Send 패널**: 캡처된 payload가 hex로 표시됨.
  내용을 수정하고 **Send** 버튼을 누르면 서버로 직접 재전송하고 응답을 인라인으로 확인.
- **Repeater 탭**: Flow table에서 우클릭 → "Send to Repeater" 로 보내 반복 테스트 가능.

``mitmproxy`` is an interactive, SSL/TLS-capable intercepting proxy with a console
interface for HTTP/1, HTTP/2, and WebSockets.

``mitmdump`` is the command-line version of mitmproxy. Think tcpdump for HTTP.

``mitmweb`` is a web-based interface for mitmproxy.

## Installation

The installation instructions are [here](https://docs.mitmproxy.org/stable/overview-installation).
If you want to install from source, see [CONTRIBUTING.md](./CONTRIBUTING.md).

## Documentation & Help

General information, tutorials, and precompiled binaries can be found on the mitmproxy website.

[![mitmproxy.org](https://shields.mitmproxy.org/badge/https%3A%2F%2F-mitmproxy.org-blue.svg)](https://mitmproxy.org/)

The documentation for mitmproxy is available on our website:

[![mitmproxy documentation stable](https://shields.mitmproxy.org/badge/docs-stable-brightgreen.svg)](https://docs.mitmproxy.org/stable/)
[![mitmproxy documentation dev](https://shields.mitmproxy.org/badge/docs-dev-brightgreen.svg)](https://docs.mitmproxy.org/dev/)

If you have questions on how to use mitmproxy, please
use GitHub Discussions!

[![mitmproxy discussions](https://shields.mitmproxy.org/badge/help-github%20discussions-orange.svg)](https://github.com/mitmproxy/mitmproxy/discussions)

## Contributing

As an open source project, mitmproxy welcomes contributions of all forms.

[![Dev Guide](https://shields.mitmproxy.org/badge/dev_docs-CONTRIBUTING.md-blue)](./CONTRIBUTING.md)
