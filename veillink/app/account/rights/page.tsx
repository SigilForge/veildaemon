import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { RightsQrStudio } from "@/components/RightsQrStudio";
import { buildMetadata } from "@/lib/seo";
import { requireUser } from "@/lib/store";
import { canCreateCheckout } from "@/lib/rights/lifecycle";
import { canEditRightsRecord, canGenerateRightsQrAssets, entitlementLabel, entitlementStatusOf } from "@/lib/rights/entitlement";
import { listOwnedRightsRecords, recordUrl } from "@/lib/rights/records";
import { RIGHTS_PRICE_CENTS, availabilityLabel, workTypeLabel } from "@/lib/rights/schema";
import type { RightsQrPreferences } from "@/lib/rights/qr-options";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = buildMetadata({
  title: "Rights Records",
  description: "Manage Creator Rights Record drafts, publication payment, durable public URLs, and branded QR assets.",
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
  const checkout = typeof params.checkout === "string" ? params.checkout : "";
  const created = typeof params.created === "string" ? params.created : "";

  return (
    <main className="page">
      <p className="eyebrow">Account</p>
      <h1 className="page-title">Creator Rights portal</h1>
      <p className="lede">
        Create a Rights Record, publish it, get a durable public URL, generate a branded QR for the work, and come back
        anytime to manage permissions or regenerate QR artwork. You buy the issued record — the QR is a regenerable asset
        of that record.
      </p>

      <div className="toolbar">
        <Link className="button" href="/rights/create">
          Create record
        </Link>
        <a className="button secondary" href="https://veildaemon.app/studio/creator-rights/" target="_blank" rel="noopener noreferrer">
          Public registry
        </a>
      </div>

      {created ? (
        <p className="notice">
          Draft saved. Review it below, then publish ({money(RIGHTS_PRICE_CENTS)}) to issue the Rights Record and unlock
          branded QR downloads.
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
                        Preview
                      </Link>
                      {entitled || record.record_status === "published" || record.record_status === "updated" ? (
                        <a className="button secondary" href={durable} target="_blank" rel="noopener noreferrer">
                          Public URL
                        </a>
                      ) : (
                        <span className="muted">Public URL issues after payment</span>
                      )}
                      {showCheckout ? (
                        <form action="/api/rights/checkout" method="post">
                          <input type="hidden" name="recordId" value={record.id} />
                          <button className="button" type="submit">
                            Publish · {money(RIGHTS_PRICE_CENTS)}
                          </button>
                        </form>
                      ) : null}
                      {editable ? (
                        <Link className="button secondary" href={`/account/rights/${record.id}/edit`}>
                          Edit metadata
                        </Link>
                      ) : null}
                    </div>
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
                </article>
              );
            })}
          </div>
        ) : (
          <div className="panel">
            <p className="panel-kicker">No records yet</p>
            <h2>Create the first draft.</h2>
            <p className="muted">
              The portal is where records are issued and managed. The public registry is the verification layer for issued
              works.
            </p>
            <div className="toolbar">
              <Link className="button" href="/rights/create">
                Create Rights Record
              </Link>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
