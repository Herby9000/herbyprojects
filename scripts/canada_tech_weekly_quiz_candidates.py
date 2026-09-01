#!/usr/bin/env python3
"""Collect a bounded discovery set for the weekly Canadian technology quiz."""
from __future__ import annotations

import argparse
import concurrent.futures
import html
import json
import re
import sys
import time
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from typing import Callable, Iterable, Sequence
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

MAX_CANDIDATES = 24
MIN_CANDIDATES = 8
MAX_FEED_BYTES = 2_000_000
HTTP_TIMEOUT_SECONDS = 8
HTTP_ATTEMPTS = 2
WINDOW_DAYS = 8
USER_AGENT = "HerbyProjectsQuizCollector/1.0 (+https://herbyprojects.com/)"
TRACKING_PARAMETERS = {"fbclid", "gclid", "mc_cid", "mc_eid"}
SPACE_RE = re.compile(r"\s+")
TAG_RE = re.compile(r"<[^>]+>")
TITLE_TOKEN_RE = re.compile(r"[a-z0-9]+")


@dataclass(frozen=True)
class Source:
    name: str
    url: str


SOURCES = (
    Source("BetaKit", "https://betakit.com/feed/"),
    Source("Techcouver", "https://techcouver.com/feed/"),
    Source("MobileSyrup", "https://mobilesyrup.com/feed/"),
    Source("CBC Technology", "https://www.cbc.ca/cmlink/rss-technology"),
)


class CollectionError(RuntimeError):
    """Raised when bounded collection cannot produce a usable discovery set."""


def clean_text(value: str, limit: int | None = None) -> str:
    text = html.unescape(TAG_RE.sub(" ", value or ""))
    text = SPACE_RE.sub(" ", "".join(character for character in text if ord(character) >= 32)).strip()
    if limit and len(text) > limit:
        text = text[: limit - 1].rstrip() + "…"
    return text


def direct_https_url(value: str) -> str:
    try:
        parts = urlsplit(html.unescape((value or "").strip()))
        port = parts.port
    except ValueError:
        return ""
    if (parts.scheme != "https" or not parts.hostname or parts.username or parts.password
            or port not in (None, 443)):
        return ""
    query = urlencode([
        (key, item) for key, item in parse_qsl(parts.query, keep_blank_values=True)
        if not key.lower().startswith("utm_") and key.lower() not in TRACKING_PARAMETERS
    ])
    return urlunsplit(("https", parts.netloc.lower(), parts.path or "/", query, ""))


def parse_date(value: str) -> datetime | None:
    if not value:
        return None
    try:
        parsed = parsedate_to_datetime(value)
    except (TypeError, ValueError, OverflowError):
        try:
            parsed = datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
        except (TypeError, ValueError, OverflowError):
            return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def child_text(node: ET.Element, names: set[str]) -> str:
    for child in list(node):
        if child.tag.rsplit("}", 1)[-1].lower() in names:
            text = "".join(child.itertext()).strip()
            if text:
                return text
    return ""


def entry_url(node: ET.Element) -> str:
    fallback = ""
    for child in list(node):
        if child.tag.rsplit("}", 1)[-1].lower() != "link":
            continue
        href = child.attrib.get("href", "").strip()
        if href and child.attrib.get("rel", "alternate") == "alternate":
            return href
        fallback = fallback or href or (child.text or "").strip()
    return fallback


def parse_feed(payload: bytes, source: Source) -> list[dict]:
    try:
        root = ET.fromstring(payload)
    except ET.ParseError as error:
        raise CollectionError(f"{source.name} returned invalid XML: {error}") from error
    records = []
    for node in root.iter():
        if node.tag.rsplit("}", 1)[-1].lower() not in {"item", "entry"}:
            continue
        title = clean_text(child_text(node, {"title"}), 240)
        published = parse_date(child_text(node, {"pubdate", "published", "updated", "date"}))
        url = direct_https_url(entry_url(node))
        snippet = clean_text(child_text(node, {"description", "summary", "content", "encoded"}), 320)
        if title and published and url:
            records.append({
                "title": title,
                "published": published,
                "source": source.name,
                "url": url,
                "snippet": snippet,
            })
    return records


def fetch_source(source: Source) -> bytes:
    last_error: Exception | None = None
    for attempt in range(HTTP_ATTEMPTS):
        request = urllib.request.Request(
            source.url,
            headers={"Accept": "application/atom+xml, application/rss+xml, application/xml, text/xml", "User-Agent": USER_AGENT},
        )
        try:
            with urllib.request.urlopen(request, timeout=HTTP_TIMEOUT_SECONDS) as response:
                if response.status != 200:
                    raise CollectionError(f"HTTP {response.status}")
                if not direct_https_url(response.geturl()):
                    raise CollectionError("feed redirected to a non-HTTPS URL")
                payload = response.read(MAX_FEED_BYTES + 1)
                if len(payload) > MAX_FEED_BYTES:
                    raise CollectionError(f"feed exceeded {MAX_FEED_BYTES} bytes")
                return payload
        except (OSError, urllib.error.URLError, CollectionError) as error:
            last_error = error
            if attempt + 1 < HTTP_ATTEMPTS:
                time.sleep(0.5)
    raise CollectionError(f"{source.name} fetch failed after {HTTP_ATTEMPTS} attempts: {last_error}")


def title_key(title: str) -> str:
    return " ".join(TITLE_TOKEN_RE.findall(title.casefold()))


def select_candidates(records: Iterable[dict], now: datetime, limit: int = MAX_CANDIDATES) -> list[dict]:
    now = now.astimezone(timezone.utc)
    cutoff = now - timedelta(days=WINDOW_DAYS)
    eligible = [record for record in records if cutoff <= record["published"] <= now]
    eligible.sort(key=lambda item: (
        -item["published"].timestamp(), item["title"].casefold(), item["source"].casefold(), item["url"]
    ))
    selected = []
    seen_urls: set[str] = set()
    seen_titles: set[str] = set()
    for record in eligible:
        normalized_title = title_key(record["title"])
        if record["url"] in seen_urls or normalized_title in seen_titles:
            continue
        seen_urls.add(record["url"])
        seen_titles.add(normalized_title)
        selected.append({
            "title": record["title"],
            "publicationDate": record["published"].date().isoformat(),
            "source": record["source"],
            "url": record["url"],
            "snippet": record["snippet"],
        })
        if len(selected) == min(limit, MAX_CANDIDATES):
            break
    return selected


def collect(
    now: datetime,
    sources: Sequence[Source] = SOURCES,
    fetcher: Callable[[Source], bytes] = fetch_source,
    minimum: int = MIN_CANDIDATES,
) -> list[dict]:
    records = []
    failures = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=len(sources)) as executor:
        futures = {executor.submit(fetcher, source): source for source in sources}
        for future, source in sorted(futures.items(), key=lambda item: item[1].name):
            try:
                records.extend(parse_feed(future.result(), source))
            except Exception as error:
                failures.append(f"{source.name}: {error}")
    candidates = select_candidates(records, now)
    if len(candidates) < minimum:
        detail = "; ".join(failures) if failures else "feeds contained too few in-window records"
        raise CollectionError(f"only {len(candidates)} unique current candidates (minimum {minimum}); {detail}")
    return candidates


def build_document(candidates: list[dict], now: datetime) -> dict:
    end = now.astimezone(timezone.utc).date()
    return {
        "windowStart": (end - timedelta(days=WINDOW_DAYS)).isoformat(),
        "windowEnd": end.isoformat(),
        "candidateCount": len(candidates),
        "candidates": candidates,
    }


def encode_document(document: dict) -> str:
    return json.dumps(document, ensure_ascii=False, separators=(",", ":"), sort_keys=False)


def parse_now(value: str) -> datetime:
    parsed = parse_date(value)
    if parsed is None:
        raise argparse.ArgumentTypeError("expected an ISO-8601 date/time")
    return parsed


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--now", type=parse_now, help="explicit UTC collection time for reproducible verification")
    args = parser.parse_args(argv)
    now = args.now or datetime.now(timezone.utc)
    try:
        candidates = collect(now)
    except CollectionError as error:
        print(f"collection failed: {error}", file=sys.stderr)
        return 1
    print(encode_document(build_document(candidates, now)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
