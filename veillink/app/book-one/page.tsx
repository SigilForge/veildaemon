import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { buildMetadata } from "@/lib/seo";
import { requireUser } from "@/lib/store";

export const metadata: Metadata = buildMetadata({
  title: "Book One",
  description:
    "Purchase Book One — The Anchor and the Glitch — direct digital edition through a VeilLink account. PDF + wallpaper pack after verified checkout.",
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
      <p className="eyebrow">Cradlepoint Studio · Published Shelf</p>
      <h1 className="page-title">Book One direct digital edition</h1>
      <p className="lede">
        Account required. Purchase records attach to this VeilLink identity before private files are issued: the verified
        PDF, reflowable EPUB & MOBI ebook editions, plus the Book One wallpaper pack.
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
            Checkout runs through Stripe. After payment, the claim route verifies the completed session, records the
            entitlement on your account, then issues short-lived private download links for the PDF, EPUB, MOBI, and wallpaper pack.
          </p>
          <ul className="book-one-includes">
            <li>Verified print-edition PDF (v47-2b) · DRM-free</li>
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
