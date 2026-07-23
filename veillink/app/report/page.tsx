import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Report Abuse",
  description:
    "Report phishing, malware, impersonation, spam, or illegal content on a VeilLink short URL or QR destination. Abuse reports help keep dynamic redirects safe.",
  path: "/report",
  keywords: ["report phishing link", "QR code abuse report", "malicious short URL report"],
});

export default function ReportPage() {
  return (
    <main className="page">
      <p className="eyebrow">Trust</p>
      <h1 className="page-title">Report abuse</h1>
      <p className="lede">
        Phishing, malware, impersonation, spam, and illegal content are prohibited. Send the VeilLink URL and what looked
        wrong.
      </p>
      <form className="form panel" action="/api/abuse" method="post">
        <label>
          VeilLink URL
          <input name="url" type="url" required placeholder="https://go.veildaemon.app/..." />
        </label>
        <label>
          Your email
          <input name="email" type="email" />
        </label>
        <label>
          Reason
          <input name="reason" maxLength={120} required />
        </label>
        <label>
          Details
          <textarea name="details" maxLength={2000} />
        </label>
        <button type="submit">Submit report</button>
      </form>
    </main>
  );
}
