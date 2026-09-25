import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { buildMetadata } from "@/lib/seo";
import { requireUser } from "@/lib/store";

export const metadata: Metadata = buildMetadata({
  title: "Book One",
  description:
    "Purchase Book One — The Anchor and the Glitch — direct digital edition through a VeilLink account. PDF, EPUB, MOBI, and wallpaper pack after verified checkout.",
  path: "/book-one",
  noIndex: true,
  image: "/brand/book-one-og.webp",
  imageWidth: 1200,
  imageHeight: 630,
  imageAlt: "Book One — The Anchor and the Glitch cover",
  keywords: ["Book One", "The Anchor and the Glitch", "Cradlepoint", "direct digital"],
});

export default async function BookOnePage() {
  const { user } = await requireUser().catch(() => redirect("/login?next=/book-one"));

  return (
    <main className="page book-one-page">
      <p className="eyebrow">SigilForge Studios · Published Shelf</p>
      <h1 className="page-title">Book One direct digital edition</h1>
      <p className="lede">
        The Anchor and the Glitch by S. Kaelen Vale. Get the DRM-free PDF, EPUB and MOBI editions,
        plus desktop and phone wallpapers. Your account keeps your downloads together.
      </p>

      <section className="book-one-layout" aria-label="Book One purchase">
        <figure className="book-one-cover">
          <Image
            src="/brand/book-one-cover.webp"
            alt="Book One — The Anchor and the Glitch cover"
            width={933}
            height={1400}
            priority
            sizes="(max-width: 720px) min(70vw, 18rem), 16rem"
          />
          <figcaption>The Anchor and the Glitch · Book One</figcaption>
        </figure>

        <div className="panel book-one-panel">
          <p className="panel-kicker">Direct digital</p>
          <h2>$9.99 launch sale price</h2>
          <p className="muted">Signed in as {user.email}</p>
          <p>
            Pay securely through Stripe, then download your book and wallpaper pack.
            Your purchase stays linked to this account so you can return for updated files.
          </p>
          <ul className="book-one-includes">
            <li>Verified print-edition PDF (v47-2c) · DRM-free</li>
            <li>Reflowable EPUB & MOBI ebook editions</li>
            <li>Wallpaper pack · desktop clean/title + phone plates</li>
            <li>Direct buyers keep access when shelf files update</li>
          </ul>
          <div className="toolbar">
            <form action="/api/book-one/checkout" method="post">
              <button name="edition" value="pdf" type="submit">
                Continue to secure checkout
              </button>
            </form>
            <a
              className="button secondary"
              href="https://veildaemon.app/studio/shelf/book-one/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Shelf page ↗
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
