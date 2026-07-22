import sys
import os
import sqlite3
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))


@pytest.fixture(autouse=True)
def banco_de_teste(tmp_path, monkeypatch):
    """
    Cria um banco SQLite temporário para cada teste.
    Isola completamente os dados — nenhum teste afeta o banco real.
    """
    import database

    db_temp = str(tmp_path / "test.db")
    monkeypatch.setattr(database, "db_path", db_temp)
    database.init_db()
    yield db_temp


# ── helpers reutilizáveis pelos testes ────────────────────────────────────────

def now_iso():
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat()


def calc_duracao(start_iso, end_iso):
    from datetime import datetime
    t1 = datetime.fromisoformat(start_iso.replace("Z", "+00:00"))
    t2 = datetime.fromisoformat(end_iso.replace("Z", "+00:00"))
    return int((t2 - t1).total_seconds())