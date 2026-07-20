import sqlite3
import os

db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "gerenciador_de_estudos.db")

def get_db():
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def init_db():
    conn = get_db()
    try:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS categories (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                nome            TEXT    NOT NULL,
                cor             TEXT    NOT NULL DEFAULT '#6366f1',
                qnd_foi_criada  TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS sessions (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                categoria_id    INTEGER REFERENCES categories(id) ON DELETE SET NULL,
                inicio          TEXT NOT NULL,
                fim             TEXT,
                duracao         INTEGER,
                nota            TEXT
            );

            CREATE TABLE IF NOT EXISTS settings (
                key   TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            INSERT OR IGNORE INTO settings (key, value) VALUES ('duracao_do_bloco', '4500');
        """)
        conn.commit()
        print("BD iniciado, path:", db_path)
    finally:
        conn.close()

if __name__ == "__main__":
    init_db()