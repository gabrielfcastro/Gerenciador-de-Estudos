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
