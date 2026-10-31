"""
Vercel Serverless Function Entry Point for Python Flask
Routes incoming API requests to the unified Flask application instance.
"""
import sys
import os

# Ensure project root and server directories are in sys.path
API_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.abspath(os.path.join(API_DIR, '..'))
SERVER_DIR = os.path.join(ROOT_DIR, 'server')

for p in [ROOT_DIR, SERVER_DIR, API_DIR]:
    if p not in sys.path:
        sys.path.insert(0, p)

from server.app import app


# WSGI Middleware to ensure Vercel rewrites map cleanly to Flask request paths
class VercelPathFixer:
    def __init__(self, wsgi_app):
        self.wsgi_app = wsgi_app

    def __call__(self, environ, start_response):
        request_uri = environ.get("REQUEST_URI", "")
        if request_uri:
            path_part = request_uri.split("?", 1)[0]
            if path_part:
                environ["PATH_INFO"] = path_part
        return self.wsgi_app(environ, start_response)


# Apply WSGI path fixer for serverless environments
app.wsgi_app = VercelPathFixer(app.wsgi_app)
