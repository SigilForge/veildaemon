import json
import re
import time
import zipfile
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote, urljoin

import requests
from bs4 import BeautifulSoup, NavigableString, Tag


BASE = "https://wiki.veildaemon.app"
OUT_DIR = Path("reports")
STAMP = datetime.now().strftime("%Y%m%d-%H%M")
ZIP_PATH = OUT_DIR / f"wiki-shade-artifact-cleanse-{STAMP}.zip"
REPORT_PATH = OUT_DIR / f"wiki-shade-artifact-cleanse-{STAMP}.json"
USER_AGENT = "VeilDaemon Shade artifact cleanup bot/1.0 (owner-requested public wiki scan)"

SESSION = requests.Session()
SESSION.headers.update({"User-Agent": USER_AGENT})

HARD_META_RULES = [
    ("facilitator_layer_exposed", re.compile(r"\bGM[- ]?(?:facing|only|material|notes?|toolbox)\b", re.I)),
    ("manual_or_product_frame", re.compile(r"\b(?:Monster Manual|sourcebook|player-facing|out-of-fiction|in-world|lore dump)\b", re.I)),
    ("audience_frame_exposed", re.compile(r"\b(?:ARG|alternate reality game|fictional?|canon|continuity)\b", re.I)),
    ("solution_layer_exposed", re.compile(r"\b(?:case|pressure)\s+clock\b|\bentity\s+loop\b|\bexit\s+condition\b|\bstabilizer\s+language\b", re.I)),
    ("mechanics_exposed", re.compile(r"\b(?:stat material|stat overlay|mechanical payload|combat notes?|mechanics)\b", re.I)),
    ("upper_band_exposed", re.compile(r"\bPip\s*7\+|\b7\s*[–-]\s*9\s*/\s*GM\s*Only\b", re.I)),
    ("leak_frame_exposed", re.compile(r"\b(?:leaked files?|rogue archive|stolen upload|hacker)\b", re.I)),
]

SHADE_REPLACEMENTS = [
    (re.compile(r"\bGM-facing\b", re.I), "restricted field-facing"),
    (re.compile(r"\bGM[- ]?only\b", re.I), "withheld from public release"),
    (re.compile(r"\bGM material\b", re.I), "restricted procedure material"),
    (re.compile(r"\bGM notes?\b", re.I), "sealed handler notes"),
    (re.compile(r"\bGM Toolbox\b", re.I), "operator support packet"),
    (re.compile(r"\bMonster Manual\b", re.I), "restricted entity index"),
    (re.compile(r"\bsourcebook\b", re.I), "compiled archive packet"),
    (re.compile(r"\bplayer-facing\b", re.I), "observer-facing"),
    (re.compile(r"\bout-of-fiction\b", re.I), "outside public procedure"),
    (re.compile(r"\bin-world\b", re.I), "field-facing"),
    (re.compile(r"\blore dump\b", re.I), "unfiltered archive dump"),
    (re.compile(r"\bARG\b|\balternate reality game\b", re.I), "signal chain"),
    (re.compile(r"\bfictional?\b", re.I), "unverified"),
    (re.compile(r"\bcanon\b", re.I), "record authority"),
    (re.compile(r"\bcontinuity\b", re.I), "record continuity"),
    (re.compile(r"\bcase clock\b", re.I), "timing model withheld"),
    (re.compile(r"\bpressure clock\b", re.I), "pressure model withheld"),
    (re.compile(r"\bentity loop\b", re.I), "behavior pattern withheld"),
    (re.compile(r"\bexit condition\b", re.I), "resolution path withheld"),
    (re.compile(r"\bstabilizer language\b", re.I), "stabilization phrase withheld"),
    (re.compile(r"\bstat material\b", re.I), "classification block"),
    (re.compile(r"\bstat overlay\b", re.I), "classification overlay"),
    (re.compile(r"\bmechanical payload\b", re.I), "sealed procedure payload"),
    (re.compile(r"\bcombat notes?\b", re.I), "contact-risk notes"),
    (re.compile(r"\bmechanics\b", re.I), "procedure logic"),
    (re.compile(r"\bPip\s*7\+\b", re.I), "upper-band classification withheld"),
    (re.compile(r"\b7\s*[–-]\s*9\s*/\s*GM\s*Only\b", re.I), "upper-band classification withheld"),
    (re.compile(r"\bleaked files?\b", re.I), "prematurely exposed files"),
    (re.compile(r"\brogue archive\b", re.I), "unapproved archive surface"),
    (re.compile(r"\bstolen upload\b", re.I), "unauthorized upload"),
    (re.compile(r"\bhacker\b", re.I), "unauthorized operator"),
]


def fetch(url):
    response = SESSION.get(url, timeout=30)
    response.raise_for_status()
    time.sleep(0.15)
    return response.text


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
                title = a.get_text(" ", strip=True)
                href = a.get("href", "")
                if title and ":" not in title:
                    pages[title] = urljoin(BASE, href)
        next_url = None
        for a in soup.select("a[href]"):
            if a.get_text(" ", strip=True).lower().startswith("next page"):
                next_url = urljoin(BASE, a["href"])
                break
    return pages


def safe_filename(title):
    name = re.sub(r"[^\w .()'-]+", "_", title, flags=re.U).strip().replace(" ", "_")
    return name[:120] or "untitled"


def inline_text(node):
    return re.sub(r"\s+", " ", node.get_text(" ", strip=True))


def table_to_markdown(table):
    rows = []
    for tr in table.select("tr"):
        cells = [inline_text(c) for c in tr.find_all(["th", "td"], recursive=False)]
        if any(cells):
            rows.append(cells)
    if not rows:
        return ""
    width = max(len(row) for row in rows)
    rows = [row + [""] * (width - len(row)) for row in rows]
    output = ["| " + " | ".join(rows[0]) + " |", "| " + " | ".join(["---"] * width) + " |"]
    output.extend("| " + " | ".join(row) + " |" for row in rows[1:])
    return "\n".join(output)


def node_to_markdown(node):
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
            chunks.append("\n" + ("#" * int(name[1])) + " " + inline_text(child) + "\n")
        elif name == "p":
            text = inline_text(child)
            if text:
                chunks.append(text + "\n")
        elif name in {"ul", "ol"}:
            for idx, li in enumerate(child.find_all("li", recursive=False), start=1):
                text = inline_text(li)
                if text:
                    chunks.append(f"{idx if name == 'ol' else '-'}{'.' if name == 'ol' else ''} {text}")
            chunks.append("")
        elif name == "table":
            table = table_to_markdown(child)
            if table:
                chunks.append(table + "\n")
        elif name in {"div", "section", "article", "blockquote", "center"}:
            inner = node_to_markdown(child)
            if inner.strip():
                chunks.append(inner)
        elif name in {"span", "b", "strong", "i", "em", "a", "code", "small"}:
            text = inline_text(child)
            if text:
                chunks.append(text)
        elif name in {"br", "hr"}:
            chunks.append("\n")
    text = "\n".join(chunks)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def extract_article(soup):
    content = soup.select_one("#mw-content-text .mw-parser-output") or soup.select_one("#bodyContent") or soup.body
    if not content:
        return ""
    for selector in [".mw-editsection", ".printfooter", ".catlinks", ".metadata", ".navbox", ".toc", "style", "script", "noscript"]:
        for node in content.select(selector):
            node.decompose()
    return node_to_markdown(content)


def page_title(soup, fallback):
    heading = soup.select_one("#firstHeading")
    return heading.get_text(" ", strip=True) if heading else fallback


def hits_for(text):
    hits = []
    for bucket, pattern in HARD_META_RULES:
        for match in pattern.finditer(text):
            start = max(0, match.start() - 120)
            end = min(len(text), match.end() + 120)
            hits.append(
                {
                    "bucket": bucket,
                    "match": match.group(0),
                    "snippet": re.sub(r"\s+", " ", text[start:end]).strip(),
                }
            )
    return hits


def shade_clean(text):
    cleaned = text
    for pattern, replacement in SHADE_REPLACEMENTS:
        cleaned = pattern.sub(replacement, cleaned)
    return cleaned


def priority(hits):
    buckets = Counter(hit["bucket"] for hit in hits)
    if buckets["facilitator_layer_exposed"] or buckets["solution_layer_exposed"] or buckets["mechanics_exposed"]:
        return "priority"
    return "review"


def main():
    OUT_DIR.mkdir(exist_ok=True)
    pages = discover_pages()
    results = []
    errors = []
    entries = {}
    used_names = Counter()

    for fallback, url in sorted(pages.items(), key=lambda item: item[0].lower()):
        try:
            soup = BeautifulSoup(fetch(url), "lxml")
            title = page_title(soup, fallback)
            original = extract_article(soup)
            if not original:
                continue
            hits = hits_for(original)
            if not hits:
                continue
            folder = priority(hits)
            base_name = f"pages/{folder}/{safe_filename(title)}"
            used_names[base_name] += 1
            suffix = "" if used_names[base_name] == 1 else f"-{used_names[base_name]}"
            path = f"{base_name}{suffix}.md"
            cleaned = shade_clean(original)
            note_lines = [
                f"# {title}",
                "",
                f"Source: {url}",
                "Artifact pass: remove audience/meta/facilitator language; preserve mystery and pull inward.",
                "",
                "Shade posture: has files, categories, and partial procedure access. Does not know final answers. Does not provide combat notes.",
                "",
                "Flagged terms:",
            ]
            for hit in hits[:12]:
                note_lines.append(f"- {hit['bucket']}: `{hit['match']}`")
            note_lines.extend(["", "---", "", cleaned.strip(), ""])
            entries[path] = "\n".join(note_lines)
            results.append(
                {
                    "title": title,
                    "url": url,
                    "file": path,
                    "priority": folder,
                    "hit_count": len(hits),
                    "buckets": dict(Counter(hit["bucket"] for hit in hits)),
                    "hits": hits[:20],
                }
            )
        except Exception as exc:
            errors.append({"title": fallback, "url": url, "error": repr(exc)})

    results.sort(key=lambda row: (row["priority"] != "priority", -row["hit_count"], row["title"].lower()))
    counts = Counter(row["priority"] for row in results)
    bucket_counts = Counter()
    for row in results:
        bucket_counts.update(row["buckets"])

    index = [
        "# Shade Artifact Cleanse Pack",
        "",
        f"Generated: {datetime.now(timezone.utc).isoformat(timespec='seconds')}",
        f"Pages discovered: {len(pages)}",
        f"Pages included: {len(results)}",
        f"Fetch errors: {len(errors)}",
        "",
        "Purpose: strip explicit audience/meta/facilitator terms without solving the archive.",
        "Keep the feeling of research files: Shade has categories and partial access, but not final answers or combat-ready procedure.",
        "",
        "## Included Counts",
        "",
    ]
    for key, value in sorted(counts.items()):
        index.append(f"- {key}: {value}")
    index.extend(["", "## Rule Hits", ""])
    for key, value in sorted(bucket_counts.items()):
        index.append(f"- {key}: {value}")
    index.extend(["", "## Pages", ""])
    for row in results:
        index.append(f"- {row['priority'].upper()} [{row['title']}]({row['url']}) -> `{row['file']}` ({row['hit_count']} hits; {row['buckets']})")
    if errors:
        index.extend(["", "## Fetch Errors", ""])
        for error in errors:
            index.append(f"- {error['title']}: {error['error']}")

    entries["index.md"] = "\n".join(index) + "\n"
    entries["shade-cleanse-rules.md"] = "\n".join(
        [
            "# Shade Cleanse Rules",
            "",
            "This pass intentionally ignores tiny style edits. It only includes pages with explicit meta, audience-frame, facilitator-only, or solution-layer terms.",
            "",
            "Guiding rule: Shade may classify and redact. Shade should not explain that the archive is an artifact, product, campaign, or puzzle.",
            "",
            "## Replacement Suggestions",
            "",
            *[f"- `{pattern.pattern}` -> `{replacement}`" for pattern, replacement in SHADE_REPLACEMENTS],
            "",
        ]
    )

    with zipfile.ZipFile(ZIP_PATH, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for name, content in sorted(entries.items()):
            archive.writestr(name, content)

    REPORT_PATH.write_text(
        json.dumps(
            {
                "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                "pages_discovered": len(pages),
                "pages_included": len(results),
                "zip_path": str(ZIP_PATH),
                "errors": errors,
                "results": results,
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    print(json.dumps({"zip": str(ZIP_PATH), "report": str(REPORT_PATH), "pages": len(results), "errors": len(errors)}, indent=2))


if __name__ == "__main__":
    main()
