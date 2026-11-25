"""End-of-day prices from Stooq for auto resale, rental and automaker stocks. Delayed data."""
import csv
import io
import time

from common import fetch, now_iso, read_json, write_json

GROUPS = [
    {"id": "resale", "title": "Resale and marketplaces", "tickers": [
        ("CVNA", "Carvana"), ("KMX", "CarMax"), ("CPRT", "Copart"), ("CARG", "CarGurus"), ("CARS", "Cars.com")]},
    {"id": "rental", "title": "Rental", "tickers": [
        ("HTZ", "Hertz"), ("CAR", "Avis Budget")]},
    {"id": "makers", "title": "Automakers", "tickers": [
        ("TSLA", "Tesla"), ("GM", "General Motors"), ("F", "Ford"), ("TM", "Toyota"), ("STLA", "Stellantis"), ("HMC", "Honda")]},
]
URL = "https://stooq.com/q/d/l/?s=%s.us&i=d"


def parse_quote(text):
    """Return (date, close, change_pct) from a Stooq daily CSV, or raise ValueError."""
    rows = list(csv.DictReader(io.StringIO(text.strip())))
    rows = [r for r in rows if r.get("Close") not in (None, "", "null")]
    if len(rows) < 2 or "Date" not in rows[-1]:
        raise ValueError("no usable price rows")
    last, prev = rows[-1], rows[-2]
    close, before = float(last["Close"]), float(prev["Close"])
    if before == 0:
        raise ValueError("bad previous close")
    return last["Date"], round(close, 2), round((close - before) / before * 100, 2)


def main():
    old = read_json("stocks.json", {"groups": []})
    old_quotes = {t["symbol"]: t for g in old.get("groups", []) for t in g.get("tickers", [])}
    groups, ok_count = [], 0
    for group in GROUPS:
        tickers = []
        for symbol, name in group["tickers"]:
            entry = {"symbol": symbol, "name": name, "url": "https://finance.yahoo.com/quote/" + symbol,
                     "close": None, "change_pct": None, "as_of": None, "stale": True}
            try:
                date, close, chg = parse_quote(fetch(URL % symbol.lower(), timeout=30, retries=1).decode("utf-8", "replace"))
                entry.update({"close": close, "change_pct": chg, "as_of": date, "stale": False})
                ok_count += 1
            except Exception as exc:  # noqa: BLE001
                prev = old_quotes.get(symbol)
                if prev and prev.get("close") is not None:
                    entry.update({"close": prev["close"], "change_pct": prev.get("change_pct"), "as_of": prev.get("as_of")})
                print("stocks: %s failed (%s)" % (symbol, str(exc)[:80]))
            tickers.append(entry)
            time.sleep(0.5)
        groups.append({"id": group["id"], "title": group["title"], "tickers": tickers})
    if ok_count == 0:
        print("stocks: no quotes fetched, keeping previous data")
        return False
    write_json("stocks.json", {"updated": now_iso(), "source": "Stooq", "groups": groups})
    print("stocks: %d quotes fetched" % ok_count)
    return True


if __name__ == "__main__":
    main()
