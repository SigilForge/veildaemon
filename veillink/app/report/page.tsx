export default function ReportPage() {
  return (
    <main className="page">
      <h1 className="page-title">Report abuse</h1>
      <p className="lede">Phishing, malware, impersonation, spam, and illegal content are prohibited. Send the link and what looked wrong.</p>
      <form className="form panel" action="/api/abuse" method="post">
        <label>VeilLink URL<input name="url" type="url" required /></label>
        <label>Your email<input name="email" type="email" /></label>
        <label>Reason<input name="reason" maxLength={120} required /></label>
        <label>Details<textarea name="details" maxLength={2000} /></label>
        <button type="submit">Submit report</button>
      </form>
    </main>
  );
}
