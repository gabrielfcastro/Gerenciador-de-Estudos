import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

def now_iso():
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat()


def calc_duracao(start_iso, end_iso):
    from datetime import datetime
    t1 = datetime.fromisoformat(start_iso.replace("Z", "+00:00"))
    t2 = datetime.fromisoformat(end_iso.replace("Z", "+00:00"))
    return int((t2 - t1).total_seconds())