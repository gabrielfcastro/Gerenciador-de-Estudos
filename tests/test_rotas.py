"""
Testes de integração das rotas HTTP do Gerenciador de Estudos.
Sobem um servidor real numa porta aleatória e fazem requisições HTTP.
Execute com:  pytest tests/ -v
"""
import json
import sqlite3
import threading
import http.client
import pytest


# ── helper de requisição ──────────────────────────────────────────────────────

def req(port, method, path, body=None):
    """Dispara uma requisição HTTP e retorna (status_code, dados)."""
    conn = http.client.HTTPConnection("localhost", port, timeout=5)
    headers = {"Content-Type": "application/json"} if body is not None else {}
    payload = json.dumps(body).encode() if body is not None else None
    conn.request(method, path, payload, headers)
    resp = conn.getresponse()
    return resp.status, json.loads(resp.read())


# ── fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def porta(tmp_path_factory):
    """
    Sobe o servidor HTTP uma vez para todo o módulo de testes.
    Usa um banco de dados temporário isolado do banco real.
    """
    from http.server import HTTPServer
    import database
    import app as app_module

    db_temp = str(tmp_path_factory.mktemp("http") / "routes.db")
    database.db_path = db_temp
    database.init_db()

    servidor = HTTPServer(("localhost", 0), app_module.Handler)
    port = servidor.server_address[1]
    threading.Thread(target=servidor.serve_forever, daemon=True).start()

    yield port

    servidor.shutdown()


@pytest.fixture(autouse=True)
def tabelas_limpas(porta):
    """Limpa os dados antes de cada teste para garantir isolamento."""
    import database
    conn = sqlite3.connect(database.db_path)
    conn.executescript("""
        DELETE FROM schedule;
        DELETE FROM tasks;
        DELETE FROM sessions;
        DELETE FROM categories;
        DELETE FROM settings;
        INSERT OR IGNORE INTO settings (key, value) VALUES ('duracao_do_bloco', '4500');
    """)
    conn.commit()
    conn.close()


# ── /api/settings ─────────────────────────────────────────────────────────────

class TestSettings:

    def test_get_retorna_duracao_padrao(self, porta):
        status, data = req(porta, "GET", "/api/settings")
        assert status == 200
        assert data["block_duration"] == "4500"

    def test_put_atualiza_duracao(self, porta):
        req(porta, "PUT", "/api/settings", {"block_duration": 3600})
        status, data = req(porta, "GET", "/api/settings")
        assert status == 200
        assert data["block_duration"] == "3600"


# ── /api/categories ───────────────────────────────────────────────────────────

class TestCategorias:

    def test_get_lista_vazia(self, porta):
        status, data = req(porta, "GET", "/api/categories")
        assert status == 200
        assert data == []

    def test_post_cria_categoria(self, porta):
        status, data = req(porta, "POST", "/api/categories", {
            "name": "Direito", "color": "#7c6ff7"
        })
        assert status == 201
        assert data["name"] == "Direito"
        assert data["color"] == "#7c6ff7"
        assert "id" in data

    def test_get_lista_categorias_criadas(self, porta):
        req(porta, "POST", "/api/categories", {"name": "Física", "color": "#f00"})
        status, data = req(porta, "GET", "/api/categories")
        assert status == 200
        assert len(data) == 1
        assert data[0]["name"] == "Física"

    def test_put_atualiza_categoria(self, porta):
        _, cat = req(porta, "POST", "/api/categories", {"name": "Original", "color": "#000"})
        status, data = req(porta, "PUT", f"/api/categories/{cat['id']}", {
            "name": "Editado", "color": "#fff"
        })
        assert status == 200
        assert data["name"] == "Editado"
        assert data["color"] == "#fff"

    def test_delete_remove_categoria(self, porta):
        _, cat = req(porta, "POST", "/api/categories", {"name": "Temp", "color": "#abc"})
        status, _ = req(porta, "DELETE", f"/api/categories/{cat['id']}")
        assert status == 200
        _, lista = req(porta, "GET", "/api/categories")
        assert lista == []


# ── /api/sessions ─────────────────────────────────────────────────────────────

class TestSessoes:

    def _iniciar(self, porta, cat_id=None):
        return req(porta, "POST", "/api/sessions/start", {
            "category_id": cat_id,
            "note": "teste"
        })

    def _parar(self, porta, sessao_id, duracao=60):
        return req(porta, "POST", "/api/sessions/stop", {
            "session_id": sessao_id,
            "duration_seconds": duracao
        })

    def test_iniciar_cria_sessao(self, porta):
        status, data = self._iniciar(porta)
        assert status == 201
        assert data["fim"] is None

    def test_parar_usa_duracao_do_frontend(self, porta):
        """Duração deve vir do frontend (excluindo pausas), não de fim - inicio."""
        _, sessao = self._iniciar(porta)
        status, data = self._parar(porta, sessao["id"], duracao=1800)
        assert status == 200
        assert data["duracao"] == 1800

    def test_parar_sem_duration_seconds_usa_calculo(self, porta):
        """Se o frontend não enviar duration_seconds, calcula normalmente."""
        _, sessao = self._iniciar(porta)
        status, data = req(porta, "POST", "/api/sessions/stop", {
            "session_id": sessao["id"]
            # sem duration_seconds
        })
        assert status == 200
        assert data["duracao"] >= 0  # calculado pelo servidor

    def test_get_lista_apenas_finalizadas(self, porta):
        self._iniciar(porta)  # sessão sem fim — não deve aparecer
        _, s = self._iniciar(porta)
        self._parar(porta, s["id"])
        status, data = req(porta, "GET", "/api/sessions?period=all")
        assert status == 200
        assert len(data) == 1

    def test_put_edita_sessao(self, porta):
        _, s = self._iniciar(porta)
        self._parar(porta, s["id"])
        status, data = req(porta, "PUT", f"/api/sessions/{s['id']}", {
            "category_id": None,
            "started_at": "2026-01-01T08:00:00+00:00",
            "ended_at":   "2026-01-01T10:00:00+00:00",
            "note": "editado"
        })
        assert status == 200
        assert data["duracao"] == 7200
        assert data["nota"] == "editado"

    def test_put_sessao_inexistente_retorna_404(self, porta):
        status, data = req(porta, "PUT", "/api/sessions/9999", {
            "category_id": None,
            "started_at": "2026-01-01T08:00:00+00:00",
            "ended_at":   "2026-01-01T09:00:00+00:00",
            "note": ""
        })
        assert status == 404

    def test_delete_remove_sessao(self, porta):
        _, s = self._iniciar(porta)
        self._parar(porta, s["id"])
        status, _ = req(porta, "DELETE", f"/api/sessions/{s['id']}")
        assert status == 200
        _, lista = req(porta, "GET", "/api/sessions?period=all")
        assert lista == []


# ── /api/stats ────────────────────────────────────────────────────────────────

class TestStats:

    def test_sem_sessoes_retorna_zeros(self, porta):
        status, data = req(porta, "GET", "/api/stats?period=all")
        assert status == 200
        assert data["total_seconds"] == 0
        assert data["session_count"] == 0

    def test_com_sessao_acumula_total(self, porta):
        _, s = req(porta, "POST", "/api/sessions/start", {"note": ""})
        req(porta, "POST", "/api/sessions/stop", {
            "session_id": s["id"],
            "duration_seconds": 3600
        })
        status, data = req(porta, "GET", "/api/stats?period=all")
        assert status == 200
        assert data["total_seconds"] == 3600
        assert data["session_count"] == 1


# ── /api/tasks ────────────────────────────────────────────────────────────────

class TestTarefas:

    def test_get_lista_vazia(self, porta):
        status, data = req(porta, "GET", "/api/tasks")
        assert status == 200
        assert data == []

    def test_post_cria_tarefa(self, porta):
        _, cat = req(porta, "POST", "/api/categories", {"name": "Direito", "color": "#7c6ff7"})
        status, data = req(porta, "POST", "/api/tasks", {
            "titulo": "Estudar cap. 1",
            "categoria_id": cat["id"]
        })
        assert status == 201
        assert data["titulo"] == "Estudar cap. 1"
        assert data["status"] == "todo"

    def test_post_tarefa_com_categoria(self, porta):
        _, cat = req(porta, "POST", "/api/categories", {"name": "TCC", "color": "#0f0"})
        status, data = req(porta, "POST", "/api/tasks", {
            "titulo": "Escrever intro",
            "categoria_id": cat["id"]
        })
        assert status == 201
        assert data["categoria_id"] == cat["id"]

    def test_post_tarefa_sem_categoria_retorna_422(self, porta):
        """Regra de negócio: toda tarefa deve estar associada a uma matéria."""
        status, data = req(porta, "POST", "/api/tasks", {"titulo": "Sem matéria"})
        assert status == 422
        assert "error" in data

    def test_post_tarefa_com_categoria_null_retorna_422(self, porta):
        status, data = req(porta, "POST", "/api/tasks", {
            "titulo": "Sem matéria", "categoria_id": None
        })
        assert status == 422

    def test_delete_remove_tarefa(self, porta):
        _, cat = req(porta, "POST", "/api/categories", {"name": "Temp", "color": "#abc"})
        _, t = req(porta, "POST", "/api/tasks", {"titulo": "Temp", "categoria_id": cat["id"]})
        status, _ = req(porta, "DELETE", f"/api/tasks/{t['id']}")
        assert status == 200
        _, lista = req(porta, "GET", "/api/tasks")
        assert lista == []


# ── /api/schedule ─────────────────────────────────────────────────────────────

class TestCronograma:

    def _criar_cat(self, porta):
        _, cat = req(porta, "POST", "/api/categories", {
            "name": "Dir. Admin", "color": "#7c6ff7"
        })
        return cat

    def test_get_lista_vazio(self, porta):
        status, data = req(porta, "GET", "/api/schedule")
        assert status == 200
        assert data == []

    def test_post_adiciona_entrada(self, porta):
        cat = self._criar_cat(porta)
        status, data = req(porta, "POST", "/api/schedule", {
            "dia_semana": "segunda",
            "categoria_id": cat["id"]
        })
        assert status == 201
        assert data["dia_semana"] == "segunda"
        assert data["category_name"] == "Dir. Admin"
        assert data["category_color"] == "#7c6ff7"

    def test_get_lista_entradas_criadas(self, porta):
        cat = self._criar_cat(porta)
        req(porta, "POST", "/api/schedule", {
            "dia_semana": "terca", "categoria_id": cat["id"]
        })
        status, data = req(porta, "GET", "/api/schedule")
        assert status == 200
        assert len(data) == 1
        assert data[0]["dia_semana"] == "terca"

    def test_multiplas_entradas_mesmo_dia(self, porta):
        cat = self._criar_cat(porta)
        req(porta, "POST", "/api/schedule", {"dia_semana": "quarta", "categoria_id": cat["id"]})
        req(porta, "POST", "/api/schedule", {"dia_semana": "quarta", "categoria_id": cat["id"]})
        _, data = req(porta, "GET", "/api/schedule")
        assert len(data) == 2

    def test_delete_remove_entrada(self, porta):
        cat = self._criar_cat(porta)
        _, e = req(porta, "POST", "/api/schedule", {
            "dia_semana": "sexta", "categoria_id": cat["id"]
        })
        status, _ = req(porta, "DELETE", f"/api/schedule/{e['id']}")
        assert status == 200
        _, lista = req(porta, "GET", "/api/schedule")
        assert lista == []

    def test_put_move_entrada_para_outro_dia(self, porta):
        """Drag-and-drop no planejamento: mover uma matéria de um dia para outro."""
        cat = self._criar_cat(porta)
        _, e = req(porta, "POST", "/api/schedule", {
            "dia_semana": "segunda", "categoria_id": cat["id"]
        })
        status, data = req(porta, "PUT", f"/api/schedule/{e['id']}", {
            "dia_semana": "quinta"
        })
        assert status == 200
        assert data["dia_semana"] == "quinta"

        _, lista = req(porta, "GET", "/api/schedule")
        assert len(lista) == 1
        assert lista[0]["dia_semana"] == "quinta"

    def test_put_dia_invalido_retorna_422(self, porta):
        cat = self._criar_cat(porta)
        _, e = req(porta, "POST", "/api/schedule", {
            "dia_semana": "segunda", "categoria_id": cat["id"]
        })
        status, data = req(porta, "PUT", f"/api/schedule/{e['id']}", {
            "dia_semana": "feriado"
        })
        assert status == 422

    def test_put_entrada_inexistente_retorna_404(self, porta):
        status, _ = req(porta, "PUT", "/api/schedule/9999", {
            "dia_semana": "segunda"
        })
        assert status == 404