process.env.TZ = 'America/Sao_Paulo';

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  esc, pad, fmtClock, fmtDuration, parseGoal,
  formatarLabels, toLocalDatetimeValue, toUTCIso,
  deslocarReferencia, rotuloPeriodoNavegavel, tooltipDuracao,
} from '../src/js/utils.js';

test('esc: escapa &, < e > para uso seguro em innerHTML', () => {
  assert.equal(esc('<script>'), '&lt;script&gt;');
  assert.equal(esc('Direito & Economia'), 'Direito &amp; Economia');
  assert.equal(esc('a < b > c & d'), 'a &lt; b &gt; c &amp; d');
});

test('esc: string sem caracteres especiais fica inalterada', () => {
  assert.equal(esc('Direito Penal'), 'Direito Penal');
});

test('esc: não escapa "&" duas vezes ao escapar < e > depois', () => {
  assert.equal(esc('<'), '&lt;');
});

test('esc: converte valores não-string via String()', () => {
  assert.equal(esc(42), '42');
  assert.equal(esc(null), 'null');
});

test('pad: preenche números de um dígito com zero à esquerda', () => {
  assert.equal(pad(0), '00');
  assert.equal(pad(5), '05');
  assert.equal(pad(15), '15');
});

test('fmtClock: formata segundos como HH:MM:SS', () => {
  assert.equal(fmtClock(0), '00:00:00');
  assert.equal(fmtClock(59), '00:00:59');
  assert.equal(fmtClock(60), '00:01:00');
  assert.equal(fmtClock(3600), '01:00:00');
  assert.equal(fmtClock(3661), '01:01:01');
});

test('fmtDuration: segundos isolados', () => {
  assert.equal(fmtDuration(0), '0s');
  assert.equal(fmtDuration(45), '45s');
});

test('fmtDuration: minutos e segundos', () => {
  assert.equal(fmtDuration(60), '1m');
  assert.equal(fmtDuration(90), '1m 30s');
});

test('fmtDuration: horas e minutos', () => {
  assert.equal(fmtDuration(3600), '1h');
  assert.equal(fmtDuration(3660), '1h 01m');
  assert.equal(fmtDuration(7320), '2h 02m');
});

test('fmtDuration: com horas > 0 e minutos == 0, os segundos são descartados', () => {
  assert.equal(fmtDuration(7230), '2h'); // 2h e 30s
});

test('parseGoal: aceita "1h15m" e formatos combinados', () => {
  assert.equal(parseGoal('1h15m'), 4500);
  assert.equal(parseGoal('45m'), 2700);
  assert.equal(parseGoal('2h'), 7200);
  assert.equal(parseGoal('30s'), 30);
});

test('parseGoal: número puro é interpretado como minutos', () => {
  assert.equal(parseGoal('90'), 5400);
});

test('parseGoal: ignora espaços e maiúsculas/minúsculas', () => {
  assert.equal(parseGoal('  1H 15M  '), 4500);
});

test('parseGoal: entradas vazias ou inválidas retornam null', () => {
  assert.equal(parseGoal(''), null);
  assert.equal(parseGoal(null), null);
  assert.equal(parseGoal('abc'), null);
});

test('parseGoal: resultado zero (ex.: "0" ou "0h") retorna null, não 0', () => {
  assert.equal(parseGoal('0'), null);
  assert.equal(parseGoal('0h0m'), null);
});

test('formatarLabels: período "week" vira nome do dia da semana', () => {
  assert.deepEqual(formatarLabels(['2026-07-21'], 'week'), ['Terça']);
});

test('formatarLabels: período "month" vira "Semana N"', () => {
  assert.deepEqual(
    formatarLabels(['2026-30', '2026-31', '2026-32'], 'month'),
    ['Semana 1', 'Semana 2', 'Semana 3']
  );
});

test('formatarLabels: período "6months"/"year" viram nome do mês sem ano', () => {
  assert.deepEqual(formatarLabels(['2026-07', '2026-08'], '6months'), ['Julho', 'Agosto']);
  assert.deepEqual(formatarLabels(['2026-01', '2026-12'], 'year'), ['Janeiro', 'Dezembro']);
});

test('formatarLabels: período "all" vira "Mês Ano"', () => {
  assert.deepEqual(formatarLabels(['2025-12', '2026-01'], 'all'), ['Dezembro 2025', 'Janeiro 2026']);
});

test('formatarLabels: período desconhecido devolve os períodos sem alterar', () => {
  assert.deepEqual(formatarLabels(['x', 'y'], 'today'), ['x', 'y']);
});

test('toLocalDatetimeValue: converte um ISO em UTC para o valor de <input datetime-local>', () => {
  assert.equal(toLocalDatetimeValue('2026-01-01T08:00:00+00:00'), '2026-01-01T05:00');
});

test('toLocalDatetimeValue: string vazia retorna string vazia', () => {
  assert.equal(toLocalDatetimeValue(''), '');
});

test('toLocalDatetimeValue: aceita o formato "YYYY-MM-DD HH:MM:SS" do SQLite (sem fuso)', () => {
  assert.equal(toLocalDatetimeValue('2026-01-01 08:00:00'), '2026-01-01T08:00');
});

test('toUTCIso: converte um valor local de volta para ISO em UTC', () => {
  assert.equal(toUTCIso('2026-01-01T05:00'), '2026-01-01T08:00:00.000Z');
});

test('toLocalDatetimeValue + toUTCIso: ida e volta preserva o instante original', () => {
  const original = '2026-03-15T14:30:00+00:00';
  const local     = toLocalDatetimeValue(original);
  const deVolta   = toUTCIso(local);
  assert.equal(deVolta, '2026-03-15T14:30:00.000Z');
});

// ── deslocarReferencia / rotuloPeriodoNavegavel / tooltipDuracao ──
// (navegação pra semana/mês/dia anterior no dashboard)

const HOJE_FIXO = new Date(2026, 6, 31); // 31 de julho de 2026 (sexta-feira)

test('deslocarReferencia: "today" com offset 0 retorna a própria data', () => {
  assert.equal(deslocarReferencia('today', 0, HOJE_FIXO), '2026-07-31');
});

test('deslocarReferencia: "today" volta dia a dia', () => {
  assert.equal(deslocarReferencia('today', 1, HOJE_FIXO), '2026-07-30');
  assert.equal(deslocarReferencia('today', 31, HOJE_FIXO), '2026-06-30');
});

test('deslocarReferencia: "week" volta de 7 em 7 dias', () => {
  assert.equal(deslocarReferencia('week', 1, HOJE_FIXO), '2026-07-24');
  assert.equal(deslocarReferencia('week', 2, HOJE_FIXO), '2026-07-17');
});

test('deslocarReferencia: "month" sempre ancora no dia 1 (evita bug de rollover de mês)', () => {
  assert.equal(deslocarReferencia('month', 0, HOJE_FIXO), '2026-07-01');
  assert.equal(deslocarReferencia('month', 1, HOJE_FIXO), '2026-06-01');
  assert.equal(deslocarReferencia('month', 7, HOJE_FIXO), '2025-12-01');
});

test('deslocarReferencia: dia 31 subtraindo meses não "vaza" pro mês seguinte', () => {
  const hoje = new Date(2026, 2, 31); // 31 de março de 2026
  // se não forçasse dia=1, 31 de março - 1 mês viraria "3 de março" (bug clássico do JS Date)
  assert.equal(deslocarReferencia('month', 1, hoje), '2026-02-01');
});

test('rotuloPeriodoNavegavel: "today" no offset 0 mostra "Hoje"', () => {
  assert.equal(rotuloPeriodoNavegavel('today', 0, HOJE_FIXO), 'Hoje');
});

test('rotuloPeriodoNavegavel: "today" com offset mostra "D de mês"', () => {
  assert.equal(rotuloPeriodoNavegavel('today', 1, HOJE_FIXO), '30 de julho');
});

test('rotuloPeriodoNavegavel: "week" no offset 0 mostra "Esta semana"', () => {
  assert.equal(rotuloPeriodoNavegavel('week', 0, HOJE_FIXO), 'Esta semana');
});

test('rotuloPeriodoNavegavel: "week" com offset mostra o intervalo segunda–domingo', () => {
  assert.equal(rotuloPeriodoNavegavel('week', 1, HOJE_FIXO), '20/07 – 26/07');
});

test('rotuloPeriodoNavegavel: "month" no offset 0 mostra "Este mês"', () => {
  assert.equal(rotuloPeriodoNavegavel('month', 0, HOJE_FIXO), 'Este mês');
});

test('rotuloPeriodoNavegavel: "month" com offset mostra "Mês de Ano"', () => {
  assert.equal(rotuloPeriodoNavegavel('month', 1, HOJE_FIXO), 'Junho de 2026');
  assert.equal(rotuloPeriodoNavegavel('month', 2, HOJE_FIXO), 'Maio de 2026');
});

test('tooltipDuracao: converte horas fracionadas em "XhYm" em vez de decimal', () => {
  assert.equal(tooltipDuracao(2.7), '2h 42m');
  assert.equal(tooltipDuracao(1), '1h');
  assert.equal(tooltipDuracao(0.5), '30m');
  assert.equal(tooltipDuracao(0), '0s');
});
