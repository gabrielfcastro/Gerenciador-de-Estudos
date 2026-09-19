#!/bin/bash
# ── Novo ciclo de estudos ─────────────────────────────────────────────────
# Guarda o banco atual (com tudo que você já estudou) num backup com
# data/hora no nome, e deixa o app com um banco novo, zerado.
#
# IMPORTANTE: pare o servidor (Ctrl+C no terminal do app.py) ANTES de rodar
# este script, e inicie de novo depois.
#
# COMO USAR:
#   cd para a pasta src/ (onde fica o app.py) e rode:
#   ./novo_ciclo.sh

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR" || exit 1

DB="gerenciador_de_estudos.db"
BACKUPS_DIR="backups"
TIMESTAMP=$(date +"%Y-%m-%d_%Hh%Mm")

if [ ! -f "$DB" ]; then
  echo "❌ Não encontrei $DB nesta pasta ($DIR)."
  echo "   Rode este script de dentro da pasta src/, junto com o app.py."
  read -p "Pressione Enter para sair..."
  exit 1
fi

mkdir -p "$BACKUPS_DIR"

BACKUP_FILE="$BACKUPS_DIR/estudos_${TIMESTAMP}.db"
cp "$DB" "$BACKUP_FILE"

if [ $? -ne 0 ]; then
  echo "❌ Não consegui fazer o backup. Nada foi apagado, por segurança."
  read -p "Pressione Enter para sair..."
  exit 1
fi

echo "✅ Backup salvo em: $DIR/$BACKUP_FILE"

rm "$DB"

echo "✅ Banco atual zerado. Na próxima vez que você iniciar o app (python3 app.py),"
echo "   ele já cria um banco novo, vazio, sozinho."
echo ""
echo "   Pra consultar esse backup de novo no futuro, use:"
echo "   ./alternar_banco.sh \"$BACKUP_FILE\""
echo ""
read -p "Pressione Enter para sair..."