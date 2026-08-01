import Link from "next/link";

type Props = {
  title: string;
  action: (formData: FormData) => Promise<void>;
  submit: string;
  error?: string;
  sent?: boolean;
  verified?: boolean;
  email?: string;
  reset?: boolean;
  signup?: boolean;
  updatePassword?: boolean;
  next?: string;
};

export function AuthForm({ title, action, submit, error, sent, verified, email, reset, signup, updatePassword, next }: Props) {
  const rightsPreservation = next === "/rights/create" || next === "/account/rights";
  const liveLink = next === "/live-link" || Boolean(next && next.startsWith("/live-link/"));
  const liveLinkSignIn = liveLink && !signup && !reset && !updatePassword;

  return (
    <main className="page">
      <p className="eyebrow">{liveLink ? "VeilLink · Live-Link" : "Account"}</p>
      <h1 className="page-title">{title}</h1>
      <p className="lede">
        {signup
          ? rightsPreservation
            ? "Create a free account to generate your Creator Dossier, maintain versioned evidence over time, and preserve permanent, timestamped Registry records. Authentication unlocks permanence for your Creator Rights Records."
            : liveLink
              ? "Create a free account to link your Operator file to Live-Link — join a Cell with a Cell Code, or open a Handler console for cross-device play."
              : "Create a free account to issue short links and editable QR codes."
          : reset
            ? "We will email a reset link if the address is on file."
            : updatePassword
              ? "Choose a new password for this account."
              : rightsPreservation
                ? "Sign in to create a permanent, timestamped Registry record, generate your Creator Dossier, and maintain versioned evidence over time. A single one-time Registry license covers the lifetime of this Creator Rights Record with no recurring subscription fees."
                : liveLink
                  ? "A live Cell is awaiting authorization. Authenticate to join with a Cell Code, open a Handler console, or link your Operator file for cross-device play."
                  : "Sign in to manage redirects, downloads, and billing."}
      </p>
      {liveLinkSignIn ? (
        <ul className="muted small" style={{ listStyle: "none", padding: 0, margin: "0 0 1rem" }}>
          <li>→ Join Cell</li>
          <li>→ Open Handler Console</li>
        </ul>
      ) : null}
      {verified ? (
        <p className="success" role="status">
          ✓ Email address confirmed successfully! Sign in below to continue.
        </p>
      ) : null}
      {sent ? (
        <p className="notice" role="status">
          ✓ Account created! We sent a confirmation link to <strong>{email || "your email address"}</strong>. Please check your inbox and click the link to activate your account.
        </p>
      ) : null}
      {error ? <p className="error" role="alert">{error === "terms" ? "Accept the terms to create an account." : error}</p> : null}
      <form className="form panel" action={action}>
        {next ? <input name="next" type="hidden" value={next} /> : null}
        {!updatePassword ? (
          <label>
            Email
            <input name="email" type="email" autoComplete="email" required />
          </label>
        ) : null}
        {!reset ? (
          <label>
            Password
            <input name="password" type="password" minLength={8} autoComplete={signup ? "new-password" : "current-password"} required />
          </label>
        ) : null}
        {signup ? (
          <label>
            <span>
              <input name="terms" type="checkbox" required /> I agree not to use VeilLink for phishing, malware,
              impersonation, spam, or illegal content.
            </span>
          </label>
        ) : null}
        <button type="submit">{liveLinkSignIn ? "Authenticate Operator" : submit}</button>
        <p className="muted">
          {signup ? (
            <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}>Already have an account?</Link>
          ) : (
            <>
              <Link href="/reset">Reset password</Link>
              {rightsPreservation ? (
                <>
                  {" · "}
                  <Link href={`/signup?next=${encodeURIComponent(next || "/rights/create")}`}>Create account to preserve a record</Link>
                </>
              ) : null}
            </>
          )}
        </p>
      </form>
    </main>
  );
}
