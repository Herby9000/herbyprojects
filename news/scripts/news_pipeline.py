#!/usr/bin/env python3
"""Build the static news snapshot from public RSS/Atom feeds (stdlib only)."""
from __future__ import annotations

import argparse
import hashlib
import html
import json
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from typing import Iterable
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[2]
DATA_PATH = ROOT / "news" / "data" / "news.json"
SNAPSHOT_PATH = ROOT / "news" / "snapshot.html"

@dataclass(frozen=True)
class Source:
    name: str
    url: str
    category: str
    region: str
    weight: int = 1
    required_terms: tuple[str, ...] = ()
    focus: str = ""

SOURCES = (
    Source("BBC News", "https://feeds.bbci.co.uk/news/rss.xml", "Politics", "World", 4),
    Source("BBC Politics", "https://feeds.bbci.co.uk/news/politics/rss.xml", "Politics", "UK", 5),
    Source("CBC Canada", "https://www.cbc.ca/cmlink/rss-canada", "Politics", "Canada", 5),
    Source("CBC World", "https://www.cbc.ca/cmlink/rss-world", "Politics", "World", 3),
    Source("NPR Politics", "https://feeds.npr.org/1014/rss.xml", "Politics", "US", 5),
    Source("The Guardian China", "https://www.theguardian.com/world/china/rss", "Politics", "China", 5),
    Source("The Guardian UK", "https://www.theguardian.com/uk-news/rss", "Politics", "UK", 3),
    Source("Ars Technica", "https://feeds.arstechnica.com/arstechnica/index", "Tech", "World", 5),
    Source("BBC Technology", "https://feeds.bbci.co.uk/news/technology/rss.xml", "Tech", "World", 4),
    Source("The Guardian Technology", "https://www.theguardian.com/technology/rss", "Tech", "World", 3),
    Source("BBC Sport", "https://feeds.bbci.co.uk/sport/rss.xml", "Sports", "UK", 4),
    Source("BBC Rugby Union", "https://feeds.bbci.co.uk/sport/rugby-union/rss.xml", "Sports", "England", 5),
    Source("Saracens", "https://saracens.com/feed/", "Sports", "England", 5, focus="Saracens"),
    Source("Toronto Blue Jays", "https://www.mlb.com/bluejays/feeds/news/rss.xml", "Sports", "Canada", 5, focus="Blue Jays"),
    Source("Sportsnet Maple Leafs", "https://www.sportsnet.ca/hockey/nhl/feed/", "Sports", "Canada", 5, ("maple leafs", "leafs"), "Maple Leafs"),
    Source("Sky Sports", "https://www.skysports.com/rss/12040", "Sports", "UK", 3),
)

TAG_RE = re.compile(r"<[^>]*>")
SCRIPT_RE = re.compile(r"<(script|style|iframe|object|embed)[^>]*>.*?</\1\s*>", re.I | re.S)
SPACE_RE = re.compile(r"\s+")
TOKEN_RE = re.compile(r"[a-z0-9]+")
TRACKING_QUERY_RE = re.compile(r"([?&])(utm_[^=&]+|cmpid|at_medium|at_campaign)=[^&]*", re.I)

REGION_RULES = {
    "Canada": ("canada", "canadian", "ottawa", "toronto", "blue jays", "maple leafs", "trudeau", "carney"),
    "US": ("united states", "u.s.", "washington", "white house", "congress", "trump", "american"),
    "China": ("china", "chinese", "beijing", "xi jinping"),
    "UK": ("united kingdom", "britain", "british", "england", "westminster", "downing street", "starmer"),
}
SPORT_RULES = ("rugby", "saracens", "blue jays", "baseball", "maple leafs", "nhl", "mlb", "premiership")
TECH_RULES = ("technology", "tech", "software", "ai ", "artificial intelligence", "cyber", "apple", "google", "microsoft", "robot", "chip")
TEAM_RULES = {
    "Saracens": ("saracens",),
    "Blue Jays": ("blue jays",),
    "Maple Leafs": ("maple leafs", "leafs"),
    "England Rugby": ("england rugby", "red roses", "six nations"),
}


def text_of(node: ET.Element | None) -> str:
    return "" if node is None else "".join(node.itertext()).strip()


def child_text(item: ET.Element, names: Iterable[str]) -> str:
    wanted = set(names)
    for child in list(item):
        local = child.tag.rsplit("}", 1)[-1].lower()
        if local in wanted:
            value = text_of(child)
            if value:
                return value
    return ""


def sanitize(value: str) -> str:
    """Convert externally supplied markup to inert plain text."""
    value = SCRIPT_RE.sub(" ", value or "")
    value = TAG_RE.sub(" ", value)
    value = html.unescape(value)
    value = "".join(ch for ch in value if ch in "\n\t" or ord(ch) >= 32)
    return SPACE_RE.sub(" ", value).strip()


def safe_url(value: str) -> str:
    value = html.unescape((value or "").strip())
    parsed = urlparse(value)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        return ""
    cleaned = TRACKING_QUERY_RE.sub(r"\1", value).replace("?&", "?").rstrip("?&")
    return cleaned


def parse_date(value: str) -> datetime:
    if not value:
        return datetime(1970, 1, 1, tzinfo=timezone.utc)
    try:
        parsed = parsedate_to_datetime(value)
    except (TypeError, ValueError, OverflowError):
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return datetime(1970, 1, 1, tzinfo=timezone.utc)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def categorize(title: str, summary: str, source: Source) -> tuple[str, str, list[str]]:
    haystack = f"{title} {summary}".lower()
    category = source.category
    # Dedicated feeds are already editorially classified. Only broad feeds need
    # keyword reclassification; a passing tech reference must not move politics.
    if source.name in ("BBC News", "CBC World"):
        if any(term in haystack for term in SPORT_RULES):
            category = "Sports"
        elif any(term in haystack for term in TECH_RULES):
            category = "Tech"
    regions = [name for name, terms in REGION_RULES.items() if any(term in haystack for term in terms)]
    region = regions[0] if regions else source.region
    labels = [category, region]
    if "rugby" in haystack or "saracens" in haystack:
        labels.append("Rugby")
    if "blue jays" in haystack or "baseball" in haystack:
        labels.append("Baseball")
    if "maple leafs" in haystack or "nhl" in haystack:
        labels.append("Hockey")
    focus_labels = [name for name, terms in TEAM_RULES.items() if any(term in haystack for term in terms)]
    if source.focus:
        focus_labels.insert(0, source.focus)
    labels.extend(focus_labels)
    return category, region, list(dict.fromkeys(labels))


def parse_feed(payload: bytes, source: Source) -> list[dict]:
    root = ET.fromstring(payload)
    items = [node for node in root.iter() if node.tag.rsplit("}", 1)[-1].lower() in ("item", "entry")]
    stories = []
    for item in items:
        title = sanitize(child_text(item, ("title",)))
        summary = sanitize(child_text(item, ("description", "summary", "content", "encoded")))
        link = child_text(item, ("link",))
        if not link:
            for child in list(item):
                if child.tag.rsplit("}", 1)[-1].lower() == "link":
                    link = child.attrib.get("href", "")
                    if link:
                        break
        link = safe_url(link)
        published = parse_date(child_text(item, ("pubdate", "published", "updated", "date")))
        if not title or not link:
            continue
        if source.required_terms and not any(term in f"{title} {summary}".lower() for term in source.required_terms):
            continue
        if len(summary) > 2400:
            summary = summary[:2399].rsplit(" ", 1)[0] + "…"
        category, region, labels = categorize(title, summary, source)
        identity = hashlib.sha256(f"{title.lower()}|{link}".encode()).hexdigest()[:16]
        stories.append({
            "id": identity, "title": title, "summary": summary or "This feed supplied a headline but no article summary.",
            "contentStatus": "Source-provided feed summary" if summary else "Headline only — no summary supplied",
            "url": link, "source": source.name, "published": published.isoformat().replace("+00:00", "Z"),
            "category": category, "region": region, "labels": labels, "sourceWeight": source.weight,
            "focus": source.focus,
        })
    return stories


def title_tokens(title: str) -> set[str]:
    stop = {"the", "a", "an", "and", "or", "to", "of", "in", "on", "for", "with", "as", "at", "from", "is", "are", "after"}
    return {token for token in TOKEN_RE.findall(title.lower()) if len(token) > 2 and token not in stop}


def similar(a: dict, b: dict) -> bool:
    left, right = title_tokens(a["title"]), title_tokens(b["title"])
    if not left or not right:
        return False
    return len(left & right) / min(len(left), len(right)) >= 0.62


def dedupe(stories: list[dict]) -> list[dict]:
    kept = []
    for story in sorted(stories, key=lambda x: (x["published"], x["sourceWeight"]), reverse=True):
        if any(story["url"].split("?", 1)[0] == old["url"].split("?", 1)[0] or similar(story, old) for old in kept):
            continue
        kept.append(story)
    return kept


def rank(stories: list[dict], now: datetime) -> list[dict]:
    def score(story: dict) -> float:
        age_hours = max(0, (now - parse_date(story["published"])).total_seconds() / 3600)
        specificity = 2 if story["region"] in ("UK", "Canada", "US", "China", "England") else 0
        focus = 2 if story.get("focus") or any(label in TEAM_RULES for label in story.get("labels", [])) else 0
        summary = min(len(story["summary"]) / 500, 2)
        return story["sourceWeight"] * 3 + specificity + focus + summary - age_hours / 18
    return sorted(stories, key=lambda story: (score(story), story["published"]), reverse=True)


def select_top(stories: list[dict], count: int = 7) -> list[dict]:
    """Select meaningful variety while always returning exactly count when possible."""
    if len(stories) < count:
        raise ValueError(f"Need at least {count} stories, got {len(stories)}")
    selected, source_counts, category_counts, focus_counts = [], {}, {}, {}

    def add(story: dict) -> None:
        selected.append(story)
        source_counts[story["source"]] = source_counts.get(story["source"], 0) + 1
        category_counts[story["category"]] = category_counts.get(story["category"], 0) + 1
        if story.get("focus"):
            focus_counts[story["focus"]] = focus_counts.get(story["focus"], 0) + 1

    # Avoid an edition accidentally omitting an entire requested section. Prefer
    # a different publisher for each seed story when the ranked pool permits it.
    for category in ("Politics", "Tech", "Sports"):
        story = next((item for item in stories
                      if item["category"] == category and not source_counts.get(item["source"])), None)
        if story is None:
            story = next((item for item in stories if item["category"] == category), None)
        if story:
            add(story)
    for story in stories:
        if story in selected:
            continue
        if (source_counts.get(story["source"], 0) >= 2
                or category_counts.get(story["category"], 0) >= 3
                or (story.get("focus") and focus_counts.get(story["focus"], 0) >= 1)):
            continue
        add(story)
        if len(selected) == count:
            break
    for story in stories:
        if len(selected) == count:
            break
        if story not in selected:
            add(story)
    return selected


def order_for_output(top: list[dict], ranked: list[dict], limit: int = 200) -> list[dict]:
    """Keep explicit editorial coverage visible before filling by rank."""
    ordered = list(top)
    requirements = [
        lambda story, region=region: story["category"] == "Politics" and story["region"] == region
        for region in ("UK", "Canada", "US", "China")
    ] + [
        lambda story, focus=focus: story.get("focus") == focus
        for focus in ("Saracens", "Blue Jays", "Maple Leafs")
    ] + [
        lambda story: "England Rugby" in story.get("labels", []),
    ]
    for requirement in requirements:
        story = next((item for item in ranked if requirement(item)), None)
        if story and story not in ordered:
            ordered.append(story)
    ordered.extend(story for story in ranked if story not in ordered)
    return ordered[:limit]


def fetch(source: Source, timeout: int = 15) -> bytes:
    request = urllib.request.Request(source.url, headers={"User-Agent": "HerbyProjectsNews/1.0 (+https://herbyprojects.com/news/)"})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.read(3_000_000)


def render_snapshot(top: list[dict]) -> str:
    cards = []
    for i, story in enumerate(top, 1):
        labels = " · ".join(story["labels"])
        cards.append(
            f'<article class="snapshot-card"><p class="snapshot-number">{i:02d}</p>'
            f'<p class="story-meta">{html.escape(story["source"])} · <time datetime="{story["published"]}">{story["published"][:10]}</time></p>'
            f'<h3>{html.escape(story["title"])}</h3><p>{html.escape(story["summary"])}</p>'
            f'<p class="labels">{html.escape(labels)}</p><a href="{html.escape(story["url"], quote=True)}" rel="noopener noreferrer">Read at source</a></article>'
        )
    return "\n".join(cards) + "\n"


def embed_snapshot(fragment: str) -> None:
    """Put source-attributed fallback HTML into the app for no-JS reading."""
    index_path = ROOT / "news" / "index.html"
    if not index_path.exists():
        return
    start, end = "<!-- SNAPSHOT:START -->", "<!-- SNAPSHOT:END -->"
    document = index_path.read_text(encoding="utf-8")
    if document.count(start) != 1 or document.count(end) != 1:
        raise ValueError("news/index.html snapshot markers are missing or ambiguous")
    before, remainder = document.split(start, 1)
    _, after = remainder.split(end, 1)
    index_path.write_text(f"{before}{start}\n{fragment}{end}{after}", encoding="utf-8")


def build(allow_fallback: bool = False) -> dict:
    now = datetime.now(timezone.utc)
    all_stories, statuses = [], []
    for source in SOURCES:
        try:
            stories = parse_feed(fetch(source), source)
            if not stories:
                raise ValueError("feed contained no usable stories")
            all_stories.extend(stories)
            statuses.append({"source": source.name, "ok": True, "items": len(stories)})
        except Exception as exc:  # one broken publisher must not stop refresh
            statuses.append({"source": source.name, "ok": False, "error": sanitize(str(exc))[:180]})
    ranked = rank(dedupe(all_stories), now)
    if len(ranked) < 7 and allow_fallback and DATA_PATH.exists():
        previous = json.loads(DATA_PATH.read_text(encoding="utf-8"))
        ranked = dedupe(ranked + previous.get("stories", []))
        ranked = rank(ranked, now)
    top = select_top(ranked)
    ordered = order_for_output(top, ranked)
    output = {
        "schemaVersion": 1, "generatedAt": now.isoformat().replace("+00:00", "Z"),
        "topStoryIds": [story["id"] for story in top], "stories": ordered,
        "sourceStatus": statuses,
    }
    DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
    DATA_PATH.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    fragment = render_snapshot(top)
    SNAPSHOT_PATH.write_text(fragment, encoding="utf-8")
    embed_snapshot(fragment)
    return output


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--allow-fallback", action="store_true", help="Reuse checked-in stories only if live feeds provide fewer than seven")
    parser.add_argument("--status", action="store_true", help="Print non-secret source refresh status")
    args = parser.parse_args()
    output = build(args.allow_fallback)
    if args.status:
        for status in output["sourceStatus"]:
            print(f"{'OK' if status['ok'] else 'FAIL'} {status['source']}: {status.get('items', status.get('error'))}")
        print(f"WROTE {len(output['stories'])} stories; top={len(output['topStoryIds'])}")
    return 0

if __name__ == "__main__":
    sys.exit(main())
