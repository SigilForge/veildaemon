import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const manifestPath = path.join(rootDir, "studio/shelf/book-one/manifest.json");
if (!fs.existsSync(manifestPath)) {
  console.error(`Manifest not found at ${manifestPath}`);
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
console.log(`[Sync] Synchronizing Book One shelf to version ${manifest.version}...`);

let updatedCount = 0;

function replaceInFile(filePath, replacements) {
  const absPath = path.join(rootDir, filePath);
  if (!fs.existsSync(absPath)) return;
  let content = fs.readFileSync(absPath, "utf8");
  let modified = false;
  for (const { pattern, replacement } of replacements) {
    if (pattern.test(content)) {
      const nextContent = content.replace(pattern, replacement);
      if (nextContent !== content) {
        content = nextContent;
        modified = true;
      }
    }
  }
  if (modified) {
    fs.writeFileSync(absPath, content, "utf8");
    console.log(`  ✓ Updated ${filePath}`);
    updatedCount++;
  } else {
    console.log(`  - No changes needed for ${filePath}`);
  }
}

// 1. api/book-one/claim.js
replaceInFile("api/book-one/claim.js", [
  {
    pattern: /const DEFAULT_PDF_PATH = "book-one\/[^"]+";/,
    replacement: `const DEFAULT_PDF_PATH = "${manifest.pdf_path}";`,
  },
  {
    pattern: /const DEFAULT_EPUB_PATH = "book-one\/[^"]+";/,
    replacement: `const DEFAULT_EPUB_PATH = "${manifest.epub_path}";`,
  },
  {
    pattern: /const DEFAULT_MOBI_PATH = "book-one\/[^"]+";/,
    replacement: `const DEFAULT_MOBI_PATH = "${manifest.mobi_path}";`,
  },
]);

// 2. studio/shelf/book-one/index.html
replaceInFile("studio/shelf/book-one/index.html", [
  {
    pattern: /<strong>PDF<\/strong><small>[^<]+<\/small>/,
    replacement: `<strong>PDF</strong><small>${manifest.pdf_filename}</small>`,
  },
  {
    pattern: /<strong>EPUB<\/strong><small>[^<]+<\/small>/,
    replacement: `<strong>EPUB</strong><small>${manifest.epub_filename}</small>`,
  },
  {
    pattern: /<strong>MOBI<\/strong><small>[^<]+<\/small>/,
    replacement: `<strong>MOBI</strong><small>${manifest.mobi_filename}</small>`,
  },
]);

// 3. veillink/app/book-one/page.tsx
replaceInFile("veillink/app/book-one/page.tsx", [
  {
    pattern: /Verified print-edition PDF[^<]*/,
    replacement: `Verified print-edition PDF (${manifest.version}) · DRM-free`,
  },
]);

// 4. studio/downloads/book-one/README.md
replaceInFile("studio/downloads/book-one/README.md", [
  {
    pattern: /- `book-one\/the-cradlepoint-archive-book-one-[^`]+` \(Verified print PDF\)/,
    replacement: `- \`${manifest.pdf_path}\` (Verified print PDF)`,
  },
  {
    pattern: /- `book-one\/the-cradlepoint-archive-book-one-[^`]+` \(Refreshed reflowable EPUB ebook\)/,
    replacement: `- \`${manifest.epub_path}\` (Refreshed reflowable EPUB ebook)`,
  },
  {
    pattern: /- `book-one\/the-cradlepoint-archive-book-one-[^`]+` \(Kindle MOBI ebook\)/,
    replacement: `- \`${manifest.mobi_path}\` (Kindle MOBI ebook)`,
  },
]);

// 5. .env.example
replaceInFile(".env.example", [
  {
    pattern: /BOOK_ONE_SUPABASE_PATH=book-one\/.+/,
    replacement: `BOOK_ONE_SUPABASE_PATH=${manifest.pdf_path}`,
  },
]);

console.log(`[Sync] Completed. ${updatedCount} file(s) updated to ${manifest.version}.`);
