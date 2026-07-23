import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { buildMetadata } from "@/lib/seo";
import { requireUser } from "@/lib/store";

export const metadata: Metadata = buildMetadata({
  title: "Book One",
  description: "Purchase the Book One direct digital edition through a VeilLink account.",
  path: "/book-one",
  noIndex: true,
});

export default async function BookOnePage() {
  const { user } = await requireUser().catch(() => redirect("/login?next=/book-one"));

  return (
    <main className="page">
      <p className="eyebrow">Cradlepoint Studio</p>
      <h1 className="page-title">Book One direct digital edition</h1>
      <p className="lede">Account required. Purchase records attach to this VeilLink identity before the private PDF is issued.</p>
      <section className="panel">
        <h2>$9.99 launch sale price</h2>
        <p className="muted">Signed in as {user.email}</p>
        <p>
          Checkout runs through Stripe. After payment, the claim route verifies the completed session, records the
          entitlement on your account, then issues a short-lived private download URL.
        </p>
        <div className="toolbar">
          <form action="/api/book-one/checkout" method="post">
            <button name="edition" value="pdf" type="submit">Continue to secure checkout</button>
          </form>
          <a className="button secondary" href="https://veildaemon.app/studio/shelf/book-one/" target="_blank" rel="noopener noreferrer">
            Return to shelf
          </a>
        </div>
      </section>
    </main>
  );
}
