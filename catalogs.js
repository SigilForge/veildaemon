(function () {
  const presentationArchiveCatalog = {
    CORE: {
      id: "CORE",
      label: "Core Package",
      tier: "core",
      expansion: 0,
      summary: "Open and Handler Approval presentations ship with core rules."
    },
    PREDATORY_ARCHIVE: {
      id: "PREDATORY_ARCHIVE",
      label: "Predatory Archive",
      expansion: 1,
      summary: "Vampire and werewolf pressure without tropes."
    },
    DEATH_ARCHIVE: {
      id: "DEATH_ARCHIVE",
      label: "Death Archive",
      expansion: 2,
      summary: "Ghosts, mummies, anchor horror, and death economy."
    },
    COVENANT_ARCHIVE: {
      id: "COVENANT_ARCHIVE",
      label: "Covenant Archive",
      expansion: 3,
      summary: "Demonic contracts, possession, and infernal binding."
    },
    RADIANCE_ARCHIVE: {
      id: "RADIANCE_ARCHIVE",
      label: "Radiance Archive",
      expansion: 4,
      summary: "Angelic vessels, divine alignment, and oracle pressure."
    },
    MACHINE_ARCHIVE: {
      id: "MACHINE_ARCHIVE",
      label: "Machine Archive",
      expansion: 5,
      summary: "Daemon bleed, synthetic saints, and myth-tech hosts."
    },
    DEEP_VOID_ARCHIVE: {
      id: "DEEP_VOID_ARCHIVE",
      label: "Deep Void Archive",
      expansion: 6,
      summary: "Late-game anti-reality and breach survivors."
    }
  };

  const presentationCatalog = {
    BASELINE_HUMAN: {
      label: "Baseline Human",
      displayName: "Baseline Human",
      category: "presentation",
      access: "starter",
      grants: {}
    },
    RESONANT_SENSITIVE: {
      label: "Resonant Sensitive",
      displayName: "Resonant Sensitive",
      category: "presentation",
      access: "open",
      grants: {}
    },
    SANGUINE: {
      label: "Sanguine Presentation",
      displayName: "Sanguine Presentation",
      category: "presentation",
      access: "handler",
      approval: "recommended",
      grants: {}
    },
    ECHO_ALTERED: {
      label: "Echo-Altered Presentation",
      displayName: "Echo-Altered Presentation",
      category: "presentation",
      access: "open",
      grants: {}
    },
    THERIAN_ADAPTATION: {
      label: "Therian Adaptation",
      displayName: "Therian Adaptation",
      category: "presentation",
      access: "open",
      grants: {}
    },
    HOLLOW_SILENCE_ALTERED: {
      label: "Hollow / Silence-Altered",
      displayName: "Hollow / Silence-Altered",
      category: "presentation",
      access: "open",
      grants: {}
    },
    WRAITH_TOUCHED_ANCHOR_BOUND: {
      label: "Wraith-Touched / Anchor-Bound",
      displayName: "Wraith-Touched / Anchor-Bound",
      category: "presentation",
      access: "handler",
      approval: "required",
      grants: {}
    },
    TECHNOMANCER_DAEMON_ALIGNED: {
      label: "Technomancer / Daemon-Aligned",
      displayName: "Technomancer / Daemon-Aligned",
      category: "presentation",
      access: "open",
      grants: {}
    },
    CONSTRUCT: {
      label: "Construct",
      displayName: "Construct",
      category: "presentation",
      access: "handler",
      approval: "required",
      grants: {}
    },
    VESSEL: {
      label: "Vessel",
      displayName: "Vessel",
      category: "presentation",
      access: "handler",
      approval: "required",
      grants: {}
    },
    CONSTRUCT_VESSEL: {
      label: "Construct / Vessel",
      displayName: "Construct / Vessel",
      category: "presentation",
      access: "handler",
      approval: "required",
      legacyAlias: true,
      grants: {}
    },
    VOID_SHARD: {
      label: "Void-Shard",
      displayName: "Void-Shard",
      category: "presentation",
      access: "handler",
      approval: "required",
      grants: {}
    },
    MYTHIC_ECHO: {
      label: "Mythic Echo",
      displayName: "Mythic Echo",
      category: "ontology",
      access: "advanced",
      grants: {}
    },
    GHOST: { label: "Ghost", displayName: "Ghost", category: "ontology", access: "advanced", grants: {} },
    WRAITH: { label: "Wraith", displayName: "Wraith", category: "ontology", access: "advanced", grants: {} },
    TECHNOMANCER: { label: "Technomancer", displayName: "Technomancer", category: "ontology", access: "advanced", grants: {} },
    MYTH_TECH_SYMBIOTE: { label: "Myth-Tech Symbiote", displayName: "Myth-Tech Symbiote", category: "ontology", access: "advanced", grants: {} },
    VEILWALKER: { label: "Veilwalker", displayName: "Veilwalker", category: "ontology", access: "advanced", grants: {} },
    DOMAIN_TOUCHED: { label: "Domain-Touched", displayName: "Domain-Touched", category: "ontology", access: "advanced", grants: {} },
    FREQUENCY_DISTORTION: { label: "Frequency Distortion", displayName: "Frequency Distortion", category: "ontology", access: "advanced", grants: {} },
    ENTITY_ADJACENT: { label: "Entity-Adjacent", displayName: "Entity-Adjacent", category: "ontology", access: "advanced", grants: {} },
    SANGUINE_VARIANT: {
      label: "Sanguine Variant",
      displayName: "Sanguine Variant",
      category: "presentation",
      access: "archive",
      archive: "PREDATORY_ARCHIVE",
      locked: true,
      grants: {}
    },
    THERIAN_ADVANCED: {
      label: "Advanced Therian",
      displayName: "Advanced Therian",
      category: "presentation",
      access: "archive",
      archive: "PREDATORY_ARCHIVE",
      locked: true,
      grants: {}
    },
    HUNGER_ADJACENT: {
      label: "Hunger-Adjacent Entity",
      displayName: "Hunger-Adjacent Entity",
      category: "presentation",
      access: "archive",
      archive: "PREDATORY_ARCHIVE",
      locked: true,
      grants: {}
    },
    FERAL_ADAPTATION: {
      label: "Feral Adaptation",
      displayName: "Feral Adaptation",
      category: "presentation",
      access: "archive",
      archive: "PREDATORY_ARCHIVE",
      locked: true,
      grants: {}
    },
    WRAITH_ADVANCED: {
      label: "Advanced Wraith",
      displayName: "Advanced Wraith",
      category: "presentation",
      access: "archive",
      archive: "DEATH_ARCHIVE",
      locked: true,
      grants: {}
    },
    GHOST_BOUND: {
      label: "Ghost-Bound",
      displayName: "Ghost-Bound",
      category: "presentation",
      access: "archive",
      archive: "DEATH_ARCHIVE",
      locked: true,
      grants: {}
    },
    GRAVE_TOUCHED: {
      label: "Grave-Touched",
      displayName: "Grave-Touched",
      category: "presentation",
      access: "archive",
      archive: "DEATH_ARCHIVE",
      locked: true,
      grants: {}
    },
    MUMMIFIED: {
      label: "Mummified",
      displayName: "Mummified",
      category: "presentation",
      access: "archive",
      archive: "DEATH_ARCHIVE",
      locked: true,
      grants: {}
    },
    FUNERARY_BOUND: {
      label: "Funerary-Bound",
      displayName: "Funerary-Bound",
      category: "presentation",
      access: "archive",
      archive: "DEATH_ARCHIVE",
      locked: true,
      grants: {}
    },
    DEMON_BOUND: {
      label: "Demon-Bound",
      displayName: "Demon-Bound",
      category: "presentation",
      access: "archive",
      archive: "COVENANT_ARCHIVE",
      locked: true,
      grants: {}
    },
    INFERNAL: {
      label: "Infernal",
      displayName: "Infernal",
      category: "presentation",
      access: "archive",
      archive: "COVENANT_ARCHIVE",
      locked: true,
      grants: {}
    },
    CONTRACTED: {
      label: "Contracted",
      displayName: "Contracted",
      category: "presentation",
      access: "archive",
      archive: "COVENANT_ARCHIVE",
      locked: true,
      grants: {}
    },
    POSSESSION_SURVIVOR: {
      label: "Possession Survivor",
      displayName: "Possession Survivor",
      category: "presentation",
      access: "archive",
      archive: "COVENANT_ARCHIVE",
      locked: true,
      grants: {}
    },
    ANGELIC_VESSEL: {
      label: "Angelic Vessel",
      displayName: "Angelic Vessel",
      category: "presentation",
      access: "archive",
      archive: "RADIANCE_ARCHIVE",
      locked: true,
      grants: {}
    },
    DIVINE_ALIGNED: {
      label: "Divine-Aligned",
      displayName: "Divine-Aligned",
      category: "presentation",
      access: "archive",
      archive: "RADIANCE_ARCHIVE",
      locked: true,
      grants: {}
    },
    SAINTED: {
      label: "Sainted",
      displayName: "Sainted",
      category: "presentation",
      access: "archive",
      archive: "RADIANCE_ARCHIVE",
      locked: true,
      grants: {}
    },
    ORACLE_BOUND: {
      label: "Oracle-Bound",
      displayName: "Oracle-Bound",
      category: "presentation",
      access: "archive",
      archive: "RADIANCE_ARCHIVE",
      locked: true,
      grants: {}
    },
    RELIC_BEARER: {
      label: "Relic-Bearer",
      displayName: "Relic-Bearer",
      category: "presentation",
      access: "archive",
      archive: "RADIANCE_ARCHIVE",
      locked: true,
      grants: {}
    },
    TECHNOMANCER_ADVANCED: {
      label: "Advanced Technomancer",
      displayName: "Advanced Technomancer",
      category: "presentation",
      access: "archive",
      archive: "MACHINE_ARCHIVE",
      locked: true,
      grants: {}
    },
    AI_HOSTED: {
      label: "AI-Hosted",
      displayName: "AI-Hosted",
      category: "presentation",
      access: "archive",
      archive: "MACHINE_ARCHIVE",
      locked: true,
      grants: {}
    },
    DAEMON_BONDED: {
      label: "Daemon-Bonded",
      displayName: "Daemon-Bonded",
      category: "presentation",
      access: "archive",
      archive: "MACHINE_ARCHIVE",
      locked: true,
      grants: {}
    },
    SYNTHETIC_SAINT: {
      label: "Synthetic Saint",
      displayName: "Synthetic Saint",
      category: "presentation",
      access: "archive",
      archive: "MACHINE_ARCHIVE",
      locked: true,
      grants: {}
    },
    CONSTRUCT_LINEAGE: {
      label: "Construct Lineage",
      displayName: "Construct Lineage",
      category: "presentation",
      access: "archive",
      archive: "MACHINE_ARCHIVE",
      locked: true,
      grants: {}
    },
    VOID_SHARD_VARIANT: {
      label: "Void-Shard Variant",
      displayName: "Void-Shard Variant",
      category: "presentation",
      access: "archive",
      archive: "DEEP_VOID_ARCHIVE",
      locked: true,
      grants: {}
    },
    NULL_BORN: {
      label: "Null-Born",
      displayName: "Null-Born",
      category: "presentation",
      access: "archive",
      archive: "DEEP_VOID_ARCHIVE",
      locked: true,
      grants: {}
    },
    BREACH_WALKED: {
      label: "Breach-Walked",
      displayName: "Breach-Walked",
      category: "presentation",
      access: "archive",
      archive: "DEEP_VOID_ARCHIVE",
      locked: true,
      grants: {}
    },
    ANTI_REALITY_SURVIVOR: {
      label: "Anti-Reality Survivor",
      displayName: "Anti-Reality Survivor",
      category: "presentation",
      access: "archive",
      archive: "DEEP_VOID_ARCHIVE",
      locked: true,
      grants: {}
    }
  };

  const backgroundCatalog = {
    CARETAKER: { label: "Caretaker", displayName: "Caretaker", skillBonus: ["Empathy"], perk: "Advantage to calm, comfort, or stabilize a distressed civilian/NPC.", hook: "You learned to read need before language.", tether: "Someone still depends on you.", access: "starter" },
    OUTSIDER: { label: "Outsider", displayName: "Outsider", skillBonus: ["Survival"], perk: "Once per scene, ask the Handler what feels socially or physically unsafe before trouble fully lands.", hook: "You survived by noticing the edges.", tether: "You have a place you are not welcome back to.", access: "starter" },
    TECH: { label: "Tech", displayName: "Tech", skillBonus: ["Hacking", "Engineering"], perk: "+1 to identify, repair, or interpret mundane devices affected by resonance bleed.", hook: "Machines make more sense than people.", tether: "A system, rig, server, or device is still tied to your old life.", access: "starter" },
    STREET: { label: "Street", displayName: "Street", skillBonus: ["Awareness", "Deception"], perk: "Once per session, find an illicit resource, rumor, back door, or local contact.", hook: "You know what polite people pretend not to see.", tether: "Someone dangerous knows your name.", access: "starter" },
    ACADEMIC: { label: "Academic", displayName: "Academic", skillBonus: ["Academics"], perk: "Choose one field; you are treated as an expert when researching it.", hook: "You explain fear until the explanation starts bleeding.", tether: "An institution owns part of your credibility.", access: "starter" },
    FIELD_MEDIC: { label: "Field Medic", displayName: "Field Medic", skillBonus: ["Medicine"], perk: "Once per scene, when giving immediate aid, identify the most urgent ordinary injury or exposure risk before acting.", hook: "You learned the body fails before the story does.", tether: "A patient, accident, or bad call still follows you.", access: "starter" },
    FIRST_RESPONDER: { label: "First Responder", displayName: "First Responder", skillBonus: ["Tactics", "Athletics"], perk: "Advantage to act quickly during disasters, evacuations, fires, crashes, panic, or crowd collapse.", hook: "You move toward the alarm.", tether: "Your badge, radio, unit, or old crew can still pull you back in.", access: "starter" },
    SERVICE_WORKER: { label: "Service Worker", displayName: "Service Worker", skillBonus: ["Persuasion", "Awareness"], perk: "Once per scene, read the mood of a workplace, crowd, queue, or customer-facing space.", hook: "You survived invisible labor and public masks.", tether: "A manager, coworker, regular, or unpaid bill still has leverage.", access: "starter" },
    BURNOUT_PROFESSIONAL: { label: "Burnout Professional", displayName: "Burnout Professional", skillBonus: ["Investigation", "Nerves"], perk: "Once per session, ignore one minor exhaustion, stress, or bureaucracy-related penalty long enough to finish a task.", hook: "You used to function. Technically.", tether: "Your old career can still identify you on paper.", access: "starter" },
    OCCULT_DABBLER: { label: "Occult Dabbler", displayName: "Occult Dabbler", skillBonus: ["Ritual"], perk: "Advantage to recognize folk wards, symbolic repetition, amateur rites, cult aesthetics, or fake occult theater.", hook: "You were playing with matches before the room became flammable.", tether: "You own, owe, or inherited something you do not fully understand.", access: "starter" },
    FORMER_BELIEVER: { label: "Former Believer", displayName: "Former Believer", skillBonus: ["Empathy", "Academics"], perk: "Advantage to spot coercive doctrine, ritualized guilt, spiritual manipulation, or groupthink.", hook: "You escaped one explanation and do not trust new ones easily.", tether: "Someone from the old circle wants you back, saved, silent, or punished.", access: "starter" },
    LOCAL_WITNESS: { label: "Local Witness", displayName: "Local Witness", skillBonus: ["Awareness", "Investigation"], perk: "Once per session, declare one mundane local detail you already know: a shortcut, rumor, business owner, camera blind spot, or neighborhood habit.", hook: "You saw something impossible and kept living nearby.", tether: "The place remembers you noticing.", access: "starter" },
    NEEDLEPOINT_SURVIVOR: { label: "Needlepoint Survivor", displayName: "Needlepoint Survivor", skillBonus: ["Nerves", "Awareness"], perk: "Advantage on your first roll to recognize a recurring hazard from a previous case.", hook: "You survived a contained impossibility.", tether: "The case did not fully close.", access: "handler" },
    VEILCORP_CONTRACTOR: { label: "VeilCorp Contractor", displayName: "VeilCorp Contractor", skillBonus: ["Investigation", "Hacking"], perk: "Once per session, request one limited procedural asset: archive snippet, badge plausibility, dead-drop, or equipment lead.", hook: "You signed something without reading the redacted part.", tether: "VeilCorp can find you when it matters.", access: "handler" },
    CULT_DEFECTOR: { label: "Cult Defector", displayName: "Cult Defector", skillBonus: ["Deception", "Ritual"], perk: "Advantage to recognize recruitment pressure, coded doctrine, hierarchy tells, or ritual compliance tests.", hook: "You know how belief sounds when it is hungry.", tether: "The cult still considers you unfinished property.", access: "handler" },
    ECHO_SITE_NATIVE: { label: "Echo Site Native", displayName: "Echo Site Native", skillBonus: ["Survival", "Awareness"], perk: "You always know one mundane exit, shelter, or unsafe threshold inside your home territory.", hook: "You grew up where reality had bad wiring.", tether: "Your neighborhood, house, route, or landmark reacts to you.", access: "handler" },
    RED_LEDGER_CONTACT: { label: "Red Ledger Contact", displayName: "Red Ledger Contact", skillBonus: ["Persuasion", "Deception"], perk: "Once per session, locate a black-market donor, broker, fixer, or illicit medical lead, with consequences.", hook: "You know the economy under the wound.", tether: "Someone thinks you owe them blood, money, silence, or access.", access: "handler" },
    UNRELIABLE_WITNESS: { label: "Unreliable Witness", displayName: "Unreliable Witness", skillBonus: ["Nerves", "Performance"], perk: "Advantage when insisting on your account under pressure, even when records contradict you.", hook: "You remember what the world edited out.", tether: "Official records say something else happened.", access: "handler" },
    INSTITUTIONAL_GHOST: { label: "Institutional Ghost", displayName: "Institutional Ghost", skillBonus: ["Stealth", "Academics"], perk: "Once per session, move through a hospital, school, office, archive, church, or agency as if you belong there.", hook: "Systems overlook you until they suddenly do not.", tether: "A file, badge, debt, or missing record keeps updating.", access: "handler" },
    SANGUINE_ADJACENT: { label: "Sanguine Adjacent", displayName: "Sanguine Adjacent", skillBonus: ["Medicine", "Empathy"], perk: "Advantage to notice hunger pressure, donor distress, blood-borne resonance cues, or unsafe intimacy dynamics.", hook: "You were close to the hunger before it had a name.", tether: "Someone Sanguine remembers how you smelled, helped, failed, or survived.", access: "handler" }
  };

  function titleCaseKey(key) {
    return String(key || "")
      .toLowerCase()
      .split(/[_\s-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  function catalogEntry(catalog, key) {
    const normalized = String(key || "").toUpperCase().replace(/[^A-Z0-9_]+/g, "_").replace(/^_|_$/g, "");
    if (catalog[normalized]) return { key: normalized, ...catalog[normalized] };
    const label = titleCaseKey(normalized);
    return {
      key: normalized,
      label,
      displayName: label,
      access: "unknown",
      skillBonus: [],
      grants: {}
    };
  }

  function entryByDisplayName(catalog, keyList, displayName) {
    const value = String(displayName || "").trim();
    if (!value) return null;
    const direct = keyList
      .map((key) => ({ key, ...catalog[key] }))
      .find((entry) => entry.displayName === value || entry.label === value);
    return direct || null;
  }

  function skillBonusGrantLabel(bonuses) {
    if (!Array.isArray(bonuses) || !bonuses.length) return "";
    return bonuses.map((skill) => `${skill} +1`).join(", ");
  }

  function grantsSkillBonuses(grants) {
    if (!grants) return [];
    if (Array.isArray(grants)) return grants.filter((item) => typeof item === "string");
    if (typeof grants === "object" && Array.isArray(grants.skillBonus)) return grants.skillBonus;
    return [];
  }

  function ontologyGrantLabel(grants) {
    const skillBonus = grantsSkillBonuses(grants);
    if (skillBonus.length) return skillBonusGrantLabel(skillBonus);
    if (!grants || (typeof grants === "object" && !Array.isArray(grants) && !Object.keys(grants).length)) return "none loaded";
    if (Array.isArray(grants) && !grants.length) return "none loaded";
    return "none loaded";
  }

  function presentationGrantLabel(entry) {
    if (!entry) return "—";
    const skillBonus = grantsSkillBonuses(entry.grants);
    if (skillBonus.length) return skillBonusGrantLabel(skillBonus);
    const api = typeof window !== "undefined" ? window.PresentationPressure : null;
    if (api && entry.key) {
      const presentation = api.presentationForCatalogKey(entry.key);
      if (presentation && api.isLoadPresentation(presentation)) {
        return presentation.trackLabel;
      }
    }
    if (entry.access === "starter" && entry.key === "BASELINE_HUMAN") {
      return "none";
    }
    if (entry.category === "ontology") {
      return "advanced ontology";
    }
    return "pressure pending";
  }

  function backgroundGrantLabel(entry) {
    return skillBonusGrantLabel(entry && entry.skillBonus) || "none loaded";
  }

  function presentationArchiveEntry(key) {
    const normalized = String(key || "").toUpperCase().replace(/[^A-Z0-9_]+/g, "_").replace(/^_|_$/g, "");
    return presentationArchiveCatalog[normalized]
      ? { id: normalized, ...presentationArchiveCatalog[normalized] }
      : { id: normalized, label: titleCaseKey(normalized), expansion: 0, summary: "" };
  }

  function presentationArchiveOptions() {
    return Object.entries(presentationArchiveCatalog)
      .map(([id, entry]) => ({ id, ...entry }))
      .sort((left, right) => Number(left.expansion || 0) - Number(right.expansion || 0));
  }

  function presentationVaultOptions() {
    return Object.entries(presentationCatalog)
      .map(([key, entry]) => ({ key, ...entry }))
      .filter((entry) => entry.access === "archive" && entry.locked);
  }

  function presentationOpenOptions() {
    return Object.entries(presentationCatalog)
      .map(([key, entry]) => ({ key, ...entry }))
      .filter((entry) => entry.access === "open" || entry.access === "starter");
  }

  function presentationHandlerApprovalOptions() {
    return Object.entries(presentationCatalog)
      .map(([key, entry]) => ({ key, ...entry }))
      .filter((entry) => entry.access === "handler" && !entry.legacyAlias);
  }

  function presentationCoreCatalogOptions() {
    return [...presentationOpenOptions(), ...presentationHandlerApprovalOptions()];
  }

  function archiveLabelForKey(archiveKey) {
    return presentationArchiveEntry(archiveKey).label || titleCaseKey(archiveKey);
  }

  function presentationAccessLabel(entry) {
    if (!entry) return "";
    if (entry.access === "open" || entry.access === "starter") return "Open Core";
    if (entry.access === "handler") {
      return entry.approval === "recommended"
        ? "Handler Approval Recommended"
        : "Handler Approval Required";
    }
    if (entry.access === "archive") {
      return `Archive Locked: ${archiveLabelForKey(entry.archive)}`;
    }
    return "";
  }

  window.CradlepointCatalogs = {
    presentationCatalog,
    presentationArchiveCatalog,
    backgroundCatalog,
    titleCaseKey,
    skillBonusGrantLabel,
    ontologyGrantLabel,
    presentationGrantLabel,
    backgroundGrantLabel,
    grantsSkillBonuses,
    presentationArchiveEntry,
    presentationArchiveOptions,
    presentationVaultOptions,
    presentationOpenOptions,
    presentationHandlerApprovalOptions,
    presentationCoreCatalogOptions,
    presentationAccessLabel,
    archiveLabelForKey,
    presentationEntry: (key) => catalogEntry(presentationCatalog, key),
    backgroundEntry: (key) => catalogEntry(backgroundCatalog, key),
    presentationKeyFromDisplayName: (displayName) => {
      const entry = entryByDisplayName(presentationCatalog, Object.keys(presentationCatalog), displayName);
      return entry ? entry.key : "";
    },
    backgroundKeyFromDisplayName: (displayName) => {
      const entry = entryByDisplayName(backgroundCatalog, Object.keys(backgroundCatalog), displayName);
      return entry ? entry.key : "";
    },
    presentationOptions: () => Object.entries(presentationCatalog).map(([key, entry]) => ({ key, ...entry })),
    backgroundOptions: () => Object.entries(backgroundCatalog).map(([key, entry]) => ({ key, ...entry }))
  };
}());