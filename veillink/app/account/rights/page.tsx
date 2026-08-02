import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { RightsQrStudio } from "@/components/RightsQrStudio";
import { RightsVerificationPanel } from "@/components/RightsVerificationPanel";
import { buildMetadata } from "@/lib/seo";
import { requireUser } from "@/lib/store";
import { canCreateCheckout } from "@/lib/rights/lifecycle";
import { canEditRightsRecord, canGenerateRightsQrAssets, entitlementLabel, entitlementStatusOf } from "@/lib/rights/entitlement";
import { listOwnedRightsRecords, recordUrl } from "@/lib/rights/records";
import { RIGHTS_PRICE_CENTS, RIGHTS_PRICE_LABEL, availabilityLabel, workTypeLabel } from "@/lib/rights/schema";
import type { RightsQrPreferences } from "@/lib/rights/qr-options";
import { effectiveVerification } from "@/lib/rights/verification";
import { listVerificationState } from "@/lib/rights/verification-store";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = buildMetadata({
  title: "Rights Records",
  description: "Manage durable Creator Rights Registry records, version history, public verification pages, Creator Dossier exports, and branded QR assets.",
  path: "/account/rights",
  noIndex: true,
});

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default async function AccountRightsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user } = await requireUser().catch(() => redirect("/login?next=/account/rights"));
  const params = await searchParams;
  let records: Awaited<ReturnType<typeof listOwnedRightsRecords>> = [];
  let loadError = "";
  try {
    records = await listOwnedRightsRecords(user.id);
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Could not load rights records.";
  }
  const verificationStates = new Map(
    await Promise.all(
      records.map(async (record) => {
        const state = await listVerificationState(record, true).catch(() => ({
          projection: effectiveVerification(record),
          evidence: [],
          challenges: [],
        }));
        return [record.id, state] as const;
      })
    )
  );
  const checkout = typeof params.checkout === "string" ? params.checkout : "";
  const created = typeof params.created === "string" ? params.created : "";

  return (
    <main className="page">
      <p className="eyebrow">Account</p>
      <h1 className="page-title">Creator Rights portal</h1>
      <p className="lede">
        This account portal is the Registry management surface. Use it when you want to preserve a permanent hosted
        record, maintain version history, manage verification evidence, export a Creator Dossier, generate QR assets, and
        come back later to update the durable provenance record.
      </p>

      <div className="toolbar">
        <Link className="button" href="/rights/create">
          Preserve rights record
        </Link>
        <Link className="button secondary" href="/rights/advisor">
          Open public Advisor
        </Link>
        <a className="button secondary" href="https://veildaemon.app/studio/creator-rights/" target="_blank" rel="noopener noreferrer">
          Creator Rights overview
        </a>
      </div>

      {created ? (
        <p className="notice">
          Draft saved. Review it below, then publish at the {RIGHTS_PRICE_LABEL} ({money(RIGHTS_PRICE_CENTS)}) to issue the permanent Rights Record. Registry fees support long-term record storage, verification infrastructure, maintenance, and the continued operation of this independent creator-focused service. Each record is covered by a single one-time lifetime Registry license with no recurring subscription fees.
        </p>
      ) : null}
      {checkout === "success" ? (
        <p className="notice">
          Checkout returned successfully. The Rights Record is issued when payment is confirmed — refresh if status still
          shows pending.
        </p>
      ) : null}
      {checkout === "cancelled" ? <p className="notice">Checkout cancelled. The draft remains private and unpublished.</p> : null}
      {loadError ? (
        <p className="notice rights-qr-warn" role="alert">
          Could not load your Rights Records: {loadError}
        </p>
      ) : null}

      <section className="section">
        {records.length ? (
          <div className="rights-manage-list">
            {records.map((record) => {
              const entitlement = entitlementStatusOf(record);
              const entitled = canGenerateRightsQrAssets(record);
              const durable = recordUrl(record.slug);
              const showCheckout = canCreateCheckout(record.record_status);
              const editable = canEditRightsRecord(record);
              const verification = verificationStates.get(record.id) || {
                projection: effectiveVerification(record),
                evidence: [],
                challenges: [],
              };
              const hasSurfaceVerification =
                verification.projection.methods.includes("domain") || verification.projection.methods.includes("github");
              const verificationPanelId = `verification-${record.id}`;

              return (
                <article className="panel rights-manage-card" key={record.id}>
                  <div className="rights-manage-meta">
                    <p className="panel-kicker">
                      {record.record_id || "Draft ID pending"} · {record.record_status}
                    </p>
                    <h2>{record.title}</h2>
                    <p className="muted">{record.ai_permissions_summary}</p>
                    <dl className="record-meta-row">
                      <div>
                        <dt>Work</dt>
                        <dd>
                          {workTypeLabel(record.work_type)} · {availabilityLabel(record.availability)}
                        </dd>
                      </div>
                      <div>
                        <dt>Payment</dt>
                        <dd>{record.payment_status || "unpaid"}</dd>
                      </div>
                      <div>
                        <dt>Issuance</dt>
                        <dd>{entitlementLabel(entitlement)}</dd>
                      </div>
                      <div>
                        <dt>Public record</dt>
                        <dd>{record.slug}</dd>
                      </div>
                      <div>
                        <dt>QR asset</dt>
                        <dd>v{record.qr_asset_version || 0}</dd>
                      </div>
                      <div>
                        <dt>Updated</dt>
                        <dd>{new Date(record.updated_at).toLocaleString()}</dd>
                      </div>
                    </dl>

                    <div className="toolbar">
                      <Link className="button secondary" href={`/rights/${record.slug}`}>
                        View Record
                      </Link>
                      {entitled || record.record_status === "published" || record.record_status === "updated" ? (
                        <a className="button secondary" href={durable} target="_blank" rel="noopener noreferrer">
                          Public Page
                        </a>
                      ) : (
                        <span className="muted">Public page issues after payment</span>
                      )}
                      {showCheckout ? (
                        <div>
                          <form action="/api/rights/checkout" method="post">
                            <input type="hidden" name="recordId" value={record.id} />
                            <button className="button" type="submit">
                              Publish · {money(RIGHTS_PRICE_CENTS)} Founders
                            </button>
                          </form>
                          <p className="muted" style={{ fontSize: "0.75rem", marginTop: "0.25rem" }}>
                            Registry fees support long-term record storage, verification infrastructure, maintenance, and the continued operation of this independent creator-focused service. One-time lifetime Registry license.
                          </p>
                        </div>
                      ) : null}
                      {editable ? (
                        <Link className="button secondary" href={`/account/rights/${record.id}/edit`}>
                          Edit
                        </Link>
                      ) : null}
                      <Link className="button secondary" href={`/account/rights/${record.id}/dossier`}>
                        Generate Creator Dossier
                      </Link>
                    </div>

                    {!hasSurfaceVerification ? (
                      <div className="rights-verification-nudge">
                        <div>
                          <p className="panel-kicker">Publisher surface</p>
                          <strong>Add domain or GitHub verification</strong>
                          <p className="muted">
                            Show that this account controls a referenced publication surface for the record.
                          </p>
                        </div>
                        <a className="button secondary" href={`#${verificationPanelId}`}>
                          Add verification
                        </a>
                      </div>
                    ) : null}
                  </div>

                  <RightsQrStudio
                    recordId={record.id}
                    slug={record.slug}
                    title={record.title}
                    recordCode={record.record_id}
                    status={record.record_status}
                    entitlementActive={entitled}
                    durableUrl={durable}
                    initialPreferences={(record.qr_preferences || null) as Partial<RightsQrPreferences> | null}
                    qrAssetVersion={record.qr_asset_version}
                  />

                  <div id={verificationPanelId}>
                    <RightsVerificationPanel
                      recordId={record.id}
                      initialProjection={verification.projection}
                      initialEvidence={verification.evidence}
                      initialChallenges={verification.challenges}
                    />
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="panel">
            <p className="panel-kicker">No records yet</p>
            <h2>Create the first draft.</h2>
            <p className="muted">
              The public Advisor can help you explore imports and licensing without an account. The portal is where a
              reviewed draft becomes a durable Registry record that can be verified, exported, versioned, and managed.
            </p>
            <div className="toolbar">
              <Link className="button" href="/rights/create">
                Preserve Rights Record
              </Link>
              <Link className="button secondary" href="/rights/advisor">
                Open public Advisor
              </Link>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
