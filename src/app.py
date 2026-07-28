import json
import os
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

from database import init_db
from servicos import (
    ServicoConfiguracoes,
    ServicoCategorias,
    ServicoSessoes,
    ServicoTarefas,
    ServicoCronograma,
)

class Roteador:

    def __init__(self):
        self._exatas    = {}
        self._dinamicas = []

    def add(self, method, path, fn, status=200):
        if "{id}" in path:
            prefix = path[: path.index("{id}")]
            self._dinamicas.append((method, prefix, fn, status))
        else:
            self._exatas[(method, path)] = (fn, status)

    def despachar(self, method, path, qs, body):
        if (method, path) in self._exatas:
            fn, status = self._exatas[(method, path)]
            return self._chamar(fn, status, qs=qs, body=body)

        for m, prefix, fn, status in self._dinamicas:
            if m == method and path.startswith(prefix):
                resource_id = path[len(prefix):]
                if resource_id and "/" not in resource_id:
                    return self._chamar(fn, status, resource_id=resource_id, qs=qs, body=body)

        return {"error": "rota não encontrada"}, 404

    @staticmethod
    def _chamar(fn, status, **kwargs):
        try:
            return fn(**kwargs), status
        except KeyError as e:
            return {"error": f"campo obrigatório ausente: {e}"}, 400
        except ValueError as e:
            return {"error": str(e)}, 422

_STATIC = {
    "/":           ("index.html", "text/html; charset=utf-8"),
    "/index.html": ("index.html", "text/html; charset=utf-8"),
    "/style.css":  ("style.css",  "text/css; charset=utf-8"),
    "/app.js":     ("app.js",     "application/javascript; charset=utf-8"),
}

def _criar_roteador():
    r = Roteador()

    r.add("GET", "/api/settings",
          lambda qs, body: ServicoConfiguracoes.obter())
    r.add("PUT", "/api/settings",
          lambda qs, body: ServicoConfiguracoes.salvar(body.get("block_duration")))

    r.add("GET",    "/api/categories",
          lambda qs, body: ServicoCategorias.listar())
    r.add("POST",   "/api/categories",
          lambda qs, body: ServicoCategorias.criar(body["name"], body.get("color", "#6366f1")), status=201)
    r.add("PUT",    "/api/categories/{id}",
          lambda qs, body, resource_id: ServicoCategorias.atualizar(resource_id, body["name"], body["color"]))
    r.add("DELETE", "/api/categories/{id}",
          lambda qs, body, resource_id: ServicoCategorias.deletar(resource_id))

    r.add("GET",    "/api/sessions",
          lambda qs, body: ServicoSessoes.listar(
              qs.get("period", ["all"])[0],
              qs.get("categoria_id", [None])[0]))
    r.add("POST",   "/api/sessions/start",
          lambda qs, body: ServicoSessoes.iniciar(
              body.get("category_id"), body.get("note", "")), status=201)
    r.add("POST",   "/api/sessions/stop",
          lambda qs, body: ServicoSessoes.parar(
              body["session_id"], body.get("duration_seconds")))
    r.add("PUT",    "/api/sessions/{id}",
          lambda qs, body, resource_id: ServicoSessoes.atualizar(
              resource_id,
              body.get("category_id"),
              body["started_at"],
              body["ended_at"],
              body.get("note", "")))
    r.add("DELETE", "/api/sessions/{id}",
          lambda qs, body, resource_id: ServicoSessoes.deletar(resource_id))

    r.add("GET", "/api/chart",
          lambda qs, body: ServicoSessoes.dados_grafico(
              qs.get("period", ["week"])[0],
              qs.get("categoria_id", [None])[0]))
    r.add("GET", "/api/stats",
          lambda qs, body: ServicoSessoes.estatisticas(qs.get("period", ["week"])[0]))

    r.add("GET",    "/api/tasks",
          lambda qs, body: ServicoTarefas.listar())
    r.add("POST",   "/api/tasks",
          lambda qs, body: ServicoTarefas.criar(body["titulo"], body.get("categoria_id")), status=201)
    r.add("DELETE", "/api/tasks/{id}",
          lambda qs, body, resource_id: ServicoTarefas.deletar(resource_id))

    r.add("GET",    "/api/schedule",
          lambda qs, body: ServicoCronograma.listar())
    r.add("POST",   "/api/schedule",
          lambda qs, body: ServicoCronograma.adicionar(body["dia_semana"], body["categoria_id"]), status=201)
    r.add("PUT",    "/api/schedule/{id}",
          lambda qs, body, resource_id: ServicoCronograma.mover(resource_id, body["dia_semana"]))
    r.add("DELETE", "/api/schedule/{id}",
          lambda qs, body, resource_id: ServicoCronograma.remover(resource_id))

    return r


_roteador = _criar_roteador()
_app_dir  = os.path.dirname(os.path.abspath(__file__))

class Handler(BaseHTTPRequestHandler):

    def log_message(self, *a): pass

    def send_json(self, data, status=200):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self._cors()
        self.end_headers()
        self.wfile.write(body)

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin",  "*")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _read_body(self):
        n = int(self.headers.get("Content-Length", 0))
        return json.loads(self.rfile.read(n)) if n else {}

    def _serve_static(self, url_path):
        filename, content_type = _STATIC[url_path]
        file_path = os.path.join(_app_dir, filename)
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read().encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(content)))
            self.end_headers()
            self.wfile.write(content)
        except FileNotFoundError:
            self.send_json({"error": f"{filename} não encontrado"}, 404)

    def _dispatch(self, method):
        p    = urlparse(self.path)
        path = p.path
        qs   = parse_qs(p.query)
        body = self._read_body() if method in ("POST", "PUT") else {}

        if path in _STATIC:
            self._serve_static(path)
            return

        resultado, status = _roteador.despachar(method, path, qs, body)
        if resultado is None:
            self.send_json({"error": "não encontrado"}, 404)
        else:
            self.send_json(resultado, status)

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):    self._dispatch("GET")
    def do_POST(self):   self._dispatch("POST")
    def do_PUT(self):    self._dispatch("PUT")
    def do_DELETE(self): self._dispatch("DELETE")

if __name__ == "__main__":
    init_db()
    port = 8000
    print(f"✅ Servidor rodando em http://localhost:{port}")
    HTTPServer(("localhost", port), Handler).serve_forever()