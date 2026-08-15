import json
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

import news_pipeline as pipeline

RSS = b'''<?xml version="1.0"?><rss><channel><item>
<title>UK &amp; Canada discuss technology partnership</title>
<link>https://example.com/story?utm_source=test</link>
<description><![CDATA[<p>A <strong>detailed</strong> update.</p><script>alert(1)</script>]]></description>
<pubDate>Sat, 15 Aug 2026 12:00:00 GMT</pubDate>
</item></channel></rss>'''

class PipelineTests(unittest.TestCase):
    def test_sanitization_strips_active_markup_and_decodes_entities(self):
        self.assertEqual(pipeline.sanitize('<style>x</style><p>A &amp; B</p><iframe>x</iframe>'), 'A & B')
        self.assertEqual(pipeline.safe_url('javascript:alert(1)'), '')

    def test_feed_normalization_is_timezone_safe_and_tagged(self):
        source = pipeline.Source('BBC News', 'https://example.com/feed', 'Politics', 'World', 3)
        story = pipeline.parse_feed(RSS, source)[0]
        self.assertEqual(story['published'], '2026-08-15T12:00:00Z')
        self.assertEqual(story['url'], 'https://example.com/story')
        self.assertEqual(story['category'], 'Tech')
        self.assertIn(story['region'], ('UK', 'Canada'))
        self.assertNotIn('<', story['summary'])
        self.assertNotIn('alert', story['summary'])

    def test_dedupe_collapses_same_event_and_keeps_newer(self):
        base = {'summary': 'x', 'sourceWeight': 3, 'source': 'A', 'category': 'Politics', 'region': 'UK', 'labels': []}
        old = dict(base, id='1', title='Prime minister announces major new housing plan', url='https://a.test/1', published='2026-08-15T10:00:00Z')
        new = dict(base, id='2', title='Major new housing plan announced by prime minister', url='https://b.test/2', published='2026-08-15T11:00:00Z')
        self.assertEqual([x['id'] for x in pipeline.dedupe([old, new])], ['2'])

    def test_ranking_favors_recency_and_relevance(self):
        now = datetime(2026, 8, 15, 12, tzinfo=timezone.utc)
        basic = {'summary': 'A useful summary ' * 10, 'source': 'A', 'category': 'Politics', 'labels': [], 'url': 'https://x.test'}
        relevant = dict(basic, id='r', title='Relevant', published='2026-08-15T11:00:00Z', sourceWeight=5, region='UK')
        stale = dict(basic, id='s', title='Stale', published='2026-08-10T11:00:00Z', sourceWeight=1, region='World')
        self.assertEqual(pipeline.rank([stale, relevant], now)[0]['id'], 'r')

    def test_category_rules_cover_requested_sports(self):
        source = pipeline.Source('BBC News', 'https://example.com', 'Politics', 'World')
        category, region, labels = pipeline.categorize('Saracens rugby prepare for England fixture', '', source)
        self.assertEqual(category, 'Sports')
        self.assertEqual(region, 'UK')
        self.assertIn('Rugby', labels)
        category, region, labels = pipeline.categorize('Toronto Blue Jays baseball update', '', source)
        self.assertEqual((category, region), ('Sports', 'Canada'))
        self.assertIn('Baseball', labels)
        category, region, labels = pipeline.categorize('Toronto Maple Leafs prepare for season', '', source)
        self.assertEqual((category, region), ('Sports', 'Canada'))
        self.assertIn('Maple Leafs', labels)

    def test_england_region_word_does_not_turn_non_sport_into_sport(self):
        source = pipeline.Source('Test', 'https://example.com', 'Politics', 'UK')
        category, _, _ = pipeline.categorize('Hospitals in England publish safety data', '', source)
        self.assertEqual(category, 'Politics')

    def test_dedicated_politics_feed_is_not_reclassified_by_tech_reference(self):
        source = pipeline.Source('The Guardian China', 'https://example.com', 'Politics', 'China')
        category, region, _ = pipeline.categorize('China publishes AI policy', '', source)
        self.assertEqual((category, region), ('Politics', 'China'))

    def test_explicit_source_filter_and_focus_label(self):
        source = pipeline.Source('Leafs', 'https://example.com', 'Sports', 'Canada', 5, ('maple leafs',), 'Maple Leafs')
        payload = RSS.replace(b'UK &amp; Canada discuss technology partnership', b'Unrelated hockey report')
        self.assertEqual(pipeline.parse_feed(payload, source), [])
        payload = RSS.replace(b'UK &amp; Canada discuss technology partnership', b'Maple Leafs publish roster update')
        story = pipeline.parse_feed(payload, source)[0]
        self.assertEqual(story['focus'], 'Maple Leafs')
        self.assertIn('Maple Leafs', story['labels'])

    def test_top_is_exactly_seven_and_source_diverse(self):
        stories = []
        for i in range(12):
            stories.append({'id': str(i), 'title': f'Unique story number {i}', 'summary': 'x', 'url': f'https://e.test/{i}',
                'published': f'2026-08-15T{12-i:02d}:00:00Z', 'sourceWeight': 3, 'source': f'Source {i % 4}',
                'category': ('Politics', 'Tech', 'Sports')[i % 3], 'region': 'World', 'labels': []})
        top = pipeline.select_top(stories)
        self.assertEqual(len(top), 7)
        self.assertEqual({s['category'] for s in top}, {'Politics', 'Tech', 'Sports'})
        self.assertLessEqual(max(sum(s['source'] == name for s in top) for name in {s['source'] for s in top}), 2)
        self.assertLessEqual(max((sum(s.get('focus') == focus for s in top)
                                  for focus in {s.get('focus') for s in top if s.get('focus')}), default=0), 1)

    def test_output_retains_explicit_coverage_ahead_of_ranked_fill(self):
        def story(identifier, category='Politics', region='World', focus='', labels=None):
            return {'id': identifier, 'title': identifier, 'summary': 'x', 'url': f'https://e.test/{identifier}',
                    'published': '2026-08-15T12:00:00Z', 'sourceWeight': 3, 'source': identifier,
                    'category': category, 'region': region, 'labels': labels or [], 'focus': focus}
        top = [story(f'top-{i}', ('Politics', 'Tech', 'Sports')[i % 3]) for i in range(7)]
        required = [story(f'politics-{region}', region=region) for region in ('UK', 'Canada', 'US', 'China')]
        required += [story(focus, 'Sports', 'Canada', focus) for focus in ('Saracens', 'Blue Jays', 'Maple Leafs')]
        required += [story('england', 'Sports', 'UK', labels=['England Rugby'])]
        filler = [story(f'filler-{i}') for i in range(25)]
        output = pipeline.order_for_output(top, filler + required, limit=15)
        self.assertEqual(len(output), 15)
        self.assertTrue(all(item in output for item in required))

    def test_checked_in_fallback_shape(self):
        data_path = Path(__file__).parents[1] / 'data' / 'news.json'
        if not data_path.exists():
            self.skipTest('snapshot generated after first live refresh')
        data = json.loads(data_path.read_text(encoding='utf-8'))
        self.assertEqual(data['schemaVersion'], 1)
        self.assertEqual(len(data['topStoryIds']), 7)
        self.assertTrue(all(set(('id', 'title', 'summary', 'url', 'published', 'category', 'source')) <= set(s) for s in data['stories']))

if __name__ == '__main__':
    unittest.main()
