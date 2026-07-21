#!/usr/bin/env python3
import json
import os
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from datetime import datetime, timezone

from database import get_db, init_db
from repositorio import RepositorioConfiguracoes, RepositorioCategorias, RepositorioSessoes, RepositorioTarefas

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a): pass

    def send_json(self, data, status=200):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(body)

    def read_body(self):
        n = int(self.headers.get("Content-Length", 0))
        return json.loads(self.rfile.read(n)) if n else {}

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        p = urlparse(self.path)
        path, qs = p.path, parse_qs(p.query)

        if path == "/" or path == "/index.html":
            try:
                html_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "index.html")
                with open(html_path, "r", encoding="utf-8") as f:
                    content = f.read().encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(content)))
                self.end_headers()
                self.wfile.write(content)
                return
            except Exception as e:
                self.send_json({"error": str(e)}, 500)
                return

        elif path == "/api/settings":
            configs = RepositorioConfiguracoes.obter_todas()
            self.send_json({"block_duration": configs.get("duracao_do_bloco", "4500")})

        elif path == "/api/categories":
            categorias = RepositorioCategorias.listar_todas_as_categorias()
            self.send_json([{"id": c["id"], "name": c["nome"], "color": c["cor"]} for c in categorias])

        elif path == "/api/sessions":
            periodo = qs.get("period", ["all"])[0]
            cat_id = qs.get("categoria_id", [None])[0]
            sessoes = RepositorioSessoes.obter_filtradas(periodo, cat_id)
            for s in sessoes:
                s["duration_seconds"] = s.get("duracao")
                s["started_at"] = s.get("inicio")
                s["category_name"] = s.get("categoria_nome")
                s["category_color"] = s.get("categoria_cor")
            self.send_json(sessoes)

        elif path == "/api/chart":
            periodo = qs.get("period", ["week"])[0]
            cat_id = qs.get("categoria_id", [None])[0]
            dados = RepositorioSessoes.obter_dados_grafico(periodo, cat_id)
            for d in dados:
                d["category_name"] = d.get("categoria_nome")
                d["category_color"] = d.get("categoria_cor")
            self.send_json(dados)

        elif path == "/api/stats":
            periodo = qs.get("period", ["week"])[0]
            stats = RepositorioSessoes.obter_estatisticas(periodo)
            self.send_json({"total_seconds": stats.get("total_segundos"), "session_count": stats.get("total_sessoes")})

        elif path == "/api/tasks":
            tarefas = RepositorioTarefas.listar()
            for t in tarefas:
                t["category_name"]  = t.get("categoria_nome")
                t["category_color"] = t.get("categoria_cor")
                t["category_id"]    = t.get("categoria_id")
            self.send_json(tarefas)

    def do_POST(self):
        path = urlparse(self.path).path
        body = self.read_body()

        if path == "/api/categories":
            res = RepositorioCategorias.criar(body["name"], body.get("color", "#6366f1"))
            # 🌟 CORREÇÃO: Mapeando nome/cor para name/color para o JavaScript entender!
            self.send_json({"id": res["id"], "name": res["nome"], "color": res["cor"]}, 201)

        elif path == "/api/sessions/start":
            now = datetime.now(timezone.utc).isoformat()
            res = RepositorioSessoes.iniciar(body.get("category_id"), now, body.get("note", ""))
            self.send_json(res, 201)

        elif path == "/api/tasks":
            res = RepositorioTarefas.criar(body["titulo"], body.get("categoria_id"))
            self.send_json(res, 201)

        elif path == "/api/sessions/stop":
            def calc_duracao(start_iso, end_iso):
                t1 = datetime.fromisoformat(start_iso.replace('Z', '+00:00'))
                t2 = datetime.fromisoformat(end_iso.replace('Z', '+00:00'))
                return int((t2 - t1).total_seconds())
            now = datetime.now(timezone.utc).isoformat()
            res = RepositorioSessoes.parar(body["session_id"], now, calc_duracao)
            self.send_json(res)

    def do_PUT(self):
        path = urlparse(self.path).path
        body = self.read_body()

        if path == "/api/settings":
            if "block_duration" in body:
                RepositorioConfiguracoes.salvar_ou_atualizar({"duracao_do_bloco": body["block_duration"]})
            self.send_json({"block_duration": body.get("block_duration")})

        elif path.startswith("/api/categories/"):
            cid = path.split("/")[-1]
            res = RepositorioCategorias.atualizar(cid, body["name"], body["color"])
            self.send_json({"id": res["id"], "name": res["nome"], "color": res["cor"]})

        elif path.startswith("/api/sessions/"):
            sid = path.split("/")[-1]
            def calc_duracao(start_iso, end_iso):
                t1 = datetime.fromisoformat(start_iso.replace('Z', '+00:00'))
                t2 = datetime.fromisoformat(end_iso.replace('Z', '+00:00'))
                return int((t2 - t1).total_seconds())
            res = RepositorioSessoes.atualizar(
                sid,
                body.get("category_id"),
                body["started_at"],
                body["ended_at"],
                body.get("note", ""),
                calc_duracao
            )
            if res:
                res["duration_seconds"] = res.get("duracao")
                res["started_at"]       = res.get("inicio")
                res["category_name"]    = res.get("categoria_nome")
                res["category_color"]   = res.get("categoria_cor")
                self.send_json(res)
            else:
                self.send_json({"error": "sessão não encontrada"}, 404)

    def do_DELETE(self):
        path = urlparse(self.path).path

        if path.startswith("/api/categories/"):
            self.send_json(RepositorioCategorias.deletar(path.split("/")[-1]))

        elif path.startswith("/api/sessions/"):
            self.send_json(RepositorioSessoes.deletar(path.split("/")[-1]))

        elif path.startswith("/api/tasks/"):
            self.send_json(RepositorioTarefas.deletar(path.split("/")[-1]))

if __name__ == "__main__":
    init_db()
    port = 8000
    print(f"✅ Servidor atualizado rodando em http://localhost:{port}")
    HTTPServer(("localhost", port), Handler).serve_forever()