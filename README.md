# Herby Projects

<p align="center">
  <img src="assets/herby-avatar.png" width="160" alt="Herby — a friendly robot with a herb sprig" />
</p>

The open-source home for the small, useful apps built by Herby for Charlie, Daisy, and family.

**Live site:** [herbyprojects.com](https://herbyprojects.com)

## What is here

- The HerbyProjects.com portfolio source
- The public Three Smiles product showcase
- Links to every live app and its public repository
- The Daily Seven static news app and its automated public-feed refresh pipeline

The apps may be personal, but the code is public. Private user data, credentials, and authenticated application content are never included here.

## Projects

- [The Daily Seven](https://herbyprojects.com/news/)
- [Three Smiles](https://github.com/Herby9000/three-smiles)
- [StickLab](https://github.com/Herby9000/sticklab)
- [Next Rugby Match](https://github.com/Herby9000/rugby-next-match)
- [Blue Jays Playoff Dashboard](https://github.com/Herby9000/blue-jays-playoff-dashboard)
- [UNO Watch Display](https://github.com/Herby9000/uno-watch-display)
- [After Dark Toronto](https://github.com/Herby9000/toronto-entertainment)

## The Daily Seven

### Architecture and privacy

`news/scripts/news_pipeline.py` is a standard-library-only RSS/Atom normalizer. It fetches every source independently, converts publisher markup to inert text, rejects unsafe links, normalizes timestamps to UTC, tags regions/categories/teams, deduplicates similar events, and ranks for recency, quality, substance and diversity. Publisher pages and images are fetched through bounded, public-HTTPS-only requests with DNS checks that reject local/private destinations. Publisher HTML is never rendered in the app.

The pipeline writes `news/data/news.json`, `news/snapshot.html`, and the same seven source-attributed fallback cards inside `news/index.html`. The browser creates all external text with `textContent`, opens stories in a native accessible dialog, and offers the attributed publisher page as an optional secondary link. There are no accounts, analytics, application secrets or personal data. The public fallback and private-reader deployment, where configured outside this public repository, use the same sanitized static edition and stable `/news/` URL.

### Sources and coverage

Normal news currently draws from:

- public and general news: BBC, CBC News, NPR, Al Jazeera, DW and UN News;
- technology and digital policy: Ars Technica, BBC Technology, TechCrunch, the Electronic Frontier Foundation, Rest of World and Guardian Technology;
- economics/business: BBC Business, CBC Business, NPR Business and Guardian business/economics feeds;
- sport: BBC Sport and Rugby Union, CBC Sports, Sky Sports, the official Saracens and MLB Blue Jays feeds, and a Sportsnet NHL feed narrowly filtered to Maple Leafs stories.

Editorial candidates come from The Conversation’s Africa and UK editions, ProPublica, Noema, Undark, Foreign Policy in Focus and Yale Environment 360. These feeds and sampled article pages were checked for anonymous free access. Candidate feeds that returned persistent 403/404 responses, redirects the safe fetcher could not validate, hard paywalls, or no extractable legally usable article text were not added. `sourceStatus` records every feed as succeeded or failed for each refresh; `editorialStatus` separately records article extraction as succeeded, failed or skipped.

### Diversity, substance and Editorial policy

Feed names are normalized to publisher families (for example every BBC, CBC, Guardian or Conversation edition shares one publisher identity). The Top 7 is always exactly seven non-Sports, non-Editorial stories, normally capped at two per publisher and seeded across Politics, Tech and Economics. Each normal section’s concise default also uses a two-per-publisher cap. If healthy alternatives are unavailable, selection relaxes deterministically rather than publishing an empty section or an incomplete Top 7. Sports team filters continue to show all exact matches.

Available text is counted with a deterministic Unicode word tokenizer; reading time is `ceil(words / 220)` with a one-minute minimum. Entries under 180 available words are omitted from featured/default views while enough substantial alternatives exist. A narrow, explicit breaking-title rule allows emergency/live items through. If feeds fail, short entries may fill otherwise empty views, and labels continue to say whether text is a feed summary, headline only, or extracted publisher-page text. Missing prose is never invented.

Editorial is a first-class long-read section for essays, analysis, investigations and explainers. Qualification requires both a source registered as `editorial` and at least 900 words (about five minutes) extracted from a freely readable publisher article page. A feed excerpt alone never passes. When a feed supplies only an excerpt, the documented fallback is conservative page extraction from semantic `<article>` prose; if extraction fails or remains below 900 words, the item is skipped. Editorial’s concise view is capped at two items per normalized publisher and displays publisher, region/topic labels, publication date, measured words/reading time, and the sanitized body in the in-app reader.

### Refresh, deployment and verification

`.github/workflows/news.yml` runs on every main push, on manual dispatch, and at minute 17 every four hours. Every run executes the Python/Node behavior suite, JSON/JavaScript validation and GitHub Pages deployment. Scheduled/manual runs refresh feeds and check in the generated edition. An emergency fallback may reuse only a previously verified Top 7 and must re-download and re-verify selected images during that build; push runs deploy the checked-in edition without a refresh loop.

The tests cover publisher normalization/caps and graceful degradation, short-content handling, reading-time math, editorial qualification/extraction/sanitization/rendering, source URL and SSRF safety, feed/image parsing, fallback and refreshed dataset invariants, exact Top 7 shape, topic/team filters, responsive control contracts and in-app reader behavior. The generated dataset exposes its selection thresholds in `policies` and its concise choices in `sectionStoryIds`, making production diversity auditable.

### Known limitations and source maintenance

RSS availability, summaries, semantic article markup and anonymous page access can change without notice. Generic extraction intentionally ignores navigation, scripts, embeds and arbitrary layout containers; some freely readable stories will therefore be skipped. Reading time measures only text actually available in the static edition, not inaccessible text on a publisher page. Images must be safe HTTPS, successfully downloaded and intrinsically at least 960×540 for Top 7 use.

To add or remove a source, edit the `SOURCES` registry, use an official/reputable free HTTPS RSS or Atom endpoint, set a stable category/region and `source_type`, and add a narrow `required_terms` filter only for shared feeds. Verify feed parsing plus multiple anonymous article pages, confirm there is no hard paywall, add a deterministic behavior test, run the full suite and a live refresh, then inspect `sourceStatus`, `editorialStatus`, publisher counts and extracted word counts. Remove endpoints that are persistently broken, paywalled, unsafe, or unable to provide usable attributed text.

## License

MIT
