-- Book One delivers PDF, EPUB, MOBI, and a wallpaper ZIP from the private paid-downloads bucket,
-- but the bucket was created accepting application/pdf only, so the ebook and wallpaper objects
-- could never be staged and the claim endpoint silently fell back to "pending staging" for them.
-- Types are what `file --mime-type` reports for the v48 artifacts. Applied live to the bucket on
-- 2026-09-25 through the Storage API with exactly this array (public=false and the 50 MB limit kept).
update storage.buckets
set allowed_mime_types = array[
  'application/pdf',
  'application/epub+zip',
  'application/x-mobipocket-ebook',
  'application/zip'
]
where id = 'paid-downloads';
