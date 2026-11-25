# Auto Pulse

A free public page that shows the auto industry in one place: headlines, vehicle recalls, stock moves for auto resale, rental and automaker companies, and the rental and leasing market. Every item links to its original source.

The site is plain HTML, CSS and JavaScript served by GitHub Pages. A scheduled GitHub Action refreshes the data files once a day, so the page updates itself.

## How it works

1. `.github/workflows/daily.yml` runs every day, and can also be run by hand from the Actions tab.
2. `scripts/run_all.py` runs three jobs: news, recalls and stocks. One failing source never stops the others.
3. Each job writes a JSON file into `data/`. If a source fails, the previous data stays in place.
4. The workflow commits changed files in `data/` to `main`.
5. `index.html` and `assets/app.js` read the JSON files and draw the page.

## Files

| Path | What it does |
|---|---|
| `index.html`, `assets/` | The page, styles and rendering code |
| `data/` | News, recalls and stock data written by the daily job |
| `scripts/` | One Python script per data source, using only the standard library |
| `tests/` | Offline tests for the parsers |
| `SOURCES.md` | Where each piece of data comes from, and what is still unverified |

## Run it locally

```
python3 -m unittest discover -s tests
python3 scripts/run_all.py
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Turn on GitHub Pages

In the repository, go to Settings, then Pages. Under Build and deployment, set Source to Deploy from a branch, choose `main` and the `/ (root)` folder, then save.

## Notes

Stock data is delayed and is not investment advice. Lawsuit and deal headlines report what outlets published. They are claims and reports, not findings.
