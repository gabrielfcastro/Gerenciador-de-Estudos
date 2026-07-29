// ── Funções puras de formatação/escape, usadas por vários módulos ────────────
// Nenhuma função aqui toca o DOM ou guarda estado — só transforma dados.

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

/** Converte "1h15m", "45m", "90" (minutos) em segundos. Retorna null se inválido. */
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
