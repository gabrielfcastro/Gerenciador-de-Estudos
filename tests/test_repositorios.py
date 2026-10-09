import pytest
import time
from conftest import now_iso, calc_duracao


@pytest.fixture(autouse=True)
def banco_de_teste(tmp_path, monkeypatch):
    import database
    db_temp = str(tmp_path / "test.db")
    monkeypatch.setattr(database, "db_path", db_temp)
    database.init_db()
    yield db_temp

class TestConfiguracoes:

    def test_valor_padrao_do_bloco(self):
        from repositorio import RepositorioConfiguracoes
        cfg = RepositorioConfiguracoes.obter_todas()
        assert "duracao_do_bloco" in cfg
        assert cfg["duracao_do_bloco"] == "4500"

    def test_salvar_e_recuperar(self):
        from repositorio import RepositorioConfiguracoes
        RepositorioConfiguracoes.salvar_ou_atualizar({"duracao_do_bloco": "3600"})
        cfg = RepositorioConfiguracoes.obter_todas()
        assert cfg["duracao_do_bloco"] == "3600"

    def test_salvar_multiplas_chaves(self):
        from repositorio import RepositorioConfiguracoes
        RepositorioConfiguracoes.salvar_ou_atualizar({"chave_a": "1", "chave_b": "2"})
        cfg = RepositorioConfiguracoes.obter_todas()
        assert cfg["chave_a"] == "1"
        assert cfg["chave_b"] == "2"

    def test_sobrescrever_valor_existente(self):
        from repositorio import RepositorioConfiguracoes
        RepositorioConfiguracoes.salvar_ou_atualizar({"duracao_do_bloco": "1800"})
        RepositorioConfiguracoes.salvar_ou_atualizar({"duracao_do_bloco": "9000"})
        cfg = RepositorioConfiguracoes.obter_todas()
        assert cfg["duracao_do_bloco"] == "9000"

class TestCategorias:

    def test_criar_retorna_dados_corretos(self):
        from repositorio import RepositorioCategorias
        cat = RepositorioCategorias.criar("Matemática", "#ff0000")
        assert cat["nome"] == "Matemática"
        assert cat["cor"] == "#ff0000"
        assert isinstance(cat["id"], int)

    def test_listar_vazio(self):
        from repositorio import RepositorioCategorias
        assert RepositorioCategorias.listar_todas_as_categorias() == []

    def test_listar_ordenado_por_nome(self):
        from repositorio import RepositorioCategorias
        RepositorioCategorias.criar("Zebra", "#000")
        RepositorioCategorias.criar("Abacate", "#111")
        cats = RepositorioCategorias.listar_todas_as_categorias()
        assert cats[0]["nome"] == "Abacate"
        assert cats[1]["nome"] == "Zebra"

    def test_atualizar_nome_e_cor(self):
        from repositorio import RepositorioCategorias
        cat = RepositorioCategorias.criar("Original", "#000000")
        res = RepositorioCategorias.atualizar(cat["id"], "Editado", "#ffffff")
        assert res["nome"] == "Editado"
        assert res["cor"] == "#ffffff"

    def test_atualizar_inexistente_retorna_vazio(self):
        from repositorio import RepositorioCategorias
        res = RepositorioCategorias.atualizar(9999, "X", "#000")
        assert res == {}

    def test_deletar(self):
        from repositorio import RepositorioCategorias
        cat = RepositorioCategorias.criar("Temp", "#abc")
        RepositorioCategorias.deletar(cat["id"])
        assert RepositorioCategorias.listar_todas_as_categorias() == []

    def test_deletar_inexistente_nao_levanta_excecao(self):
        from repositorio import RepositorioCategorias
        RepositorioCategorias.deletar(9999)  # não deve lançar erro

class TestSessoes:

    def _criar_sessao_completa(self, cat_id=None, nota=""):
        from repositorio import RepositorioSessoes
        s = RepositorioSessoes.iniciar(cat_id, now_iso(), nota)
        return RepositorioSessoes.parar(s["id"], now_iso(), calc_duracao)

    def test_iniciar_cria_sessao_sem_fim(self):
        from repositorio import RepositorioSessoes
        s = RepositorioSessoes.iniciar(None, now_iso(), "nota")
        assert s["id"] is not None
        assert s["fim"] is None
        assert s["nota"] == "nota"

    # ── fechar_sessoes_abertas (rede de segurança ao desligar o servidor) ──

    def test_fechar_sessoes_abertas_preenche_fim_e_duracao(self):
        from repositorio import RepositorioSessoes
        s = RepositorioSessoes.iniciar(None, "2026-01-01T08:00:00+00:00", "")
        qtd = RepositorioSessoes.fechar_sessoes_abertas("2026-01-01T08:45:00+00:00", calc_duracao)
        assert qtd == 1

        sessoes = RepositorioSessoes.obter_filtradas("all", None)
        assert sessoes[0]["fim"] is not None
        assert sessoes[0]["duracao"] == 2700

    def test_fechar_sessoes_abertas_nao_mexe_em_sessao_ja_encerrada(self):
        from repositorio import RepositorioSessoes
        s = RepositorioSessoes.iniciar(None, "2026-01-01T08:00:00+00:00", "")
        RepositorioSessoes.parar(s["id"], "2026-01-01T08:30:00+00:00", calc_duracao)

        qtd = RepositorioSessoes.fechar_sessoes_abertas("2026-01-01T09:00:00+00:00", calc_duracao)
        assert qtd == 0  # já estava fechada, não deveria contar nem alterar

        sessoes = RepositorioSessoes.obter_filtradas("all", None)
        assert sessoes[0]["duracao"] == 1800  # continua com a duração original

    def test_fechar_sessoes_abertas_sem_nenhuma_aberta_retorna_zero(self):
        from repositorio import RepositorioSessoes
        assert RepositorioSessoes.fechar_sessoes_abertas(now_iso(), calc_duracao) == 0

    def test_fechar_sessoes_abertas_fecha_todas_se_houver_mais_de_uma(self):
        from repositorio import RepositorioSessoes
        RepositorioSessoes.iniciar(None, "2026-01-01T08:00:00+00:00", "")
        RepositorioSessoes.iniciar(None, "2026-01-01T09:00:00+00:00", "")

        qtd = RepositorioSessoes.fechar_sessoes_abertas("2026-01-01T10:00:00+00:00", calc_duracao)
        assert qtd == 2

        sessoes = RepositorioSessoes.obter_filtradas("all", None)
        assert all(s["fim"] is not None for s in sessoes)

    def test_parar_registra_duracao(self):
        from repositorio import RepositorioSessoes
        inicio = "2026-01-01T08:00:00+00:00"
        fim    = "2026-01-01T09:30:00+00:00"
        s = RepositorioSessoes.iniciar(None, inicio, "")
        res = RepositorioSessoes.parar(s["id"], fim, calc_duracao)
        assert res is not None
        assert res["duracao"] == 5400
        assert res["fim"] is not None

    def test_parar_com_duracao_real_excluindo_pausas(self):
        from repositorio import RepositorioSessoes
        inicio = "2026-01-01T08:00:00+00:00"
        fim    = "2026-01-01T09:30:00+00:00"
        s = RepositorioSessoes.iniciar(None, inicio, "")
        duracao_real = 3000
        res = RepositorioSessoes.parar(s["id"], fim, calc_duracao, duracao_real)
        assert res is not None
        assert res["duracao"] == 3000

    def test_parar_sessao_inexistente_retorna_none(self):
        from repositorio import RepositorioSessoes
        res = RepositorioSessoes.parar(9999, now_iso(), calc_duracao)
        assert res is None

    def test_sessao_nao_finalizada_nao_aparece_na_lista(self):
        from repositorio import RepositorioSessoes
        RepositorioSessoes.iniciar(None, now_iso(), "")
        resultado = RepositorioSessoes.obter_filtradas("all", None)
        assert resultado == []

    def test_obter_filtradas_all(self):
        from repositorio import RepositorioSessoes
        self._criar_sessao_completa()
        self._criar_sessao_completa()
        resultado = RepositorioSessoes.obter_filtradas("all", None)
        assert len(resultado) == 2

    def test_obter_filtradas_hoje(self):
        from repositorio import RepositorioSessoes
        self._criar_sessao_completa()
        resultado = RepositorioSessoes.obter_filtradas("today", None)
        assert len(resultado) == 1

    def test_obter_filtradas_por_categoria(self):
        from repositorio import RepositorioSessoes, RepositorioCategorias
        cat = RepositorioCategorias.criar("Dir", "#7c6ff7")
        self._criar_sessao_completa(cat_id=cat["id"])
        self._criar_sessao_completa(cat_id=None)
        resultado = RepositorioSessoes.obter_filtradas("all", cat["id"])
        assert len(resultado) == 1
        assert resultado[0]["categoria_id"] == cat["id"]

    def test_estatisticas_contagem_e_total(self):
        from repositorio import RepositorioSessoes
        inicio = "2026-01-01T08:00:00+00:00"
        fim    = "2026-01-01T09:00:00+00:00"
        s = RepositorioSessoes.iniciar(None, inicio, "")
        RepositorioSessoes.parar(s["id"], fim, calc_duracao)
        stats = RepositorioSessoes.obter_estatisticas("all")
        assert stats["total_sessoes"] == 1
        assert stats["total_segundos"] == 3600

    def test_estatisticas_sem_sessoes(self):
        from repositorio import RepositorioSessoes
        stats = RepositorioSessoes.obter_estatisticas("all")
        assert stats["total_sessoes"] == 0
        assert stats["total_segundos"] == 0

    def test_atualizar_corrige_duracao(self):
        from repositorio import RepositorioSessoes
        s = self._criar_sessao_completa()
        novo_inicio = "2026-01-01T08:00:00+00:00"
        novo_fim    = "2026-01-01T10:00:00+00:00"
        res = RepositorioSessoes.atualizar(
            s["id"], None, novo_inicio, novo_fim, "editado", calc_duracao
        )
        assert res is not None
        assert res["duracao"] == 7200
        assert res["nota"] == "editado"

    def test_atualizar_inexistente_retorna_none(self):
        from repositorio import RepositorioSessoes
        res = RepositorioSessoes.atualizar(
            9999, None,
            "2026-01-01T08:00:00+00:00",
            "2026-01-01T09:00:00+00:00",
            "", calc_duracao
        )
        assert res is None

    def test_deletar(self):
        from repositorio import RepositorioSessoes
        self._criar_sessao_completa()
        sessoes = RepositorioSessoes.obter_filtradas("all", None)
        RepositorioSessoes.deletar(sessoes[0]["id"])
        assert RepositorioSessoes.obter_filtradas("all", None) == []

    def test_dados_grafico_retorna_period_key(self):
        from repositorio import RepositorioSessoes
        self._criar_sessao_completa()
        dados = RepositorioSessoes.obter_dados_grafico("all", None)
        assert len(dados) >= 1
        assert "period_key" in dados[0]
        assert "total_seconds" in dados[0]

    # ── criar_manual (entrada manual de horário, tipo Clockify) ──

    def test_criar_manual_cria_sessao_ja_finalizada(self):
        from repositorio import RepositorioSessoes
        inicio = "2026-01-01T08:00:00+00:00"
        fim    = "2026-01-01T09:00:00+00:00"
        s = RepositorioSessoes.criar_manual(None, inicio, fim, "nota manual", calc_duracao)
        assert s["id"] is not None
        assert s["fim"] is not None
        assert s["duracao"] == 3600
        assert s["nota"] == "nota manual"

    def test_criar_manual_com_categoria(self):
        from repositorio import RepositorioSessoes, RepositorioCategorias
        cat = RepositorioCategorias.criar("Dir", "#7c6ff7")
        s = RepositorioSessoes.criar_manual(
            cat["id"], "2026-01-01T08:00:00+00:00", "2026-01-01T09:00:00+00:00", "", calc_duracao
        )
        assert s["categoria_id"] == cat["id"]

    def test_criar_manual_aparece_na_listagem_imediatamente(self):
        from repositorio import RepositorioSessoes
        RepositorioSessoes.criar_manual(
            None, "2026-01-01T08:00:00+00:00", "2026-01-01T09:00:00+00:00", "", calc_duracao
        )
        resultado = RepositorioSessoes.obter_filtradas("all", None)
        assert len(resultado) == 1

    def test_criar_manual_conta_nas_estatisticas(self):
        from repositorio import RepositorioSessoes
        RepositorioSessoes.criar_manual(
            None, "2026-01-01T08:00:00+00:00", "2026-01-01T10:00:00+00:00", "", calc_duracao
        )
        stats = RepositorioSessoes.obter_estatisticas("all")
        assert stats["total_sessoes"] == 1
        assert stats["total_segundos"] == 7200

    # ── novos: navegação por período (referencia) ──

    def _sessao_em(self, inicio_iso, fim_iso, cat_id=None):
        from repositorio import RepositorioSessoes
        s = RepositorioSessoes.iniciar(cat_id, inicio_iso, "")
        return RepositorioSessoes.parar(s["id"], fim_iso, calc_duracao)

    def test_filtradas_today_usa_referencia_em_vez_de_hoje(self):
        from repositorio import RepositorioSessoes
        self._sessao_em("2026-07-10T08:00:00+00:00", "2026-07-10T09:00:00+00:00")
        self._sessao_em("2026-07-15T08:00:00+00:00", "2026-07-15T09:00:00+00:00")

        resultado = RepositorioSessoes.obter_filtradas("today", None, referencia="2026-07-10")
        assert len(resultado) == 1
        assert resultado[0]["inicio"].startswith("2026-07-10")

    def test_filtradas_week_usa_referencia(self):
        from repositorio import RepositorioSessoes
        # segunda 2026-07-13 a domingo 2026-07-19
        self._sessao_em("2026-07-13T08:00:00+00:00", "2026-07-13T09:00:00+00:00")
        self._sessao_em("2026-07-19T20:00:00+00:00", "2026-07-19T21:00:00+00:00")
        # fora da semana (semana seguinte)
        self._sessao_em("2026-07-20T08:00:00+00:00", "2026-07-20T09:00:00+00:00")

        resultado = RepositorioSessoes.obter_filtradas("week", None, referencia="2026-07-15")
        assert len(resultado) == 2

    def test_filtradas_month_usa_referencia(self):
        from repositorio import RepositorioSessoes
        self._sessao_em("2026-06-05T08:00:00+00:00", "2026-06-05T09:00:00+00:00")
        self._sessao_em("2026-07-05T08:00:00+00:00", "2026-07-05T09:00:00+00:00")

        resultado = RepositorioSessoes.obter_filtradas("month", None, referencia="2026-06-15")
        assert len(resultado) == 1
        assert resultado[0]["inicio"].startswith("2026-06")

    def test_filtradas_sem_referencia_mantem_comportamento_atual(self):
        from repositorio import RepositorioSessoes
        self._criar_sessao_completa()
        resultado = RepositorioSessoes.obter_filtradas("today", None)
        assert len(resultado) == 1

    def test_estatisticas_usa_referencia(self):
        from repositorio import RepositorioSessoes
        self._sessao_em("2026-06-05T08:00:00+00:00", "2026-06-05T09:00:00+00:00")
        self._sessao_em("2026-07-05T08:00:00+00:00", "2026-07-05T09:30:00+00:00")

        stats_junho = RepositorioSessoes.obter_estatisticas("month", referencia="2026-06-15")
        assert stats_junho["total_sessoes"] == 1
        assert stats_junho["total_segundos"] == 3600

        stats_julho = RepositorioSessoes.obter_estatisticas("month", referencia="2026-07-15")
        assert stats_julho["total_sessoes"] == 1
        assert stats_julho["total_segundos"] == 5400

    def test_dados_grafico_usa_referencia(self):
        from repositorio import RepositorioSessoes
        self._sessao_em("2026-06-05T08:00:00+00:00", "2026-06-05T09:00:00+00:00")
        self._sessao_em("2026-07-05T08:00:00+00:00", "2026-07-05T09:00:00+00:00")

        dados = RepositorioSessoes.obter_dados_grafico("month", None, referencia="2026-06-15")
        assert len(dados) == 1
        assert dados[0]["total_seconds"] == 3600

    def test_today_com_servidor_em_fuso_negativo_nao_duplica_conversao_de_localtime(self, monkeypatch):
        monkeypatch.setenv("TZ", "America/Sao_Paulo")
        time.tzset()
        try:
            from repositorio import RepositorioSessoes
            self._sessao_em("2026-07-10T22:00:00+00:00", "2026-07-10T23:00:00+00:00")

            resultado_grafico = RepositorioSessoes.obter_dados_grafico("today", None, referencia="2026-07-10")
            resultado_lista   = RepositorioSessoes.obter_filtradas("today", None, referencia="2026-07-10")
            resultado_stats   = RepositorioSessoes.obter_estatisticas("today", referencia="2026-07-10")

            assert len(resultado_grafico) == 1, "gráfico não pode 'perder' a sessão de hoje"
            assert len(resultado_lista) == 1, "lista de sessões não pode 'perder' a sessão de hoje"
            assert resultado_stats["total_sessoes"] == 1, "estatísticas não podem 'perder' a sessão de hoje"
        finally:
            monkeypatch.delenv("TZ", raising=False)
            time.tzset()

class TestSegundosPorDia:
    # horários ao meio-dia UTC pra o dia local ser o mesmo em qualquer fuso razoável

    def _sessao(self, inicio, fim):
        from repositorio import RepositorioSessoes
        return RepositorioSessoes.criar_manual(None, inicio, fim, "", calc_duracao)

    def test_soma_sessoes_do_mesmo_dia(self):
        from repositorio import RepositorioSessoes
        self._sessao("2026-10-05T12:00:00+00:00", "2026-10-05T13:00:00+00:00")
        self._sessao("2026-10-05T15:00:00+00:00", "2026-10-05T15:30:00+00:00")
        res = RepositorioSessoes.obter_segundos_por_dia("2026-10-01")
        assert res == {"2026-10-05": 5400}

    def test_separa_dias_diferentes(self):
        from repositorio import RepositorioSessoes
        self._sessao("2026-10-05T12:00:00+00:00", "2026-10-05T13:00:00+00:00")
        self._sessao("2026-10-06T12:00:00+00:00", "2026-10-06T14:00:00+00:00")
        res = RepositorioSessoes.obter_segundos_por_dia("2026-10-01")
        assert res == {"2026-10-05": 3600, "2026-10-06": 7200}

    def test_ignora_dias_antes_da_data_inicial(self):
        from repositorio import RepositorioSessoes
        self._sessao("2026-09-20T12:00:00+00:00", "2026-09-20T13:00:00+00:00")
        self._sessao("2026-10-05T12:00:00+00:00", "2026-10-05T13:00:00+00:00")
        res = RepositorioSessoes.obter_segundos_por_dia("2026-10-01")
        assert "2026-09-20" not in res and "2026-10-05" in res

    def test_ignora_sessao_em_andamento(self):
        from repositorio import RepositorioSessoes
        RepositorioSessoes.iniciar(None, "2026-10-05T12:00:00+00:00", "")
        assert RepositorioSessoes.obter_segundos_por_dia("2026-10-01") == {}

    def test_sem_sessoes_retorna_vazio(self):
        from repositorio import RepositorioSessoes
        assert RepositorioSessoes.obter_segundos_por_dia("2026-10-01") == {}


class TestTarefas:

    def test_criar_sem_categoria(self):
        from repositorio import RepositorioTarefas
        t = RepositorioTarefas.criar("Estudar capítulo 1", None)
        assert t["titulo"] == "Estudar capítulo 1"
        assert t["categoria_id"] is None
        assert t["status"] == "todo"

    def test_criar_com_categoria(self):
        from repositorio import RepositorioTarefas, RepositorioCategorias
        cat = RepositorioCategorias.criar("TCC", "#green")
        t = RepositorioTarefas.criar("Escrever introdução", cat["id"])
        assert t["categoria_id"] == cat["id"]

    def test_listar_retorna_apenas_todo(self):
        from repositorio import RepositorioTarefas
        RepositorioTarefas.criar("Tarefa 1", None)
        RepositorioTarefas.criar("Tarefa 2", None)
        tarefas = RepositorioTarefas.listar()
        assert len(tarefas) == 2
        assert all(t["status"] == "todo" for t in tarefas)

    def test_listar_vazio(self):
        from repositorio import RepositorioTarefas
        assert RepositorioTarefas.listar() == []

    def test_deletar(self):
        from repositorio import RepositorioTarefas
        t = RepositorioTarefas.criar("Temporária", None)
        RepositorioTarefas.deletar(t["id"])
        assert RepositorioTarefas.listar() == []

    def test_categoria_deletada_nao_remove_tarefa(self):
        from repositorio import RepositorioTarefas, RepositorioCategorias
        cat = RepositorioCategorias.criar("Passageira", "#tmp")
        RepositorioTarefas.criar("Tarefa com categoria", cat["id"])
        RepositorioCategorias.deletar(cat["id"])
        tarefas = RepositorioTarefas.listar()
        assert len(tarefas) == 1
        assert tarefas[0]["categoria_id"] is None

    def test_criar_com_nota(self):
        from repositorio import RepositorioTarefas, RepositorioCategorias
        cat = RepositorioCategorias.criar("Dir", "#7c6ff7")
        t = RepositorioTarefas.criar("Ler capítulo 3", cat["id"], "Focar nos artigos 5 a 12")
        assert t["nota"] == "Focar nos artigos 5 a 12"

    def test_criar_sem_nota_usa_string_vazia(self):
        from repositorio import RepositorioTarefas, RepositorioCategorias
        cat = RepositorioCategorias.criar("Dir", "#7c6ff7")
        t = RepositorioTarefas.criar("Ler capítulo 3", cat["id"])
        assert t["nota"] == ""

    # ── completar / reabrir (não apaga mais, só muda de status) ──

    def test_completar_muda_status_para_done(self):
        from repositorio import RepositorioTarefas
        t = RepositorioTarefas.criar("Estudar", None)
        res = RepositorioTarefas.completar(t["id"], "2026-01-01T10:00:00+00:00")
        assert res["status"] == "done"
        assert res["concluida_em"] == "2026-01-01T10:00:00+00:00"

    def test_completar_some_da_listagem_padrao(self):
        from repositorio import RepositorioTarefas
        t = RepositorioTarefas.criar("Estudar", None)
        RepositorioTarefas.completar(t["id"], "2026-01-01T10:00:00+00:00")
        assert RepositorioTarefas.listar() == []

    def test_completar_tarefa_inexistente_retorna_none(self):
        from repositorio import RepositorioTarefas
        assert RepositorioTarefas.completar(9999, "2026-01-01T10:00:00+00:00") is None

    def test_listar_concluidas_retorna_as_completadas(self):
        from repositorio import RepositorioTarefas
        t1 = RepositorioTarefas.criar("Tarefa 1", None)
        t2 = RepositorioTarefas.criar("Tarefa 2", None)
        RepositorioTarefas.completar(t1["id"], "2026-01-01T10:00:00+00:00")
        concluidas = RepositorioTarefas.listar_concluidas()
        assert len(concluidas) == 1
        assert concluidas[0]["id"] == t1["id"]

    def test_listar_concluidas_ordena_mais_recente_primeiro(self):
        from repositorio import RepositorioTarefas
        t1 = RepositorioTarefas.criar("Primeira concluída", None)
        t2 = RepositorioTarefas.criar("Segunda concluída", None)
        RepositorioTarefas.completar(t1["id"], "2026-01-01T08:00:00+00:00")
        RepositorioTarefas.completar(t2["id"], "2026-01-01T10:00:00+00:00")
        concluidas = RepositorioTarefas.listar_concluidas()
        assert concluidas[0]["id"] == t2["id"]  # a mais recente vem primeiro

    def test_reabrir_volta_pra_todo(self):
        from repositorio import RepositorioTarefas
        t = RepositorioTarefas.criar("Estudar", None)
        RepositorioTarefas.completar(t["id"], "2026-01-01T10:00:00+00:00")
        res = RepositorioTarefas.reabrir(t["id"])
        assert res["status"] == "todo"
        assert res["concluida_em"] is None

    def test_reabrir_volta_a_aparecer_na_listagem_padrao(self):
        from repositorio import RepositorioTarefas
        t = RepositorioTarefas.criar("Estudar", None)
        RepositorioTarefas.completar(t["id"], "2026-01-01T10:00:00+00:00")
        RepositorioTarefas.reabrir(t["id"])
        tarefas = RepositorioTarefas.listar()
        assert len(tarefas) == 1
        assert tarefas[0]["id"] == t["id"]

    def test_reabrir_tarefa_inexistente_retorna_none(self):
        from repositorio import RepositorioTarefas
        assert RepositorioTarefas.reabrir(9999) is None

    def test_criar_traz_nome_e_cor_da_categoria(self):
        from repositorio import RepositorioTarefas, RepositorioCategorias
        cat = RepositorioCategorias.criar("Dir. Penal", "#123456")
        t = RepositorioTarefas.criar("Fazer resumo", cat["id"])
        assert t["categoria_nome"] == "Dir. Penal"
        assert t["categoria_cor"]  == "#123456"

    def test_listar_traz_a_nota(self):
        from repositorio import RepositorioTarefas
        RepositorioTarefas.criar("Com nota", None, "Detalhe importante")
        tarefas = RepositorioTarefas.listar()
        assert tarefas[0]["nota"] == "Detalhe importante"

    def test_atualizar_titulo_categoria_e_nota(self):
        from repositorio import RepositorioTarefas, RepositorioCategorias
        cat1 = RepositorioCategorias.criar("Original", "#111")
        cat2 = RepositorioCategorias.criar("Nova", "#222")
        t = RepositorioTarefas.criar("Título original", cat1["id"], "nota original")

        res = RepositorioTarefas.atualizar(t["id"], "Título editado", cat2["id"], "nota editada")

        assert res["titulo"] == "Título editado"
        assert res["categoria_id"] == cat2["id"]
        assert res["nota"] == "nota editada"
        assert res["categoria_nome"] == "Nova"
        assert res["categoria_cor"]  == "#222"

    def test_atualizar_persiste_no_banco(self):
        from repositorio import RepositorioTarefas
        t = RepositorioTarefas.criar("Antigo", None, "antiga")
        RepositorioTarefas.atualizar(t["id"], "Novo", None, "nova")
        tarefas = RepositorioTarefas.listar()
        assert tarefas[0]["titulo"] == "Novo"
        assert tarefas[0]["nota"]   == "nova"

    def test_atualizar_inexistente_retorna_none(self):
        from repositorio import RepositorioTarefas
        res = RepositorioTarefas.atualizar(9999, "X", None, "")
        assert res is None

class TestCronograma:

    def _cat(self, nome="Matéria", cor="#7c6ff7"):
        from repositorio import RepositorioCategorias
        return RepositorioCategorias.criar(nome, cor)

    def test_adicionar_e_listar(self):
        from repositorio import RepositorioCronograma
        cat = self._cat()
        RepositorioCronograma.adicionar("segunda", cat["id"])
        entries = RepositorioCronograma.listar()
        assert len(entries) == 1
        assert entries[0]["dia_semana"] == "segunda"
        assert entries[0]["categoria_id"] == cat["id"]

    def test_listar_vazio(self):
        from repositorio import RepositorioCronograma
        assert RepositorioCronograma.listar() == []

    def test_multiplas_materias_no_mesmo_dia(self):
        from repositorio import RepositorioCronograma
        cat1 = self._cat("A", "#1")
        cat2 = self._cat("B", "#2")
        RepositorioCronograma.adicionar("terca", cat1["id"])
        RepositorioCronograma.adicionar("terca", cat2["id"])
        entries = RepositorioCronograma.listar()
        assert len(entries) == 2
        assert all(e["dia_semana"] == "terca" for e in entries)

    def test_ordem_incremental_no_mesmo_dia(self):
        from repositorio import RepositorioCronograma
        cat1 = self._cat("Primeiro", "#1")
        cat2 = self._cat("Segundo", "#2")
        e1 = RepositorioCronograma.adicionar("quarta", cat1["id"])
        e2 = RepositorioCronograma.adicionar("quarta", cat2["id"])
        assert e2["ordem"] > e1["ordem"]

    def test_diferentes_dias(self):
        from repositorio import RepositorioCronograma
        cat = self._cat()
        RepositorioCronograma.adicionar("segunda", cat["id"])
        RepositorioCronograma.adicionar("sexta", cat["id"])
        dias = {e["dia_semana"] for e in RepositorioCronograma.listar()}
        assert "segunda" in dias
        assert "sexta" in dias

    def test_remover_entrada(self):
        from repositorio import RepositorioCronograma
        cat = self._cat()
        e = RepositorioCronograma.adicionar("domingo", cat["id"])
        RepositorioCronograma.remover(e["id"])
        assert RepositorioCronograma.listar() == []

    def test_deletar_categoria_remove_entradas_cascade(self):
        from repositorio import RepositorioCronograma, RepositorioCategorias
        cat = self._cat("Passageira", "#tmp")
        RepositorioCronograma.adicionar("quinta", cat["id"])
        RepositorioCategorias.deletar(cat["id"])
        assert RepositorioCronograma.listar() == []

    def test_nome_e_cor_da_categoria_na_listagem(self):
        from repositorio import RepositorioCronograma
        cat = self._cat("Dir. Admin", "#7c6ff7")
        RepositorioCronograma.adicionar("sabado", cat["id"])
        e = RepositorioCronograma.listar()[0]
        assert e["categoria_nome"] == "Dir. Admin"
        assert e["categoria_cor"]  == "#7c6ff7"

    def test_mover_altera_dia_semana(self):
        from repositorio import RepositorioCronograma
        cat = self._cat()
        e = RepositorioCronograma.adicionar("segunda", cat["id"])
        res = RepositorioCronograma.mover(e["id"], "sexta")
        assert res["dia_semana"] == "sexta"
        assert res["id"] == e["id"]

    def test_mover_vai_para_o_fim_do_dia_destino(self):
        from repositorio import RepositorioCronograma
        cat = self._cat()
        e1 = RepositorioCronograma.adicionar("terca", cat["id"])
        e2 = RepositorioCronograma.adicionar("quarta", cat["id"])
        res = RepositorioCronograma.mover(e2["id"], "terca")
        assert res["ordem"] > e1["ordem"]

    def test_mover_preserva_nome_e_cor_da_categoria(self):
        from repositorio import RepositorioCronograma
        cat = self._cat("Dir. Civil", "#123456")
        e = RepositorioCronograma.adicionar("segunda", cat["id"])
        res = RepositorioCronograma.mover(e["id"], "domingo")
        assert res["categoria_nome"] == "Dir. Civil"
        assert res["categoria_cor"]  == "#123456"

    def test_mover_entrada_inexistente_retorna_none(self):
        from repositorio import RepositorioCronograma
        assert RepositorioCronograma.mover(9999, "segunda") is None


class TestQuestoes:

    def _criar(self, **kw):
        from repositorio import RepositorioQuestoes
        dados = dict(materia_nome="Dir. Financeiro", materia_cor="#d4537e", assunto="Restos a pagar", banca="FCC", tipo="ME",
                     enunciado="Qual alternativa está correta?", alternativas_json='["a", "b", "c"]', gabarito="B",
                     justificativa="porque sim")
        dados.update(kw)
        return RepositorioQuestoes.criar(**dados)

    def test_criar_devolve_a_questao_com_estatisticas_zeradas(self):
        q = self._criar()
        assert q["id"] is not None
        assert q["materia_nome"] == "Dir. Financeiro" and q["materia_cor"] == "#d4537e"
        assert q["tipo"] == "ME" and q["gabarito"] == "B"
        assert q["alternativas"] == '["a", "b", "c"]'
        assert q["tentativas"] == 0 and q["acertos"] == 0 and q["ultima_acertou"] is None

    def test_listar_traz_a_mais_recente_primeiro(self):
        from repositorio import RepositorioQuestoes
        a = self._criar(enunciado="primeira")
        b = self._criar(enunciado="segunda")
        assert [q["id"] for q in RepositorioQuestoes.listar()] == [b["id"], a["id"]]

    def test_tentativas_atualizam_as_estatisticas(self):
        from repositorio import RepositorioQuestoes
        q = self._criar()
        RepositorioQuestoes.registrar_tentativa(q["id"], "A", 0)
        RepositorioQuestoes.registrar_tentativa(q["id"], "B", 1)
        atual = RepositorioQuestoes.obter(q["id"])
        assert atual["tentativas"] == 2 and atual["acertos"] == 1

    def test_ultima_tentativa_e_a_mais_recente(self):
        from repositorio import RepositorioQuestoes
        q = self._criar()
        RepositorioQuestoes.registrar_tentativa(q["id"], "B", 1)
        RepositorioQuestoes.registrar_tentativa(q["id"], "A", 0)
        assert RepositorioQuestoes.obter(q["id"])["ultima_acertou"] == 0

    def test_obter_inexistente_retorna_none(self):
        from repositorio import RepositorioQuestoes
        assert RepositorioQuestoes.obter(9999) is None

    def test_atualizar_muda_os_campos_inclusive_a_materia(self):
        from repositorio import RepositorioQuestoes
        q = self._criar()
        novo = RepositorioQuestoes.atualizar(
            q["id"], materia_nome="Contabilidade", materia_cor="#1d9e75", assunto="Outro", banca="FGV", tipo="CE",
            enunciado="Julgue", alternativas_json="[]", gabarito="C", justificativa="j")
        assert novo["materia_nome"] == "Contabilidade" and novo["materia_cor"] == "#1d9e75"
        assert novo["assunto"] == "Outro" and novo["tipo"] == "CE" and novo["gabarito"] == "C"

    def test_atualizar_inexistente_retorna_none(self):
        from repositorio import RepositorioQuestoes
        assert RepositorioQuestoes.atualizar(
            9999, materia_nome="X", materia_cor="#000000", assunto="", banca="", tipo="CE",
            enunciado="x", alternativas_json="[]", gabarito="C", justificativa="") is None

    def test_deletar_apaga_a_questao_e_as_tentativas(self):
        import sqlite3, database
        from repositorio import RepositorioQuestoes
        q = self._criar()
        RepositorioQuestoes.registrar_tentativa(q["id"], "B", 1)
        RepositorioQuestoes.deletar(q["id"])
        assert RepositorioQuestoes.obter(q["id"]) is None
        conn = sqlite3.connect(database.caminho_questoes())
        assert conn.execute("SELECT COUNT(*) FROM question_attempts").fetchone()[0] == 0
        conn.close()

    def test_tipo_invalido_e_rejeitado_pelo_banco(self):
        import sqlite3
        with pytest.raises(sqlite3.IntegrityError):
            self._criar(tipo="XX")


class TestRevisaoEspacada:
    """O servidor informa os FATOS (acertos seguidos e data da última tentativa); a escada de prazos mora no frontend."""

    def _questao(self, enunciado="q"):
        from repositorio import RepositorioQuestoes
        return RepositorioQuestoes.criar(materia_nome="M", materia_cor="#000000", assunto="", banca="", tipo="ME",
                                         enunciado=enunciado, alternativas_json='["a","b"]', gabarito="B", justificativa="")

    def _tentativas(self, q, *resultados):
        from repositorio import RepositorioQuestoes
        for acertou in resultados:
            RepositorioQuestoes.registrar_tentativa(q["id"], "B" if acertou else "A", 1 if acertou else 0)

    def _seguidos(self, q):
        from repositorio import RepositorioQuestoes
        return RepositorioQuestoes.obter(q["id"])["acertos_seguidos"]

    def test_sem_tentativas_nao_ha_acertos_seguidos_nem_data(self):
        from repositorio import RepositorioQuestoes
        q = RepositorioQuestoes.obter(self._questao()["id"])
        assert q["acertos_seguidos"] == 0 and q["ultima_respondida_em"] is None

    def test_conta_os_acertos_depois_do_ultimo_erro(self):
        q = self._questao(); self._tentativas(q, 1, 1, 0, 1, 1, 1)
        assert self._seguidos(q) == 3

    def test_so_acertos_contam_todos(self):
        q = self._questao(); self._tentativas(q, 1, 1, 1)
        assert self._seguidos(q) == 3

    def test_se_a_ultima_foi_erro_zera(self):
        q = self._questao(); self._tentativas(q, 1, 1, 0)
        assert self._seguidos(q) == 0

    def test_um_erro_isolado_no_comeco_nao_atrapalha(self):
        q = self._questao(); self._tentativas(q, 0, 1, 1)
        assert self._seguidos(q) == 2

    def test_nao_mistura_questoes_diferentes(self):
        a, b = self._questao("a"), self._questao("b")
        self._tentativas(a, 1, 1); self._tentativas(b, 1, 0)
        assert self._seguidos(a) == 2 and self._seguidos(b) == 0

    def test_ultima_respondida_em_e_a_da_tentativa_mais_recente(self):
        import sqlite3, database
        from repositorio import RepositorioQuestoes
        q = self._questao(); self._tentativas(q, 1, 1)
        conn = sqlite3.connect(database.caminho_questoes())
        conn.execute("UPDATE question_attempts SET respondida_em = '2026-10-01 10:00:00' WHERE id = 1")
        conn.execute("UPDATE question_attempts SET respondida_em = '2026-10-05 22:30:00' WHERE id = 2")
        conn.commit(); conn.close()
        assert RepositorioQuestoes.obter(q["id"])["ultima_respondida_em"] == "2026-10-05 22:30:00"

    def test_listar_tambem_traz_os_campos(self):
        from repositorio import RepositorioQuestoes
        q = self._questao(); self._tentativas(q, 1)
        item = RepositorioQuestoes.listar()[0]
        assert item["acertos_seguidos"] == 1 and item["ultima_respondida_em"]


class TestCadernoEmArquivoProprio:
    """O caderno mora em caderno_de_questoes.db: nenhum "novo ciclo" do banco principal o alcança."""

    def _criar(self, **kw):
        from repositorio import RepositorioQuestoes
        dados = dict(materia_nome="Dir. Financeiro", materia_cor="#d4537e", assunto="", banca="", tipo="CE",
                     enunciado="Julgue.", alternativas_json="[]", gabarito="C", justificativa="")
        dados.update(kw)
        return RepositorioQuestoes.criar(**dados)

    def test_o_arquivo_fica_ao_lado_do_banco_principal(self):
        import os, database
        assert os.path.dirname(database.caminho_questoes()) == os.path.dirname(os.path.abspath(database.db_path))
        assert os.path.basename(database.caminho_questoes()) == "caderno_de_questoes.db"

    def test_as_questoes_nao_ficam_no_banco_principal(self):
        import sqlite3, database
        self._criar()
        conn = sqlite3.connect(database.db_path)
        tabelas = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        conn.close()
        assert "questions" not in tabelas and "question_attempts" not in tabelas

    def test_novo_ciclo_apagando_o_banco_principal_nao_apaga_o_caderno(self):
        import os, database
        from repositorio import RepositorioQuestoes
        q = self._criar(enunciado="sobrevive ao ciclo")
        RepositorioQuestoes.registrar_tentativa(q["id"], "C", 1)
        os.remove(database.db_path)           # é o que o novo_ciclo.sh faz
        database.init_db()                    # e o app recria o banco vazio ao subir
        lista = RepositorioQuestoes.listar()
        assert [x["enunciado"] for x in lista] == ["sobrevive ao ciclo"]
        assert lista[0]["tentativas"] == 1

    def test_apagar_a_materia_do_app_nao_mexe_nas_questoes(self):
        from repositorio import RepositorioQuestoes, RepositorioCategorias
        cat = RepositorioCategorias.criar("Dir. Financeiro", "#d4537e")
        self._criar()
        RepositorioCategorias.deletar(cat["id"])
        q = RepositorioQuestoes.listar()[0]
        assert q["materia_nome"] == "Dir. Financeiro" and q["materia_cor"] == "#d4537e"

    def _banco_antigo(self):
        """Reproduz a versão anterior: as questões dentro do banco principal, ligadas à matéria pelo id."""
        import os, sqlite3, database
        os.remove(database.caminho_questoes())
        conn = sqlite3.connect(database.db_path)
        conn.executescript("""
            CREATE TABLE questions (id INTEGER PRIMARY KEY AUTOINCREMENT, categoria_id INTEGER, assunto TEXT NOT NULL DEFAULT '',
                banca TEXT NOT NULL DEFAULT '', tipo TEXT NOT NULL, enunciado TEXT NOT NULL, alternativas TEXT NOT NULL DEFAULT '[]',
                gabarito TEXT NOT NULL, justificativa TEXT NOT NULL DEFAULT '', criada_em TEXT);
            CREATE TABLE question_attempts (id INTEGER PRIMARY KEY AUTOINCREMENT, question_id INTEGER NOT NULL,
                resposta TEXT NOT NULL, acertou INTEGER NOT NULL, respondida_em TEXT);
            INSERT INTO categories (id, nome, cor) VALUES (7, 'Contabilidade', '#1d9e75');
            INSERT INTO questions (id, categoria_id, assunto, banca, tipo, enunciado, alternativas, gabarito, justificativa, criada_em)
                VALUES (3, 7, 'Depreciação', 'FCC', 'ME', 'Qual?', '["a","b"]', 'B', 'j', '2026-01-01 10:00:00'),
                       (4, NULL, '', '', 'CE', 'Sem matéria.', '[]', 'C', '', '2026-01-02 10:00:00');
            INSERT INTO question_attempts (question_id, resposta, acertou) VALUES (3, 'A', 0), (3, 'B', 1);
        """)
        conn.commit(); conn.close()

    def test_questoes_da_versao_anterior_sao_migradas_sem_perda(self):
        import database
        from repositorio import RepositorioQuestoes
        self._banco_antigo()
        database.init_db()
        por_id = {q["id"]: q for q in RepositorioQuestoes.listar()}
        assert set(por_id) == {3, 4}
        q3 = por_id[3]
        assert (q3["materia_nome"], q3["materia_cor"], q3["assunto"], q3["banca"], q3["gabarito"]) == ("Contabilidade", "#1d9e75", "Depreciação", "FCC", "B")
        assert q3["tentativas"] == 2 and q3["acertos"] == 1 and q3["ultima_acertou"] == 1
        assert por_id[4]["materia_nome"] == "Sem matéria"

    def test_a_migracao_roda_uma_vez_so(self):
        import database
        from repositorio import RepositorioQuestoes
        self._banco_antigo()
        database.init_db()
        database.init_db()
        assert len(RepositorioQuestoes.listar()) == 2

    def test_depois_de_migrar_o_caderno_novo_nao_e_afetado_pelo_antigo(self):
        import database
        from repositorio import RepositorioQuestoes
        self._banco_antigo()
        database.init_db()
        RepositorioQuestoes.deletar(3)
        database.init_db()                        # reiniciar o app não "ressuscita" a questão apagada
        assert [q["id"] for q in RepositorioQuestoes.listar()] == [4]
