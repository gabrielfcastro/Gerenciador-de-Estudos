#!/bin/bash
# ── Inicia o Gerenciador de Estudos e abre no navegador ──────────────────────
# Dá dois cliques nesse arquivo (ou rode "./iniciar_app.sh" no terminal) em
# vez de abrir a IDE, entrar na pasta e rodar "python app.py" manualmente.

# Descobre a pasta onde este script está, e entra nela.
# IMPORTANTE: este arquivo precisa estar na MESMA pasta que o app.py.
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR" || { echo "Não encontrei a pasta do projeto."; read -p "Pressione Enter para sair..."; exit 1; }

if [ ! -f "app.py" ]; then
  echo "❌ app.py não encontrado em: $DIR"
  echo "   Mova este script pra dentro da pasta do projeto (junto com app.py)."
  read -p "Pressione Enter para sair..."
  exit 1
fi

PORT=8000
URL="http://localhost:$PORT"

echo "🚀 Iniciando Gerenciador de Estudos..."

# Sobe o servidor em segundo plano
python3 app.py &
SERVER_PID=$!

# Encerra o servidor também quando esta janela for fechada (Ctrl+C, fechar
# a janela do terminal, etc) — cobre vários sinais, não só a saída normal.
trap "echo '🛑 Encerrando servidor...'; kill $SERVER_PID 2>/dev/null" EXIT INT TERM HUP

# Espera o servidor subir antes de abrir o navegador
sleep 1

# Abre no navegador padrão — desgrudado do terminal de propósito (setsid +
# segundo plano + disown). Sem isso, se o Firefox (ou outro navegador) ainda
# não estivesse aberto, ele nasceria "preso" a este terminal, e fechar o
# terminal derrubaria o navegador inteiro (todas as abas, não só esta).
if command -v xdg-open >/dev/null; then
  setsid xdg-open "$URL" >/dev/null 2>&1 < /dev/null &
  disown
else
  echo "Abra manualmente no navegador: $URL"
fi

echo "✅ Rodando em $URL"
echo "   (feche esta janela pra encerrar o servidor)"

# Mantém o script vivo enquanto o servidor roda
wait $SERVER_PID
