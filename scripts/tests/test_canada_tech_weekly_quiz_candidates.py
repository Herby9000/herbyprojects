#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
import json
import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "canada_tech_weekly_quiz_candidates.py"
SPEC = importlib.util.spec_from_file_location("quiz_candidates", SCRIPT)
assert SPEC is not None
collector = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = collector
assert SPEC.loader is not None
SPEC.loader.exec_module(collector)
FIXTURES = Path(__file__).parent / "fixtures"


class CollectorTests(unittest.TestCase):
    NOW = datetime(2026, 9, 1, 17, 0, tzinfo=timezone.utc)

    def test_rss_is_sanitized_filtered_and_deduplicated(self):
        payload = (FIXTURES / "canada_tech_rss.xml").read_bytes()
        records = collector.parse_feed(payload, collector.Source("Fixture RSS", "https://feed.example/rss"))
        result = collector.select_candidates(records, self.NOW, limit=24)

        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["title"], "Toronto startup raises new financing")
        self.assertEqual(result[0]["publicationDate"], "2026-08-31")
        self.assertEqual(result[0]["url"], "https://example.com/toronto-startup")
        self.assertEqual(result[0]["snippet"], "The company will expand its Canadian engineering team.")

    def test_atom_dates_and_deterministic_newest_first_order(self):
        payload = (FIXTURES / "canada_tech_atom.xml").read_bytes()
        records = collector.parse_feed(payload, collector.Source("Fixture Atom", "https://feed.example/atom"))
        result = collector.select_candidates(records, self.NOW, limit=24)

        self.assertEqual([item["title"] for item in result], [
            "Vancouver quantum company opens lab",
            "Ottawa AI firm launches platform",
        ])
        self.assertEqual(result[1]["publicationDate"], "2026-08-25")
        self.assertNotIn("<", result[1]["snippet"])

    def test_limit_is_hard_and_order_does_not_depend_on_input(self):
        records = []
        for index in range(30):
            records.append({
                "title": f"Canadian tech event {index:02d}",
                "published": datetime(2026, 8, 31, index % 24, tzinfo=timezone.utc),
                "source": "Fixture",
                "url": f"https://example.com/story-{index}",
                "snippet": "Verified fixture summary.",
            })
        forward = collector.select_candidates(records, self.NOW, limit=24)
        reverse = collector.select_candidates(reversed(records), self.NOW, limit=24)
        self.assertEqual(forward, reverse)
        self.assertEqual(len(forward), 24)

    def test_collect_fails_honestly_when_sources_are_insufficient(self):
        payload = (FIXTURES / "canada_tech_rss.xml").read_bytes()
        with self.assertRaisesRegex(collector.CollectionError, "only 1 unique current candidates"):
            collector.collect(
                now=self.NOW,
                sources=(collector.Source("Fixture", "https://feed.example/rss"),),
                fetcher=lambda _source: payload,
                minimum=8,
            )

    def test_document_is_compact_and_has_only_bounded_metadata(self):
        candidates = [{"title": "T", "publicationDate": "2026-09-01", "source": "S", "url": "https://e.test/t", "snippet": "X"}]
        document = collector.build_document(candidates, self.NOW)
        encoded = collector.encode_document(document)
        self.assertEqual(json.loads(encoded), document)
        self.assertNotIn("\n", encoded)
        self.assertEqual(set(document), {"windowStart", "windowEnd", "candidateCount", "candidates"})


if __name__ == "__main__":
    unittest.main()
