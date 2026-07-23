import Link from "next/link";
import { plans } from "@/lib/config";

const rows = [
  ["Dynamic redirects", "3 active", "100 active", "1,000 active"],
  ["Editable destinations", "Yes", "Yes", "Yes"],
  ["Analytics", "Total count", "Basic dashboard", "Basic dashboard"],
  ["Expiration dates", "No", "Yes", "Yes"],
  ["Path links", "Yes", "Yes", "Yes"],
  ["Wildcard subdomain links", "No", "Yes", "Yes"],
  ["Custom domains", "No", "No", "Planned"],
];

export default function PricingPage() {
  return (
    <main className="page">
      <h1 className="page-title">Pricing</h1>
      <p className="lede">A dynamic QR code is just a QR code pointing at an editable redirect. Useful, honest, and much less dramatic than most subscription pages make it sound.</p>
      <section className="grid">
        {Object.values(plans).map((plan) => (
          <article className="card" key={plan.id}>
            <h2>{plan.label}</h2>
            <p><strong>{plan.monthlyPrice ? `$${plan.monthlyPrice}/mo` : "$0"}</strong></p>
            <p className="muted">{plan.yearlyPrice ? `$${plan.yearlyPrice}/yr` : "Start small. Upgrade later."}</p>
            <p>{plan.activeRedirectLimit} active redirects</p>
            <Link className="button" href="/signup">Start</Link>
          </article>
        ))}
      </section>
      <section className="panel">
        <h2>Plain-English limits</h2>
        <table className="table">
          <thead><tr><th>Feature</th><th>Free</th><th>Pro</th><th>Business</th></tr></thead>
          <tbody>{rows.map((row) => <tr key={row[0]}>{row.map((cell) => <td key={cell}>{cell}</td>)}</tr>)}</tbody>
        </table>
        <p className="muted">Exported static QR files are yours. Dynamic redirects depend on the service remaining active. Paid checkout and subscription management are handled through Stripe; webhook-driven billing state supplies the signal for plan changes and cancellation.</p>
      </section>
    </main>
  );
}
