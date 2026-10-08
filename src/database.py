import sqlite3
import os

db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "gerenciador_de_estudos.db")

def get_db():
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def _init_banco_principal():
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

            CREATE TABLE IF NOT EXISTS tasks (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                titulo       TEXT    NOT NULL,
                categoria_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
                status       TEXT    NOT NULL DEFAULT 'todo',
                nota         TEXT    DEFAULT '',
                criada_em    TEXT    DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS schedule (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                dia_semana   TEXT    NOT NULL,
                categoria_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
                ordem        INTEGER DEFAULT 0
            );
        """)
        conn.commit()

        # migração: bancos criados antes da coluna `nota` existir em tasks
        colunas = [r["name"] for r in conn.execute("PRAGMA table_info(tasks)").fetchall()]
        if "nota" not in colunas:
            conn.execute("ALTER TABLE tasks ADD COLUMN nota TEXT DEFAULT ''")
            conn.commit()

        # migração: bancos criados antes da coluna `concluida_em` existir em tasks
        colunas = [r["name"] for r in conn.execute("PRAGMA table_info(tasks)").fetchall()]
        if "concluida_em" not in colunas:
            conn.execute("ALTER TABLE tasks ADD COLUMN concluida_em TEXT DEFAULT NULL")
            conn.commit()
    finally:
        conn.close()

if __name__ == "__main__":
    init_db()


# ── Caderno de questões: arquivo próprio ──────────────────────────────────────
# O caderno é um acervo que cresce por meses ou anos; por isso NÃO mora no banco
# principal (que o novo_ciclo.sh guarda e zera a cada ciclo de estudos). A questão
# guarda o nome e a cor da matéria, e não o id dela, porque os ids recomeçam
# quando o banco principal é zerado.

questions_db_path = None        # None = ao lado do banco principal
COR_PADRAO_MATERIA = "#94a3b8"

def caminho_questoes():
    if questions_db_path:
        return questions_db_path
    return os.path.join(os.path.dirname(os.path.abspath(db_path)), "caderno_de_questoes.db")

def get_questions_db():
    conn = sqlite3.connect(caminho_questoes())
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

_SCHEMA_CADERNO = """
    CREATE TABLE IF NOT EXISTS questions (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        materia_nome  TEXT    NOT NULL,
        materia_cor   TEXT    NOT NULL DEFAULT '#94a3b8',
        assunto       TEXT    NOT NULL DEFAULT '',
        banca         TEXT    NOT NULL DEFAULT '',
        tipo          TEXT    NOT NULL CHECK (tipo IN ('ME', 'CE')),
        enunciado     TEXT    NOT NULL,
        alternativas  TEXT    NOT NULL DEFAULT '[]',
        gabarito      TEXT    NOT NULL,
        justificativa TEXT    NOT NULL DEFAULT '',
        criada_em     TEXT    DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS question_attempts (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        question_id   INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
        resposta      TEXT    NOT NULL,
        acertou       INTEGER NOT NULL,
        respondida_em TEXT    DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_attempts_question ON question_attempts(question_id);
"""

def _migrar_caderno_da_versao_anterior(destino):
    """Na versão anterior as questões ficavam no banco principal, ligadas à matéria pelo id.
    Copia tudo (ids e tentativas inclusive) pro arquivo novo, trocando o id pelo nome e a cor."""
    principal = get_db()
    try:
        tabelas = {r[0] for r in principal.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        if "questions" not in tabelas:
            return
        linhas = principal.execute(
            "SELECT q.*, c.nome AS cat_nome, c.cor AS cat_cor FROM questions q "
            "LEFT JOIN categories c ON q.categoria_id = c.id ORDER BY q.id").fetchall()
        for r in linhas:
            destino.execute(
                "INSERT INTO questions (id, materia_nome, materia_cor, assunto, banca, tipo, enunciado, alternativas,"
                " gabarito, justificativa, criada_em) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                (r["id"], r["cat_nome"] or "Sem matéria", r["cat_cor"] or COR_PADRAO_MATERIA, r["assunto"], r["banca"],
                 r["tipo"], r["enunciado"], r["alternativas"], r["gabarito"], r["justificativa"], r["criada_em"]))
        if "question_attempts" in tabelas:
            for a in principal.execute("SELECT * FROM question_attempts ORDER BY id").fetchall():
                destino.execute(
                    "INSERT INTO question_attempts (id, question_id, resposta, acertou, respondida_em) VALUES (?,?,?,?,?)",
                    (a["id"], a["question_id"], a["resposta"], a["acertou"], a["respondida_em"]))
    finally:
        principal.close()

def init_questions_db():
    conn = get_questions_db()
    try:
        conn.executescript(_SCHEMA_CADERNO)
        if conn.execute("PRAGMA user_version").fetchone()[0] < 1:      # a migração roda uma vez só
            _migrar_caderno_da_versao_anterior(conn)
            conn.commit()
            conn.execute("PRAGMA user_version = 1")
            conn.commit()
    finally:
        conn.close()

def init_db():
    _init_banco_principal()
    init_questions_db()
