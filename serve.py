"""Local dev server for the dashboard: python serve.py [port]

Same as `python -m http.server`, but every response says Cache-Control: no-store, so the browser
never runs a stale util.js / tokens.css next to newer chart modules. GitHub Pages is unaffected.
"""
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class NoStoreHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8001
    ThreadingHTTPServer(("", port), NoStoreHandler).serve_forever()
