from database import get_db, get_questions_db

def converter_linhas_para_lista(rows):
    return [dict(r) for r in rows]

class RepositorioConfiguracoes:
    @staticmethod
    def obter_todas():
        with get_db() as conn:
            rows = conn.execute("SELECT key, value FROM settings").fetchall()
            return {r["key"]: r["value"] for r in rows}

    @staticmethod
    def salvar_ou_atualizar(dicionario_configuracoes):
        with get_db() as conn:
            for k, v in dicionario_configuracoes.items():
                conn.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?,?)", (k, str(v)))
            conn.commit()
            return RepositorioConfiguracoes.obter_todas()

class RepositorioCategorias:
    @staticmethod
    def listar_todas_as_categorias():
        with get_db() as conn:
            return converter_linhas_para_lista(conn.execute("SELECT * FROM categories ORDER BY nome").fetchall())

    @staticmethod
    def criar(nome, cor):
        with get_db() as conn:
            cur = conn.execute("INSERT INTO categories (nome, cor) VALUES (?,?)", (nome, cor))
            conn.commit()
            row = conn.execute("SELECT * FROM categories WHERE id=?", (cur.lastrowid,)).fetchone()
            return dict(row)

    @staticmethod
    def atualizar(cid, nome, cor):
        with get_db() as conn:
            conn.execute("UPDATE categories SET nome=?, cor=? WHERE id=?", (nome, cor, cid))
            conn.commit()
            row = conn.execute("SELECT * FROM categories WHERE id=?", (cid,)).fetchone()
            return dict(row) if row else {}

    @staticmethod
    def deletar(cid):
        with get_db() as conn:
            conn.execute("DELETE FROM categories WHERE id=?", (cid,))
            conn.commit()
            return {"ok": True}

class RepositorioSessoes:
    @staticmethod
    def obter_filtradas(periodo, categoria_id, referencia=None):
        referencia = referencia or "now"
        lista_de_filtros = ["s.fim IS NOT NULL"]
        parametros = []

        if periodo == "today":
            if referencia == "now":
                lista_de_filtros.append("date(s.inicio, 'localtime') = date('now', 'localtime')")
            else:
                lista_de_filtros.append("date(s.inicio, 'localtime') = date(?)")
                parametros.append(referencia)
        elif periodo == "week":
            lista_de_filtros.append("datetime(s.inicio, 'localtime') >= datetime(?, 'weekday 0', '-6 days')")
            lista_de_filtros.append("datetime(s.inicio, 'localtime') < datetime(?, 'weekday 0', '+1 day')")
            parametros.extend([referencia, referencia])
        elif periodo == "month":
            lista_de_filtros.append("datetime(s.inicio, 'localtime') >= datetime(?, 'start of month')")
            lista_de_filtros.append("datetime(s.inicio, 'localtime') < datetime(?, 'start of month', '+1 month')")
            parametros.extend([referencia, referencia])
        elif periodo in ["6months", "year"]:
            mapeamento = {"6months": "-6 months", "year": "-1 year"}
            lista_de_filtros.append(f"datetime(s.inicio, 'localtime') >= datetime('now', 'localtime', '{mapeamento[periodo]}')")

        if categoria_id:
            lista_de_filtros.append("s.categoria_id = ?")
            parametros.append(categoria_id)

        sql = f"""
            SELECT s.*, c.nome as categoria_nome, c.cor as categoria_cor
            FROM sessions s
            LEFT JOIN categories c ON s.categoria_id = c.id
            WHERE {' AND '.join(lista_de_filtros)}
            ORDER BY s.id DESC
        """
        with get_db() as conn:
            return converter_linhas_para_lista(conn.execute(sql, parametros).fetchall())

    @staticmethod
    def obter_dados_grafico(periodo, categoria_id, referencia=None):
        referencia = referencia or "now"
        lista_de_filtros = ["s.fim IS NOT NULL"]
        parametros = []

        if periodo == "today":
            if referencia == "now":
                lista_de_filtros.append("date(s.inicio, 'localtime') = date('now', 'localtime')")
            else:
                lista_de_filtros.append("date(s.inicio, 'localtime') = date(?)")
                parametros.append(referencia)
            formato_data = "%Y-%m-%d"

        elif periodo == "week":
            lista_de_filtros.append("datetime(s.inicio, 'localtime') >= datetime(?, 'weekday 0', '-6 days')")
            lista_de_filtros.append("datetime(s.inicio, 'localtime') < datetime(?, 'weekday 0', '+1 day')")
            parametros.extend([referencia, referencia])
            formato_data = "%Y-%m-%d"

        elif periodo == "month":
            lista_de_filtros.append("datetime(s.inicio, 'localtime') >= datetime(?, 'start of month')")
            lista_de_filtros.append("datetime(s.inicio, 'localtime') < datetime(?, 'start of month', '+1 month')")
            parametros.extend([referencia, referencia])
            formato_data = "%Y-%W"

        elif periodo == "6months":
            lista_de_filtros.append("datetime(s.inicio, 'localtime') >= datetime('now', 'localtime', '-6 months')")
            formato_data = "%Y-%m"

        elif periodo == "year":
            lista_de_filtros.append("datetime(s.inicio, 'localtime') >= datetime('now', 'localtime', '-1 year')")
            formato_data = "%Y-%m"

        else:
            formato_data = "%Y-%m"

        if categoria_id:
            lista_de_filtros.append("s.categoria_id = ?")
            parametros.append(categoria_id)

        sql = f"""
            SELECT strftime('{formato_data}', s.inicio, 'localtime') as period_key,
                   c.nome as categoria_nome, c.cor as categoria_cor,
                   SUM(s.duracao) as total_seconds
            FROM sessions s
            LEFT JOIN categories c ON s.categoria_id = c.id
            WHERE {' AND '.join(lista_de_filtros)}
            GROUP BY period_key, s.categoria_id
            ORDER BY period_key
        """
        with get_db() as conn:
            return converter_linhas_para_lista(conn.execute(sql, parametros).fetchall())

    @staticmethod
    def obter_estatisticas(periodo, referencia=None):
        referencia = referencia or "now"
        lista_de_filtros = ["fim IS NOT NULL"]
        parametros = []

        if periodo == "today":
            if referencia == "now":
                lista_de_filtros.append("date(inicio, 'localtime') = date('now', 'localtime')")
            else:
                lista_de_filtros.append("date(inicio, 'localtime') = date(?)")
                parametros.append(referencia)
        elif periodo == "week":
            lista_de_filtros.append("datetime(inicio, 'localtime') >= datetime(?, 'weekday 0', '-6 days')")
            lista_de_filtros.append("datetime(inicio, 'localtime') < datetime(?, 'weekday 0', '+1 day')")
            parametros.extend([referencia, referencia])
        elif periodo == "month":
            lista_de_filtros.append("datetime(inicio, 'localtime') >= datetime(?, 'start of month')")
            lista_de_filtros.append("datetime(inicio, 'localtime') < datetime(?, 'start of month', '+1 month')")
            parametros.extend([referencia, referencia])
        elif periodo == "6months":
            lista_de_filtros.append("datetime(inicio, 'localtime') >= datetime('now', 'localtime', '-6 months')")
        elif periodo == "year":
            lista_de_filtros.append("datetime(inicio, 'localtime') >= datetime('now', 'localtime', '-1 year')")

        clausula_where = " AND ".join(lista_de_filtros)
        with get_db() as conn:
            total = conn.execute(f"SELECT COALESCE(SUM(duracao), 0) as t FROM sessions WHERE {clausula_where}", parametros).fetchone()["t"]
            count = conn.execute(f"SELECT COUNT(*) as c FROM sessions WHERE {clausula_where}", parametros).fetchone()["c"]
            return {"total_segundos": total, "total_sessoes": count}

    @staticmethod
    def obter_segundos_por_dia(data_inicial):
        """Total de segundos estudados em cada dia (data local), a partir de data_inicial."""
        with get_db() as conn:
            rows = conn.execute("""
                SELECT date(inicio, 'localtime') AS dia, SUM(duracao) AS total
                FROM sessions
                WHERE fim IS NOT NULL AND date(inicio, 'localtime') >= date(?)
                GROUP BY dia
                ORDER BY dia
            """, (data_inicial,)).fetchall()
            return {r["dia"]: (r["total"] or 0) for r in rows}

    @staticmethod
    def iniciar(categoria_id, inicio_iso, nota):
        with get_db() as conn:
            cur = conn.execute(
                "INSERT INTO sessions (categoria_id, inicio, nota) VALUES (?,?,?)",
                (categoria_id, inicio_iso, nota)
            )
            conn.commit()
            row = conn.execute("SELECT * FROM sessions WHERE id=?", (cur.lastrowid,)).fetchone()
            return dict(row)

    @staticmethod
    def parar(sessao_id, fim_iso, funcao_calcular_duracao, duracao_override=None):
        with get_db() as conn:
            row = conn.execute("SELECT * FROM sessions WHERE id=?", (sessao_id,)).fetchone()
            if not row:
                return None

            duracao = (
                duracao_override
                if duracao_override is not None
                else funcao_calcular_duracao(row["inicio"], fim_iso)
            )
            conn.execute(
                "UPDATE sessions SET fim=?, duracao=? WHERE id=?",
                (fim_iso, duracao, sessao_id)
            )
            conn.commit()
            return dict(conn.execute("SELECT * FROM sessions WHERE id=?", (sessao_id,)).fetchone())

    @staticmethod
    def atualizar(sessao_id, categoria_id, inicio_iso, fim_iso, nota, funcao_calcular_duracao):
        with get_db() as conn:
            row = conn.execute("SELECT * FROM sessions WHERE id=?", (sessao_id,)).fetchone()
            if not row:
                return None
            duracao = funcao_calcular_duracao(inicio_iso, fim_iso)
            conn.execute(
                "UPDATE sessions SET categoria_id=?, inicio=?, fim=?, duracao=?, nota=? WHERE id=?",
                (categoria_id, inicio_iso, fim_iso, duracao, nota, sessao_id)
            )
            conn.commit()
            return dict(conn.execute("SELECT * FROM sessions WHERE id=?", (sessao_id,)).fetchone())

    @staticmethod
    def deletar(sid):
        with get_db() as conn:
            conn.execute("DELETE FROM sessions WHERE id=?", (sid,))
            conn.commit()
            return {"ok": True}

    @staticmethod
    def criar_manual(categoria_id, inicio_iso, fim_iso, nota, funcao_calcular_duracao):
        duracao = funcao_calcular_duracao(inicio_iso, fim_iso)
        with get_db() as conn:
            cur = conn.execute(
                "INSERT INTO sessions (categoria_id, inicio, fim, duracao, nota) VALUES (?,?,?,?,?)",
                (categoria_id, inicio_iso, fim_iso, duracao, nota)
            )
            conn.commit()
            row = conn.execute("SELECT * FROM sessions WHERE id=?", (cur.lastrowid,)).fetchone()
            return dict(row)

    @staticmethod
    def fechar_sessoes_abertas(fim_iso, funcao_calcular_duracao):
        """Fecha toda sessão com fim IS NULL (em andamento), preenchendo fim/duração.
        Usado como rede de segurança quando o servidor é desligado (Ctrl+C, fechar
        o terminal, etc) com um timer rodando — sem isso, a sessão ficaria aberta
        pra sempre, sem contar em lugar nenhum."""
        with get_db() as conn:
            abertas = conn.execute("SELECT * FROM sessions WHERE fim IS NULL").fetchall()
            for row in abertas:
                duracao = funcao_calcular_duracao(row["inicio"], fim_iso)
                conn.execute(
                    "UPDATE sessions SET fim=?, duracao=? WHERE id=?",
                    (fim_iso, duracao, row["id"])
                )
            conn.commit()
            return len(abertas)
class RepositorioTarefas:
    @staticmethod
    def listar(status="todo"):
        with get_db() as conn:
            rows = conn.execute("""
                SELECT t.*, c.nome as categoria_nome, c.cor as categoria_cor
                FROM tasks t
                LEFT JOIN categories c ON t.categoria_id = c.id
                WHERE t.status = ?
                ORDER BY t.criada_em ASC
            """, (status,)).fetchall()
            return converter_linhas_para_lista(rows)

    @staticmethod
    def listar_concluidas():
        with get_db() as conn:
            rows = conn.execute("""
                SELECT t.*, c.nome as categoria_nome, c.cor as categoria_cor
                FROM tasks t
                LEFT JOIN categories c ON t.categoria_id = c.id
                WHERE t.status = 'done'
                ORDER BY t.concluida_em DESC
            """).fetchall()
            return converter_linhas_para_lista(rows)

    @staticmethod
    def criar(titulo, categoria_id, nota=""):
        with get_db() as conn:
            cur = conn.execute(
                "INSERT INTO tasks (titulo, categoria_id, nota) VALUES (?,?,?)",
                (titulo, categoria_id, nota)
            )
            conn.commit()
            row = conn.execute("""
                SELECT t.*, c.nome as categoria_nome, c.cor as categoria_cor
                FROM tasks t LEFT JOIN categories c ON t.categoria_id = c.id
                WHERE t.id=?
            """, (cur.lastrowid,)).fetchone()
            return dict(row)

    @staticmethod
    def atualizar(tid, titulo, categoria_id, nota):
        with get_db() as conn:
            existe = conn.execute("SELECT id FROM tasks WHERE id=?", (tid,)).fetchone()
            if not existe:
                return None
            conn.execute(
                "UPDATE tasks SET titulo=?, categoria_id=?, nota=? WHERE id=?",
                (titulo, categoria_id, nota, tid)
            )
            conn.commit()
            row = conn.execute("""
                SELECT t.*, c.nome as categoria_nome, c.cor as categoria_cor
                FROM tasks t LEFT JOIN categories c ON t.categoria_id = c.id
                WHERE t.id=?
            """, (tid,)).fetchone()
            return dict(row)

    @staticmethod
    def deletar(tid):
        with get_db() as conn:
            conn.execute("DELETE FROM tasks WHERE id=?", (tid,))
            conn.commit()
            return {"ok": True}

    @staticmethod
    def completar(tid, concluida_em_iso):
        with get_db() as conn:
            existe = conn.execute("SELECT id FROM tasks WHERE id=?", (tid,)).fetchone()
            if not existe:
                return None
            conn.execute(
                "UPDATE tasks SET status='done', concluida_em=? WHERE id=?",
                (concluida_em_iso, tid)
            )
            conn.commit()
            row = conn.execute("""
                SELECT t.*, c.nome as categoria_nome, c.cor as categoria_cor
                FROM tasks t LEFT JOIN categories c ON t.categoria_id = c.id
                WHERE t.id=?
            """, (tid,)).fetchone()
            return dict(row)

    @staticmethod
    def reabrir(tid):
        with get_db() as conn:
            existe = conn.execute("SELECT id FROM tasks WHERE id=?", (tid,)).fetchone()
            if not existe:
                return None
            conn.execute(
                "UPDATE tasks SET status='todo', concluida_em=NULL WHERE id=?",
                (tid,)
            )
            conn.commit()
            row = conn.execute("""
                SELECT t.*, c.nome as categoria_nome, c.cor as categoria_cor
                FROM tasks t LEFT JOIN categories c ON t.categoria_id = c.id
                WHERE t.id=?
            """, (tid,)).fetchone()
            return dict(row)
class RepositorioCronograma:
    DIAS = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo']

    @staticmethod
    def listar():
        with get_db() as conn:
            rows = conn.execute("""
                SELECT s.*, c.nome as categoria_nome, c.cor as categoria_cor
                FROM schedule s
                LEFT JOIN categories c ON s.categoria_id = c.id
                ORDER BY s.dia_semana, s.ordem, s.id
            """).fetchall()
            return converter_linhas_para_lista(rows)

    @staticmethod
    def adicionar(dia_semana, categoria_id):
        with get_db() as conn:
            max_ordem = conn.execute(
                "SELECT COALESCE(MAX(ordem), -1) as m FROM schedule WHERE dia_semana=?",
                (dia_semana,)
            ).fetchone()["m"]
            cur = conn.execute(
                "INSERT INTO schedule (dia_semana, categoria_id, ordem) VALUES (?,?,?)",
                (dia_semana, categoria_id, max_ordem + 1)
            )
            conn.commit()
            row = conn.execute("""
                SELECT s.*, c.nome as categoria_nome, c.cor as categoria_cor
                FROM schedule s LEFT JOIN categories c ON s.categoria_id = c.id
                WHERE s.id=?
            """, (cur.lastrowid,)).fetchone()
            return dict(row)

    @staticmethod
    def remover(entry_id):
        with get_db() as conn:
            conn.execute("DELETE FROM schedule WHERE id=?", (entry_id,))
            conn.commit()
            return {"ok": True}

    @staticmethod
    def mover(entry_id, novo_dia):
        with get_db() as conn:
            existe = conn.execute("SELECT id FROM schedule WHERE id=?", (entry_id,)).fetchone()
            if not existe:
                return None

            max_ordem = conn.execute(
                "SELECT COALESCE(MAX(ordem), -1) as m FROM schedule WHERE dia_semana=?",
                (novo_dia,)
            ).fetchone()["m"]

            conn.execute(
                "UPDATE schedule SET dia_semana=?, ordem=? WHERE id=?",
                (novo_dia, max_ordem + 1, entry_id)
            )
            conn.commit()
            row = conn.execute("""
                SELECT s.*, c.nome as categoria_nome, c.cor as categoria_cor
                FROM schedule s LEFT JOIN categories c ON s.categoria_id = c.id
                WHERE s.id=?
            """, (entry_id,)).fetchone()
            return dict(row)


class RepositorioQuestoes:
    """Caderno de questões (arquivo próprio — ver database.py)."""

    _SELECT = """
        SELECT q.*,
               (SELECT COUNT(*) FROM question_attempts a WHERE a.question_id = q.id) AS tentativas,
               (SELECT COALESCE(SUM(a.acertou), 0) FROM question_attempts a WHERE a.question_id = q.id) AS acertos,
               (SELECT a.acertou FROM question_attempts a WHERE a.question_id = q.id ORDER BY a.id DESC LIMIT 1) AS ultima_acertou
        FROM questions q
    """

    @staticmethod
    def listar():
        with get_questions_db() as conn:
            rows = conn.execute(RepositorioQuestoes._SELECT + " ORDER BY q.id DESC").fetchall()
            return converter_linhas_para_lista(rows)

    @staticmethod
    def obter(qid):
        with get_questions_db() as conn:
            row = conn.execute(RepositorioQuestoes._SELECT + " WHERE q.id = ?", (qid,)).fetchone()
            return dict(row) if row else None

    @staticmethod
    def criar(*, materia_nome, materia_cor, assunto, banca, tipo, enunciado, alternativas_json, gabarito, justificativa):
        with get_questions_db() as conn:
            cur = conn.execute(
                "INSERT INTO questions (materia_nome, materia_cor, assunto, banca, tipo, enunciado, alternativas, gabarito, justificativa)"
                " VALUES (?,?,?,?,?,?,?,?,?)",
                (materia_nome, materia_cor, assunto, banca, tipo, enunciado, alternativas_json, gabarito, justificativa)
            )
            conn.commit()
            novo_id = cur.lastrowid
        return RepositorioQuestoes.obter(novo_id)

    @staticmethod
    def atualizar(qid, *, materia_nome, materia_cor, assunto, banca, tipo, enunciado, alternativas_json, gabarito, justificativa):
        with get_questions_db() as conn:
            if not conn.execute("SELECT 1 FROM questions WHERE id = ?", (qid,)).fetchone():
                return None
            conn.execute(
                "UPDATE questions SET materia_nome=?, materia_cor=?, assunto=?, banca=?, tipo=?, enunciado=?,"
                " alternativas=?, gabarito=?, justificativa=? WHERE id=?",
                (materia_nome, materia_cor, assunto, banca, tipo, enunciado, alternativas_json, gabarito, justificativa, qid)
            )
            conn.commit()
        return RepositorioQuestoes.obter(qid)

    @staticmethod
    def deletar(qid):
        with get_questions_db() as conn:
            conn.execute("DELETE FROM questions WHERE id = ?", (qid,))
            conn.commit()
            return {"ok": True}

    @staticmethod
    def registrar_tentativa(qid, resposta, acertou):
        with get_questions_db() as conn:
            conn.execute(
                "INSERT INTO question_attempts (question_id, resposta, acertou) VALUES (?,?,?)",
                (qid, resposta, acertou)
            )
            conn.commit()
