// ── Indicador de conexão com o servidor ───────────────────────────────────────
// "Conectado" é informação de desenvolvedor: quando está tudo bem, o indicador
// some e não ocupa o cabeçalho. Só aparece (em vermelho) quando o servidor cai.

export function atualizarIndicadorConexao(ok) {
  document.getElementById('conn').hidden = ok;
  document.getElementById('conn-dot').className = 'conn-dot' + (ok ? ' ok' : '');
  document.getElementById('conn-label').textContent = ok ? 'Conectado' : 'Servidor offline';
}
