"use client";

import { useMemo, useState } from "react";

type DossierPurpose =
  | "publisher"
  | "licensing"
  | "grant"
  | "archive"
  | "open_source"
  | "suspected_use"
  | "general"
  | "custom";

type DossierSection =
  | "rights_summary"
  | "work_identity"
  | "parties"
  | "primary_license"
  | "registry_framework"
  | "ai_permissions"
  | "publication_history"
  | "identifiers"
  | "artifact_inventory"
  | "verification_status"
  | "timeline"
  | "canonical_urls"
  | "suspected_use_report";

const requiredSections: DossierSection[] = [
  "rights_summary",
  "work_identity",
  "parties",
  "primary_license",
  "registry_framework",
  "ai_permissions",
  "canonical_urls",
];

const purposeDefaults: Record<DossierPurpose, DossierSection[]> = {
  publisher: [
    "rights_summary",
    "work_identity",
    "parties",
    "primary_license",
    "registry_framework",
    "publication_history",
    "identifiers",
    "artifact_inventory",
    "canonical_urls",
    "timeline",
  ],
  licensing: [
    "rights_summary",
    "work_identity",
    "parties",
    "primary_license",
    "registry_framework",
    "ai_permissions",
    "identifiers",
    "verification_status",
    "canonical_urls",
    "timeline",
  ],
  grant: [
    "rights_summary",
    "work_identity",
    "parties",
    "publication_history",
    "identifiers",
    "artifact_inventory",
    "verification_status",
    "canonical_urls",
    "timeline",
  ],
  archive: [
    "rights_summary",
    "work_identity",
    "parties",
    "primary_license",
    "registry_framework",
    "ai_permissions",
    "publication_history",
    "identifiers",
    "artifact_inventory",
    "verification_status",
    "canonical_urls",
    "timeline",
  ],
  open_source: [
    "rights_summary",
    "work_identity",
    "parties",
    "primary_license",
    "registry_framework",
    "ai_permissions",
    "artifact_inventory",
    "verification_status",
    "canonical_urls",
    "timeline",
  ],
  suspected_use: [
    "rights_summary",
    "work_identity",
    "parties",
    "primary_license",
    "registry_framework",
    "ai_permissions",
    "publication_history",
    "identifiers",
    "artifact_inventory",
    "verification_status",
    "canonical_urls",
    "timeline",
    "suspected_use_report",
  ],
  general: [
    "rights_summary",
    "work_identity",
    "parties",
    "primary_license",
    "registry_framework",
    "ai_permissions",
    "publication_history",
    "identifiers",
    "artifact_inventory",
    "verification_status",
    "canonical_urls",
    "timeline",
  ],
  custom: [...requiredSections, "timeline"],
};

const allSections: DossierSection[] = [
  "rights_summary",
  "work_identity",
  "parties",
  "primary_license",
  "registry_framework",
  "ai_permissions",
  "publication_history",
  "identifiers",
  "artifact_inventory",
  "verification_status",
  "timeline",
  "canonical_urls",
  "suspected_use_report",
];

const purposes: Array<{ id: DossierPurpose; label: string; note: string }> = [
  { id: "publisher", label: "Publisher or literary agent", note: "Concise rights picture for submission or review." },
  { id: "licensing", label: "Licensing or business review", note: "Restrictions, permissions, identity, and verification." },
  { id: "grant", label: "Grant or application", note: "A polished project record and documentation trail." },
  { id: "archive", label: "Archive or estate records", note: "Continuity package for future review." },
  { id: "open_source", label: "Open-source release", note: "License, SPDX, repository, release, and AI-use posture." },
  { id: "suspected_use", label: "Suspected unauthorized use", note: "Creator-reported observations with restrained classification." },
  { id: "general", label: "General records", note: "Balanced professional dossier for the work." },
  { id: "custom", label: "Custom", note: "Start with required sections and choose the rest." },
];

const sectionLabels: Record<DossierSection, string> = {
  rights_summary: "Rights summary",
  work_identity: "Work identity",
  parties: "Creator and rights holder",
  primary_license: "Primary copyright license",
  registry_framework: "SFR registry framework",
  ai_permissions: "AI permissions",
  publication_history: "Publication history",
  identifiers: "ISBN and identifiers",
  artifact_inventory: "Artifact inventory",
  verification_status: "Verification status",
  timeline: "Timeline",
  canonical_urls: "Canonical URLs",
  suspected_use_report: "Reported observation section",
};

function checkedSetForPurpose(purpose: DossierPurpose) {
  return new Set([...requiredSections, ...purposeDefaults[purpose]]);
}

export function CreatorDossierBuilderFields({ initialPurpose = "publisher" }: { initialPurpose?: DossierPurpose }) {
  const [purpose, setPurpose] = useState<DossierPurpose>(initialPurpose);
  const [sections, setSections] = useState<Set<DossierSection>>(() => checkedSetForPurpose(initialPurpose));
  const required = useMemo(() => new Set(requiredSections), []);

  function choosePurpose(next: DossierPurpose) {
    setPurpose(next);
    setSections(checkedSetForPurpose(next));
  }

  function toggleSection(section: DossierSection, checked: boolean) {
    setSections((current) => {
      const next = new Set(current);
      if (checked) next.add(section);
      else if (!required.has(section)) next.delete(section);
      return next;
    });
  }

  return (
    <>
      <section className="form-step full">
        <div className="form-step-head">
          <p className="eyebrow">Step 1</p>
          <h2>Purpose</h2>
        </div>
        <p className="field-hint full">
          The purpose controls recommended sections and ordering. It does not alter the underlying Creator Rights Record.
        </p>
        <div className="dossier-purpose-grid full">
          {purposes.map((option) => (
            <label className={purpose === option.id ? "dossier-purpose selected" : "dossier-purpose"} key={option.id}>
              <input
                type="radio"
                name="purpose"
                value={option.id}
                checked={purpose === option.id}
                onChange={() => choosePurpose(option.id)}
              />
              <span>{option.label}</span>
              <small>{option.note}</small>
            </label>
          ))}
        </div>
      </section>

      <section className="form-step full">
        <div className="form-step-head">
          <p className="eyebrow">Step 2</p>
          <h2>Record content</h2>
        </div>
        <p className="field-hint full">
          Required provenance and disclaimer sections stay included so the export is not misleading.
        </p>
        <div className="dossier-section-grid full">
          {allSections.map((section) => (
            <label className="checkbox-label dossier-section" key={section}>
              <input
                type="checkbox"
                name="sections"
                value={section}
                checked={sections.has(section)}
                disabled={required.has(section)}
                onChange={(event) => toggleSection(section, event.target.checked)}
              />
              {required.has(section) ? <input type="hidden" name="sections" value={section} /> : null}
              <span>{sectionLabels[section]}</span>
            </label>
          ))}
        </div>
      </section>

      {purpose === "suspected_use" ? (
        <section className="form-step full">
          <div className="form-step-head">
            <p className="eyebrow">Reported observation</p>
            <h2>Suspected unauthorized use</h2>
          </div>
          <p className="notice full">
            This section records the creator&apos;s report and supporting materials. It does not independently determine
            whether infringement or unauthorized use occurred.
          </p>
          <label>
            Company or provider
            <input name="suspected.providerName" />
          </label>
          <label>
            Model or service
            <input name="suspected.modelName" />
          </label>
          <label>
            Observation date
            <input name="suspected.observedAt" type="date" />
          </label>
          <label>
            Status
            <select name="suspected.status" defaultValue="creator_reported">
              <option value="creator_reported">Creator reported</option>
              <option value="under_review">Under review</option>
              <option value="independently_reviewed">Independently reviewed</option>
              <option value="disputed">Disputed</option>
              <option value="resolved">Resolved</option>
            </select>
          </label>
          <label className="full">
            Factual observation
            <textarea name="suspected.factualObservation" rows={4} />
          </label>
          <label className="full">
            Creator interpretation
            <textarea name="suspected.creatorInterpretation" rows={4} />
          </label>
        </section>
      ) : null}
    </>
  );
}
