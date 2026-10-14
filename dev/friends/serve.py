import http.server, socketserver, threading, urllib.parse, os, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
holds = {}
lock = threading.Lock()
GIF = b"GIF89a\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00\xff\xff\xff!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;"


def event(k):
    with lock:
        return holds.setdefault(k, threading.Event())


class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def log_message(self, *a):
        pass

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        u = urllib.parse.urlparse(self.path)
        q = urllib.parse.parse_qs(u.query)
        k = q.get("k", ["x"])[0]
        if u.path == "/__hold":
            event(k).wait(int(q.get("ms", ["8000"])[0]) / 1000.0)
            self.send_response(200)
            self.send_header("Content-Type", "image/gif")
            self.send_header("Content-Length", str(len(GIF)))
            self.end_headers()
            self.wfile.write(GIF)
        elif u.path == "/__release":
            event(k).set()
            self.send_response(204)
            self.end_headers()
        else:
            super().do_GET()


class S(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


S(("127.0.0.1", PORT), H).serve_forever()
