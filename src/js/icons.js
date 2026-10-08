// ── Ícones ────────────────────────────────────────────────────────────────────
// Um único conjunto de ícones de traço (estilo Lucide, licença ISC), desenhados
// no sprite que fica no começo do index.html. Em vez de emoji (que muda de
// aparência em cada sistema), todo ícone sai daqui, com o mesmo tamanho e traço.

export const NOMES_ICONES = [
  'timer', 'clipboard', 'calendar', 'settings', 'moon', 'sun', 'edit', 'x', 'plus',
  'check', 'undo', 'play', 'pause', 'stop', 'clock', 'external',
  'chevron-right', 'chevron-down', 'chevron-left', 'file-text',
  'book-open', 'scissors', 'filter', 'search', 'trash', 'minus', 'arrow-left',
];

export function ico(nome, extra = '') {
  if (!NOMES_ICONES.includes(nome)) throw new Error(`Ícone desconhecido: ${nome}`);
  const classe = extra ? `ico ${extra}` : 'ico';
  return `<svg class="${classe}" aria-hidden="true" focusable="false"><use href="#i-${nome}"/></svg>`;
}
