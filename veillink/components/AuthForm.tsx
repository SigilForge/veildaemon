import Link from "next/link";

type Props = {
  title: string;
  action: (formData: FormData) => Promise<void>;
  submit: string;
  error?: string;
  reset?: boolean;
  signup?: boolean;
  updatePassword?: boolean;
};

export function AuthForm({ title, action, submit, error, reset, signup, updatePassword }: Props) {
  return (
    <main className="page">
      <p className="eyebrow">Account</p>
      <h1 className="page-title">{title}</h1>
      <p className="lede">
        {signup
          ? "Create a free account to issue short links and editable QR codes."
          : reset
            ? "We will email a reset link if the address is on file."
            : updatePassword
              ? "Choose a new password for this account."
              : "Sign in to manage redirects, downloads, and billing."}
      </p>
      {error ? <p className="error" role="alert">{error === "terms" ? "Accept the terms to create an account." : error}</p> : null}
      <form className="form panel" action={action}>
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
          {signup ? <Link href="/login">Already have an account?</Link> : <Link href="/reset">Reset password</Link>}
        </p>
      </form>
    </main>
  );
}
