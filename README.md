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

### Architecture

`news/scripts/news_pipeline.py` is a standard-library-only RSS/Atom normalizer. It fetches each source independently, converts publisher markup to plain text, rejects non-HTTP links, normalizes timestamps to UTC, tags regions/categories/teams, deduplicates similar events, and ranks for recency, source quality, focus and diversity. It writes:

- `news/data/news.json`, the progressively enhanced app data;
- `news/snapshot.html`, a readable generated fragment;
- the same seven source-attributed stories inside `news/index.html`, so an edition remains readable without JavaScript or after a failed refresh.

The browser app creates all publisher-derived UI with `textContent`, opens stories in a native accessible dialog, and provides the original source only as a secondary link. It never iframes a publisher. A `?v=1` asset version and `fetch(..., {cache: "no-store"})` prevent indefinite client staleness; deploys also replace the static JSON on each refresh.

### Sources and coverage

The current feed registry uses BBC News, BBC Politics, BBC Technology, BBC Sport and BBC Rugby Union; CBC Canada and World; NPR Politics for explicit US coverage; Guardian UK, China and Technology; Ars Technica; Sky Sports; the official Saracens feed; the official MLB Toronto Blue Jays feed; and a Sportsnet NHL feed filtered specifically for Maple Leafs stories. These are freely readable public feeds/pages and require no key or subscription. A failed publisher is recorded in `sourceStatus` and does not invalidate successful sources.

Source summaries vary in length. The reader labels them as source-provided summaries (or headline-only) and never claims to reproduce a full article. Publisher content and links remain the publishers’ property.

### Refresh and deployment

`.github/workflows/news.yml` runs on every main-branch push, on manual dispatch, and at minute 17 every four hours. Every run executes deterministic tests and asset validation and deploys the repository to GitHub Pages. Scheduled/manual runs also refresh feeds with the checked-in edition as an emergency fallback and commit changed generated data; push runs deploy that checked-in edition without creating a refresh loop. There are no application secrets, logins, analytics or personal data.

### Development and verification

Run the pipeline tests with Python’s built-in `unittest`, then run `news/scripts/news_pipeline.py --allow-fallback --status`. Serve the repository root with any static HTTP server; the app is at `/news/`. JavaScript can be syntax-checked with Node. Tests cover normalization and UTC timestamps, active-markup removal, URL safety, event deduplication, ranking, requested category/region/team rules, focused-feed filtering, fallback shape, section diversity and exactly seven top stories.

### Limitations and source maintenance

RSS is not guaranteed to contain full article text, and publishers can change or retire feeds without notice. Feed discovery, extraction and ranking are therefore intentionally conservative. To maintain a source, update the `SOURCES` registry, prefer an official or reputable free HTTPS RSS/Atom endpoint, add a narrow `required_terms` filter for shared feeds, and add deterministic tests before deployment. Hard-paywalled sources should not be added. The pipeline caps normalized summaries and the total checked-in story set to keep the static payload bounded.

## License

MIT
