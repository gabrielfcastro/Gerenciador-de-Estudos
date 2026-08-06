import { Api } from './api.js';
import {
  esc, fmtDuration, formatarLabels, toLocalDatetimeValue, toUTCIso,
  deslocarReferencia, rotuloPeriodoNavegavel, tooltipDuracao, fmtEixoHoras,
} from './utils.js';
import { buildCsel, registerCsel } from './csel.js';
import { getCategories, onCategoriesChange, onCategoryDeleted, refreshHours } from './categories.js';

let currentPeriod = 'week';
let periodOffset  = 0;
let chart         = null;
let openGroups    = new Set();
let editSessId    = null;
let editSelCatId  = null;

const PERIODOS_NAVEGAVEIS = ['today', 'week', 'month'];
function isNavegavel(period) { return PERIODOS_NAVEGAVEIS.includes(period); }

function getReferencia() {
  return isNavegavel(currentPeriod) ? deslocarReferencia(currentPeriod, periodOffset) : null;
}

function renderPeriodNav() {
  const nav = document.getElementById('period-nav');
  if (!nav) return;
  if (!isNavegavel(currentPeriod)) { nav.style.display = 'none'; return; }
  nav.style.display = 'flex';
  document.getElementById('period-nav-label').textContent = rotuloPeriodoNavegavel(currentPeriod, periodOffset);
  document.getElementById('period-nav-next').disabled = periodOffset === 0;
}

export function prevPeriod() {
  if (!isNavegavel(currentPeriod)) return;
  periodOffset += 1;
  renderPeriodNav();
  refreshAll();
}

export function nextPeriod() {
  if (!isNavegavel(currentPeriod) || periodOffset === 0) return;
  periodOffset -= 1;
  renderPeriodNav();
  refreshAll();
}

registerCsel('edit-csel', {
  onSelect: (id) => { editSelCatId = id; },
  getCategories,
});

onCategoriesChange(() => refreshHours(currentPeriod));
onCategoryDeleted(() => loadChart());

export function getCurrentPeriod() { return currentPeriod; }

export async function loadChart() {
  try { renderChart(await Api.getChart(currentPeriod, null, getReferencia())); }
  catch {}
}

function renderChart(data) {
  const ctx = document.getElementById('chart').getContext('2d');
  if (chart) chart.destroy();

  if (currentPeriod === 'all' || currentPeriod === 'today') {
    const bycat = {};
    data.forEach(d => {
      const key   = d.category_name || 'Sem categoria';
      const color = d.category_color || '#8b90a8';
      if (!bycat[key]) bycat[key] = { secs: 0, color };
      bycat[key].secs += d.total_seconds;
    });
    const labels = Object.keys(bycat);
    const values = labels.map(k => +(bycat[k].secs / 3600).toFixed(2));
    const colors = labels.map(k => bycat[k].color);

    const wrap = document.getElementById('chart').parentElement;
    wrap.className = 'chart-wrap-pie';
    wrap.innerHTML = `<canvas id="chart"></canvas><div class="pie-legend" id="pie-legend"></div>`;
    const ctx2 = document.getElementById('chart').getContext('2d');

    chart = new Chart(ctx2, {
      type: 'doughnut',
      data: { labels, datasets: [{ data: values, backgroundColor: colors.map(c => c + 'cc'), borderColor: colors, borderWidth: 2 }] },
      options: {
        responsive: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ` ${c.label}: ${tooltipDuracao(c.parsed)}` } } },
        cutout: '60%',
      }
    });

    const totalH = values.reduce((a, b) => a + b, 0);
    document.getElementById('pie-legend').innerHTML = labels.map((l, i) => `
      <div class="pie-legend-item">
        <div class="pie-legend-dot" style="background:${colors[i]}"></div>
        <span class="pie-legend-name">${esc(l)}</span>
        <span class="pie-legend-val">${tooltipDuracao(values[i])}</span>
      </div>`).join('');
    return;
  }

  const wrap = document.getElementById('chart') ? document.getElementById('chart').parentElement : null;
  if (wrap && wrap.className !== 'chart-wrap') {
    wrap.className = 'chart-wrap';
    wrap.innerHTML = `<canvas id="chart"></canvas>`;
  }
  const ctxBar = document.getElementById('chart').getContext('2d');

  const periods  = [...new Set(data.map(d => d.period_key))];
  const labels   = formatarLabels(periods, currentPeriod);
  const catNames = [...new Set(data.filter(d => d.category_name).map(d => d.category_name))];
  const datasets = catNames.map(name => {
    const color = data.find(d => d.category_name === name)?.category_color || '#7c6ff7';
    return {
      label: name,
      data: periods.map(p => { const r = data.find(d => d.period_key === p && d.category_name === name); return r ? +(r.total_seconds / 3600).toFixed(2) : 0; }),
      backgroundColor: color + 'cc', borderColor: color, borderWidth: 1, borderRadius: 6,
    };
  });
  const uncatData = periods.map(p => { const r = data.find(d => d.period_key === p && !d.category_name); return r ? +(r.total_seconds / 3600).toFixed(2) : 0; });
  if (uncatData.some(v => v > 0)) datasets.push({ label: 'Sem categoria', data: uncatData, backgroundColor: '#8b90a8cc', borderColor: '#8b90a8', borderWidth: 1, borderRadius: 6 });

  chart = new Chart(ctxBar, {
    type: 'bar', data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#4e5370', font: { size: 12 }, boxWidth: 10, borderRadius: 4 } },
        tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${tooltipDuracao(c.parsed.y)}` } }
      },
      scales: {
        x: { stacked: true, ticks: { color: '#4e5370', font: { size: 11 } }, grid: { color: '#a8adc0' } },
        y: { stacked: true, ticks: { color: '#4e5370', font: { size: 11 }, callback: v => fmtEixoHoras(v) }, grid: { color: '#a8adc0' } }
      }
    }
  });
}

export function setPeriod(p, btn) {
  currentPeriod = p;
  periodOffset  = 0;
  document.querySelectorAll('.ptab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  refreshAll();
}

export async function loadStats() {
  try {
    const { total_seconds: t, session_count: c } = await Api.getStats(currentPeriod, getReferencia());
    document.getElementById('stat-total').textContent = t ? fmtDuration(t) : '—';
    document.getElementById('stat-count').textContent = c || '—';
    document.getElementById('stat-avg').textContent   = c ? fmtDuration(Math.round(t / c)) : '—';
  } catch {}
}

export async function loadSessions() {
  try { renderSessions(await Api.getSessions(currentPeriod, null, getReferencia())); }
  catch {}
}

export async function refreshAll() {
  renderPeriodNav();
  await Promise.all([loadChart(), loadStats(), loadSessions(), refreshHours(currentPeriod)]);
}

function groupSessions(list) {
  const map = new Map();
  for (const s of list) {
    const key = s.category_id ?? s.categoria_id ?? 'sem-cat';
    if (!map.has(key)) {
      map.set(key, {
        category_id:    s.category_id ?? s.categoria_id,
        category_name:  s.category_name  || 'Sem categoria',
        category_color: s.category_color || '#8b90a8',
        total_seconds:  0,
        sessions:       [],
      });
    }
    const g = map.get(key);
    g.total_seconds += s.duration_seconds || 0;
    g.sessions.push(s);
  }
  return [...map.values()].sort((a, b) => b.total_seconds - a.total_seconds);
}

function renderSessions(list) {
  const el = document.getElementById('sess-list');
  if (!list.length) { el.innerHTML = '<div class="empty">📚 Nenhuma sessão neste período.</div>'; return; }
  const groups = groupSessions(list);
  el.innerHTML = groups.map(g => {
    const isOpen     = openGroups.has(g.category_id);
    const count      = g.sessions.length;
    const total      = fmtDuration(g.total_seconds);
    const labelCount = count === 1 ? '1 sessão' : `${count} sessões`;
    const children   = g.sessions.map(s => {
      const dur  = s.duration_seconds ? fmtDuration(s.duration_seconds) : '—';
      const raw  = s.started_at || s.inicio || '';
      const dt   = raw ? new Date(raw.replace(' ', 'T')).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
      const note = s.note ? `<span class="sess-child-note">📝 ${esc(s.note)}</span>` : '';
      return `<div class="sess-child">
        <div class="sess-child-left">
          <span class="sess-child-time">${dt}</span>${note}
        </div>
        <span class="sess-child-dur">${dur}</span>
        <button class="sess-edit" onclick="openEditSess(${s.id})" title="Editar">✏</button>
        <button class="sess-del"  onclick="deleteSess(${s.id})"   title="Excluir">✕</button>
      </div>`;
    }).join('');
    return `<div class="sess-group">
      <div class="sess-group-header" onclick="toggleGroup(${JSON.stringify(g.category_id)})">
        <div class="sess-group-dot" style="background:${g.category_color}"></div>
        <span class="sess-group-name">${esc(g.category_name)}</span>
        <span class="sess-group-meta">${labelCount}</span>
        <span class="sess-group-total">${total}</span>
        <span class="sess-group-arrow ${isOpen ? 'open' : ''}">▶</span>
      </div>
      <div class="sess-group-children" style="display:${isOpen ? 'block' : 'none'}">${children}</div>
    </div>`;
  }).join('');
}

export function toggleGroup(categoryId) {
  if (openGroups.has(categoryId)) openGroups.delete(categoryId);
  else openGroups.add(categoryId);
  loadSessions();
}

export async function deleteSess(id) {
  if (!confirm('Excluir essa sessão de estudo permanentemente?')) return;
  await Api.deleteSession(id);
  await refreshAll();
}

export async function openEditSess(id) {
  const all = await Api.getSessions('all');
  const s = all.find(x => x.id === id);
  if (!s) return;

  editSessId   = id;
  editSelCatId = s.category_id || s.categoria_id || null;

  buildCsel('edit-csel', getCategories(), editSelCatId);

  const cat = editSelCatId ? getCategories().find(c => String(c.id) === String(editSelCatId)) : null;
  const dot  = document.getElementById('edit-csel-dot');
  const text = document.getElementById('edit-csel-text');
  if (cat) {
    dot.style.display    = 'inline-block';
    dot.style.background = cat.color;
    text.textContent     = cat.name;
    text.classList.remove('placeholder');
  } else {
    dot.style.display = 'none';
    text.textContent  = '— sem categoria —';
    text.classList.add('placeholder');
  }

  const inicioStr = s.started_at || s.inicio || '';
  const fimStr    = s.fim || s.ended_at || '';
  document.getElementById('edit-start').value = toLocalDatetimeValue(inicioStr);
  document.getElementById('edit-end').value   = toLocalDatetimeValue(fimStr);
  document.getElementById('edit-note').value  = s.note || s.nota || '';

  document.getElementById('edit-sess-modal').classList.add('open');
}

export function closeEditSess() {
  document.getElementById('edit-sess-modal').classList.remove('open');
  editSessId = null;
}

export async function saveEditSess() {
  const startLocal = document.getElementById('edit-start').value;
  const endLocal   = document.getElementById('edit-end').value;
  if (!startLocal || !endLocal) { alert('Preencha início e fim.'); return; }

  const startUTC = toUTCIso(startLocal);
  const endUTC   = toUTCIso(endLocal);
  if (new Date(endUTC) <= new Date(startUTC)) {
    alert('O fim deve ser depois do início.'); return;
  }

  const catId = editSelCatId || null;
  const note  = document.getElementById('edit-note').value.trim();

  await Api.updateSession(editSessId, {
    category_id: catId ? parseInt(catId) : null,
    started_at:  startUTC,
    ended_at:    endUTC,
    note,
  });

  closeEditSess();
  await refreshAll();
}

export function initSessionModals() {
  document.getElementById('edit-sess-modal').addEventListener('click', function (e) {
    if (e.target === this) closeEditSess();
  });
}