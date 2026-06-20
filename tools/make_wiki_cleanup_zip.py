import json
import re
import time
import zipfile
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote, urljoin, urlparse

import requests
from bs4 import BeautifulSoup, NavigableString, Tag


BASE = "https://wiki.veildaemon.app"
OUT_DIR = Path("reports")
STAMP = datetime.now().strftime("%Y%m%d-%H%M")
ZIP_PATH = OUT_DIR / f"wiki-meta-cleanup-pages-{STAMP}.zip"
REPORT_PATH = OUT_DIR / f"wiki-meta-cleanup-pages-{STAMP}.json"
USER_AGENT = "VeilDaemon cleanup audit bot/1.0 (local owner-requested scan; contact: veildaemon.app)"

SESSION = requests.Session()
SESSION.headers.update({"User-Agent": USER_AGENT})

RULES = [
    ("likely_gm_leak", re.compile(r"\bGM[- ]?(?:facing|only|material|toolbox|notes?)\b", re.I)),
    ("likely_gm_leak", re.compile(r"\bMonster Manual\b", re.I)),
    ("likely_gm_leak", re.compile(r"\b(?:case|pressure)\s+clock\b", re.I)),
    ("likely_gm_leak", re.compile(r"\bentity\s+loop\b", re.I)),
    ("likely_gm_leak", re.compile(r"\bstabilizer\s+language\b", re.I)),
    ("likely_gm_leak", re.compile(r"\bexit\s+condition\b", re.I)),
    ("likely_gm_leak", re.compile(r"\b(?:stat material|stat overlay|mechanical payload|mechanics)\b", re.I)),
    ("likely_gm_leak", re.compile(r"\bplaytest notes?\b", re.I)),
    ("likely_gm_leak", re.compile(r"\bPip\s*7\+|\b7\+\b|\b7\s*[–-]\s*9\s*/\s*GM\b", re.I)),
    ("tone_or_product_meta_review", re.compile(r"\b(?:ARG|fiction|lore|canon|continuity|game|sourcebook|player-facing|out-of-fiction|in-world)\b", re.I)),
    ("technical_meta_review", re.compile(r"\b(?:template|infobox|MediaWiki|wiki page|this page)\b", re.I)),
    ("leak_language_review", re.compile(r"\b(?:leaked|leak|hacker|rogue archive|stolen upload)\b", re.I)),
]

REPLACEMENTS = [
    (re.compile(r"\bGM-facing\b", re.I), "restricted field layer"),
    (re.compile(r"\bGM[- ]?only\b", re.I), "restricted classification"),
    (re.compile(r"\bGM material\b", re.I), "restricted procedure material"),
    (re.compile(r"\bGM notes?\b", re.I), "restricted notes"),
    (re.compile(r"\bGM Toolbox\b", re.I), "operator support kit"),
    (re.compile(r"\bMonster Manual\b", re.I), "restricted entity archive"),
    (re.compile(r"\bcase clock\b", re.I), "removed timing model"),
    (re.compile(r"\bpressure clock\b", re.I), "removed pressure model"),
    (re.compile(r"\bentity loop\b", re.I), "withheld behavior model"),
    (re.compile(r"\bstabilizer language\b", re.I), "stabilization procedure withheld"),
    (re.compile(r"\bexit condition\b", re.I), "resolution path removed"),
    (re.compile(r"\bencounter notes?\b", re.I), "field-contact notes"),
    (re.compile(r"\bstat material\b", re.I), "runtime classification block"),
    (re.compile(r"\bstat overlay\b", re.I), "runtime classification block"),
    (re.compile(r"\bmechanical payload\b", re.I), "sealed procedure payload"),
    (re.compile(r"\bplaytest notes?\b", re.I), "unreleased field notes"),
    (re.compile(r"\bPip\s*7\+\b", re.I), "upper-band classification withheld"),
    (re.compile(r"\b7\s*[–-]\s*9\s*/\s*GM\s*Only\b", re.I), "upper-band classification withheld"),
    (re.compile(r"\b7\+\b", re.I), "classification withheld"),
    (re.compile(r"\bplayer-facing\b", re.I), "public-release"),
    (re.compile(r"\bout-of-fiction\b", re.I), "outside public procedure"),
    (re.compile(r"\bin-world\b", re.I), "field-facing"),
    (re.compile(r"\bsourcebook\b", re.I), "archive packet"),
    (re.compile(r"\blore dump\b", re.I), "uncontrolled archive dump"),
    (re.compile(r"\bARG\b", re.I), "signal chain"),
    (re.compile(r"\bfiction\b", re.I), "public file"),
    (re.compile(r"\blore\b", re.I), "archive record"),
    (re.compile(r"\bcanon\b", re.I), "record authority"),
    (re.compile(r"\bcontinuity\b", re.I), "record continuity"),
    (re.compile(r"\bgame\b", re.I), "case file"),
    (re.compile(r"\bleaked\b", re.I), "exposed"),
    (re.compile(r"\bleak\b", re.I), "exposure"),
    (re.compile(r"\bhacker\b", re.I), "unauthorized operator"),
]


def fetch(url):
    response = SESSION.get(url, timeout=30)
    response.raise_for_status()
    time.sleep(0.15)
    return response.text


def page_url_from_title(title):
    return f"{BASE}/wiki/{quote(title.replace(' ', '_'), safe='()_-:/')}"


def discover_pages():
    pages = {}
    next_url = f"{BASE}/wiki/Special:AllPages"
    seen = set()
    while next_url and next_url not in seen:
        seen.add(next_url)
        soup = BeautifulSoup(fetch(next_url), "lxml")
        body = soup.select_one(".mw-allpages-body") or soup.select_one("#mw-content-text")
        if body:
            for a in body.select("a[href^='/wiki/']"):
                href = a.get("href", "")
                title = a.get_text(" ", strip=True)
                if title and ":" not in title:
                    pages[title] = urljoin(BASE, href)
        next_link = None
        for a in soup.select("a[href]"):
            if a.get_text(" ", strip=True).lower().startswith("next page"):
                next_link = urljoin(BASE, a["href"])
                break
        next_url = next_link
    return pages


def clean_title_from_soup(soup, fallback):
    heading = soup.select_one("#firstHeading")
    return heading.get_text(" ", strip=True) if heading else fallback


def content_from_soup(soup):
    content = soup.select_one("#mw-content-text .mw-parser-output")
    if not content:
        content = soup.select_one("#bodyContent") or soup.body
    if not content:
        return ""
    for selector in [
        ".mw-editsection",
        ".printfooter",
        ".catlinks",
        ".metadata",
        ".navbox",
        ".toc",
        "style",
        "script",
        "noscript",
    ]:
        for node in content.select(selector):
            node.decompose()
    return node_to_markdown(content)


def inline_text(node):
    text = node.get_text(" ", strip=True)
    return re.sub(r"\s+", " ", text)


def table_to_markdown(table):
    rows = []
    for tr in table.select("tr"):
        cells = [inline_text(c) for c in tr.find_all(["th", "td"], recursive=False)]
        if any(cells):
            rows.append(cells)
    if not rows:
        return ""
    width = max(len(r) for r in rows)
    rows = [r + [""] * (width - len(r)) for r in rows]
    out = ["| " + " | ".join(rows[0]) + " |", "| " + " | ".join(["---"] * width) + " |"]
    out.extend("| " + " | ".join(r) + " |" for r in rows[1:])
    return "\n".join(out)


def node_to_markdown(node, depth=0):
    chunks = []
    for child in node.children:
        if isinstance(child, NavigableString):
            text = str(child).strip()
            if text:
                chunks.append(text)
            continue
        if not isinstance(child, Tag):
            continue
        name = child.name.lower()
        if name in {"h1", "h2", "h3", "h4", "h5", "h6"}:
            level = int(name[1])
            chunks.append("\n" + ("#" * level) + " " + inline_text(child) + "\n")
        elif name == "p":
            text = inline_text(child)
            if text:
                chunks.append(text + "\n")
        elif name in {"ul", "ol"}:
            for i, li in enumerate(child.find_all("li", recursive=False), start=1):
                marker = f"{i}." if name == "ol" else "-"
                text = inline_text(li)
                if text:
                    chunks.append(f"{marker} {text}")
            chunks.append("")
        elif name == "dl":
            for item in child.find_all(["dt", "dd"], recursive=False):
                text = inline_text(item)
                if text:
                    chunks.append(("- " if item.name == "dd" else "## ") + text)
            chunks.append("")
        elif name == "table":
            table_md = table_to_markdown(child)
            if table_md:
                chunks.append(table_md + "\n")
        elif name in {"br", "hr"}:
            chunks.append("\n")
        elif name in {"div", "section", "article", "blockquote", "center"}:
            inner = node_to_markdown(child, depth + 1)
            if inner.strip():
                chunks.append(inner)
        elif name in {"span", "b", "strong", "i", "em", "a", "code", "small"}:
            text = inline_text(child)
            if text:
                chunks.append(text)
    text = "\n".join(chunks)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]+\n", "\n", text)
    return text.strip()


def score_page(text):
    hits = []
    for bucket, pattern in RULES:
        for match in pattern.finditer(text):
            start = max(0, match.start() - 100)
            end = min(len(text), match.end() + 100)
            snippet = re.sub(r"\s+", " ", text[start:end]).strip()
            hits.append({"bucket": bucket, "match": match.group(0), "snippet": snippet})
    return hits


def apply_cleanup(text):
    cleaned = text
    for pattern, repl in REPLACEMENTS:
        cleaned = pattern.sub(repl, cleaned)
    return cleaned


def safe_filename(title):
    name = re.sub(r"[^\w .()'-]+", "_", title, flags=re.U).strip().replace(" ", "_")
    return name[:120] or "untitled"


def choose_folder(hits):
    buckets = Counter(h["bucket"] for h in hits)
    if buckets["likely_gm_leak"]:
        return "pages/priority"
    if buckets["leak_language_review"] or buckets["tone_or_product_meta_review"]:
        return "pages/review"
    return "pages/minor"


def main():
    OUT_DIR.mkdir(exist_ok=True)
    pages = discover_pages()
    results = []
    errors = []
    zip_entries = {}
    used_names = Counter()

    for title, url in sorted(pages.items(), key=lambda item: item[0].lower()):
        try:
            soup = BeautifulSoup(fetch(url), "lxml")
            live_title = clean_title_from_soup(soup, title)
            original = content_from_soup(soup)
            if not original:
                continue
            hits = score_page(original)
            if not hits:
                continue
            cleaned = apply_cleanup(original)
            folder = choose_folder(hits)
            base_name = safe_filename(live_title)
            name_key = f"{folder}/{base_name}"
            used_names[name_key] += 1
            suffix = "" if used_names[name_key] == 1 else f"-{used_names[name_key]}"
            filename = f"{folder}/{base_name}{suffix}.md"
            header = [
                f"# {live_title}",
                "",
                f"Source: {url}",
                f"Draft generated: {datetime.now(timezone.utc).isoformat(timespec='seconds')}",
                "",
                "Notes: Paste-ready article-body draft generated from rendered wiki HTML. Review headings/tables after paste because this is not raw MediaWiki source.",
                "",
                "---",
                "",
            ]
            zip_entries[filename] = "\n".join(header) + cleaned.strip() + "\n"
            results.append(
                {
                    "title": live_title,
                    "url": url,
                    "file": filename,
                    "hit_count": len(hits),
                    "buckets": dict(Counter(h["bucket"] for h in hits)),
                    "hits": hits[:20],
                }
            )
        except Exception as exc:
            errors.append({"title": title, "url": url, "error": repr(exc)})

    results.sort(key=lambda r: (-r["buckets"].get("likely_gm_leak", 0), -r["hit_count"], r["title"].lower()))
    summary_counts = Counter()
    for result in results:
        summary_counts.update(result["buckets"])

    index_lines = [
        "# Wiki Meta Cleanup Draft Pack",
        "",
        f"Generated: {datetime.now(timezone.utc).isoformat(timespec='seconds')}",
        f"Pages discovered: {len(pages)}",
        f"Pages with cleanup drafts: {len(results)}",
        f"Fetch errors: {len(errors)}",
        "",
        "These are paste-ready body drafts generated from rendered wiki pages, not exact MediaWiki source exports.",
        "Priority drafts are the pages most likely to expose facilitator-only or system-mechanics language.",
        "",
        "## Bucket Counts",
        "",
    ]
    for key, value in sorted(summary_counts.items()):
        index_lines.append(f"- {key}: {value}")
    index_lines.extend(["", "## Drafts", ""])
    for result in results:
        index_lines.append(f"- [{result['title']}]({result['url']}) -> `{result['file']}` ({result['hit_count']} hits; {result['buckets']})")
    if errors:
        index_lines.extend(["", "## Fetch Errors", ""])
        for error in errors:
            index_lines.append(f"- {error['title']}: {error['error']}")

    zip_entries["index.md"] = "\n".join(index_lines) + "\n"
    zip_entries["cleanup-replacements.md"] = "\n".join(
        [
            "# Cleanup Replacement Rules",
            "",
            "Use these as suggestions, not immutable law. If a page is explicitly a product or facilitator page, review manually before accepting a diegetic replacement.",
            "",
            *[f"- `{pattern.pattern}` -> `{repl}`" for pattern, repl in REPLACEMENTS],
            "",
        ]
    )

    with zipfile.ZipFile(ZIP_PATH, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for name, content in sorted(zip_entries.items()):
            zf.writestr(name, content)

    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "pages_discovered": len(pages),
        "pages_with_cleanup_drafts": len(results),
        "zip_path": str(ZIP_PATH),
        "errors": errors,
        "results": results,
    }
    REPORT_PATH.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps({"zip": str(ZIP_PATH), "report": str(REPORT_PATH), "pages": len(results), "errors": len(errors)}, indent=2))


if __name__ == "__main__":
    main()
