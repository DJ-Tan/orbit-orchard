import http.server, os, sys, threading

ROOT = os.path.abspath(sys.argv[1])
PORT = int(sys.argv[2])


class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def log_message(self, *a):
        pass

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Access-Control-Allow-Origin", "*")
        super().end_headers()

    def do_GET(self):
        if self.path.startswith("/__die"):
            self.send_response(204)
            self.end_headers()
            threading.Thread(target=srv.shutdown).start()
        else:
            super().do_GET()


srv = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), H)
srv.serve_forever()
