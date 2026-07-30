"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LICENSE_CATALOG, SFR_REGISTRY_FRAMEWORK, licenseById, licenseWorkTypeWarning } from "@/lib/rights/license-catalog";

const permissionFields = [
  ["generalTraining", "General AI training"],
  ["foundationModelPretraining", "Foundation-model pretraining"],
  ["fineTuning", "Fine-tuning"],
  ["embeddings", "Embeddings"],
  ["rag", "Retrieval-augmented generation"],
  ["generation", "Text or image generation"],
  ["datasetRedistribution", "Dataset redistribution"],
  ["researchUse", "Research use"],
  ["commercialUse", "Commercial use"],
  ["attributionRequired", "Attribution required"],
  ["licenseRequired", "License required"],
] as const;

type Props = {
  recordId: string;
  isDraft: boolean;
  initial: {
    title: string;
    description: string;
    creatorName: string;
    publicDisplayName: string;
    rightsHolderName: string;
    workType: string;
    category: string;
    availability: string;
    edition: string;
    sourceUrl: string;
    licensingContact: string;
    copyrightNotice: string;
    copyrightLicenseId: string;
    rightsStatement: string;
    humanCommercialLicenseAvailable: string;
    permissions: Record<string, string>;
  };
  workTypes: string[];
  categoryValues: string[];
  availabilityCategories: string[];
  permissionValues: string[];
};

function optionLabel(value: string) {
  return value.replace(/_/g, " ").replace(/^./, (first) => first.toUpperCase());
}

export function RightsEditForm({
  recordId,
  isDraft,
  initial,
  workTypes,
  categoryValues,
  availabilityCategories,
  permissionValues,
}: Props) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(initial);
  const selectedLicense = licenseById(form.copyrightLicenseId);
  const licenseWarning = licenseWorkTypeWarning(form.copyrightLicenseId, form.workType);

  function setField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function setPermission(key: string, value: string) {
    setForm((current) => ({
      ...current,
      permissions: { ...current.permissions, [key]: value },
    }));
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/rights/${recordId}/update`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Update failed.");
      router.push("/account/rights");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form rights-form" onSubmit={onSubmit}>
      {isDraft ? (
        <>
          <label>
            Creator name
            <input value={form.creatorName} required onChange={(e) => setField("creatorName", e.target.value)} />
          </label>
          <label>
            Public display name
            <input
              value={form.publicDisplayName}
              required
              onChange={(e) => setField("publicDisplayName", e.target.value)}
            />
          </label>
          <label>
            Rights-holder name
            <input
              value={form.rightsHolderName}
              required
              onChange={(e) => setField("rightsHolderName", e.target.value)}
            />
          </label>
          <label>
            Work title
            <input value={form.title} required onChange={(e) => setField("title", e.target.value)} />
          </label>
          <label>
            Work type
            <select value={form.workType} onChange={(e) => setField("workType", e.target.value)}>
              {workTypes.map((type) => (
                <option key={type} value={type}>
                  {optionLabel(type)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Category
            <select value={form.category} onChange={(e) => setField("category", e.target.value)}>
              {categoryValues.map((category) => (
                <option key={category} value={category}>
                  {optionLabel(category)}
                </option>
              ))}
            </select>
          </label>
        </>
      ) : (
        <p className="full muted">Title, creator, and work type stay fixed after issuance. Durable slug and record ID do not change.</p>
      )}

      <label>
        Availability
        <select value={form.availability} onChange={(e) => setField("availability", e.target.value)}>
          {availabilityCategories.map((category) => (
            <option key={category} value={category}>
              {optionLabel(category)}
            </option>
          ))}
        </select>
      </label>
      <label>
        Edition or version
        <input value={form.edition} onChange={(e) => setField("edition", e.target.value)} />
      </label>
      <label className="full">
        Description
        <textarea value={form.description} rows={4} required onChange={(e) => setField("description", e.target.value)} />
      </label>
      <label>
        Licensing contact
        <input value={form.licensingContact} onChange={(e) => setField("licensingContact", e.target.value)} />
      </label>
      <label>
        Copyright notice
        <input value={form.copyrightNotice} onChange={(e) => setField("copyrightNotice", e.target.value)} />
      </label>
      <div className="license-composition full">
        <div className="form-step-head">
          <p className="eyebrow">License composition</p>
          <h3>Primary License + Registry Framework</h3>
        </div>
        <label>
          Primary License
          <select value={form.copyrightLicenseId} onChange={(e) => setField("copyrightLicenseId", e.target.value)}>
            {LICENSE_CATALOG.map((license) => (
              <option key={license.id} value={license.id}>
                {license.name}{license.spdxId ? ` (${license.spdxId})` : ""}
              </option>
            ))}
          </select>
          <span className={licenseWarning ? "field-error" : "field-hint"}>
            {licenseWarning || selectedLicense.summary}
          </span>
        </label>
        <div className="registry-framework-row">
          <span>Registry Framework</span>
          <strong>{SFR_REGISTRY_FRAMEWORK.name} ({SFR_REGISTRY_FRAMEWORK.shortName}) v{SFR_REGISTRY_FRAMEWORK.version}</strong>
          <p>{SFR_REGISTRY_FRAMEWORK.summary}</p>
        </div>
        <p className="notice sfr-notice">
          SFR does not replace your selected copyright license. It publishes additional creator declarations,
          attribution guidance, AI permissions, provenance metadata, verification state, and machine-readable rights
          information alongside that license.
        </p>
      </div>
      <label className="full">
        Original publication URL
        <input value={form.sourceUrl} type="url" onChange={(e) => setField("sourceUrl", e.target.value)} />
      </label>
      <label className="full">
        Rights statement
        <textarea
          value={form.rightsStatement}
          rows={5}
          required
          onChange={(e) => setField("rightsStatement", e.target.value)}
        />
      </label>

      <fieldset className="full permission-fieldset">
        <legend>AI permissions</legend>
        <div className="permission-grid">
          {permissionFields.map(([name, label]) => (
            <label className="permission-select" key={name}>
              <span>{label}</span>
              <select value={form.permissions[name] || "license_required"} onChange={(e) => setPermission(name, e.target.value)}>
                {permissionValues.map((value) => (
                  <option key={value} value={value}>
                    {optionLabel(value)}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </fieldset>

      <label>
        Human commercial licensing
        <select
          value={form.humanCommercialLicenseAvailable}
          onChange={(e) => setField("humanCommercialLicenseAvailable", e.target.value)}
        >
          {permissionValues.map((value) => (
            <option key={value} value={value}>
              {optionLabel(value)}
            </option>
          ))}
        </select>
      </label>

      {error ? <p className="full rights-qr-warn">{error}</p> : null}
      <button type="submit" disabled={busy}>
        {busy ? "Saving record updates…" : "Save record updates"}
      </button>
    </form>
  );
}
