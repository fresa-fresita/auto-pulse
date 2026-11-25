"""Collect news that names Flexcar, for the Flexcar section. Headline, link, publisher and date only."""
from urllib.parse import quote_plus

from common import fetch, now_iso, read_json, write_json
from fetch_news import merge, parse_feed

URL = "https://news.google.com/rss/search?q=" + quote_plus("Flexcar") + "&hl=en-US&gl=US&ceid=US:en"
KEEP_DAYS = 60
MAX_ITEMS = 30


def main():
    old = read_json("flexcar.json", {"items": []})
    try:
        fresh = parse_feed(fetch(URL), "Google News", item_source=True, must_match=r"\bflexcar\b")
    except Exception as exc:  # noqa: BLE001
        print("flexcar: feed failed, keeping previous data (%s)" % str(exc)[:120])
        return False
    items = merge(old.get("items", []), fresh, KEEP_DAYS, MAX_ITEMS)
    write_json("flexcar.json", {"updated": now_iso(), "items": items})
    print("flexcar: %d items kept, %d fresh" % (len(items), len(fresh)))
    return True


if __name__ == "__main__":
    main()
