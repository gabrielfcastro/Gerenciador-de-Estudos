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