import Link from "next/link";
import { RIGHTS_PRICE_CENTS, RIGHTS_PRICE_LABEL } from "@/lib/rights/schema";

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

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export function AuthForm({ title, action, submit, error, sent, verified, email, reset, signup, updatePassword, next }: Props) {
  const rightsPreservation = next === "/rights/create" || next === "/account/rights";
  const rightsPrice = `${money(RIGHTS_PRICE_CENTS)} ${RIGHTS_PRICE_LABEL}`;

  return (
    <main className="page">
      <p className="eyebrow">Account</p>
      <h1 className="page-title">{title}</h1>
      <p className="lede">
        {signup
          ? rightsPreservation
            ? `Create a free account to preserve permanent, timestamped Registry records at the ${rightsPrice}. Authentication unlocks Creator Dossier generation, versioned evidence, and long-term record management.`
            : "Create a free account to issue short links and editable QR codes."
          : reset
            ? "We will email a reset link if the address is on file."
            : updatePassword
              ? "Choose a new password for this account."
              : rightsPreservation
                ? `Sign in to preserve a permanent, timestamped Registry record at the ${rightsPrice}, generate your Creator Dossier, and maintain versioned evidence over time. A single one-time Registry license covers the lifetime of this Creator Rights Record with no recurring subscription fees.`
                : "Sign in to manage redirects, downloads, and billing."}
      </p>
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
        <button type="submit">{submit}</button>
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
