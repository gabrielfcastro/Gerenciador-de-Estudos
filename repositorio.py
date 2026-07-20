from database import get_db

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
    def obter_filtradas(periodo, categoria_id):
        lista_de_filtros = ["s.fim IS NOT NULL"]
        parametros = []

        if periodo == "today":
            lista_de_filtros.append("date(s.inicio) = date('now')")
        elif periodo == "week":
            # Semana de calendário: segunda-feira 00:00 até domingo 23:59
            lista_de_filtros.append("s.inicio >= datetime('now', 'weekday 0', '-6 days')")
            lista_de_filtros.append("s.inicio < datetime('now', 'weekday 0', '+1 day')")
        elif periodo == "month":
            # Mês de calendário: dia 1 até o último dia do mês atual
            lista_de_filtros.append("s.inicio >= datetime('now', 'start of month')")
            lista_de_filtros.append("s.inicio < datetime('now', 'start of month', '+1 month')")
        elif periodo in ["6months", "year"]:
            mapeamento = {"6months": "-6 months", "year": "-1 year"}
            lista_de_filtros.append(f"s.inicio >= datetime('now', '{mapeamento[periodo]}')")

        if categoria_id:
            lista_de_filtros.append("s.categoria_id = ?")
            parametros.append(categoria_id)

        sql = f"""
            SELECT s.*, c.nome as categoria_nome, c.cor as categoria_cor
            FROM sessions s
            LEFT JOIN categories c ON s.categoria_id = c.id
            WHERE {' AND '.join(lista_de_filtros)}
            ORDER BY s.inicio DESC
        """
        with get_db() as conn:
            return converter_linhas_para_lista(conn.execute(sql, parametros).fetchall())

    @staticmethod
    def obter_dados_grafico(periodo, categoria_id):
        lista_de_filtros = ["s.fim IS NOT NULL"]
        parametros = []

        if periodo == "today":
            lista_de_filtros.append("date(s.inicio) = date('now')")
            formato_data = "%Y-%m-%d"

        elif periodo == "week":
            # Segunda-feira da semana atual até domingo
            lista_de_filtros.append("s.inicio >= datetime('now', 'weekday 0', '-6 days')")
            lista_de_filtros.append("s.inicio < datetime('now', 'weekday 0', '+1 day')")
            formato_data = "%Y-%m-%d"  # uma barra por dia (seg a dom)

        elif periodo == "month":
            # Mês de calendário, agrupado por semana (segunda-feira de cada semana)
            lista_de_filtros.append("s.inicio >= datetime('now', 'start of month')")
            lista_de_filtros.append("s.inicio < datetime('now', 'start of month', '+1 month')")
            formato_data = "%Y-%W"     # agrupa por número da semana do ano

        elif periodo == "6months":
            lista_de_filtros.append("s.inicio >= datetime('now', '-6 months')")
            formato_data = "%Y-%m"

        elif periodo == "year":
            lista_de_filtros.append("s.inicio >= datetime('now', '-1 year')")
            formato_data = "%Y-%m"

        else:  # all
            formato_data = "%Y-%m"

        if categoria_id:
            lista_de_filtros.append("s.categoria_id = ?")
            parametros.append(categoria_id)

        sql = f"""
            SELECT strftime('{formato_data}', s.inicio) as period_key,
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
    def obter_estatisticas(periodo):
        lista_de_filtros = ["fim IS NOT NULL"]
        if periodo == "today":
            lista_de_filtros.append("date(inicio) = date('now')")
        elif periodo == "week":
            lista_de_filtros.append("inicio >= datetime('now', 'weekday 0', '-6 days')")
            lista_de_filtros.append("inicio < datetime('now', 'weekday 0', '+1 day')")
        elif periodo == "month":
            lista_de_filtros.append("inicio >= datetime('now', 'start of month')")
            lista_de_filtros.append("inicio < datetime('now', 'start of month', '+1 month')")
        elif periodo == "6months":
            lista_de_filtros.append("inicio >= datetime('now', '-6 months')")
        elif periodo == "year":
            lista_de_filtros.append("inicio >= datetime('now', '-1 year')")

        clausula_where = " AND ".join(lista_de_filtros)
        with get_db() as conn:
            total = conn.execute(f"SELECT COALESCE(SUM(duracao), 0) as t FROM sessions WHERE {clausula_where}").fetchone()["t"]
            count = conn.execute(f"SELECT COUNT(*) as c FROM sessions WHERE {clausula_where}").fetchone()["c"]
            return {"total_segundos": total, "total_sessoes": count}

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
    def parar(sessao_id, fim_iso, funcao_calcular_duracao):
        with get_db() as conn:
            row = conn.execute("SELECT * FROM sessions WHERE id=?", (sessao_id,)).fetchone()
            if not row:
                return None

            duracao = funcao_calcular_duracao(row["inicio"], fim_iso)
            conn.execute(
                "UPDATE sessions SET fim=?, duracao=? WHERE id=?",
                (fim_iso, duracao, sessao_id)
            )
            conn.commit()
            return dict(conn.execute("SELECT * FROM sessions WHERE id=?", (sessao_id,)).fetchone())

    @staticmethod
    def atualizar(sessao_id, categoria_id, inicio_iso, fim_iso, nota, funcao_calcular_duracao):
        with get_db() as conn:
            duracao = funcao_calcular_duracao(inicio_iso, fim_iso)
            conn.execute(
                "UPDATE sessions SET categoria_id=?, inicio=?, fim=?, duracao=?, nota=? WHERE id=?",
                (categoria_id, inicio_iso, fim_iso, duracao, nota, sessao_id)
            )
            conn.commit()
            row = conn.execute("SELECT * FROM sessions WHERE id=?", (sessao_id,)).fetchone()
            return dict(row) if row else None

    @staticmethod
    def deletar(sid):
        with get_db() as conn:
            conn.execute("DELETE FROM sessions WHERE id=?", (sid,))
            conn.commit()
            return {"ok": True}