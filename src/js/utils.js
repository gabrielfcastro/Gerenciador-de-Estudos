// Lê o valor atual de uma variável CSS (ex.: '--text2') — respeita o tema ativo.
export function lerVarCss(nome, el = document.documentElement) {
  return getComputedStyle(el).getPropertyValue(nome).trim();
}

export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = h.length === 3
    ? h.split('').map(c => c + c).join('')
    : h;
  const num = parseInt(n, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

// Mistura hexA com hexB, onde `peso` (0 a 1) é o quanto de hexA entra na mistura.
export function blendHex(hexA, hexB, peso) {
  const a = hexToRgb(hexA), b = hexToRgb(hexB);
  const r = Math.round(a.r * peso + b.r * (1 - peso));
  const g = Math.round(a.g * peso + b.g * (1 - peso));
  const bl = Math.round(a.b * peso + b.b * (1 - peso));
  return `rgb(${r}, ${g}, ${bl})`;
}

export function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function pad(n) {
  return String(n).padStart(2, '0');
}

export function fmtClock(secs) {
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export function fmtDuration(secs) {
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60;
  if (h > 0 && m > 0) return `${h}h ${pad(m)}m`;
  if (h > 0)          return `${h}h`;
  if (m > 0 && s > 0) return `${m}m ${pad(s)}s`;
  if (m > 0)          return `${m}m`;
  return `${s}s`;
}

export function parseGoal(str) {
  if (!str) return null;
  str = str.trim().toLowerCase();
  let t = 0;
  const h = str.match(/(\d+)\s*h/); if (h) t += parseInt(h[1]) * 3600;
  const m = str.match(/(\d+)\s*m/); if (m) t += parseInt(m[1]) * 60;
  const s = str.match(/(\d+)\s*s/); if (s) t += parseInt(s[1]);
  if (!h && !m && !s) { if (/^\d+$/.test(str)) t = parseInt(str) * 60; }
  return t > 0 ? t : null;
}

const DIAS_SEMANA = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
const MESES_NOMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                     'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

export function formatarLabels(periods, period) {
  if (period === 'week') {
    return periods.map(p => { const d = new Date(p + 'T12:00:00'); return DIAS_SEMANA[d.getDay()]; });
  }
  if (period === 'month') {
    return periods.map((_, i) => `Semana ${i + 1}`);
  }
  if (period === '6months' || period === 'year') {
    return periods.map(p => { const [, mes] = p.split('-'); return MESES_NOMES[parseInt(mes) - 1]; });
  }
  if (period === 'all') {
    return periods.map(p => { const [ano, mes] = p.split('-'); return `${MESES_NOMES[parseInt(mes) - 1]} ${ano}`; });
  }
  return periods;
}

export function toLocalDatetimeValue(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr.includes('T') ? isoStr : isoStr.replace(' ', 'T'));
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function toUTCIso(localStr) {
  return new Date(localStr).toISOString();
}

function segundaDaSemana(d) {
  const dia  = d.getDay();
  const diff = dia === 0 ? -6 : 1 - dia;
  const seg  = new Date(d);
  seg.setDate(d.getDate() + diff);
  return seg;
}

export function deslocarReferencia(period, offset, hoje = new Date()) {
  const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  if (period === 'today') {
    d.setDate(d.getDate() - offset);
  } else if (period === 'week') {
    d.setDate(d.getDate() - offset * 7);
  } else if (period === 'month') {
    d.setDate(1);
    d.setMonth(d.getMonth() - offset);
  }
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function rotuloPeriodoNavegavel(period, offset, hoje = new Date()) {
  const base = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());

  if (period === 'today') {
    if (offset === 0) return 'Hoje';
    const d = new Date(base);
    d.setDate(d.getDate() - offset);
    return `${d.getDate()} de ${MESES_NOMES[d.getMonth()].toLowerCase()}`;
  }

  if (period === 'week') {
    if (offset === 0) return 'Esta semana';
    const ref = new Date(base);
    ref.setDate(ref.getDate() - offset * 7);
    const seg = segundaDaSemana(ref);
    const dom = new Date(seg);
    dom.setDate(seg.getDate() + 6);
    return `${pad(seg.getDate())}/${pad(seg.getMonth() + 1)} – ${pad(dom.getDate())}/${pad(dom.getMonth() + 1)}`;
  }

  if (period === 'month') {
    if (offset === 0) return 'Este mês';
    const d = new Date(base);
    d.setDate(1);
    d.setMonth(d.getMonth() - offset);
    return `${MESES_NOMES[d.getMonth()]} de ${d.getFullYear()}`;
  }

  return '';
}

export function tooltipDuracao(horas) {
  return fmtDuration(Math.round(horas * 3600));
}

// Formata valores decimais de hora (ex: 4.5) do eixo do gráfico como "4h30"
// em vez de "4.5h" — mais rápido de ler de relance.
export function fmtEixoHoras(horasDecimais) {
  const totalMin = Math.round(horasDecimais * 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0 && m > 0) return `${h}h${pad(m)}`;
  if (h > 0) return `${h}h`;
  if (m > 0) return `${m}m`;
  return '0h';
}

// Total de uma barra empilhada do gráfico: soma o valor de todas as séries na posição i.
export function somarEmpilhado(series, i) {
  return series.reduce((soma, s) => soma + (s.data[i] || 0), 0);
}

// ── Cor legível ──────────────────────────────────────────────────────────────
// Uma cor de matéria clara (lima, amarelo) some sobre fundo claro. Em vez de
// trocar a cor, ela é escurecida (ou clareada, no tema escuro) só até ter
// contraste suficiente, preservando o tom.
export function luminancia(hex) {
  const { r, g, b } = hexToRgb(hex);
  const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function contrasteEntre(a, b) {
  const [alto, baixo] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (alto + 0.05) / (baixo + 0.05);
}

function rgbParaHex({ r, g, b }) {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

/** `minimo` 3 é o padrão WCAG para texto grande (o relógio tem 40px ou mais). */
export function corLegivel(cor, fundo, minimo = 3) {
  if (contrasteEntre(cor, fundo) >= minimo) return cor;
  const alvo = luminancia(fundo) > 0.179 ? { r: 0, g: 0, b: 0 } : { r: 255, g: 255, b: 255 };
  const base = hexToRgb(cor);
  for (let passo = 1; passo <= 20; passo++) {
    const p = passo * 0.05;
    const hex = rgbParaHex({
      r: Math.round(base.r * (1 - p) + alvo.r * p),
      g: Math.round(base.g * (1 - p) + alvo.g * p),
      b: Math.round(base.b * (1 - p) + alvo.b * p),
    });
    if (contrasteEntre(hex, fundo) >= minimo) return hex;
  }
  return rgbParaHex(alvo);
}
