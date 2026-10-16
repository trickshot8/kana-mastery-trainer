"""Replica of family-hub save-api for tests: clean()/merge() and routes copied from server.py."""
import json, os, re, sys, threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
DATA = sys.argv[1]; PORT = int(sys.argv[2])
MAX_BODY = 256 * 1024
SLUG = re.compile(r"^[a-z0-9][a-z0-9-]{0,40}$")
BUCKETS = ("sets", "min", "max", "last"); LOCK = threading.Lock()
def empty(): return {b: {} for b in BUCKETS}
def _num(x): return isinstance(x, (int, float)) and not isinstance(x, bool)
def clean(doc):
    out = empty()
    if not isinstance(doc, dict): return out
    for b in BUCKETS:
        src = doc.get(b)
        if not isinstance(src, dict): continue
        for k, v in src.items():
            if not isinstance(k, str) or not k or len(k) > 80: continue
            if b == "sets" and isinstance(v, list):
                out[b][k] = [y for y in v if _num(y) or (isinstance(y, str) and len(y) <= 80)][:5000]
            elif b in ("min", "max") and _num(v): out[b][k] = v
            elif b == "last" and isinstance(v, list) and len(v) == 2 and _num(v[1]): out[b][k] = v
    return out
def merge(a, b):
    a, b = clean(a), clean(b); r = empty()
    for k in set(a["sets"]) | set(b["sets"]):
        seen = []
        for v in a["sets"].get(k, []) + b["sets"].get(k, []):
            if v not in seen: seen.append(v)
        r["sets"][k] = sorted(seen, key=lambda v: (isinstance(v, str), v))
    for k in set(a["min"]) | set(b["min"]): r["min"][k] = min(x for x in (a["min"].get(k), b["min"].get(k)) if x is not None)
    for k in set(a["max"]) | set(b["max"]): r["max"][k] = max(x for x in (a["max"].get(k), b["max"].get(k)) if x is not None)
    for k in set(a["last"]) | set(b["last"]):
        x, y = a["last"].get(k), b["last"].get(k)
        r["last"][k] = y if x is None or (y is not None and y[1] >= x[1]) else x
    return r
def _read(p, d):
    try:
        with open(p, encoding="utf-8") as f: return json.load(f)
    except (FileNotFoundError, ValueError): return d
def _write(p, data):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p + ".tmp", "w", encoding="utf-8") as f: json.dump(data, f, ensure_ascii=False)
    os.replace(p + ".tmp", p)
def get_players(): return _read(os.path.join(DATA, "players.json"), [])
def save_path(app, pid): return os.path.join(DATA, "saves", app, pid + ".json")
class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def _send(self, code, obj):
        b = json.dumps(obj, ensure_ascii=False).encode(); self.send_response(code)
        self.send_header("Content-Type", "application/json"); self.send_header("Content-Length", str(len(b))); self.end_headers(); self.wfile.write(b)
    def _route(self):
        parts = [p for p in self.path.split("?")[0].split("/") if p]
        return parts[1:] if parts[:1] == ["api"] else None
    def _target(self, r):
        if len(r) != 3 or r[0] != "save" or not SLUG.match(r[1]) or not SLUG.match(r[2]): return None
        if not any(p.get("id") == r[2] for p in get_players()): return False
        return r[1], r[2]
    def do_GET(self):
        r = self._route()
        if r == ["health"]: return self._send(200, {"ok": True})
        if r == ["players"]: return self._send(200, {"players": get_players()})
        t = self._target(r or [])
        if not t: return self._send(404, {"error": "x"})
        return self._send(200, {"doc": clean(_read(save_path(*t), empty()))})
    def do_PUT(self):
        t = self._target(self._route() or [])
        if not t: return self._send(404, {"error": "x"})
        n = int(self.headers.get("Content-Length") or 0)
        if n > MAX_BODY: return self._send(413, {"error": "big"})
        incoming = json.loads(self.rfile.read(n) or b"{}").get("doc")
        with LOCK:
            merged = merge(_read(save_path(*t), empty()), incoming); _write(save_path(*t), merged)
        return self._send(200, {"doc": merged})
ThreadingHTTPServer(("127.0.0.1", PORT), H).serve_forever()
