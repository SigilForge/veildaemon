(function () {
  const presentationCatalog = {
    BASELINE_HUMAN: { label: "Baseline Human", displayName: "Baseline Human", category: "presentation", access: "starter" },
    RESONANT_SENSITIVE: { label: "Resonant Sensitive", displayName: "Resonant Sensitive", category: "presentation", access: "starter" },
    SANGUINE: { label: "Sanguine Presentation", displayName: "Sanguine Presentation", category: "presentation", access: "handler" },
    ECHO_ALTERED: { label: "Echo-Altered Presentation", displayName: "Echo-Altered Presentation", category: "presentation", access: "handler" },
    THERIAN_ADAPTATION: { label: "Therian Adaptation", displayName: "Therian Adaptation", category: "presentation", access: "handler" },
    HOLLOW_SILENCE_ALTERED: { label: "Hollow / Silence-Altered", displayName: "Hollow / Silence-Altered", category: "presentation", access: "handler" },
    WRAITH_TOUCHED_ANCHOR_BOUND: { label: "Wraith-Touched / Anchor-Bound", displayName: "Wraith-Touched / Anchor-Bound", category: "presentation", access: "handler" },
    TECHNOMANCER_DAEMON_ALIGNED: { label: "Technomancer / Daemon-Aligned", displayName: "Technomancer / Daemon-Aligned", category: "presentation", access: "handler" },
    CONSTRUCT_VESSEL: { label: "Construct / Vessel", displayName: "Construct / Vessel", category: "presentation", access: "handler" },
    MYTHIC_ECHO: { label: "Mythic Echo", displayName: "Mythic Echo", category: "ontology", access: "advanced" },
    GHOST: { label: "Ghost", displayName: "Ghost", category: "ontology", access: "advanced" },
    WRAITH: { label: "Wraith", displayName: "Wraith", category: "ontology", access: "advanced" },
    VESSEL: { label: "Vessel", displayName: "Vessel", category: "ontology", access: "advanced" },
    TECHNOMANCER: { label: "Technomancer", displayName: "Technomancer", category: "ontology", access: "advanced" },
    CONSTRUCT: { label: "Construct", displayName: "Construct", category: "ontology", access: "advanced" },
    VOID_SHARD: { label: "Void-Shard", displayName: "Void-Shard", category: "ontology", access: "advanced" },
    MYTH_TECH_SYMBIOTE: { label: "Myth-Tech Symbiote", displayName: "Myth-Tech Symbiote", category: "ontology", access: "advanced" },
    VEILWALKER: { label: "Veilwalker", displayName: "Veilwalker", category: "ontology", access: "advanced" },
    DOMAIN_TOUCHED: { label: "Domain-Touched", displayName: "Domain-Touched", category: "ontology", access: "advanced" },
    FREQUENCY_DISTORTION: { label: "Frequency Distortion", displayName: "Frequency Distortion", category: "ontology", access: "advanced" },
    ENTITY_ADJACENT: { label: "Entity-Adjacent", displayName: "Entity-Adjacent", category: "ontology", access: "advanced" }
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
    const normalized = String(key || "").toUpperCase();
    return catalog[normalized] || { label: titleCaseKey(normalized), displayName: titleCaseKey(normalized), access: "unknown" };
  }

  window.CradlepointCatalogs = {
    presentationCatalog,
    backgroundCatalog,
    titleCaseKey,
    presentationEntry: (key) => catalogEntry(presentationCatalog, key),
    backgroundEntry: (key) => catalogEntry(backgroundCatalog, key),
    presentationOptions: () => Object.entries(presentationCatalog).map(([key, entry]) => ({ key, ...entry })),
    backgroundOptions: () => Object.entries(backgroundCatalog).map(([key, entry]) => ({ key, ...entry }))
  };
}());
