import Link from "next/link";
import { product } from "@/lib/config";

export default function HomePage() {
  return (
    <main className="page">
      <section className="hero">
        <h1>Editable QR codes without the ransom note.</h1>
        <p className="lede">
          Create branded QR codes and short links you control. Change the destination anytime without reprinting anything.
        </p>
        <div className="toolbar">
          <Link className="button" href="/signup">Create a free link</Link>
          <Link className="button secondary" href="/pricing">See pricing</Link>
        </div>
      </section>

      <section className="grid" aria-label={`${product.name} features`}>
        <div className="panel"><h2>How it works</h2><p className="muted">Your QR points to a stable VeilLink URL. You edit the destination behind it whenever you need.</p></div>
        <div className="panel"><h2>Static vs dynamic</h2><p className="muted">Static QR files keep working as files. Dynamic redirects depend on this service staying active.</p></div>
        <div className="panel"><h2>Useful by default</h2><p className="muted">Short links, PNG/SVG QR downloads, scan counts, expiration dates, and pause controls.</p></div>
        <div className="panel"><h2>Built for sanity</h2><p className="muted">No fake customer counts, no mystery lock-in, no pretending a QR is more magical than a redirect.</p></div>
      </section>
    </main>
  );
}
