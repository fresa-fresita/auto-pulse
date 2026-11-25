"""Run every data job. One failing source never stops the others."""
import sys
import traceback

import fetch_news
import fetch_recalls
import fetch_stocks

JOBS = [("news", fetch_news.main), ("recalls", fetch_recalls.main), ("stocks", fetch_stocks.main)]


def main():
    succeeded = 0
    for name, job in JOBS:
        try:
            if job():
                succeeded += 1
        except Exception:  # noqa: BLE001
            print("%s: failed" % name)
            traceback.print_exc()
    print("%d of %d jobs updated" % (succeeded, len(JOBS)))
    # Fail the run only when nothing updated, so the Actions tab shows a red mark.
    return 0 if succeeded else 1


if __name__ == "__main__":
    sys.exit(main())
