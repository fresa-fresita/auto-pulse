"""Shared helpers for the Auto Pulse data scripts."""
import json
import os
import re
import time
import urllib.request
from datetime import datetime, timezone
from html import unescape

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
UA = "AutoPulse/1.0 (+https://github.com/fresa-fresita/auto-pulse)"


def fetch(url, timeout=45, retries=2):
    """GET a URL and return bytes. Retries a couple of times, then raises."""
    last = None
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return resp.read()
        except Exception as exc:  # noqa: BLE001
            last = exc
            time.sleep(2 * (attempt + 1))
    raise last


def now_iso():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def read_json(name, default):
    path = os.path.join(DATA, name)
    try:
        with open(path, "r", encoding="utf-8") as fh:
            return json.load(fh)
    except (OSError, ValueError):
        return default


def write_json(name, obj):
    os.makedirs(DATA, exist_ok=True)
    path = os.path.join(DATA, name)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(obj, fh, ensure_ascii=False, indent=1)
        fh.write("\n")


TAG_RE = re.compile(r"<[^>]+>")
SPACE_RE = re.compile(r"\s+")


def clean_text(text, limit=220):
    """Strip tags and entities, collapse whitespace, trim to a limit."""
    text = TAG_RE.sub(" ", unescape(text or ""))
    text = SPACE_RE.sub(" ", text).strip()
    if len(text) > limit:
        text = text[: limit - 1].rstrip() + "…"
    return text


def safe_url(url):
    """Only allow http and https links."""
    url = (url or "").strip()
    return url if re.match(r"^https?://", url, re.I) else ""
