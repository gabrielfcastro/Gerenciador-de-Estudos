#!/bin/bash
# ── Backup do caderno de questões ─────────────────────────────────────────
# O caderno mora num arquivo próprio (caderno_de_questoes.db) que o
# novo_ciclo.sh NÃO mexe — justamente pra ele crescer com o tempo. Este script
# tira uma cópia datada dele, pra você ter uma garantia extra.
#
# Pode rodar com o servidor ligado: a cópia é feita pelo próprio SQLite, que
# garante um arquivo consistente mesmo se alguém estiver usando o app.
#
# COMO USAR:
#   cd para a pasta src/ (onde fica o app.py) e rode:
#   ./backup_caderno.sh

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR" || exit 1

DB="caderno_de_questoes.db"
BACKUPS_DIR="backups"
DESTINO="$BACKUPS_DIR/caderno_$(date +"%Y-%m-%d_%Hh%Mm").db"

if [ ! -f "$DB" ]; then
  echo "❌ Não encontrei $DB nesta pasta ($DIR)."
  echo "   Ele é criado sozinho na primeira vez que você abre o app."
  read -p "Pressione Enter para sair..."
  exit 1
fi

mkdir -p "$BACKUPS_DIR"

python3 - "$DB" "$DESTINO" <<'PY'
import sqlite3, sys
origem, destino = sys.argv[1], sys.argv[2]
a = sqlite3.connect(origem)
b = sqlite3.connect(destino)
a.backup(b)
total = b.execute("SELECT COUNT(*) FROM questions").fetchone()[0]
b.close(); a.close()
print(f"✅ Backup salvo em: {destino}  ({total} questões)")
PY

if [ $? -ne 0 ]; then
  echo "❌ Não consegui fazer o backup."
fi
read -p "Pressione Enter para sair..."
