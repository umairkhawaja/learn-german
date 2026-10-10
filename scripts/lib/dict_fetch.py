#!/usr/bin/env python3
"""Line-oriented HTTP fetcher for scripts/verify-german-dictionary.mjs.

LEO (dict.leo.org) sits behind Cloudflare, which rejects Node's and curl's TLS
fingerprint with a 403 "Attention Required" page regardless of headers. dict.cc
serves non-browser clients a truncated 3-row "limited result set". curl_cffi
presents a real browser TLS/HTTP2 fingerprint, so both sites answer normally.

Protocol: one JSON object per line on stdin {"id", "url"}; one JSON object per
line on stdout {"id", "status", "url", "text"} or {"id", "error"}.
"""
import json
import sys

try:
    from curl_cffi import requests
except ImportError:  # pragma: no cover - reported to the caller
    print(json.dumps({"fatal": "curl_cffi is not installed for " + sys.executable}), flush=True)
    sys.exit(3)

session = requests.Session(impersonate="chrome")
print(json.dumps({"ready": True}), flush=True)
for line in sys.stdin:
    line = line.strip()
    if not line:
        continue
    job = json.loads(line)
    try:
        r = session.get(job["url"], timeout=25, headers={"Accept-Language": "en-GB,en;q=0.9,de;q=0.8"})
        out = {"id": job["id"], "status": r.status_code, "url": str(r.url), "text": r.text}
    except Exception as exc:  # network errors stay "unknown" upstream
        out = {"id": job["id"], "error": f"{type(exc).__name__}: {exc}"}
    print(json.dumps(out), flush=True)
