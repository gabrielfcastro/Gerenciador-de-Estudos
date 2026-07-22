from datetime import datetime, timezone
from repositorio import (
    RepositorioConfiguracoes,
    RepositorioCategorias,
    RepositorioSessoes,
    RepositorioTarefas,
    RepositorioCronograma,
)

def calcular_duracao(inicio_iso: str, fim_iso: str) -> int:
    """Retorna a duração em segundos entre dois timestamps ISO 8601."""
    t1 = datetime.fromisoformat(inicio_iso.replace("Z", "+00:00"))
    t2 = datetime.fromisoformat(fim_iso.replace("Z", "+00:00"))
    return int((t2 - t1).total_seconds())

class ServicoConfiguracoes:

    @staticmethod
    def obter() -> dict:
        cfg = RepositorioConfiguracoes.obter_todas()
        return {"block_duration": cfg.get("duracao_do_bloco", "4500")}

    @staticmethod
    def salvar(block_duration) -> dict:
        RepositorioConfiguracoes.salvar_ou_atualizar({"duracao_do_bloco": block_duration})
        return {"block_duration": str(block_duration)}

class ServicoCategorias:

    @staticmethod
    def _mapear(cat: dict) -> dict:
        return {"id": cat["id"], "name": cat["nome"], "color": cat["cor"]}

    @staticmethod
    def listar() -> list:
        return [ServicoCategorias._mapear(c)
                for c in RepositorioCategorias.listar_todas_as_categorias()]

    @staticmethod
    def criar(name: str, color: str) -> dict:
        return ServicoCategorias._mapear(RepositorioCategorias.criar(name, color))

    @staticmethod
    def atualizar(cid, name: str, color: str) -> dict:
        res = RepositorioCategorias.atualizar(cid, name, color)
        return ServicoCategorias._mapear(res) if res else {}

    @staticmethod
    def deletar(cid) -> dict:
        return RepositorioCategorias.deletar(cid)

class ServicoSessoes:

    @staticmethod
    def _mapear(sessao: dict | None) -> dict | None:
        if sessao is None:
            return None
        sessao["duration_seconds"] = sessao.get("duracao")
        sessao["started_at"]       = sessao.get("inicio")
        sessao["category_name"]    = sessao.get("categoria_nome")
        sessao["category_color"]   = sessao.get("categoria_cor")
        return sessao

    @staticmethod
    def iniciar(categoria_id, nota: str) -> dict:
        now = datetime.now(timezone.utc).isoformat()
        return RepositorioSessoes.iniciar(categoria_id, now, nota)

    @staticmethod
    def parar(sessao_id, duracao_override=None) -> dict | None:
        now = datetime.now(timezone.utc).isoformat()
        res = RepositorioSessoes.parar(sessao_id, now, calcular_duracao, duracao_override)
        return ServicoSessoes._mapear(res)

    @staticmethod
    def atualizar(sessao_id, categoria_id, started_at: str, ended_at: str, nota: str) -> dict | None:
        t1 = datetime.fromisoformat(started_at.replace("Z", "+00:00"))
        t2 = datetime.fromisoformat(ended_at.replace("Z", "+00:00"))
        if t2 <= t1:
            raise ValueError("fim deve ser posterior ao início")
        res = RepositorioSessoes.atualizar(
            sessao_id, categoria_id, started_at, ended_at, nota, calcular_duracao
        )
        return ServicoSessoes._mapear(res)

    @staticmethod
    def listar(periodo: str, categoria_id=None) -> list:
        return [ServicoSessoes._mapear(s)
                for s in RepositorioSessoes.obter_filtradas(periodo, categoria_id)]

    @staticmethod
    def dados_grafico(periodo: str, categoria_id=None) -> list:
        dados = RepositorioSessoes.obter_dados_grafico(periodo, categoria_id)
        for d in dados:
            d["category_name"]  = d.get("categoria_nome")
            d["category_color"] = d.get("categoria_cor")
        return dados

    @staticmethod
    def estatisticas(periodo: str) -> dict:
        stats = RepositorioSessoes.obter_estatisticas(periodo)
        return {
            "total_seconds": stats["total_segundos"],
            "session_count": stats["total_sessoes"],
        }

    @staticmethod
    def deletar(sessao_id) -> dict:
        return RepositorioSessoes.deletar(sessao_id)


# ── tarefas ───────────────────────────────────────────────────────────────────

class ServicoTarefas:

    @staticmethod
    def _mapear(t: dict) -> dict:
        t["category_name"]  = t.get("categoria_nome")
        t["category_color"] = t.get("categoria_cor")
        t["category_id"]    = t.get("categoria_id")
        return t

    @staticmethod
    def listar() -> list:
        return [ServicoTarefas._mapear(t) for t in RepositorioTarefas.listar()]

    @staticmethod
    def criar(titulo: str, categoria_id=None) -> dict:
        return RepositorioTarefas.criar(titulo, categoria_id)

    @staticmethod
    def deletar(tid) -> dict:
        return RepositorioTarefas.deletar(tid)


# ── cronograma ────────────────────────────────────────────────────────────────

class ServicoCronograma:

    @staticmethod
    def _mapear(e: dict) -> dict:
        e["category_name"]  = e.get("categoria_nome")
        e["category_color"] = e.get("categoria_cor")
        e["category_id"]    = e.get("categoria_id")
        return e

    @staticmethod
    def listar() -> list:
        return [ServicoCronograma._mapear(e) for e in RepositorioCronograma.listar()]

    @staticmethod
    def adicionar(dia_semana: str, categoria_id) -> dict:
        return ServicoCronograma._mapear(
            RepositorioCronograma.adicionar(dia_semana, categoria_id)
        )

    @staticmethod
    def remover(entry_id) -> dict:
        return RepositorioCronograma.remover(entry_id)