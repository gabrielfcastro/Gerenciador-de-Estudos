// ── Caderno de questões: HTML da tela (funções puras) ─────────────────────────
// Recebem dados e devolvem texto HTML — não tocam no DOM. Todo texto vindo do
// usuário (enunciado, alternativas, assunto...) passa por esc()/escAttr(): quem
// cola um enunciado com "<script>" vê o texto, e nada é executado.

import { esc, escAttr } from './utils.js';
import { ico } from './icons.js';
import { LETRAS, questaoAtual, totalRespondidas, indicesNaoRespondidos, textoStatus, rotuloTipo, situacaoDe, intervaloDe, textoProximaRevisao } from './questoes-logica.js';

const plural = (n, singular, pluralTxt) => `${n} ${n === 1 ? singular : pluralTxt}`;
const corSegura = (cor) => (/^#[0-9a-f]{3,8}$/i.test(cor || '') ? cor : '#94a3b8');

// ── filtros ───────────────────────────────────────────────────────────────────
export function htmlOpcoes({ total, opcoes }, rotuloTodas, selecionado) {
  const itens = opcoes.map(o =>
    `<option value="${escAttr(o.valor)}"${String(o.valor) === String(selecionado) ? ' selected' : ''}>${esc(o.rotulo)} (${o.n})</option>`);
  return `<option value="">${esc(rotuloTodas)} (${total})</option>` + itens.join('');
}

export function htmlSegTipo(contagem, atual) {
  const itens = [['todos', 'Todos', contagem.todos], ['ME', 'Múltipla escolha', contagem.ME], ['CE', 'Certo ou errado', contagem.CE]];
  return itens.map(([valor, rotulo, n]) =>
    `<button type="button" class="q-seg-btn" aria-pressed="${atual === valor}" onclick="Questoes.tipo('${valor}')">${rotulo} (${n})</button>`
  ).join('');
}

// ── painel de desempenho ──────────────────────────────────────────────────────
export function htmlPainel(r, situacao) {
  if (!r.total) return '';
  const ativo = situacao || 'todas';
  const desempenho = r.tentativas
    ? `<strong>${r.taxaAcerto}%</strong> de acerto · ${plural(r.erros, 'erro', 'erros')} em ${plural(r.tentativas, 'tentativa', 'tentativas')}`
    : 'Ainda sem tentativas';
  const faixa = (classe, n) => (n ? `<span class="${classe}" style="flex:${n} 1 0"></span>` : '');
  const cartoes = [
    { id: 'todas', icone: 'book-open', rotulo: 'No caderno', num: r.total, classe: '', sub: r.total === 1 ? 'questão cadastrada' : 'questões cadastradas' },
    { id: 'dominadas', icone: 'check', rotulo: 'Dominadas', num: r.dominadas, classe: ' ok', sub: `${r.pctDominadas}% · em dia` },
    { id: 'vencidas', icone: 'clock', rotulo: 'Vencidas', num: r.vencidas, classe: ' venc', sub: 'hora de rever' },
    { id: 'revisar', icone: 'undo', rotulo: 'Para revisar', num: r.revisar, classe: ' err', sub: 'errou na última vez' },
    { id: 'novas', icone: 'minus', rotulo: 'Ainda não refeitas', num: r.novas, classe: ' nd', sub: 'nunca resolvidas' },
  ];
  const cta = r.hoje
    ? `<button type="button" class="btn btn-ghost q-hoje" onclick="Questoes.revisarHoje()">${ico('play')} Revisar hoje · ${r.hoje}</button>`
    : (r.tentativas ? `<span class="q-hoje-ok">${ico('check')} Revisão de hoje em dia</span>` : '');
  return `<section class="card q-painel" aria-label="Seu desempenho">
    <div class="q-painel-cab"><div class="q-painel-esq"><h3>Seu desempenho</h3>${cta}</div><span class="q-painel-taxa">${desempenho}</span></div>
    <div class="q-barra-geral" role="img" aria-label="${r.acertos} acertos e ${r.erros} erros nas tentativas">${faixa('ok', r.acertos)}${faixa('err', r.erros)}</div>
    <div class="q-kpis">${cartoes.map(c => `<button type="button" class="q-kpi" aria-pressed="${ativo === c.id}" onclick="Questoes.situacao('${c.id}')">
      <span class="q-kpi-rot">${ico(c.icone)} ${c.rotulo}</span><span class="q-kpi-num${c.classe}">${c.num}</span><span class="q-kpi-sub">${c.sub}</span></button>`).join('')}</div>
  </section>`;
}

// ── lista ─────────────────────────────────────────────────────────────────────
export function htmlTopoAcoes(n) {
  return `<button type="button" class="btn btn-ghost" onclick="Questoes.abrirNovo()">${ico('plus')} Nova questão</button>`
    + (n ? `<button type="button" class="btn btn-primary" onclick="Questoes.iniciarRefazer()" title="Resolver ${n} ${n === 1 ? 'questão' : 'questões'}" aria-label="Resolver ${n} ${n === 1 ? 'questão' : 'questões'}">${ico('play')}</button>` : '');
}

/** A quantidade de questões da lista, só pra leitor de tela (o painel já mostra os números na tela). */
export function htmlContagemOculta(n) {
  return `<p class="sr-only" role="status">${plural(n, 'questão', 'questões')}</p>`;
}

export function htmlLinha(q) {
  const estado = { novas: 'nd', dominadas: 'ok', vencidas: 'venc', revisar: 'err' }[situacaoDe(q)];
  const icone = { nd: 'minus', ok: 'check', venc: 'clock', err: 'x' }[estado];
  const assunto = q.assunto ? `<span class="q-assunto">${esc(q.assunto)}</span>` : '';
  const banca = q.banca ? `<span class="q-chip">${esc(q.banca)}</span>` : '';
  return `<article class="q-linha" tabindex="0" onclick="Questoes.abrir(${q.id})" onkeydown="if(event.key==='Enter'&amp;&amp;event.target===this)Questoes.abrir(${q.id})">
    <span class="q-st q-st-${estado}" aria-hidden="true">${ico(icone)}</span>
    <div class="q-linha-meio">
      <div class="q-meta">
        <span class="q-pt" style="background:${corSegura(q.materia_cor)}"></span>
        <span class="q-materia">${esc(q.materia_nome || 'Sem matéria')}</span>
        ${assunto}${banca}<span class="q-chip">${rotuloTipo(q.tipo)}</span>
      </div>
      <p class="q-enun">${esc(q.enunciado)}</p>
      <p class="q-status-txt">${esc(textoStatus(q))}</p>
    </div>
    <div class="q-acoes">
      <button type="button" class="icon-btn" onclick="event.stopPropagation(); Questoes.abrir(${q.id})" title="Editar questão" aria-label="Editar questão">${ico('edit')}</button>
      <button type="button" class="icon-btn" onclick="event.stopPropagation(); Questoes.excluir(${q.id})" title="Excluir questão" aria-label="Excluir questão">${ico('trash')}</button>
    </div>
  </article>`;
}

export function htmlMostrarMais(restam) {
  return `<div class="q-mais"><button type="button" class="btn btn-ghost" onclick="Questoes.mostrarMais()">Mostrar mais (${restam})</button></div>`;
}

export function htmlVazioCaderno() {
  return `<div class="card q-vazio">${ico('book-open', 'q-vazio-ico')}
    <h3>Seu caderno está vazio</h3>
    <p>Cadastre as questões que você errou ou achou traiçoeiras e refaça quando quiser.</p>
    <button type="button" class="btn btn-primary" onclick="Questoes.abrirNovo()">${ico('plus')} Cadastrar a primeira questão</button>
  </div>`;
}

export function htmlSemResultados() {
  return `<div class="card q-vazio">${ico('search', 'q-vazio-ico')}
    <h3>Nenhuma questão com esses filtros</h3>
    <p>Tire algum filtro, ou limpe todos para ver o caderno inteiro.</p>
    <button type="button" class="btn btn-ghost" onclick="Questoes.limpar()">Limpar filtros</button>
  </div>`;
}

// ── modo refazer ──────────────────────────────────────────────────────────────
function htmlAlternativa(e, q, i, rotulo, letra, ehCE) {
  const cortada = e.cortadas.includes(i);
  const gabIdx = e.respondida ? (ehCE ? ['C', 'E'] : LETRAS).indexOf(e.resultado.gabarito) : -1;
  const certa = e.respondida && i === gabIdx;
  const errada = e.respondida && i === e.marcada && i !== gabIdx;
  const marcada = !e.respondida && e.marcada === i;
  // depois de responder, a correta aparece limpa (sem tachado) mesmo que tenha sido riscada
  const classes = ['q-alt', (cortada && !certa) && 'cortada', marcada && 'marcada', certa && 'certa', errada && 'errada'].filter(Boolean).join(' ');
  const tesoura = ehCE ? '' : `<button type="button" class="q-tesoura" data-alt="${i}" onclick="Questoes.cortar(${i})" aria-pressed="${cortada}" aria-label="${cortada ? 'Restaurar' : 'Riscar'} alternativa ${letra}"${e.respondida ? ' disabled' : ''}>${ico(cortada ? 'undo' : 'scissors')}</button>`;
  const marca = certa ? `<span class="q-marca q-marca-ok">${ico('check')}</span>` : (errada ? `<span class="q-marca q-marca-err">${ico('x')}</span>` : '');
  return `<div class="${classes}">${tesoura}
    <div class="q-alt-corpo" data-alt="${i}" role="radio" tabindex="${cortada ? -1 : 0}" aria-checked="${marcada || (e.respondida && e.marcada === i)}" aria-disabled="${cortada || e.respondida}" onclick="Questoes.marcar(${i})" onkeydown="if(event.key===' '||event.key==='Enter'){event.preventDefault();Questoes.marcar(${i})}">
      <span class="q-letra">${letra}</span><span class="q-alt-texto">${esc(rotulo)}</span>${marca}
    </div></div>`;
}

export function htmlCartaoRefazer(e) {
  const q = questaoAtual(e);
  const total = e.fila.length;
  const concluidas = totalRespondidas(e);
  const seta = (nav, icone, rotulo, atalho, handler, desabilitada) =>
    `<button type="button" class="icon-btn q-nav-btn" data-nav="${nav}" onclick="Questoes.${handler}()" title="${rotulo} (${atalho})" aria-label="${rotulo}"${desabilitada ? ' disabled' : ''}>${ico(icone)}</button>`;
  const ehCE = q.tipo === 'CE';
  const rotulos = ehCE ? ['Certo', 'Errado'] : q.alternativas;
  const letras = ehCE ? ['C', 'E'] : LETRAS;

  const topo = `<div class="q-refazer-topo">
    <button type="button" class="btn btn-ghost" onclick="Questoes.sair()">${ico('arrow-left')} Voltar ao caderno</button>
    <div class="q-progresso">
      <div class="q-nav">${seta('anterior', 'chevron-left', 'Questão anterior', 'seta esquerda', 'anterior', e.indice === 0)}<span class="q-progresso-txt">Questão ${e.indice + 1} de ${total}</span>${seta('seguinte', 'chevron-right', 'Ir para a próxima questão', 'seta direita', 'seguinte', e.indice + 1 >= total)}</div>
      <div class="q-barra" role="progressbar" aria-label="Progresso da rodada" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${concluidas}"><div style="width:${Math.round((concluidas / total) * 100)}%"></div></div>
    </div>
    <span class="q-placar">${plural(e.acertos, 'acerto', 'acertos')} · ${plural(e.erros, 'erro', 'erros')}</span>
  </div>`;

  const alternativas = rotulos.map((txt, i) => htmlAlternativa(e, q, i, txt, letras[i], ehCE)).join('');

  let rodape;
  if (!e.respondida) {
    rodape = `<div class="q-rodape"><button type="button" class="btn btn-primary" onclick="Questoes.responder()">Responder</button><span class="q-erro" role="alert">${esc(e.erro)}</span></div>`
      + (ehCE ? '' : '<p class="q-dica">Toque na tesoura para riscar uma alternativa. Alternativa riscada não pode ser marcada; toque de novo para restaurar.</p>');
  } else {
    const r = e.resultado;
    const gabaritoTxt = ehCE ? (r.gabarito === 'C' ? 'Certo' : 'Errado') : r.gabarito;
    const aviso = r.acertou
      ? `<div class="q-resultado ok">Você acertou${r.acertos_seguidos > 0 ? ` · próxima revisão ${textoProximaRevisao(intervaloDe(r.acertos_seguidos))}` : ''}</div>`
      : `<div class="q-resultado err">Você errou. O gabarito é ${esc(gabaritoTxt)}.</div>`;
    const nota = (!r.acertou && e.riscouAGabarito)
      ? `<p class="q-nota">Você tinha riscado a alternativa ${esc(r.gabarito)}, que era a correta.</p>` : '';
    const justificativa = r.justificativa
      ? `<div class="q-just"><span class="q-rotulo">Justificativa</span><p>${esc(r.justificativa)}</p></div>` : '';
    const proximaTxt = e.indice + 1 >= total ? 'Ver resultado' : 'Próxima questão';
    rodape = `${aviso}${nota}${justificativa}
      <div class="q-rodape">
        <button type="button" class="btn btn-primary" data-foco="proxima" onclick="Questoes.proxima()">${proximaTxt} ${ico('chevron-right')}</button>
        <button type="button" class="btn btn-ghost" onclick="Questoes.refazerEsta()">${ico('undo')} Refazer esta</button>
      </div>`;
  }

  return `${topo}
    <div class="card q-cartao">
      <div class="q-meta q-cartao-meta">
        <span class="q-pt" style="background:${corSegura(q.materia_cor)}"></span>
        <span class="q-materia">${esc(q.materia_nome || 'Sem matéria')}</span>
        ${q.assunto ? `<span class="q-chip">${esc(q.assunto)}</span>` : ''}
        ${q.banca ? `<span class="q-chip">${esc(q.banca)}</span>` : ''}
        <span class="q-chip">${rotuloTipo(q.tipo)}</span>
      </div>
      <p class="q-enunciado">${esc(q.enunciado)}</p>
      <div role="radiogroup" aria-label="Alternativas">${alternativas}</div>
      ${rodape}
    </div>`;
}

export function htmlFim(e) {
  const respondidas = e.acertos + e.erros;
  const pct = respondidas ? Math.round((e.acertos / respondidas) * 100) : 0;
  const erradas = e.errouIds.length;
  const puladas = indicesNaoRespondidos(e).length;
  const principal = (cond) => (cond ? 'btn-primary' : 'btn-ghost');
  return `<div class="card q-fim">
    <h3>Fim da rodada</h3>
    <div class="q-fim-numeros">
      <div><span class="q-fim-num">${pct}%</span><span class="q-rotulo">de acerto</span></div>
      <div><span class="q-fim-num">${e.acertos}</span><span class="q-rotulo">${e.acertos === 1 ? 'acerto' : 'acertos'}</span></div>
      <div><span class="q-fim-num">${e.erros}</span><span class="q-rotulo">${e.erros === 1 ? 'erro' : 'erros'}</span></div>
    </div>
    ${puladas ? `<p class="q-nota">Você pulou ${plural(puladas, 'questão', 'questões')} nesta rodada.</p>` : ''}
    <div class="q-rodape">
      ${puladas ? `<button type="button" class="btn btn-primary" onclick="Questoes.irParaPulada()">${ico('chevron-left')} Responder ${puladas === 1 ? 'a pulada' : 'as puladas'}</button>` : ''}
      ${erradas ? `<button type="button" class="btn ${principal(!puladas)}" onclick="Questoes.refazerErradas()">${ico('undo')} Refazer as erradas (${erradas})</button>` : ''}
      <button type="button" class="btn btn-ghost" onclick="Questoes.refazerTudo()">Refazer tudo de novo</button>
      <button type="button" class="btn btn-ghost" onclick="Questoes.sair()">Voltar ao caderno</button>
    </div>
  </div>`;
}

// ── formulário ────────────────────────────────────────────────────────────────
export function htmlAlternativasForm(valores = [], gabarito = '') {
  return LETRAS.map((letra, i) => `<div class="q-edit-alt">
      <button type="button" class="q-gab" role="radio" aria-checked="${gabarito === letra}" aria-label="Marcar a alternativa ${letra} como correta" onclick="Questoes.marcarGabarito('${letra}')">${ico('check')}</button>
      <label class="q-letra" for="qm-alt-${i}">${letra}</label>
      <textarea id="qm-alt-${i}" rows="2" oninput="Questoes.editou('alternativas')" placeholder="${i < 2 ? 'Texto da alternativa' : 'Opcional'}">${escAttr(valores[i] ?? '')}</textarea>
    </div>`).join('');
}