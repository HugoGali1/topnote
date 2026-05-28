#!/usr/bin/env python3
"""Servidor estático de desarrollo para Top Note.

Igual que `python -m http.server` pero envía `Cache-Control: no-store`
en todas las respuestas, para que el navegador nunca sirva una versión
cacheada obsoleta del catálogo o del index.html durante el desarrollo.

Uso:  python scripts/serve.py [puerto]   (por defecto 8000)
"""
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    handler = partial(NoCacheHandler, directory='.')
    httpd = ThreadingHTTPServer(('0.0.0.0', port), handler)
    print(f'Top Note dev server (no-store) en http://localhost:{port}', flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        httpd.shutdown()


if __name__ == '__main__':
    main()
