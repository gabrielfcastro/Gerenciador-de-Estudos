#!/bin/bash
# ── Alternar banco de estudos ──────────────────────────────────────────────
# Troca o banco ativo do app por um backup antigo (pra consultar números
# de um ciclo de estudos anterior). SEMPRE faz backup do banco atual antes
# de trocar, então nunca perde nada nessa operação — dá pra ir e voltar
# quantas vezes quiser.
#
# IMPORTANTE: pare o servidor (Ctrl+C) ANTES de rodar, inicie de novo depois.
#
# COMO USAR:
#   cd para a pasta src/ e rode, apontando pro backup que quer ver:
#   ./alternar_banco.sh backups/estudos_2026-09-07_14h30m.db

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR" || exit 1

DB="gerenciador_de_estudos.db"
BACKUPS_DIR="backups"
ALVO="$1"
TIMESTAMP=$(date +"%Y-%m-%d_%Hh%Mm")

if [ -z "$ALVO" ]; then
  echo "❌ Uso: ./alternar_banco.sh caminho/para/o/backup.db"
  echo ""
  echo "   Backups disponíveis:"
  ls -1 "$BACKUPS_DIR" 2>/dev/null | sed 's/^/   - backups\//' || echo "   (nenhum backup encontrado ainda)"
  read -p "Pressione Enter para sair..."
  exit 1
fi

if [ ! -f "$ALVO" ]; then
  echo "❌ Não encontrei o arquivo: $ALVO"
  read -p "Pressione Enter para sair..."
  exit 1
fi

mkdir -p "$BACKUPS_DIR"

# Salva o banco atual antes de trocar, por segurança (mesmo que já seja um backup antigo)
if [ -f "$DB" ]; then
  cp "$DB" "$BACKUPS_DIR/estudos_${TIMESTAMP}_antes-de-trocar.db"
  echo "✅ Banco atual salvo em: $BACKUPS_DIR/estudos_${TIMESTAMP}_antes-de-trocar.db"
fi

cp "$ALVO" "$DB"
echo "✅ Banco trocado! O app agora vai abrir com os dados de: $ALVO"
echo ""
echo "   Inicie o app normalmente (python3 app.py) pra ver."
read -p "Pressione Enter para sair..."