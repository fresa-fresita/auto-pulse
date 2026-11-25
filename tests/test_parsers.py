import os
import sys
import unittest
from datetime import datetime, timezone

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "scripts"))

import fetch_news  # noqa: E402
import fetch_recalls  # noqa: E402

RSS = b"""<?xml version="1.0"?>
<rss version="2.0"><channel><title>Test</title>
<item><title>Ford recalls 100,000 trucks over brake issue</title><link>https://example.com/a</link>
<pubDate>Mon, 23 Nov 2026 14:00:00 +0000</pubDate></item>
<item><title>Hertz and Avis hold pricing as rental demand softens</title><link>https://example.com/b</link>
<pubDate>Mon, 23 Nov 2026 10:00:00 +0000</pubDate></item>
<item><title>Group acquires Toyota dealership in Ohio</title><link>javascript:alert(1)</link>
<pubDate>Mon, 23 Nov 2026 09:00:00 +0000</pubDate></item>
</channel></rss>"""

ATOM = b"""<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Automaker unveils new EV</title>
<link rel="alternate" href="https://example.com/c"/><updated>2026-11-22T08:00:00Z</updated></entry></feed>"""


def flat_line(camp, make, model, year, date, rtype="V", potaff="1000"):
    cols = [""] * 25
    cols[0] = "1"
    cols[1] = camp
    cols[2] = make
    cols[3] = model
    cols[4] = year
    cols[6] = "BRAKES"
    cols[10] = rtype
    cols[11] = potaff
    cols[15] = date
    cols[19] = "The brake line may leak."
    return "\t".join(cols)


class NewsTests(unittest.TestCase):
    def test_rss_parsing_and_tags(self):
        items = fetch_news.parse_feed(RSS, "Test")
        self.assertEqual(len(items), 2)  # javascript: link is dropped
        self.assertIn("recall", items[0]["tags"])
        self.assertIn("rental", items[1]["tags"])
        self.assertTrue(all(i["link"].startswith("https://") for i in items))

    def test_atom_parsing(self):
        items = fetch_news.parse_feed(ATOM, "Atom")
        self.assertEqual(items[0]["link"], "https://example.com/c")
        self.assertIn("launch", items[0]["tags"])
        self.assertIn("ev", items[0]["tags"])

    def test_search_feed_uses_publisher_and_filters(self):
        xml = (b"<rss><channel><item><title>Flexcar adds new cities - Reuters</title>"
               b"<link>https://news.google.com/rss/articles/x</link><pubDate>Mon, 23 Nov 2026 10:00:00 GMT</pubDate>"
               b"<source url='https://reuters.com'>Reuters</source></item>"
               b"<item><title>Other story - Foo</title><link>https://a.com/1</link>"
               b"<pubDate>Mon, 23 Nov 2026 10:00:00 GMT</pubDate><source>Foo</source></item></channel></rss>")
        items = fetch_news.parse_feed(xml, "Google News", True, r"\bflexcar\b")
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["source"], "Reuters")
        self.assertEqual(items[0]["title"], "Flexcar adds new cities")
        self.assertIn("flexcar", items[0]["tags"])

    def test_avis_tag(self):
        self.assertIn("avis", fetch_news.tag_title("Avis Budget names new CFO"))

    def test_entities_rejected(self):
        with self.assertRaises(ValueError):
            fetch_news.parse_feed(b'<?xml version="1.0"?><!DOCTYPE x [<!ENTITY a "b">]><rss/>', "Bad")

    def test_merge_dedupes_and_drops_old(self):
        now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        fresh = {"title": "Same story", "link": "https://example.com/x", "source": "A", "published": now, "tags": []}
        copy = dict(fresh, source="B", link="https://example.com/y")  # same title, different link
        old = {"title": "Ancient", "link": "https://example.com/z", "source": "A", "published": "2020-01-01T00:00:00Z", "tags": []}
        merged = fetch_news.merge([fresh, old], [copy])
        self.assertEqual(len(merged), 1)


class RecallTests(unittest.TestCase):
    def test_build_groups_by_campaign(self):
        today = datetime(2026, 11, 24, tzinfo=timezone.utc)
        text = "\n".join([
            flat_line("26V123000", "FORD", "F-150", "2025", "20261120"),
            flat_line("26V123000", "FORD", "F-250", "2026", "20261120"),
            flat_line("26V124000", "TOYOTA", "CAMRY", "2024", "20261101"),
            flat_line("26E999000", "ACME", "WIDGET", "2024", "20261120", rtype="E"),
            flat_line("20V000001", "OLD", "CAR", "2015", "20200101"),
        ])
        result = fetch_recalls.build(fetch_recalls.parse_rows(text), today)
        ids = [r["id"] for r in result["recent"]]
        self.assertEqual(ids, ["26V123000", "26V124000"])
        self.assertEqual(result["recent"][0]["models"], ["F-150", "F-250"])
        self.assertEqual(result["recent"][0]["years"], [2025, 2026])
        self.assertEqual(result["campaigns_in_window"], 2)
        self.assertTrue(result["recent"][0]["url"].endswith("nhtsaId=26V123000"))

    def test_bad_layout_rejected(self):
        with self.assertRaises(ValueError):
            list(fetch_recalls.parse_rows("\n".join(["a\t" * 30] * 5)))


if __name__ == "__main__":
    unittest.main()
