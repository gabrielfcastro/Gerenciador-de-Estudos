import { Api } from './api.js';
import {
  lerVarCss, esc, fmtDuration, formatarLabels, toLocalDatetimeValue, toUTCIso,
  deslocarReferencia, rotuloPeriodoNavegavel, tooltipDuracao, fmtEixoHoras, somarEmpilhado,
} from './utils.js';
import { buildCsel, registerCsel, resetCsel } from './csel.js';
import { loadHeatmap } from './heatmap.js';
import { ico } from './icons.js';
import { toast, confirmar } from './ui.js';
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

let manualSelCatId = null;
registerCsel('manual-csel', {
  onSelect: (id) => { manualSelCatId = id; },
  getCategories,
});

onCategoriesChange(() => refreshHours(currentPeriod));
onCategoryDeleted(() => loadChart());

export function getCurrentPeriod() { return currentPeriod; }

export async function loadChart() {
  try { renderChart(await Api.getChart(currentPeriod, null, getReferencia())); }
  catch {}
}

// Tooltip externo do gráfico de pizza: em vez de desenhar dentro do canvas
// (que corta na borda quando o texto não cabe no espaço do gráfico pequeno),
// isso cria uma div HTML normal flutuando por cima, sem limite de borda.
function pieTooltipExterno(context) {
  const { chart, tooltip } = context;

  let el = document.getElementById('pie-tooltip-externo');
  if (!el) {
    el = document.createElement('div');
    el.id = 'pie-tooltip-externo';
    el.className = 'pie-tooltip-externo';
    document.body.appendChild(el);
  }

  if (tooltip.opacity === 0) {
    el.style.opacity = 0;
    return;
  }

  if (tooltip.body) {
    const dp    = tooltip.dataPoints[0];
    const cor   = tooltip.labelColors[0].backgroundColor;
    const nome  = dp.label;
    const valor = tooltipDuracao(dp.parsed);
    el.innerHTML = `<span class="pie-tooltip-dot" style="background:${cor}"></span>${esc(nome)}: ${valor}`;
  }

  const rect = chart.canvas.getBoundingClientRect();
  el.style.opacity = 1;
  el.style.left = (rect.left + window.scrollX + tooltip.caretX) + 'px';
  el.style.top  = (rect.top  + window.scrollY + tooltip.caretY) + 'px';
}

// Escreve o total de horas no topo de cada barra empilhada (leitura direta, sem tooltip).
const totaisNoTopo = {
  id: 'totaisNoTopo',
  afterDatasetsDraw(chart) {
    const { ctx, scales: { x, y }, data } = chart;
    ctx.save();
    ctx.font = '700 15px Inter, system-ui, sans-serif';
    ctx.fillStyle = lerVarCss('--text');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    data.labels.forEach((_, i) => {
      const horas = somarEmpilhado(data.datasets, i);
      if (horas <= 0) return;
      // o texto usa os segundos exatos (as barras guardam horas com 2 casas, que arredondam)
      const segundos = somarEmpilhado(data.datasets.map(d => ({ data: d.segundos })), i);
      ctx.fillText(fmtDuration(segundos), x.getPixelForValue(i), y.getPixelForValue(horas) - 8);
    });
    ctx.restore();
  },
};

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
        plugins: { legend: { display: false }, tooltip: { enabled: false, external: pieTooltipExterno } },
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
      segundos: periods.map(p => { const r = data.find(d => d.period_key === p && d.category_name === name); return r ? r.total_seconds : 0; }),
      backgroundColor: color, borderColor: lerVarCss('--surface'), borderWidth: 2, borderRadius: 4,
    };
  });
  const uncatData = periods.map(p => { const r = data.find(d => d.period_key === p && !d.category_name); return r ? +(r.total_seconds / 3600).toFixed(2) : 0; });
  const uncatSeg = periods.map(p => { const r = data.find(d => d.period_key === p && !d.category_name); return r ? r.total_seconds : 0; });
  if (uncatData.some(v => v > 0)) datasets.push({ label: 'Sem categoria', data: uncatData, segundos: uncatSeg, backgroundColor: '#94a3b8', borderColor: lerVarCss('--surface'), borderWidth: 2, borderRadius: 4 });

  chart = new Chart(ctxBar, {
    type: 'bar', data: { labels, datasets }, plugins: [totaisNoTopo],
    options: {
      responsive: true, maintainAspectRatio: false,
      layout: { padding: { top: 4 } },
      plugins: {
        legend: { labels: { color: lerVarCss('--text2'), font: { size: 13 }, boxWidth: 10, borderRadius: 4, padding: 14 } },
        tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${fmtDuration(c.dataset.segundos[c.dataIndex])}` } }
      },
      scales: {
        x: { stacked: true, ticks: { color: lerVarCss('--text2'), font: { size: 12 } }, grid: { color: lerVarCss('--border') } },
        y: { stacked: true, grace: '20%', ticks: { color: lerVarCss('--text2'), font: { size: 12 }, callback: v => fmtEixoHoras(v) }, grid: { color: lerVarCss('--border') } }
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
  await Promise.all([loadChart(), loadStats(), loadSessions(), refreshHours(currentPeriod), loadHeatmap()]);
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
  if (!list.length) { el.innerHTML = '<div class="empty">Nenhuma sessão neste período.</div>'; return; }
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
      const note = s.note ? `<span class="sess-child-note">${ico('file-text')} ${esc(s.note)}</span>` : '';
      return `<div class="sess-child">
        <div class="sess-child-left">
          <span class="sess-child-time">${dt}</span>${note}
        </div>
        <span class="sess-child-dur">${dur}</span>
        <button class="icon-btn sess-edit" onclick="openEditSess(${s.id})" title="Editar sessão" aria-label="Editar sessão">${ico('edit')}</button>
        <button class="icon-btn sess-del" onclick="deleteSess(${s.id})" title="Excluir sessão" aria-label="Excluir sessão">${ico('x')}</button>
      </div>`;
    }).join('');
    return `<div class="sess-group">
      <div class="sess-group-header" role="button" tabindex="0" aria-expanded="${isOpen}" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();this.click()}" onclick="toggleGroup(${JSON.stringify(g.category_id)})">
        <div class="sess-group-dot" style="background:${g.category_color}"></div>
        <span class="sess-group-name">${esc(g.category_name)}</span>
        <span class="sess-group-meta">${labelCount}</span>
        <span class="sess-group-total">${total}</span>
        <span class="sess-group-arrow ${isOpen ? 'open' : ''}">${ico('chevron-right')}</span>
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
  const ok = await confirmar('Essa sessão de estudo será apagada de vez.', { titulo: 'Excluir sessão?', confirmar: 'Excluir', perigo: true });
  if (!ok) return;
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
  if (!startLocal || !endLocal) { toast('Preencha o início e o fim.', 'erro'); return; }

  const startUTC = toUTCIso(startLocal);
  const endUTC   = toUTCIso(endLocal);
  if (new Date(endUTC) <= new Date(startUTC)) {
    toast('O fim precisa ser depois do início.', 'erro'); return;
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
  document.getElementById('manual-sess-modal').addEventListener('click', function (e) {
    if (e.target === this) closeManualSess();
  });
}

export function openManualSess() {
  manualSelCatId = null;
  resetCsel('manual-csel');
  buildCsel('manual-csel', getCategories(), null);

  document.getElementById('manual-start').value = '';
  document.getElementById('manual-end').value   = '';
  document.getElementById('manual-note').value  = '';

  document.getElementById('manual-sess-modal').classList.add('open');
}

export function closeManualSess() {
  document.getElementById('manual-sess-modal').classList.remove('open');
}

export async function saveManualSess() {
  const startLocal = document.getElementById('manual-start').value;
  const endLocal   = document.getElementById('manual-end').value;
  if (!startLocal || !endLocal) { toast('Preencha o início e o fim.', 'erro'); return; }

  const startUTC = toUTCIso(startLocal);
  const endUTC   = toUTCIso(endLocal);
  if (new Date(endUTC) <= new Date(startUTC)) {
    toast('O fim precisa ser depois do início.', 'erro'); return;
  }

  const catId = manualSelCatId || null;
  const note  = document.getElementById('manual-note').value.trim();

  await Api.createManualSession(catId ? parseInt(catId) : null, startUTC, endUTC, note);

  closeManualSess();
  await refreshAll();
}