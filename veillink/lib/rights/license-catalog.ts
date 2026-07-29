import type { KnownWorkType } from "./schema";

export type LicenseCategory = "open_source" | "open_content" | "public_domain" | "proprietary" | "custom";

export type LicenseCatalogEntry = {
  id: string;
  name: string;
  shortName: string;
  spdxId: string | null;
  category: LicenseCategory;
  officialUrl: string;
  summary: string;
  goodFor: string;
  requiresNotice: boolean;
  eligibleWorkTypes: string[];
  cautions: string[];
};

export type RegistryFrameworkEntry = {
  id: "sfr";
  name: string;
  shortName: string;
  version: string;
  url: string;
  summary: string;
  supplementalNotice: string;
};

export const SFR_REGISTRY_FRAMEWORK: RegistryFrameworkEntry = {
  id: "sfr",
  name: "SigilForge Rights Framework",
  shortName: "SFR",
  version: "1.0",
  url: "https://veildaemon.app/rights/",
  summary:
    "Defines the Creator Rights Record behavior: provenance metadata, verification state, AI permissions, evidence package semantics, artifact status, and machine-readable rights information.",
  supplementalNotice: "This framework supplements the selected copyright license. It does not replace or modify that license.",
};

const softwareWorkTypes = ["software", "website", "game"];
const contentWorkTypes = ["book", "short_story", "ttrpg", "artwork", "photography", "screenplay", "music", "audio", "video", "animation", "comic", "document", "course"];
const dataWorkTypes = ["dataset", "research"];
const broadWorkTypes = [...softwareWorkTypes, ...contentWorkTypes, ...dataWorkTypes, "3d_model", "map", "asset_pack", "other"];

export const LICENSE_CATALOG: LicenseCatalogEntry[] = [
  {
    id: "proprietary",
    name: "Proprietary / all rights reserved",
    shortName: "Proprietary",
    spdxId: null,
    category: "proprietary",
    officialUrl: "https://www.copyright.gov/help/faq/",
    summary: "No reuse rights are granted unless a separate notice, agreement, or license says otherwise.",
    goodFor: "Commercial products, books, art, private releases, and records where licensing is handled by inquiry.",
    requiresNotice: false,
    eligibleWorkTypes: broadWorkTypes,
    cautions: ["Use a separate written agreement when granting reuse."],
  },
  {
    id: "mit",
    name: "MIT License",
    shortName: "MIT",
    spdxId: "MIT",
    category: "open_source",
    officialUrl: "https://opensource.org/license/mit/",
    summary: "A short permissive software license that allows broad reuse when the copyright and permission notice are kept.",
    goodFor: "Small libraries, examples, tools, and developer-facing software.",
    requiresNotice: true,
    eligibleWorkTypes: softwareWorkTypes,
    cautions: ["Usually not the right fit for books, art, music, or datasets."],
  },
  {
    id: "apache-2.0",
    name: "Apache License 2.0",
    shortName: "Apache 2.0",
    spdxId: "Apache-2.0",
    category: "open_source",
    officialUrl: "https://www.apache.org/licenses/LICENSE-2.0",
    summary: "A permissive software license with explicit patent terms and notice handling.",
    goodFor: "Software projects where patent clarity and NOTICE files matter.",
    requiresNotice: true,
    eligibleWorkTypes: softwareWorkTypes,
    cautions: ["Usually not the right fit for non-software creative works."],
  },
  {
    id: "bsd-3-clause",
    name: "BSD 3-Clause License",
    shortName: "BSD 3-Clause",
    spdxId: "BSD-3-Clause",
    category: "open_source",
    officialUrl: "https://opensource.org/license/bsd-3-clause/",
    summary: "A permissive software license with attribution and no-endorsement conditions.",
    goodFor: "Software libraries and codebases that want permissive reuse with attribution preservation.",
    requiresNotice: true,
    eligibleWorkTypes: softwareWorkTypes,
    cautions: ["Usually not the right fit for books, art, music, or datasets."],
  },
  {
    id: "mpl-2.0",
    name: "Mozilla Public License 2.0",
    shortName: "MPL 2.0",
    spdxId: "MPL-2.0",
    category: "open_source",
    officialUrl: "https://www.mozilla.org/en-US/MPL/2.0/",
    summary: "A file-level copyleft software license that requires changes to MPL-covered files to remain available under MPL.",
    goodFor: "Software that should stay open at the file level while allowing larger combined works under separate terms.",
    requiresNotice: true,
    eligibleWorkTypes: softwareWorkTypes,
    cautions: ["Keep file notices clear so users can tell which source files are MPL-covered."],
  },
  {
    id: "gpl-3.0-only",
    name: "GNU General Public License v3.0 only",
    shortName: "GPL 3.0",
    spdxId: "GPL-3.0-only",
    category: "open_source",
    officialUrl: "https://www.gnu.org/licenses/gpl-3.0.en.html",
    summary: "A strong copyleft software license for distributing programs and modified versions under the same license.",
    goodFor: "Software projects that intentionally require reciprocal source-code licensing on distribution.",
    requiresNotice: true,
    eligibleWorkTypes: softwareWorkTypes,
    cautions: ["Copyleft obligations can affect distribution plans and compatibility with other code."],
  },
  {
    id: "lgpl-3.0-only",
    name: "GNU Lesser General Public License v3.0 only",
    shortName: "LGPL 3.0",
    spdxId: "LGPL-3.0-only",
    category: "open_source",
    officialUrl: "https://www.gnu.org/licenses/lgpl-3.0.en.html",
    summary: "A copyleft software license commonly used for libraries while allowing linking from differently licensed programs.",
    goodFor: "Libraries where reciprocal terms should apply to the library itself.",
    requiresNotice: true,
    eligibleWorkTypes: softwareWorkTypes,
    cautions: ["Linking and modification obligations should be reviewed for the intended distribution model."],
  },
  {
    id: "agpl-3.0-only",
    name: "GNU Affero General Public License v3.0 only",
    shortName: "AGPL 3.0",
    spdxId: "AGPL-3.0-only",
    category: "open_source",
    officialUrl: "https://www.gnu.org/licenses/agpl-3.0.en.html",
    summary: "A strong copyleft software license that also addresses network service use.",
    goodFor: "Server software where hosted modifications should also provide corresponding source.",
    requiresNotice: true,
    eligibleWorkTypes: softwareWorkTypes,
    cautions: ["Network-use obligations can be a significant product and procurement consideration."],
  },
  {
    id: "unlicense",
    name: "The Unlicense",
    shortName: "Unlicense",
    spdxId: "Unlicense",
    category: "public_domain",
    officialUrl: "https://unlicense.org/",
    summary: "A public-domain-style software dedication with fallback permission language.",
    goodFor: "Software intentionally released with minimal restrictions.",
    requiresNotice: false,
    eligibleWorkTypes: softwareWorkTypes,
    cautions: ["Public-domain dedication treatment can vary by jurisdiction."],
  },
  {
    id: "cc-by-4.0",
    name: "Creative Commons Attribution 4.0 International",
    shortName: "CC BY 4.0",
    spdxId: "CC-BY-4.0",
    category: "open_content",
    officialUrl: "https://creativecommons.org/licenses/by/4.0/",
    summary: "A content license that allows sharing and adaptation with attribution.",
    goodFor: "Writing, art, media, educational materials, and other non-code creative works.",
    requiresNotice: true,
    eligibleWorkTypes: [...contentWorkTypes, ...dataWorkTypes, "3d_model", "map", "asset_pack", "other"],
    cautions: ["Creative Commons recommends other licenses for software source code."],
  },
  {
    id: "cc-by-sa-4.0",
    name: "Creative Commons Attribution-ShareAlike 4.0 International",
    shortName: "CC BY-SA 4.0",
    spdxId: "CC-BY-SA-4.0",
    category: "open_content",
    officialUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    summary: "A content license that allows sharing and adaptation with attribution and ShareAlike terms.",
    goodFor: "Open content where adapted versions should stay under compatible terms.",
    requiresNotice: true,
    eligibleWorkTypes: [...contentWorkTypes, "3d_model", "map", "asset_pack", "other"],
    cautions: ["ShareAlike affects how adaptations can be redistributed."],
  },
  {
    id: "cc-by-nc-4.0",
    name: "Creative Commons Attribution-NonCommercial 4.0 International",
    shortName: "CC BY-NC 4.0",
    spdxId: "CC-BY-NC-4.0",
    category: "open_content",
    officialUrl: "https://creativecommons.org/licenses/by-nc/4.0/",
    summary: "A content license that allows noncommercial sharing and adaptation with attribution.",
    goodFor: "Creative works where public noncommercial use is welcome but commercial use needs separate permission.",
    requiresNotice: true,
    eligibleWorkTypes: [...contentWorkTypes, "3d_model", "map", "asset_pack", "other"],
    cautions: ["Noncommercial terms can be ambiguous for some institutions and platforms."],
  },
  {
    id: "cc0-1.0",
    name: "Creative Commons Zero v1.0 Universal",
    shortName: "CC0 1.0",
    spdxId: "CC0-1.0",
    category: "public_domain",
    officialUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    summary: "A public-domain dedication with broad fallback permissions.",
    goodFor: "Datasets, examples, and assets intentionally released with minimal restrictions.",
    requiresNotice: false,
    eligibleWorkTypes: [...contentWorkTypes, ...dataWorkTypes, "3d_model", "map", "asset_pack", "other"],
    cautions: ["Public-domain dedication treatment can vary by jurisdiction."],
  },
  {
    id: "custom",
    name: "Custom or separately negotiated license",
    shortName: "Custom",
    spdxId: null,
    category: "custom",
    officialUrl: "https://veildaemon.app/rights/",
    summary: "Reuse terms are defined in a custom agreement, creator notice, publisher contract, or future license template.",
    goodFor: "Commercial rights, enterprise review, adaptations, unreleased works, or rights that need negotiation.",
    requiresNotice: false,
    eligibleWorkTypes: broadWorkTypes,
    cautions: ["Attach or describe the governing agreement before relying on this for automated procurement."],
  },
];

export function licenseById(id: string | null | undefined) {
  return LICENSE_CATALOG.find((entry) => entry.id === id) || LICENSE_CATALOG[0];
}

export function licenseOptionsForWorkType(workType: string) {
  const matching = LICENSE_CATALOG.filter((entry) => entry.eligibleWorkTypes.includes(workType));
  const fallback = LICENSE_CATALOG.filter((entry) => entry.id === "proprietary" || entry.id === "custom");
  const entries = matching.length ? matching : fallback;
  return [...new Map(entries.map((entry) => [entry.id, entry])).values()];
}

export function licenseWorkTypeWarning(licenseId: string, workType: string) {
  const entry = licenseById(licenseId);
  if (entry.eligibleWorkTypes.includes(workType)) return "";
  if (softwareWorkTypes.includes(workType) && entry.category === "open_content") {
    return "Creative Commons licenses are usually not recommended for software source code.";
  }
  if (!softwareWorkTypes.includes(workType) && entry.category === "open_source") {
    return "Open-source software licenses are usually not designed for books, art, music, datasets, or other non-code works.";
  }
  return "This license may not match the selected work type. Review the license text before publishing.";
}

export function publicLicenseShape(id: string | null | undefined) {
  const entry = licenseById(id);
  return {
    id: entry.id,
    name: entry.name,
    shortName: entry.shortName,
    spdxId: entry.spdxId,
    category: entry.category,
    url: entry.officialUrl,
    summary: entry.summary,
    requiresNotice: entry.requiresNotice,
  };
}

export function publicRegistryFrameworkShape(id: string | null | undefined, version?: string | null) {
  return {
    ...SFR_REGISTRY_FRAMEWORK,
    id: id === "sfr" || !id ? "sfr" : SFR_REGISTRY_FRAMEWORK.id,
    version: version || SFR_REGISTRY_FRAMEWORK.version,
  };
}

export function defaultLicenseIdForWorkType(workType: KnownWorkType | string) {
  return workType === "software" || workType === "website" ? "mit" : "proprietary";
}
