"""Latest US vehicle recalls from NHTSA's public recall flat file."""
import io
import re
import zipfile
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from common import clean_text, fetch, now_iso, write_json

URL = "https://static.nhtsa.gov/odi/ffdd/rcl/FLAT_RCL_POST_2010.zip"
RECENT_DAYS = 120
COUNT_DAYS = 90
MAX_RECENT = 30
KEEP_UPPER = {"BMW", "GMC", "RAM", "MG", "FCA", "MINI"}

# Column positions in the NHTSA recall flat file (RCL.txt data dictionary), zero based.
COL = {"type": 10, "campno": 1, "make": 2, "model": 3, "year": 4, "comp": 6,
       "potaff": 11, "rcdate": 15, "desc": 19}
MIN_COLUMNS = 20
CAMP_RE = re.compile(r"^\d{2}[VEC]\d{6}$")
DATE_RE = re.compile(r"^\d{8}$")


def nice_make(name):
    name = (name or "").strip()
    return name if name in KEEP_UPPER else name.title()


def parse_rows(text):
    """Yield validated rows as dicts. Raises ValueError when the layout looks wrong."""
    checked = bad = 0
    for line in text.splitlines():
        parts = line.split("\t")
        if len(parts) < MIN_COLUMNS:
            continue
        checked += 1
        camp = parts[COL["campno"]].strip()
        date = parts[COL["rcdate"]].strip()
        if not CAMP_RE.match(camp) or not DATE_RE.match(date):
            bad += 1
            continue
        yield {
            "type": parts[COL["type"]].strip(),
            "camp": camp,
            "make": parts[COL["make"]].strip(),
            "model": parts[COL["model"]].strip(),
            "year": parts[COL["year"]].strip(),
            "comp": parts[COL["comp"]].strip(),
            "potaff": parts[COL["potaff"]].strip(),
            "date": datetime.strptime(date, "%Y%m%d").replace(tzinfo=timezone.utc),
            "desc": parts[COL["desc"]].strip(),
        }
        if checked > 200 and bad > checked * 0.5:
            raise ValueError("file layout does not match the expected columns")
    if checked == 0 or bad > checked * 0.5:
        raise ValueError("file layout does not match the expected columns")


def build(rows, today=None):
    today = today or datetime.now(timezone.utc)
    recent_cut = today - timedelta(days=RECENT_DAYS)
    count_cut = today - timedelta(days=COUNT_DAYS)
    camps = {}
    for row in rows:
        if row["type"] != "V" or row["date"] < recent_cut or row["date"] > today + timedelta(days=2):
            continue
        c = camps.setdefault(row["camp"], {"date": row["date"], "makes": set(), "models": set(), "years": set(),
                                           "comp": row["comp"], "potaff": row["potaff"], "desc": row["desc"]})
        c["makes"].add(nice_make(row["make"]))
        if row["model"]:
            c["models"].add(row["model"].title())
        if row["year"].isdigit() and row["year"] != "9999":
            c["years"].add(int(row["year"]))
    out = []
    for camp, c in camps.items():
        years = sorted(c["years"])
        models = sorted(c["models"])
        try:
            units = int(c["potaff"])
        except ValueError:
            units = None
        out.append({
            "id": camp,
            "date": c["date"].strftime("%Y-%m-%d"),
            "makes": sorted(c["makes"]),
            "models": models[:4],
            "more_models": max(0, len(models) - 4),
            "years": [years[0], years[-1]] if years else [],
            "component": clean_text(c["comp"].title(), 90),
            "summary": clean_text(c["desc"], 230),
            "units": units,
            "url": "https://www.nhtsa.gov/recalls?nhtsaId=" + camp,
        })
    out.sort(key=lambda r: (r["date"], r["id"]), reverse=True)
    by_make = defaultdict(int)
    total = 0
    for r in out:
        if datetime.strptime(r["date"], "%Y-%m-%d").replace(tzinfo=timezone.utc) >= count_cut:
            total += 1
            for make in r["makes"]:
                by_make[make] += 1
    top = sorted(by_make.items(), key=lambda kv: (-kv[1], kv[0]))[:12]
    return {
        "updated": now_iso(),
        "window_days": COUNT_DAYS,
        "campaigns_in_window": total,
        "by_make": [{"make": m, "count": n} for m, n in top],
        "recent": out[:MAX_RECENT],
    }


def main():
    blob = fetch(URL, timeout=120)
    with zipfile.ZipFile(io.BytesIO(blob)) as zf:
        name = next(n for n in zf.namelist() if n.lower().endswith(".txt"))
        text = zf.read(name).decode("latin-1")
    result = build(parse_rows(text))
    if not result["recent"]:
        raise ValueError("no recent recalls found, keeping previous data")
    write_json("recalls.json", result)
    print("recalls: %d recent, %d campaigns in last %d days" % (len(result["recent"]), result["campaigns_in_window"], COUNT_DAYS))
    return True


if __name__ == "__main__":
    main()
