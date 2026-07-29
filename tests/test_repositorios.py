import pytest
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