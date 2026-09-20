#!/usr/bin/env python3
"""以倉庫子路徑模擬 GitHub Pages，驗證所有已發布資源。"""

from __future__ import annotations

import functools
import http.server
import json
import os
import pathlib
import threading
import urllib.error
import urllib.parse
import urllib.request


ROOT = pathlib.Path(__file__).resolve().parents[1]
DOCS = pathlib.Path(os.environ.get("DOCS_ROOT", ROOT / "docs")).resolve()
PREFIX = "/repository-name/"


class RepositoryHandler(http.server.SimpleHTTPRequestHandler):
    """只把指定倉庫前綴映射到 docs，避免測試誤用網域根路徑。"""

    def translate_path(self, request_path: str) -> str:
        parsed_path = urllib.parse.urlsplit(request_path).path
        if not parsed_path.startswith(PREFIX):
            return str(DOCS / "__not_found__")
        relative = urllib.parse.unquote(parsed_path[len(PREFIX) :]) or "index.html"
        candidate = (DOCS / relative).resolve()
        if DOCS.resolve() not in candidate.parents and candidate != DOCS.resolve():
            return str(DOCS / "__not_found__")
        return str(candidate)

    def log_message(self, _format: str, *_args: object) -> None:
        return


def fetch(base_url: str, relative_url: str) -> bytes:
    url = urllib.parse.urljoin(base_url, relative_url)
    separator = "&" if "?" in url else "?"
    with urllib.request.urlopen(f"{url}{separator}v=smoke", timeout=5) as response:
        if response.status != 200:
            raise AssertionError(f"{url} 回傳 HTTP {response.status}")
        return response.read()


def main() -> None:
    handler = functools.partial(RepositoryHandler, directory=str(DOCS))
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base_url = f"http://127.0.0.1:{server.server_port}{PREFIX}"

    try:
        frontend_assets = ["", "css/style.css", "js/content-utils.js", "js/navigation-utils.js", "js/app.js"]
        if (DOCS / "js" / "markdown.js").exists():
            frontend_assets.append("js/markdown.js")
        for asset in frontend_assets:
            if not fetch(base_url, asset):
                raise AssertionError(f"{asset or 'index.html'} 是空回應")

        catalog = json.loads(fetch(base_url, "content/catalog.json?t=1"))
        projects = [
            project
            for category in catalog["categories"]
            for project in category["projects"]
        ]
        for project in projects:
            manifest_url = urllib.parse.urljoin("content/catalog.json", project["manifest"])
            manifest = json.loads(fetch(base_url, manifest_url))
            project_base = urllib.parse.urljoin(manifest_url, "./")
            for artifact in manifest["artifacts"]:
                localized_files = list((artifact.get("fileByLocale") or {}).values())
                for artifact_file in [artifact["file"], *localized_files]:
                    payload = fetch(base_url, urllib.parse.urljoin(project_base, artifact_file))
                    if not payload:
                        raise AssertionError(f"{project['id']} 的 {artifact_file} 是空檔案")
                    if artifact["kind"] == "json":
                        json.loads(payload)
    except urllib.error.HTTPError as error:
        raise AssertionError(f"HTTP smoke test 失敗：{error.url} 回傳 {error.code}") from error
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)

    print(
        "HTTP smoke test passed: "
        f"{len(catalog['categories'])} categories, {len(projects)} cases"
    )


if __name__ == "__main__":
    main()
