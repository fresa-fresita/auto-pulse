# Sources and what is verified

The site shows headline, source name, date and link only. It does not copy article text.

| Panel | Source | Status |
|---|---|---|
| Headlines | RSS feeds from CBT News, Automotive World, Auto Rental News and Electrek | Feed addresses are best guesses and were not checked before launch. A feed that fails is skipped and shown as unavailable under Sources on the page. Check each outlet's terms for headline display |
| Recalls | NHTSA recall flat file, `static.nhtsa.gov/odi/ffdd/rcl/FLAT_RCL_POST_2010.zip`. NHTSA data is public domain | The column positions in `scripts/fetch_recalls.py` come from NHTSA's data dictionary and were not tested against the live file. The script checks the layout on every run and keeps the previous data if it does not match |
| Stocks | Stooq end-of-day CSV | Stooq is free for non-commercial use and its wording on redistribution is unclear. Prices are credited to Stooq on the page. If a ticker fails, the page shows "Price unavailable" |
| Rental and leasing | The same news feeds, filtered by keyword, plus Hertz and Avis Budget prices | Keyword filtering is rough and can include off-topic items |

## Known limits

- Topic tags on headlines come from keywords in the title. They are a guide, not a classification.
- Lawsuit and deal headlines report what outlets published. They are claims and reports, not findings.
- Nothing has been tested against the live feeds from this repository yet. The first run of the daily workflow is the first real test. Check the Actions tab and the Sources list on the page after it runs.
