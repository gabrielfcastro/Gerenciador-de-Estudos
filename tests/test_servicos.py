import pytest
from unittest.mock import patch, MagicMock

class TestCalcularDuracao:

    def _calc(self, inicio, fim):
        from servicos import calcular_duracao
        return calcular_duracao(inicio, fim)

    def test_uma_hora(self):
        d = self._calc("2026-01-01T08:00:00+00:00", "2026-01-01T09:00:00+00:00")
        assert d == 3600

    def test_uma_hora_e_meia(self):
        d = self._calc("2026-01-01T08:00:00+00:00", "2026-01-01T09:30:00+00:00")
        assert d == 5400

    def test_aceita_formato_Z(self):
        d = self._calc("2026-01-01T08:00:00.000Z", "2026-01-01T09:00:00.000Z")
        assert d == 3600

    def test_duracao_zero(self):
        d = self._calc("2026-01-01T10:00:00+00:00", "2026-01-01T10:00:00+00:00")
        assert d == 0

    def test_atravessa_meia_noite(self):
        d = self._calc("2026-01-01T23:00:00+00:00", "2026-01-02T01:00:00+00:00")
        assert d == 7200

class TestServicoCategoriasMapeamento:

    def _mapear(self, cat):
        from servicos import ServicoCategorias
        return ServicoCategorias._mapear(cat)

    def test_converte_campos_pt_para_en(self):
        res = self._mapear({"id": 1, "nome": "Direito", "cor": "#7c6ff7"})
        assert res == {"id": 1, "name": "Direito", "color": "#7c6ff7"}

    def test_preserva_id(self):
        res = self._mapear({"id": 42, "nome": "X", "cor": "#000"})
        assert res["id"] == 42

class TestServicoSessoesMapeamento:

    def _mapear(self, s):
        from servicos import ServicoSessoes
        return ServicoSessoes._mapear(s)

    def test_mapeia_campos_principais(self):
        s = {
            "id": 1,
            "duracao": 3600,
            "inicio":  "2026-01-01T08:00:00+00:00",
            "categoria_nome": "Dir",
            "categoria_cor":  "#7c6ff7",
            "categoria_id":   42,
        }
        res = self._mapear(s)
        assert res["duration_seconds"] == 3600
        assert res["started_at"]       == "2026-01-01T08:00:00+00:00"
        assert res["category_name"]    == "Dir"
        assert res["category_color"]   == "#7c6ff7"

    def test_mapeia_category_id(self):
        s = {"id": 1, "duracao": 0, "inicio": "", "categoria_nome": "", "categoria_cor": "", "categoria_id": 7}
        res = self._mapear(s)
        assert res["category_id"] == 7

    def test_category_id_none_quando_sem_categoria(self):
        s = {"id": 1, "duracao": 0, "inicio": "", "categoria_nome": None, "categoria_cor": None, "categoria_id": None}
        res = self._mapear(s)
        assert "category_id" in res
        assert res["category_id"] is None

    def test_retorna_none_para_sessao_none(self):
        assert self._mapear(None) is None

    def test_campos_nulos_viram_none(self):
        s = {"id": 1, "duracao": None, "inicio": None, "categoria_nome": None, "categoria_cor": None}
        res = self._mapear(s)
        assert res["duration_seconds"] is None
        assert res["category_name"]    is None

    DIAS   = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
    MESES  = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
               'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

    def _formatar(self, periods, period):
        from datetime import datetime
        if period == 'week':
            return [self.DIAS[datetime.strptime(p, '%Y-%m-%d').weekday() + 1 if datetime.strptime(p, '%Y-%m-%d').weekday() < 6 else 0]
                    for p in periods]
        if period == 'month':
            return [f'Sem {i+1}' for i, _ in enumerate(periods)]
        if period in ('6months', 'year'):
            return [self.MESES[int(p.split('-')[1]) - 1] for p in periods]
        if period == 'all':
            return [f'{self.MESES[int(p.split("-")[1])-1]} {p.split("-")[0]}' for p in periods]
        return periods

    def test_semana_vira_dia_da_semana(self):
        resultado = self._formatar(['2026-07-21'], 'week')
        assert resultado == ['Ter']

    def test_mes_vira_semanas(self):
        resultado = self._formatar(['2026-30', '2026-31', '2026-32'], 'month')
        assert resultado == ['Sem 1', 'Sem 2', 'Sem 3']

    def test_6meses_vira_nome_completo_sem_ano(self):
        resultado = self._formatar(['2026-07', '2026-08'], '6months')
        assert resultado == ['Julho', 'Agosto']

    def test_ano_vira_nome_completo_sem_ano(self):
        resultado = self._formatar(['2026-01', '2026-12'], 'year')
        assert resultado == ['Janeiro', 'Dezembro']

    def test_total_vira_nome_completo_com_ano(self):
        resultado = self._formatar(['2025-12', '2026-01'], 'all')
        assert resultado == ['Dezembro 2025', 'Janeiro 2026']

class TestServicoMapaDeCalor:

    def test_data_inicial_e_a_segunda_feira_de_semanas_atras(self):
        from datetime import date
        from servicos import ServicoSessoes
        with patch("servicos.RepositorioSessoes") as mock_repo:
            mock_repo.obter_segundos_por_dia.return_value = {}
            # 08/10/2026 é quinta; com 2 semanas, começa na segunda 28/09/2026
            res = ServicoSessoes.mapa_de_calor(2, hoje=date(2026, 10, 8))
            assert res["inicio"] == "2026-09-28"
            assert res["semanas"] == 2
            mock_repo.obter_segundos_por_dia.assert_called_once_with("2026-09-28")

    def test_uma_semana_comeca_na_segunda_da_semana_atual(self):
        from datetime import date
        from servicos import ServicoSessoes
        with patch("servicos.RepositorioSessoes") as mock_repo:
            mock_repo.obter_segundos_por_dia.return_value = {}
            res = ServicoSessoes.mapa_de_calor(1, hoje=date(2026, 10, 8))
            assert res["inicio"] == "2026-10-05"

    def test_repassa_os_dias_do_repositorio(self):
        from datetime import date
        from servicos import ServicoSessoes
        with patch("servicos.RepositorioSessoes") as mock_repo:
            mock_repo.obter_segundos_por_dia.return_value = {"2026-10-05": 3600}
            res = ServicoSessoes.mapa_de_calor(1, hoje=date(2026, 10, 8))
            assert res["dias"] == {"2026-10-05": 3600}

    def test_semanas_invalidas_lancam_erro(self):
        from servicos import ServicoSessoes
        with pytest.raises(ValueError):
            ServicoSessoes.mapa_de_calor(0)
        with pytest.raises(ValueError):
            ServicoSessoes.mapa_de_calor(54)

class TestServicoSessoesFecharAbertas:

    def test_chama_repositorio_com_timestamp_atual(self):
        from servicos import ServicoSessoes
        with patch("servicos.RepositorioSessoes") as mock_repo:
            mock_repo.fechar_sessoes_abertas.return_value = 1
            qtd = ServicoSessoes.fechar_sessoes_abertas()
            assert qtd == 1
            args = mock_repo.fechar_sessoes_abertas.call_args[0]
            assert isinstance(args[0], str)  # timestamp ISO

class TestServicoSessoesValidacao:

    def test_fim_antes_do_inicio_lanca_erro(self):
        from servicos import ServicoSessoes
        with pytest.raises(ValueError, match="fim deve ser posterior ao início"):
            with patch("servicos.RepositorioSessoes"):
                ServicoSessoes.atualizar(
                    1, None,
                    "2026-01-01T10:00:00+00:00",
                    "2026-01-01T08:00:00+00:00",
                    ""
                )

    def test_fim_igual_ao_inicio_lanca_erro(self):
        from servicos import ServicoSessoes
        with pytest.raises(ValueError):
            with patch("servicos.RepositorioSessoes"):
                ServicoSessoes.atualizar(
                    1, None,
                    "2026-01-01T10:00:00+00:00",
                    "2026-01-01T10:00:00+00:00",
                    ""
                )

    def test_sessao_valida_chama_repositorio(self):
        from servicos import ServicoSessoes
        sessao_mock = {
            "id": 1, "duracao": 3600, "inicio": "2026-01-01T08:00:00+00:00",
            "fim": "2026-01-01T09:00:00+00:00", "nota": "",
            "categoria_nome": None, "categoria_cor": None, "categoria_id": None
        }
        with patch("servicos.RepositorioSessoes") as mock_repo:
            mock_repo.atualizar.return_value = sessao_mock
            res = ServicoSessoes.atualizar(
                1, None,
                "2026-01-01T08:00:00+00:00",
                "2026-01-01T09:00:00+00:00",
                "nota"
            )
            assert mock_repo.atualizar.called
            assert res is not None
            assert res["duration_seconds"] == 3600

class TestServicoSessoesCriarManual:

    def test_fim_antes_do_inicio_lanca_erro(self):
        from servicos import ServicoSessoes
        with pytest.raises(ValueError, match="fim deve ser posterior ao início"):
            with patch("servicos.RepositorioSessoes"):
                ServicoSessoes.criar_manual(
                    None,
                    "2026-01-01T10:00:00+00:00",
                    "2026-01-01T08:00:00+00:00",
                    ""
                )

    def test_fim_igual_ao_inicio_lanca_erro(self):
        from servicos import ServicoSessoes
        with pytest.raises(ValueError):
            with patch("servicos.RepositorioSessoes"):
                ServicoSessoes.criar_manual(
                    None,
                    "2026-01-01T10:00:00+00:00",
                    "2026-01-01T10:00:00+00:00",
                    ""
                )

    def test_entrada_valida_chama_repositorio(self):
        from servicos import ServicoSessoes
        sessao_mock = {
            "id": 1, "duracao": 3600, "inicio": "2026-01-01T08:00:00+00:00",
            "fim": "2026-01-01T09:00:00+00:00", "nota": "manual",
            "categoria_nome": None, "categoria_cor": None, "categoria_id": None
        }
        with patch("servicos.RepositorioSessoes") as mock_repo:
            mock_repo.criar_manual.return_value = sessao_mock
            res = ServicoSessoes.criar_manual(
                None,
                "2026-01-01T08:00:00+00:00",
                "2026-01-01T09:00:00+00:00",
                "manual"
            )
            assert mock_repo.criar_manual.called
            assert res is not None
            assert res["duration_seconds"] == 3600
            assert res["started_at"] == "2026-01-01T08:00:00+00:00"

    def test_repassa_categoria_id_pro_repositorio(self):
        from servicos import ServicoSessoes
        with patch("servicos.RepositorioSessoes") as mock_repo:
            mock_repo.criar_manual.return_value = {
                "id": 1, "duracao": 3600, "inicio": "2026-01-01T08:00:00+00:00",
                "fim": "2026-01-01T09:00:00+00:00", "nota": "",
                "categoria_nome": None, "categoria_cor": None, "categoria_id": 7
            }
            ServicoSessoes.criar_manual(
                7, "2026-01-01T08:00:00+00:00", "2026-01-01T09:00:00+00:00", ""
            )
            args = mock_repo.criar_manual.call_args[0]
            assert args[0] == 7

class TestServicoSessoesReferencia:

    def test_listar_repassa_referencia_pro_repositorio(self):
        from servicos import ServicoSessoes
        with patch("servicos.RepositorioSessoes") as mock_repo:
            mock_repo.obter_filtradas.return_value = []
            ServicoSessoes.listar("week", None, "2026-07-15")
            mock_repo.obter_filtradas.assert_called_once_with("week", None, "2026-07-15")

    def test_listar_referencia_e_opcional(self):
        from servicos import ServicoSessoes
        with patch("servicos.RepositorioSessoes") as mock_repo:
            mock_repo.obter_filtradas.return_value = []
            ServicoSessoes.listar("week", None)
            mock_repo.obter_filtradas.assert_called_once_with("week", None, None)

    def test_dados_grafico_repassa_referencia(self):
        from servicos import ServicoSessoes
        with patch("servicos.RepositorioSessoes") as mock_repo:
            mock_repo.obter_dados_grafico.return_value = []
            ServicoSessoes.dados_grafico("month", None, "2026-06-15")
            mock_repo.obter_dados_grafico.assert_called_once_with("month", None, "2026-06-15")

    def test_estatisticas_repassa_referencia(self):
        from servicos import ServicoSessoes
        with patch("servicos.RepositorioSessoes") as mock_repo:
            mock_repo.obter_estatisticas.return_value = {"total_segundos": 0, "total_sessoes": 0}
            ServicoSessoes.estatisticas("today", "2026-07-10")
            mock_repo.obter_estatisticas.assert_called_once_with("today", "2026-07-10")

class TestServicoConfiguracoes:

    def test_obter_usa_chave_correta(self):
        from servicos import ServicoConfiguracoes
        with patch("servicos.RepositorioConfiguracoes") as mock:
            mock.obter_todas.return_value = {"duracao_do_bloco": "4500"}
            res = ServicoConfiguracoes.obter()
            assert res == {"block_duration": "4500"}

    def test_obter_valor_padrao_sem_configuracao(self):
        from servicos import ServicoConfiguracoes
        with patch("servicos.RepositorioConfiguracoes") as mock:
            mock.obter_todas.return_value = {}
            res = ServicoConfiguracoes.obter()
            assert res["block_duration"] == "4500"

    def test_salvar_converte_para_chave_portuguesa(self):
        from servicos import ServicoConfiguracoes
        with patch("servicos.RepositorioConfiguracoes") as mock:
            ServicoConfiguracoes.salvar(3600)
            mock.salvar_ou_atualizar.assert_called_once_with({"duracao_do_bloco": 3600})

    def test_salvar_retorna_valor_como_string(self):
        from servicos import ServicoConfiguracoes
        with patch("servicos.RepositorioConfiguracoes"):
            res = ServicoConfiguracoes.salvar(3600)
            assert res == {"block_duration": "3600"}

class TestServicoTarefas:

    def test_criar_sem_categoria_lanca_erro(self):
        from servicos import ServicoTarefas
        with pytest.raises(ValueError):
            with patch("servicos.RepositorioTarefas"):
                ServicoTarefas.criar("Sem matéria", None)

    def test_criar_com_categoria_id_zero_lanca_erro(self):
        from servicos import ServicoTarefas
        with pytest.raises(ValueError):
            with patch("servicos.RepositorioTarefas"):
                ServicoTarefas.criar("Sem matéria", 0)

    def test_criar_com_categoria_chama_repositorio(self):
        from servicos import ServicoTarefas
        with patch("servicos.RepositorioTarefas") as mock_repo:
            mock_repo.criar.return_value = {"id": 1, "titulo": "X", "categoria_id": 7, "status": "todo", "nota": ""}
            res = ServicoTarefas.criar("X", 7)
            mock_repo.criar.assert_called_once_with("X", 7, "")
            assert res["categoria_id"] == 7

    def test_criar_repassa_a_nota_pro_repositorio(self):
        from servicos import ServicoTarefas
        with patch("servicos.RepositorioTarefas") as mock_repo:
            mock_repo.criar.return_value = {"id": 1, "titulo": "X", "categoria_id": 7, "status": "todo", "nota": "detalhes"}
            res = ServicoTarefas.criar("X", 7, "detalhes")
            mock_repo.criar.assert_called_once_with("X", 7, "detalhes")
            assert res["note"] == "detalhes"

    def test_criar_mapeia_campos_category_para_ingles(self):
        from servicos import ServicoTarefas
        with patch("servicos.RepositorioTarefas") as mock_repo:
            mock_repo.criar.return_value = {
                "id": 1, "titulo": "X", "categoria_id": 7, "status": "todo",
                "nota": "", "categoria_nome": "Dir", "categoria_cor": "#7c6ff7",
            }
            res = ServicoTarefas.criar("X", 7)
            assert res["category_name"]  == "Dir"
            assert res["category_color"] == "#7c6ff7"

    def test_atualizar_sem_categoria_lanca_erro(self):
        from servicos import ServicoTarefas
        with pytest.raises(ValueError):
            with patch("servicos.RepositorioTarefas"):
                ServicoTarefas.atualizar(1, "Título", None, "")

    def test_atualizar_chama_repositorio_com_os_dados_certos(self):
        from servicos import ServicoTarefas
        with patch("servicos.RepositorioTarefas") as mock_repo:
            mock_repo.atualizar.return_value = {
                "id": 1, "titulo": "Editado", "categoria_id": 9,
                "nota": "nova nota", "categoria_nome": "Dir", "categoria_cor": "#111",
            }
            res = ServicoTarefas.atualizar(1, "Editado", 9, "nova nota")
            mock_repo.atualizar.assert_called_once_with(1, "Editado", 9, "nova nota")
            assert res["titulo"] == "Editado"
            assert res["note"]   == "nova nota"

    def test_atualizar_tarefa_inexistente_retorna_none(self):
        from servicos import ServicoTarefas
        with patch("servicos.RepositorioTarefas") as mock_repo:
            mock_repo.atualizar.return_value = None
            res = ServicoTarefas.atualizar(9999, "X", 1, "")
            assert res is None

    # ── completar / reabrir ──

    def test_completar_chama_repositorio_com_timestamp(self):
        from servicos import ServicoTarefas
        with patch("servicos.RepositorioTarefas") as mock_repo:
            mock_repo.completar.return_value = {
                "id": 1, "titulo": "X", "categoria_id": None, "nota": "",
                "status": "done", "concluida_em": "2026-01-01T10:00:00+00:00",
                "categoria_nome": None, "categoria_cor": None,
            }
            res = ServicoTarefas.completar(1)
            assert mock_repo.completar.called
            args = mock_repo.completar.call_args[0]
            assert args[0] == 1
            assert isinstance(args[1], str)  # timestamp ISO gerado pelo serviço
            assert res["status"] == "done"

    def test_completar_tarefa_inexistente_retorna_none(self):
        from servicos import ServicoTarefas
        with patch("servicos.RepositorioTarefas") as mock_repo:
            mock_repo.completar.return_value = None
            res = ServicoTarefas.completar(9999)
            assert res is None

    def test_reabrir_chama_repositorio(self):
        from servicos import ServicoTarefas
        with patch("servicos.RepositorioTarefas") as mock_repo:
            mock_repo.reabrir.return_value = {
                "id": 1, "titulo": "X", "categoria_id": None, "nota": "",
                "status": "todo", "concluida_em": None,
                "categoria_nome": None, "categoria_cor": None,
            }
            res = ServicoTarefas.reabrir(1)
            mock_repo.reabrir.assert_called_once_with(1)
            assert res["status"] == "todo"

    def test_listar_concluidas_mapeia_categoria(self):
        from servicos import ServicoTarefas
        with patch("servicos.RepositorioTarefas") as mock_repo:
            mock_repo.listar_concluidas.return_value = [{
                "id": 1, "titulo": "X", "categoria_id": 7, "nota": "",
                "status": "done", "concluida_em": "2026-01-01T10:00:00+00:00",
                "categoria_nome": "Dir", "categoria_cor": "#7c6ff7",
            }]
            res = ServicoTarefas.listar_concluidas()
            assert len(res) == 1
            assert res[0]["category_name"] == "Dir"

class TestServicoCronograma:

    def test_mover_com_dia_valido_chama_repositorio(self):
        from servicos import ServicoCronograma
        with patch("servicos.RepositorioCronograma") as mock_repo:
            mock_repo.DIAS = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo']
            mock_repo.mover.return_value = {
                "id": 1, "dia_semana": "sexta", "categoria_id": 7,
                "categoria_nome": "Dir", "categoria_cor": "#7c6ff7"
            }
            res = ServicoCronograma.mover(1, "sexta")
            mock_repo.mover.assert_called_once_with(1, "sexta")
            assert res["category_name"] == "Dir"

    def test_mover_com_dia_invalido_lanca_erro(self):
        from servicos import ServicoCronograma
        with patch("servicos.RepositorioCronograma") as mock_repo:
            mock_repo.DIAS = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo']
            with pytest.raises(ValueError):
                ServicoCronograma.mover(1, "quinta-feira")

    def test_mover_entrada_inexistente_retorna_none(self):
        from servicos import ServicoCronograma
        with patch("servicos.RepositorioCronograma") as mock_repo:
            mock_repo.DIAS = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo']
            mock_repo.mover.return_value = None
            assert ServicoCronograma.mover(9999, "segunda") is None


class TestRoteador:

    def _roteador(self):
        from app import Roteador
        return Roteador()

    def test_rota_exata_get(self):
        r = self._roteador()
        r.add("GET", "/api/test", lambda qs, body: {"ok": True})
        res, status = r.despachar("GET", "/api/test", {}, {})
        assert status == 200
        assert res["ok"] is True

    def test_rota_dinamica_com_id(self):
        r = self._roteador()
        r.add("DELETE", "/api/items/{id}", lambda qs, body, resource_id: {"id": resource_id})
        res, status = r.despachar("DELETE", "/api/items/42", {}, {})
        assert status == 200
        assert res["id"] == "42"

    def test_rota_nao_encontrada_retorna_404(self):
        r = self._roteador()
        res, status = r.despachar("GET", "/api/nao-existe", {}, {})
        assert status == 404

    def test_key_error_retorna_400(self):
        r = self._roteador()
        r.add("POST", "/api/test", lambda qs, body: body["campo_obrigatorio"])
        res, status = r.despachar("POST", "/api/test", {}, {})
        assert status == 400

    def test_value_error_retorna_422(self):
        r = self._roteador()
        r.add("POST", "/api/test", lambda qs, body: (_ for _ in ()).throw(ValueError("inválido")))
        def handler_com_erro(qs, body):
            raise ValueError("fim antes do início")
        r.add("PUT", "/api/test", handler_com_erro)
        res, status = r.despachar("PUT", "/api/test", {}, {})
        assert status == 422
        assert "fim antes do início" in res["error"]

    def test_metodo_errado_retorna_404(self):
        r = self._roteador()
        r.add("GET", "/api/test", lambda qs, body: {})
        res, status = r.despachar("POST", "/api/test", {}, {})
        assert status == 404


class TestServicoQuestoes:

    ROW = {"id": 1, "materia_nome": "Dir", "materia_cor": "#ffffff", "assunto": "A", "banca": "FCC", "tipo": "ME",
           "enunciado": "e", "alternativas": '["x", "y"]', "gabarito": "B", "justificativa": "", "criada_em": "2026-01-01",
           "tentativas": 2, "acertos": 1, "ultima_acertou": 1}

    def _criar(self, repo, **kw):
        from servicos import ServicoQuestoes
        repo.criar.return_value = dict(self.ROW)
        args = dict(materia_nome="Dir. Financeiro", materia_cor="#d4537e", assunto="Restos a pagar", banca="FCC", tipo="ME",
                    enunciado="Texto", alternativas=["a", "b", "c"], gabarito="B", justificativa="")
        args.update(kw)
        return ServicoQuestoes.criar(**args)

    def test_me_valido_normaliza_e_grava(self):
        import json
        with patch("servicos.RepositorioQuestoes") as repo:
            self._criar(repo, alternativas=["  a ", "b", "c", "", " "], gabarito="b", tipo=" me ")
            kw = repo.criar.call_args.kwargs
            assert json.loads(kw["alternativas_json"]) == ["a", "b", "c"]
            assert kw["gabarito"] == "B" and kw["tipo"] == "ME"

    def test_ce_ignora_alternativas(self):
        import json
        with patch("servicos.RepositorioQuestoes") as repo:
            self._criar(repo, tipo="CE", alternativas=["lixo"], gabarito="c")
            kw = repo.criar.call_args.kwargs
            assert json.loads(kw["alternativas_json"]) == [] and kw["gabarito"] == "C"

    def test_materia_assunto_e_banca_tem_espacos_normalizados(self):
        with patch("servicos.RepositorioQuestoes") as repo:
            self._criar(repo, materia_nome="  Dir.   Financeiro ", assunto="  Restos   a  pagar ", banca="  fcc ")
            kw = repo.criar.call_args.kwargs
            assert kw["materia_nome"] == "Dir. Financeiro"
            assert kw["assunto"] == "Restos a pagar" and kw["banca"] == "fcc"

    def test_assunto_e_banca_sao_opcionais(self):
        with patch("servicos.RepositorioQuestoes") as repo:
            self._criar(repo, assunto=None, banca="")
            kw = repo.criar.call_args.kwargs
            assert kw["assunto"] == "" and kw["banca"] == ""

    def test_cor_valida_e_mantida_em_minusculas(self):
        with patch("servicos.RepositorioQuestoes") as repo:
            self._criar(repo, materia_cor="#D4537E")
            assert repo.criar.call_args.kwargs["materia_cor"] == "#d4537e"

    @pytest.mark.parametrize("cor", [None, "", "azul", "#12", "#gggggg", "red; background:url(x)"])
    def test_cor_invalida_vira_cor_padrao(self, cor):
        with patch("servicos.RepositorioQuestoes") as repo:
            self._criar(repo, materia_cor=cor)
            assert repo.criar.call_args.kwargs["materia_cor"] == "#94a3b8"

    @pytest.mark.parametrize("campo,valor,trecho", [
        ("materia_nome", None, "matéria"),
        ("materia_nome", "   ", "matéria"),
        ("materia_nome", "x" * 101, "matéria"),
        ("enunciado", "   ", "enunciado"),
        ("tipo", "XX", "tipo"),
        ("alternativas", ["so uma"], "pelo menos 2"),
        ("alternativas", list("abcdef"), "máximo de 5"),
        ("alternativas", ["a", "", "c"], "em ordem"),
        ("gabarito", "E", "gabarito"),
        ("gabarito", "", "gabarito"),
        ("assunto", "x" * 101, "assunto"),
        ("banca", "x" * 101, "banca"),
    ])
    def test_entradas_invalidas_viram_erro(self, campo, valor, trecho):
        with patch("servicos.RepositorioQuestoes") as repo:
            with pytest.raises(ValueError, match=trecho):
                self._criar(repo, **{campo: valor})
            assert not repo.criar.called

    def test_ce_com_gabarito_de_letra_e_invalido(self):
        with patch("servicos.RepositorioQuestoes") as repo:
            with pytest.raises(ValueError, match="C ou E"):
                self._criar(repo, tipo="CE", gabarito="A")

    def test_mapeia_a_linha_do_banco_para_a_api(self):
        from servicos import ServicoQuestoes
        with patch("servicos.RepositorioQuestoes") as repo:
            repo.listar.return_value = [dict(self.ROW), {**self.ROW, "ultima_acertou": 0}, {**self.ROW, "ultima_acertou": None, "tentativas": 0}]
            a, b, c = ServicoQuestoes.listar()
            assert a["alternativas"] == ["x", "y"]
            assert a["ultima_acertou"] is True and b["ultima_acertou"] is False and c["ultima_acertou"] is None
            assert a["tentativas"] == 2 and a["acertos"] == 1

    def test_atualizar_inexistente_retorna_none(self):
        from servicos import ServicoQuestoes
        with patch("servicos.RepositorioQuestoes") as repo:
            repo.atualizar.return_value = None
            assert ServicoQuestoes.atualizar(9, "Dir", "#ffffff", "", "", "CE", "x", None, "C", "") is None

    def test_responder_acerto_registra_tentativa(self):
        from servicos import ServicoQuestoes
        with patch("servicos.RepositorioQuestoes") as repo:
            repo.obter.side_effect = [dict(self.ROW), {**self.ROW, "tentativas": 3, "acertos": 2}]
            res = ServicoQuestoes.responder(1, "b")
            repo.registrar_tentativa.assert_called_once_with(1, "B", 1)
            assert res["acertou"] is True and res["gabarito"] == "B" and res["tentativas"] == 3

    def test_responder_erro_registra_tentativa_com_zero(self):
        from servicos import ServicoQuestoes
        with patch("servicos.RepositorioQuestoes") as repo:
            repo.obter.side_effect = [dict(self.ROW), dict(self.ROW)]
            res = ServicoQuestoes.responder(1, "A")
            repo.registrar_tentativa.assert_called_once_with(1, "A", 0)
            assert res["acertou"] is False

    def test_responder_questao_inexistente_retorna_none(self):
        from servicos import ServicoQuestoes
        with patch("servicos.RepositorioQuestoes") as repo:
            repo.obter.return_value = None
            assert ServicoQuestoes.responder(9, "A") is None
            assert not repo.registrar_tentativa.called

    @pytest.mark.parametrize("tipo,resposta", [("ME", "E"), ("ME", ""), ("ME", "Z"), ("CE", "A")])
    def test_responder_com_resposta_invalida_vira_erro(self, tipo, resposta):
        from servicos import ServicoQuestoes
        with patch("servicos.RepositorioQuestoes") as repo:
            repo.obter.return_value = {**self.ROW, "tipo": tipo, "alternativas": '["x", "y"]' if tipo == "ME" else "[]"}
            with pytest.raises(ValueError, match="resposta"):
                ServicoQuestoes.responder(1, resposta)
            assert not repo.registrar_tentativa.called
