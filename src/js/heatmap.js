// ── Mapa de calor dos dias estudados + sequência de dias ──────────────────────
// A parte de cálculo (nivelDoDia, montarDias, calcularSequencias) é pura, pra
// poder ser testada sem navegador. desenharHeatmap só escreve o resultado na tela.

import { Api } from './api.js';
import { esc, fmtDuration, pad } from './utils.js';

// Busca o máximo de histórico; a tela recorta o que é relevante (ver recortarDias).
export const SEMANAS_BUSCADAS = 53;
// Mesmo com pouco histórico, mostra pelo menos isso (senão a grade fica minúscula).
export const MIN_SEMANAS_VISIVEIS = 16;
// Menos que isso no dia não conta como "dia estudado" (evita sessão de teste de segundos).
export const MIN_SEGUNDOS_DIA_ESTUDADO = 60;

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

// 0 = não estudou · 1 = até 1h · 2 = até 2h · 3 = até 3h30 · 4 = 3h30 ou mais
export function nivelDoDia(segundos) {
  if (segundos < MIN_SEGUNDOS_DIA_ESTUDADO) return 0;
  const min = segundos / 60;
  if (min < 60)  return 1;
  if (min < 120) return 2;
  if (min < 210) return 3;
  return 4;
}

export function hojeLocalISO(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function somarDias(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export function montarDias(inicioISO, semanas, segundosPorDia, hojeISO) {
  const dias = [];
  for (let i = 0; i < semanas * 7; i++) {
    const data = somarDias(inicioISO, i);
    dias.push({ data, segundos: segundosPorDia[data] || 0, futuro: data > hojeISO });
  }
  return dias;
}

export function calcularSequencias(dias) {
  const passados = dias.filter(d => !d.futuro);
  const estudou = d => d.segundos >= MIN_SEGUNDOS_DIA_ESTUDADO;

  let melhor = 0, corrente = 0, estudados = 0;
  for (const d of passados) {
    if (estudou(d)) { estudados++; corrente++; melhor = Math.max(melhor, corrente); }
    else corrente = 0;
  }

  // Se hoje ainda não teve estudo, a sequência de ontem continua valendo.
  let i = passados.length - 1;
  if (i >= 0 && !estudou(passados[i])) i--;
  let atual = 0;
  while (i >= 0 && estudou(passados[i])) { atual++; i--; }

  // "X de Y dias": conta a partir do primeiro dia estudado, não da janela inteira.
  const primeiro = passados.findIndex(estudou);
  const total = primeiro === -1 ? 0 : passados.length - primeiro;

  return { atual, melhor, estudados, total };
}

// Tira do começo as semanas vazias antes de você começar a estudar, deixando
// uma semana de margem e nunca menos que `minSemanas` semanas visíveis.
export function recortarDias(dias, minSemanas = MIN_SEMANAS_VISIVEIS) {
  const semanas = dias.length / 7;
  const primeiro = dias.findIndex(d => d.segundos >= MIN_SEGUNDOS_DIA_ESTUDADO);
  const semanaDoPrimeiro = primeiro === -1 ? semanas : Math.floor(primeiro / 7);
  const inicio = Math.max(0, Math.min(semanaDoPrimeiro - 1, semanas - minSemanas));
  return dias.slice(inicio * 7);
}

function textoTempo(segundos) {
  if (segundos < MIN_SEGUNDOS_DIA_ESTUDADO) return 'sem estudo';
  return fmtDuration(Math.round(segundos / 60) * 60);
}

function rotuloDoDia(iso) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' });
}

const plural = n => (n === 1 ? '1 dia' : `${n} dias`);

export function desenharHeatmap(dados, hojeISO = hojeLocalISO()) {
  const todos   = montarDias(dados.inicio, dados.semanas, dados.dias, hojeISO);
  const visiveis = recortarDias(todos);
  const nSemanas = visiveis.length / 7;

  // A grade é uma tabela só (rótulos + células), preenchida linha a linha:
  // linha 1 = meses; linhas 2..8 = Seg..Dom, cada uma com seu rótulo e as semanas.
  const partes = ['<div></div>'];
  for (let w = 0; w < nSemanas; w++) {
    const segunda = visiveis[w * 7].data;
    const nome = Number(segunda.slice(8, 10)) <= 7 ? MESES[Number(segunda.slice(5, 7)) - 1] : '';
    partes.push(`<div class="hm-month">${nome}</div>`);
  }
  const ROTULOS = ['Seg', '', 'Qua', '', 'Sex', '', ''];
  for (let dSemana = 0; dSemana < 7; dSemana++) {
    partes.push(`<div class="hm-daylabel">${ROTULOS[dSemana]}</div>`);
    for (let w = 0; w < nSemanas; w++) {
      const d = visiveis[w * 7 + dSemana];
      if (d.futuro) { partes.push('<div class="hm-cell hm-future"></div>'); continue; }
      const txt = esc(`${rotuloDoDia(d.data)}: ${textoTempo(d.segundos)}`);
      partes.push(`<div class="hm-cell hm-l${nivelDoDia(d.segundos)}" title="${txt}" data-info="${txt}"></div>`);
    }
  }

  document.getElementById('hm-left').style.setProperty('--hm-n', String(nSemanas));
  const grid = document.getElementById('hm-grid');
  grid.innerHTML = partes.join('');

  const info = document.getElementById('hm-info');
  grid.onmouseover = (e) => {
    const t = e.target && e.target.dataset && e.target.dataset.info;
    if (t) info.textContent = t;
  };

  // sequências são calculadas sobre o histórico todo, não só sobre o que está visível
  const s = calcularSequencias(todos);
  document.getElementById('hm-atual').textContent  = plural(s.atual);
  document.getElementById('hm-melhor').textContent = plural(s.melhor);
  document.getElementById('hm-dias').textContent   = s.total ? `${s.estudados} de ${s.total}` : '—';
}

export async function loadHeatmap() {
  try { desenharHeatmap(await Api.getHeatmap(SEMANAS_BUSCADAS)); }
  catch {}
}
