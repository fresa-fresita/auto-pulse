"""Pull headlines from trade news RSS feeds. Stores headline, link, source, date and tags only."""
import re
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime

from urllib.parse import quote_plus

from common import clean_text, fetch, now_iso, read_json, safe_url, write_json

# Feed URLs are best guesses and are checked on every run. A feed that fails is skipped
# and reported in data/news.json under "sources". See SOURCES.md.
FEEDS = [
    {"name": "CBT News", "url": "https://www.cbtnews.com/feed/"},
    {"name": "Automotive World", "url": "https://www.automotiveworld.com/feed/"},
    {"name": "Auto Rental News", "url": "https://www.autorentalnews.com/rss"},
    {"name": "Electrek", "url": "https://electrek.co/feed/"},
    # Google News search results. Each item carries its publisher, which is shown as the source.
    {"name": "Google News (Avis)", "url": "https://news.google.com/rss/search?q=" + quote_plus('"Avis Budget" OR "Avis Car Rental"') + "&hl=en-US&gl=US&ceid=US:en",
     "item_source": True, "must_match": r"\bavis\b"},
]

KEEP_DAYS = 14
MAX_ITEMS = 150

TAG_RULES = {
    "recall": r"\brecall(s|ed|ing)?\b|\bNHTSA\b|safety probe",
    "legal": r"\blawsuit|\bsued?\b|\bsuing\b|settle(s|d|ment)|class[- ]action|\bprobe\b|investigation|\bfined?\b|antitrust|\bcourt\b|\bjudge\b",
    "deal": r"\bacquir|acquisition|\bmerger|\bmerges?\b|\bbuyout|takeover|\bstake\b|\bbuys?\b|\bsells? (its|a|the)\b|dealership group",
    "launch": r"\bunveil|\bdebut|\blaunch(es|ed)?\b|\breveals?\b|all-new|\bintroduces?\b|\bnew model\b|\bnext-gen",
    "flexcar": r"\bflexcar\b",
    "avis": r"\bavis\b",
    "rental": r"\brental|\bleas(e|es|ing)\b|\bhertz\b|\bavis\b|\bturo\b|\bzipcar\b|\bsixt\b|\bgetaround\b|\benterprise mobility|car[- ]sharing|\bsubscription\b",
    "ev": r"\bEVs?\b|electric vehicle|\bbattery\b|\bcharging\b|\bPHEV\b|\bhybrid",
}
TAG_RES = {tag: re.compile(rx, re.I) for tag, rx in TAG_RULES.items()}


def tag_title(title):
    return [tag for tag, rx in TAG_RES.items() if rx.search(title)]


def parse_date(text):
    text = (text or "").strip()
    if not text:
        return None
    try:
        dt = parsedate_to_datetime(text)
    except (TypeError, ValueError):
        dt = None
    if dt is None:
        try:
            dt = datetime.fromisoformat(text.replace("Z", "+00:00"))
        except ValueError:
            return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def local(tag):
    return tag.rsplit("}", 1)[-1]


def parse_feed(xml_bytes, source, item_source=False, must_match=None):
    """Return a list of items from an RSS 2.0 or Atom document."""
    head = xml_bytes[:4096].lower()
    if b"<!doctype" in head or b"<!entity" in xml_bytes.lower():
        raise ValueError("DTD or entity declarations are not accepted")
    root = ET.fromstring(xml_bytes)
    items = []
    for node in root.iter():
        name = local(node.tag)
        if name not in ("item", "entry"):
            continue
        fields = {}
        for child in node:
            key = local(child.tag)
            if key == "link" and name == "entry":
                if child.attrib.get("rel", "alternate") == "alternate":
                    fields["link"] = child.attrib.get("href", "")
            elif key in ("title", "link", "pubDate", "published", "updated", "date", "source"):
                fields.setdefault(key, (child.text or "").strip())
        title = clean_text(fields.get("title", ""), 200)
        link = safe_url(fields.get("link", ""))
        when = parse_date(fields.get("pubDate") or fields.get("published") or fields.get("updated") or fields.get("date"))
        if not title or not link or not when:
            continue
        name = source
        if item_source:
            publisher = clean_text(fields.get("source", ""), 60)
            if publisher:
                name = publisher
                suffix = " - " + publisher
                if title.endswith(suffix):
                    title = title[: -len(suffix)].rstrip()
        if must_match and not re.search(must_match, title, re.I):
            continue
        items.append({
            "title": title,
            "link": link,
            "source": name,
            "published": when.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "tags": tag_title(title),
        })
    return items


def merge(old_items, new_items, keep_days=KEEP_DAYS, max_items=MAX_ITEMS):
    cutoff = datetime.now(timezone.utc) - timedelta(days=keep_days)
    seen, out = set(), []
    for item in new_items + old_items:
        key = item["link"]
        norm = re.sub(r"\W+", "", item["title"].lower())
        if key in seen or norm in seen:
            continue
        when = parse_date(item["published"])
        if when is None or when < cutoff:
            continue
        seen.add(key)
        seen.add(norm)
        out.append(item)
    out.sort(key=lambda i: i["published"], reverse=True)
    return out[:max_items]


def main():
    old = read_json("news.json", {"items": []})
    fresh, report = [], []
    for feed in FEEDS:
        try:
            items = parse_feed(fetch(feed["url"]), feed["name"], feed.get("item_source", False), feed.get("must_match"))
            fresh.extend(items)
            report.append({"name": feed["name"], "ok": True, "count": len(items)})
        except Exception as exc:  # noqa: BLE001
            report.append({"name": feed["name"], "ok": False, "count": 0, "error": str(exc)[:120]})
    if not fresh and not any(r["ok"] for r in report):
        print("news: every feed failed, keeping previous data")
        old["sources"] = report
        write_json("news.json", old)
        return False
    items = merge(old.get("items", []), fresh)
    write_json("news.json", {"updated": now_iso(), "sources": report, "items": items})
    print("news: %d items kept, %d fresh" % (len(items), len(fresh)))
    return True


if __name__ == "__main__":
    main()
