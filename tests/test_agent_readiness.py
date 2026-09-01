import json
import struct
import unittest
from html.parser import HTMLParser
from pathlib import Path
from xml.etree import ElementTree


ROOT = Path(__file__).resolve().parents[1]


class DocumentParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []
        self.meta = []
        self.json_ld = []
        self.visible = []
        self._hidden_depth = 0
        self._json_ld_depth = 0
        self._json_ld_parts = []

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        if tag == "link":
            self.links.append(attributes)
        elif tag == "meta":
            self.meta.append(attributes)
        if tag in {"script", "style"}:
            self._hidden_depth += 1
        if tag == "script" and attributes.get("type") == "application/ld+json":
            self._json_ld_depth = self._hidden_depth
            self._json_ld_parts = []

    def handle_endtag(self, tag):
        if tag == "script" and self._json_ld_depth == self._hidden_depth:
            self.json_ld.append("".join(self._json_ld_parts))
            self._json_ld_depth = 0
            self._json_ld_parts = []
        if tag in {"script", "style"}:
            self._hidden_depth -= 1

    def handle_data(self, data):
        if self._json_ld_depth:
            self._json_ld_parts.append(data)
        if not self._hidden_depth:
            self.visible.append(data)


class AgentReadinessTests(unittest.TestCase):
    required_files = {
        "index.html",
        "about.html",
        "about.md",
        "contact.html",
        "contact.md",
        "privacy.html",
        "privacy.md",
        "llms.txt",
        "portfolio.md",
        "robots.txt",
        "sitemap.xml",
        "assets/herby-projects-og.svg",
        "assets/herby-projects-og.png",
    }

    def parse_html(self, relative_path):
        parser = DocumentParser()
        parser.feed((ROOT / relative_path).read_text(encoding="utf-8"))
        parser.close()
        return parser

    def test_all_agent_readiness_files_are_present(self):
        missing = sorted(path for path in self.required_files if not (ROOT / path).is_file())
        self.assertEqual(missing, [])

    def test_homepage_has_canonical_open_graph_and_valid_json_ld(self):
        page = self.parse_html("index.html")
        canonical = [link.get("href") for link in page.links if link.get("rel") == "canonical"]
        self.assertEqual(canonical, ["https://herbyprojects.com/"])

        open_graph = {meta.get("property"): meta.get("content") for meta in page.meta if meta.get("property")}
        self.assertEqual(open_graph["og:type"], "website")
        self.assertEqual(open_graph["og:url"], "https://herbyprojects.com/")
        self.assertEqual(open_graph["og:image"], "https://herbyprojects.com/assets/herby-projects-og.png")
        self.assertEqual(open_graph["og:image:width"], "1200")
        self.assertEqual(open_graph["og:image:height"], "630")

        self.assertEqual(len(page.json_ld), 1)
        structured_data = json.loads(page.json_ld[0])
        self.assertEqual(structured_data["@context"], "https://schema.org")
        graph = {item["@type"]: item for item in structured_data["@graph"]}
        self.assertEqual(set(graph), {"Organization", "WebSite"})
        organization = graph["Organization"]
        self.assertEqual(organization["name"], "Herby Projects")
        self.assertTrue(organization["description"])
        self.assertEqual(organization["url"], "https://herbyprojects.com/")
        self.assertTrue(organization["logo"].startswith("https://herbyprojects.com/"))
        self.assertEqual(organization["sameAs"], ["https://github.com/Herby9000"])
        self.assertEqual(
            organization["contactPoint"],
            {
                "@type": "ContactPoint",
                "contactType": "technical support",
                "url": "https://herbyprojects.com/contact",
                "availableLanguage": "English",
            },
        )
        self.assertEqual(
            organization["address"],
            {
                "@type": "PostalAddress",
                "addressLocality": "Toronto",
                "addressRegion": "Ontario",
                "addressCountry": "CA",
            },
        )
        self.assertEqual(graph["WebSite"]["publisher"]["@id"], organization["@id"])

    def test_sitemap_is_valid_and_contains_canonical_public_pages(self):
        root = ElementTree.parse(ROOT / "sitemap.xml").getroot()
        self.assertEqual(root.tag, "{http://www.sitemaps.org/schemas/sitemap/0.9}urlset")
        locations = {
            node.text
            for node in root.findall("{http://www.sitemaps.org/schemas/sitemap/0.9}url/{http://www.sitemaps.org/schemas/sitemap/0.9}loc")
        }
        self.assertEqual(
            locations,
            {
                "https://herbyprojects.com/",
                "https://herbyprojects.com/about",
                "https://herbyprojects.com/contact",
                "https://herbyprojects.com/privacy",
                "https://herbyprojects.com/projects/three-smiles",
                "https://herby9000.github.io/herbyprojects/projects/canadian-tech-challenge/",
            },
        )
        last_modified = {
            node.text
            for node in root.findall("{http://www.sitemaps.org/schemas/sitemap/0.9}url/{http://www.sitemaps.org/schemas/sitemap/0.9}lastmod")
        }
        self.assertEqual(last_modified, {"2026-08-30", "2026-09-01"})

    def test_llms_guidance_explains_when_and_how_to_use_the_site(self):
        guidance = (ROOT / "llms.txt").read_text(encoding="utf-8")
        for phrase in (
            "## When to use Herby Projects",
            "Reach for Herby Projects when a user asks for:",
            "official live URL or source repository",
            "Do not use Herby Projects as a source for private journal entries",
            "## How an agent should use this site",
            "https://herbyprojects.com/portfolio.md",
            "/about.md",
        ):
            self.assertIn(phrase, guidance)

    def test_workflow_prepares_clean_trust_page_routes(self):
        workflow = (ROOT / ".github/workflows/news.yml").read_text(encoding="utf-8")
        self.assertIn("for page in about contact privacy", workflow)
        self.assertIn('cp "$page.html" "$page/index.html"', workflow)

    def test_trust_pages_have_at_least_500_visible_characters(self):
        for path in ("about.html", "contact.html", "privacy.html"):
            with self.subTest(path=path):
                visible = " ".join(" ".join(self.parse_html(path).visible).split())
                self.assertGreaterEqual(len(visible), 500)

    def test_trust_pages_and_markdown_state_public_boundaries(self):
        expected = {
            "about": ("personal open-source portfolio", "private software"),
            "contact": ("Herby9000 GitHub", "no public office"),
            "privacy": ("Cloudflare", "cross-site marketing trackers", "application cookie", "private applications"),
        }
        for page, phrases in expected.items():
            with self.subTest(page=page):
                html = (ROOT / f"{page}.html").read_text(encoding="utf-8")
                markdown = (ROOT / f"{page}.md").read_text(encoding="utf-8")
                for phrase in phrases:
                    self.assertIn(phrase, html)
                    self.assertIn(phrase, markdown)

    def test_open_graph_png_has_signature_and_exact_dimensions(self):
        payload = (ROOT / "assets/herby-projects-og.png").read_bytes()
        self.assertEqual(payload[:8], b"\x89PNG\r\n\x1a\n")
        self.assertEqual(payload[12:16], b"IHDR")
        self.assertEqual(struct.unpack(">II", payload[16:24]), (1200, 630))


if __name__ == "__main__":
    unittest.main()
