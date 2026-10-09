import json
import re
from datetime import date, datetime, timedelta, timezone
from repositorio import (
    RepositorioConfiguracoes,
    RepositorioCategorias,
    RepositorioSessoes,
    RepositorioTarefas,
    RepositorioCronograma,
    RepositorioQuestoes,
)

def calcular_duracao(inicio_iso: str, fim_iso: str) -> int:
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
        sessao["category_id"]      = sessao.get("categoria_id")
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
    def listar(periodo: str, categoria_id=None, referencia=None) -> list:
        return [ServicoSessoes._mapear(s)
                for s in RepositorioSessoes.obter_filtradas(periodo, categoria_id, referencia)]

    @staticmethod
    def dados_grafico(periodo: str, categoria_id=None, referencia=None) -> list:
        dados = RepositorioSessoes.obter_dados_grafico(periodo, categoria_id, referencia)
        for d in dados:
            d["category_name"]  = d.get("categoria_nome")
            d["category_color"] = d.get("categoria_cor")
        return dados

    @staticmethod
    def estatisticas(periodo: str, referencia=None) -> dict:
        stats = RepositorioSessoes.obter_estatisticas(periodo, referencia)
        return {
            "total_seconds": stats["total_segundos"],
            "session_count": stats["total_sessoes"],
        }

    @staticmethod
    def deletar(sessao_id) -> dict:
        return RepositorioSessoes.deletar(sessao_id)

    @staticmethod
    def criar_manual(categoria_id, started_at: str, ended_at: str, nota: str) -> dict:
        t1 = datetime.fromisoformat(started_at.replace("Z", "+00:00"))
        t2 = datetime.fromisoformat(ended_at.replace("Z", "+00:00"))
        if t2 <= t1:
            raise ValueError("fim deve ser posterior ao início")
        res = RepositorioSessoes.criar_manual(categoria_id, started_at, ended_at, nota, calcular_duracao)
        return ServicoSessoes._mapear(res)

    @staticmethod
    def fechar_sessoes_abertas() -> int:
        agora = datetime.now(timezone.utc).isoformat()
        return RepositorioSessoes.fechar_sessoes_abertas(agora, calcular_duracao)

    @staticmethod
    def mapa_de_calor(semanas: int = 26, hoje=None) -> dict:
        if semanas < 1 or semanas > 53:
            raise ValueError("semanas deve estar entre 1 e 53")
        hoje = hoje or date.today()
        # a grade sempre começa numa segunda-feira, `semanas` semanas atrás
        inicio = hoje - timedelta(days=hoje.weekday() + (semanas - 1) * 7)
        dias = RepositorioSessoes.obter_segundos_por_dia(inicio.isoformat())
        return {"inicio": inicio.isoformat(), "semanas": semanas, "dias": dias}

class ServicoTarefas:

    @staticmethod
    def _mapear(t: dict) -> dict:
        t["category_name"]  = t.get("categoria_nome")
        t["category_color"] = t.get("categoria_cor")
        t["category_id"]    = t.get("categoria_id")
        t["note"]           = t.get("nota", "")
        return t

    @staticmethod
    def listar() -> list:
        return [ServicoTarefas._mapear(t) for t in RepositorioTarefas.listar()]

    @staticmethod
    def criar(titulo: str, categoria_id=None, nota: str = "") -> dict:
        if not categoria_id:
            raise ValueError("tarefa precisa estar associada a uma matéria")
        return ServicoTarefas._mapear(RepositorioTarefas.criar(titulo, categoria_id, nota))

    @staticmethod
    def atualizar(tid, titulo: str, categoria_id=None, nota: str = "") -> dict | None:
        if not categoria_id:
            raise ValueError("tarefa precisa estar associada a uma matéria")
        res = RepositorioTarefas.atualizar(tid, titulo, categoria_id, nota)
        return ServicoTarefas._mapear(res) if res else None

    @staticmethod
    def deletar(tid) -> dict:
        return RepositorioTarefas.deletar(tid)

    @staticmethod
    def completar(tid) -> dict | None:
        agora = datetime.now(timezone.utc).isoformat()
        res = RepositorioTarefas.completar(tid, agora)
        return ServicoTarefas._mapear(res) if res else None

    @staticmethod
    def reabrir(tid) -> dict | None:
        res = RepositorioTarefas.reabrir(tid)
        return ServicoTarefas._mapear(res) if res else None

    @staticmethod
    def listar_concluidas() -> list:
        return [ServicoTarefas._mapear(t) for t in RepositorioTarefas.listar_concluidas()]

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

    @staticmethod
    def mover(entry_id, dia_semana) -> dict | None:
        if dia_semana not in RepositorioCronograma.DIAS:
            raise ValueError("dia da semana inválido")
        res = RepositorioCronograma.mover(entry_id, dia_semana)
        return ServicoCronograma._mapear(res) if res else None


class ServicoQuestoes:
    """Caderno de questões: múltipla escolha (ME, alternativas A–E) ou certo/errado (CE)."""

    LETRAS = "ABCDE"
    LIMITE_TEXTO_CURTO = 100
    COR_PADRAO = "#94a3b8"

    @staticmethod
    def _texto_curto(valor, nome: str) -> str:
        texto = " ".join(str(valor or "").split())
        if len(texto) > ServicoQuestoes.LIMITE_TEXTO_CURTO:
            raise ValueError(f"{nome}: máximo de {ServicoQuestoes.LIMITE_TEXTO_CURTO} caracteres")
        return texto

    @staticmethod
    def _cor_segura(cor) -> str:
        """Só aceita #rrggbb; qualquer outra coisa vira a cor padrão (a cor vai parar num style="")."""
        cor = str(cor or "").strip()
        return cor.lower() if re.fullmatch(r"#[0-9a-fA-F]{6}", cor) else ServicoQuestoes.COR_PADRAO

    @staticmethod
    def _validar(materia_nome, materia_cor, assunto, banca, tipo, enunciado, alternativas, gabarito, justificativa) -> dict:
        materia = ServicoQuestoes._texto_curto(materia_nome, "matéria")
        if not materia:
            raise ValueError("questão precisa estar associada a uma matéria")

        tipo = str(tipo or "").strip().upper()
        if tipo not in ("ME", "CE"):
            raise ValueError("tipo deve ser ME (múltipla escolha) ou CE (certo ou errado)")

        enunciado = str(enunciado or "").strip()
        if not enunciado:
            raise ValueError("o enunciado é obrigatório")

        gabarito = str(gabarito or "").strip().upper()
        if tipo == "CE":
            alts = []
            if gabarito not in ("C", "E"):
                raise ValueError("gabarito de certo ou errado deve ser C ou E")
        else:
            alts = [str(a or "").strip() for a in (alternativas or [])]
            while alts and not alts[-1]:
                alts.pop()
            if len(alts) < 2:
                raise ValueError("múltipla escolha precisa de pelo menos 2 alternativas")
            if len(alts) > len(ServicoQuestoes.LETRAS):
                raise ValueError(f"máximo de {len(ServicoQuestoes.LETRAS)} alternativas por questão")
            if any(not a for a in alts):
                raise ValueError("preencha as alternativas em ordem, sem pular letras")
            if len(gabarito) != 1 or gabarito not in ServicoQuestoes.LETRAS[:len(alts)]:
                raise ValueError(f"gabarito deve ser uma letra de A a {ServicoQuestoes.LETRAS[len(alts) - 1]}")

        return dict(
            materia_nome=materia,
            materia_cor=ServicoQuestoes._cor_segura(materia_cor),
            assunto=ServicoQuestoes._texto_curto(assunto, "assunto"),
            banca=ServicoQuestoes._texto_curto(banca, "banca"),
            tipo=tipo,
            enunciado=enunciado,
            alternativas_json=json.dumps(alts, ensure_ascii=False),
            gabarito=gabarito,
            justificativa=str(justificativa or "").strip(),
        )

    @staticmethod
    def _mapear(q: dict | None) -> dict | None:
        if q is None:
            return None
        q["alternativas"] = json.loads(q.get("alternativas") or "[]")
        ultima = q.get("ultima_acertou")
        q["ultima_acertou"] = None if ultima is None else bool(ultima)
        q["tentativas"] = int(q.get("tentativas") or 0)
        q["acertos"] = int(q.get("acertos") or 0)
        q["acertos_seguidos"] = int(q.get("acertos_seguidos") or 0)
        q["ultima_respondida_em"] = q.get("ultima_respondida_em")
        return q

    @staticmethod
    def listar() -> list:
        return [ServicoQuestoes._mapear(q) for q in RepositorioQuestoes.listar()]

    @staticmethod
    def criar(materia_nome, materia_cor, assunto, banca, tipo, enunciado, alternativas, gabarito, justificativa) -> dict:
        dados = ServicoQuestoes._validar(materia_nome, materia_cor, assunto, banca, tipo, enunciado, alternativas, gabarito, justificativa)
        return ServicoQuestoes._mapear(RepositorioQuestoes.criar(**dados))

    @staticmethod
    def atualizar(qid, materia_nome, materia_cor, assunto, banca, tipo, enunciado, alternativas, gabarito, justificativa) -> dict | None:
        dados = ServicoQuestoes._validar(materia_nome, materia_cor, assunto, banca, tipo, enunciado, alternativas, gabarito, justificativa)
        return ServicoQuestoes._mapear(RepositorioQuestoes.atualizar(qid, **dados))

    @staticmethod
    def deletar(qid) -> dict:
        return RepositorioQuestoes.deletar(qid)

    @staticmethod
    def responder(qid, resposta) -> dict | None:
        """Corrige no servidor (fonte única da verdade) e registra a tentativa."""
        q = RepositorioQuestoes.obter(qid)
        if q is None:
            return None
        letras = "CE" if q["tipo"] == "CE" else ServicoQuestoes.LETRAS[:len(json.loads(q["alternativas"] or "[]"))]
        resposta = str(resposta or "").strip().upper()
        if len(resposta) != 1 or resposta not in letras:
            raise ValueError(f"resposta inválida: use uma destas letras: {', '.join(letras)}")

        acertou = resposta == q["gabarito"]
        RepositorioQuestoes.registrar_tentativa(qid, resposta, 1 if acertou else 0)
        atual = RepositorioQuestoes.obter(qid)
        return {
            "acertou": acertou,
            "gabarito": q["gabarito"],
            "justificativa": q["justificativa"],
            "tentativas": int(atual["tentativas"]),
            "acertos": int(atual["acertos"]),
            "acertos_seguidos": int(atual.get("acertos_seguidos") or 0),
            "ultima_respondida_em": atual.get("ultima_respondida_em"),
        }
