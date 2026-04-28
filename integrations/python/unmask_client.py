"""
unmask_client.py — minimal Python JSON-RPC client for unmask-cli.

Spawns `unmask serve --stdio` as a subprocess and exposes the public RPC
methods as Python calls. Designed to be embedded directly inside
`playstealth-cli` so the two CLIs combine into one runtime: stealth (ninja
mask) + observation (X-ray gear).

Example:
    from unmask_client import UnmaskClient
    with UnmaskClient() as u:
        h = u.open(url="https://example.com")
        print(u.observe(h, intent="primary CTA", topK=3))
        u.act(h, intent="click the start button")
        u.bundle(h)
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import threading
from typing import Any, Iterator, Optional


class UnmaskRPCError(RuntimeError):
    pass


class UnmaskClient:
    """JSON-RPC 2.0 client over stdio."""

    def __init__(
        self,
        cmd: list[str] | None = None,
        env: dict[str, str] | None = None,
        cwd: Optional[str] = None,
    ) -> None:
        self._cmd = cmd or ["unmask", "serve", "--stdio"]
        self._env = {**os.environ, **(env or {})}
        self._cwd = cwd
        self._proc: subprocess.Popen[str] | None = None
        self._next_id = 0
        self._lock = threading.Lock()

    # ------------- lifecycle -------------

    def __enter__(self) -> "UnmaskClient":
        self.start()
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()

    def start(self) -> None:
        if self._proc is not None:
            return
        self._proc = subprocess.Popen(
            self._cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=sys.stderr,
            text=True,
            bufsize=1,
            env=self._env,
            cwd=self._cwd,
        )

    def close(self) -> None:
        if self._proc is None:
            return
        try:
            try:
                self.call("shutdown")
            except Exception:
                pass
            self._proc.stdin.close()  # type: ignore[union-attr]
            self._proc.wait(timeout=5)
        except Exception:
            self._proc.kill()
        finally:
            self._proc = None

    # ------------- transport -------------

    def call(self, method: str, **params: Any) -> Any:
        if self._proc is None:
            raise UnmaskRPCError("UnmaskClient not started")
        with self._lock:
            self._next_id += 1
            req_id = self._next_id
            req = {"jsonrpc": "2.0", "id": req_id, "method": method, "params": params}
            self._proc.stdin.write(json.dumps(req) + "\n")  # type: ignore[union-attr]
            self._proc.stdin.flush()  # type: ignore[union-attr]
            line = self._proc.stdout.readline()  # type: ignore[union-attr]
            if not line:
                raise UnmaskRPCError("unmask-cli closed stdout unexpectedly")
            res = json.loads(line)
        if "error" in res:
            raise UnmaskRPCError(res["error"].get("message", "rpc error"))
        return res.get("result")

    # ------------- typed helpers -------------

    def ping(self) -> dict[str, Any]:
        return self.call("ping")

    def open(
        self,
        *,
        url: str,
        headless: bool | None = None,
        cdp_endpoint: str | None = None,
        session_label: str | None = None,
    ) -> str:
        params: dict[str, Any] = {"url": url}
        if headless is not None:
            params["headless"] = headless
        if cdp_endpoint:
            params["cdpEndpoint"] = cdp_endpoint
        if session_label:
            params["sessionLabel"] = session_label
        result = self.call("open", **params)
        return result["handleId"]

    def navigate(self, handle: str, url: str) -> dict[str, Any]:
        return self.call("navigate", handleId=handle, url=url)

    def observe(
        self,
        handle: str,
        intent: str,
        top_k: int = 5,
        vision: bool = False,
    ) -> list[dict[str, Any]]:
        return self.call("observe", handleId=handle, intent=intent, topK=top_k, vision=vision)

    def act(
        self,
        handle: str,
        intent: str,
        verb: str | None = None,
        value: str | None = None,
        vision: bool = False,
        dry_run: bool = False,
    ) -> dict[str, Any]:
        params: dict[str, Any] = {
            "handleId": handle,
            "intent": intent,
            "vision": vision,
            "dryRun": dry_run,
        }
        if verb:
            params["verb"] = verb
        if value is not None:
            params["value"] = value
        return self.call("act", **params)

    def extract(
        self,
        handle: str,
        instruction: str | None = None,
        vision: bool = False,
    ) -> Any:
        params: dict[str, Any] = {"handleId": handle, "vision": vision}
        if instruction:
            params["instruction"] = instruction
        return self.call("extract", **params)

    def screenshot(self, handle: str, full_page: bool = False) -> dict[str, Any]:
        return self.call("screenshot", handleId=handle, fullPage=full_page)

    def scan_dom(self, handle: str, max_results: int = 50) -> list[dict[str, Any]]:
        return self.call("scanDom", handleId=handle, max=max_results)

    def bundle(self, handle: str) -> dict[str, Any]:
        return self.call("bundle", handleId=handle)

    def close_handle(self, handle: str) -> dict[str, Any]:
        return self.call("close", handleId=handle)

    def session(self, handle: str) -> dict[str, Any]:
        return self.call("session", handleId=handle)

    def list_handles(self) -> list[dict[str, Any]]:
        return self.call("list")

    def iter_handles(self) -> Iterator[dict[str, Any]]:
        for h in self.list_handles():
            yield h
