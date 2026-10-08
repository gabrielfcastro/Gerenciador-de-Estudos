// ── Avisos e confirmações do app ──────────────────────────────────────────────
// Substitui alert()/confirm() nativos: eles travam a página, não seguem o tema
// (claro/escuro) e destoam do resto. toast() avisa sem interromper; confirmar()
// pergunta num modal do próprio app e devolve uma Promise<boolean>.

function raizDeToasts() {
  let raiz = document.getElementById('toast-root');
  if (!raiz) {
    raiz = document.createElement('div');
    raiz.className = 'toast-root';
    raiz.setAttribute('id', 'toast-root');
    raiz.setAttribute('aria-live', 'polite');
    document.body.appendChild(raiz);
  }
  return raiz;
}

/** tipo: 'info' | 'ok' | 'erro'. Erros usam role="alert" pra leitores de tela. */
export function toast(mensagem, tipo = 'info', ms = 3500) {
  const raiz = raizDeToasts();
  const t = document.createElement('div');
  t.className = `toast toast-${tipo}`;
  t.setAttribute('role', tipo === 'erro' ? 'alert' : 'status');
  t.textContent = mensagem;
  raiz.appendChild(t);
  setTimeout(() => t.remove(), ms);
  return t;
}

export function confirmar(mensagem, opcoes = {}) {
  const { titulo = 'Confirmar', confirmar: rotuloOk = 'Confirmar', cancelar: rotuloNao = 'Cancelar', perigo = false } = opcoes;

  return new Promise((resolve) => {
    const anterior = document.activeElement;

    const overlay = document.createElement('div');
    overlay.className = 'overlay open';
    overlay.setAttribute('role', 'alertdialog');
    overlay.setAttribute('aria-modal', 'true');

    const modal = document.createElement('div');
    modal.className = 'modal confirm-modal';

    const h = document.createElement('h3');
    h.textContent = titulo;
    const p = document.createElement('p');
    p.textContent = mensagem;

    const acoes = document.createElement('div');
    acoes.className = 'modal-actions';
    const bNao = document.createElement('button');
    bNao.className = 'btn btn-ghost btn-cancelar';
    bNao.textContent = rotuloNao;
    const bOk = document.createElement('button');
    bOk.className = `btn ${perigo ? 'btn-danger-solid' : 'btn-primary'} btn-confirmar`;
    bOk.textContent = rotuloOk;

    acoes.appendChild(bNao);
    acoes.appendChild(bOk);
    modal.appendChild(h);
    modal.appendChild(p);
    modal.appendChild(acoes);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    function encerrar(valor) {
      document.removeEventListener('keydown', aoTeclar);
      overlay.remove();
      if (anterior && anterior.focus) anterior.focus();
      resolve(valor);
    }
    function aoTeclar(e) {
      if (e.key === 'Escape') { e.preventDefault(); encerrar(false); }
      else if (e.key === 'Tab') {
        // mantém o foco dentro do modal
        e.preventDefault();
        (document.activeElement === bNao ? bOk : bNao).focus();
      }
    }

    bNao.addEventListener('click', () => encerrar(false));
    bOk.addEventListener('click', () => encerrar(true));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) encerrar(false); });
    document.addEventListener('keydown', aoTeclar);

    // em ação perigosa o foco começa no "Cancelar" (o caminho seguro)
    (perigo ? bNao : bOk).focus();
  });
}
