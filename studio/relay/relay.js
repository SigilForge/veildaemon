(function () {
  "use strict";

  const STORAGE_KEY = "relaydaemon.draft.v1";
  const MAX_SOURCE = 40000;
  const state = {
    analysis: null,
    variants: [],
    media: null,
    objectUrl: null,
    codeScan: { status: "not-run", formats: [], detail: "No media has been inspected." },
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const form = $("#relay-form");
  const sourceText = $("#source-text");
  const sourceUrl = $("#source-url");
  const destinationUrl = $("#destination-url");
  const imageUrl = $("#image-url");
  const mediaFile = $("#media-file");
  const altText = $("#alt-text");
  const objective = $("#objective");
  const voice = $("#voice");
  const contentWarning = $("#content-warning");
  const campaign = $("#campaign");
  const codeVerified = $("#code-verified");

  const brandTags = {
    personal: "",
    archive: "#VeilCorpArchives",
    studio: "#CradlepointStudios",
    platform: "#VeilDaemon",
    cradlepoint: "#Cradlepoint",
  };

  const discoveryRules = [
    { pattern: /ttrpg|tabletop|operator core|handler core|needlepoint/i, tags: ["#IndieTTRPG", "#HorrorRPG"] },
    { pattern: /vampir|sanguine/i, tags: ["#GothicHorror", "#Sanguine"] },
    { pattern: /worldbuild|fiction|archive|entity|lore/i, tags: ["#WeirdFiction", "#Worldbuilding"] },
    { pattern: /local.first|open.source/i, tags: ["#LocalFirst", "#CreativeTechnology"] },
    { pattern: /software|app|tool|development|code|technology/i, tags: ["#CreativeTechnology", "#IndieGameDev"] },
    { pattern: /augmented reality|mobile ar/i, tags: ["#AugmentedReality", "#LocationBasedEntertainment"] },
    { pattern: /playstation|steam deck|steamos|pc gaming/i, tags: ["#PlayStation", "#SteamDeck"] },
    { pattern: /preservation|digital ownership|physical media/i, tags: ["#GamePreservation", "#DigitalOwnership"] },
  ];

  const subjectRules = [
    { pattern: /operator/i, tag: "#Operator" },
    { pattern: /handler/i, tag: "#Handler" },
    { pattern: /sanguine|vampir/i, tag: "#Sanguine" },
    { pattern: /entity/i, tag: "#EntityFiles" },
    { pattern: /transmission/i, tag: "#ArchiveTransmissions" },
    { pattern: /needlepoint/i, tag: "#Needlepoint" },
    { pattern: /array[\s-]*(?:delta|Δ)\s*4/i, tag: "#ARRAYDelta4" },
    { pattern: /lyric[\s-]*9/i, tag: "#LYRIC9" },
  ];

  const platformConfig = [
    { id: "x", name: "X", target: "200–600", limit: 600, crop: "16:9 or 1.91:1 · center-safe", defaultOn: true },
    { id: "facebook-personal", name: "Personal Facebook", target: "250–1,500", limit: 1500, crop: "1.91:1 landscape · keep faces central", defaultOn: true },
    { id: "facebook-cradlepoint", name: "Cradlepoint Facebook", target: "250–1,500", limit: 1500, crop: "1.91:1 landscape or 4:5 portrait", defaultOn: true },
    { id: "instagram", name: "Instagram", target: "500–1,500", limit: 2200, crop: "4:5 portrait · 1080×1350", defaultOn: true },
    { id: "threads", name: "Threads", target: "200–450", limit: 500, crop: "4:5 portrait · center-safe", defaultOn: true },
    { id: "bluesky", name: "Bluesky", target: "220–290", limit: 300, crop: "16:9 landscape · 2:1 safe", defaultOn: true, graphemes: true },
    { id: "mastodon", name: "Mastodon", target: "350–480", limit: 500, crop: "16:9 landscape · preserve detail", defaultOn: true },
    { id: "linkedin", name: "LinkedIn", target: "500–1,800", limit: 3000, crop: "1.91:1 landscape · clear subject", defaultOn: true },
    { id: "discord", name: "Discord", target: "250–1,500", limit: 2000, crop: "16:9 embed · readable at 400px", defaultOn: true },
    { id: "patreon", name: "Patreon", target: "Full context", limit: 5000, crop: "16:9 header + full source asset", defaultOn: true },
    { id: "reddit", name: "Reddit", target: "Title 50–120 · body 500–3,000", limit: 40000, crop: "Use original when community rules allow", defaultOn: true },
    { id: "itch", name: "itch.io devlog", target: "Title 40–90 · body 800–4,000", limit: 4000, crop: "16:9 cover · product readable", defaultOn: true },
    { id: "tiktok", name: "TikTok", target: "100–500", limit: 2200, crop: "9:16 vertical · 1080×1920 safe zones", mediaOnly: true, defaultOn: false },
    { id: "youtube", name: "YouTube Shorts", target: "Title 45–75 · description 300–1,500", limit: 5000, crop: "9:16 vertical · title-safe center", mediaOnly: true, defaultOn: false },
    { id: "site-news", name: "Site news entry", target: "Permanent source", limit: 10000, crop: "1.91:1 social preview + WebP display asset", defaultOn: true },
  ];

  function normalizeWhitespace(value) {
    return String(value || "")
      .replace(/\r\n/g, "\n")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function stripSocialNoise(value) {
    return normalizeWhitespace(value)
      .replace(/(^|\s)#[\p{L}\p{N}_]+/gu, "")
      .replace(/(^|\s)@[A-Za-z0-9_.-]+/g, "")
      .replace(/\s{2,}/g, " ")
      .replace(/ *\n */g, "\n")
      .trim();
  }

  function splitSentences(value) {
    const clean = stripSocialNoise(value);
    const matches = clean.match(/[^.!?\n]+(?:[.!?]+|$)/g);
    return (matches || [clean]).map((item) => item.trim()).filter(Boolean);
  }

  function clip(value, max, suffix = "…") {
    const clean = normalizeWhitespace(value);
    if (countText(clean) <= max) return clean;
    const slice = clean.slice(0, Math.max(0, max - suffix.length));
    const boundary = slice.lastIndexOf(" ");
    return `${slice.slice(0, boundary > max * 0.65 ? boundary : slice.length).trim()}${suffix}`;
  }

  function countText(value, graphemes = false) {
    if (graphemes && typeof Intl !== "undefined" && Intl.Segmenter) {
      return [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(value)].length;
    }
    return [...String(value || "")].length;
  }

  function cleanUrl(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    try {
      const parsed = new URL(raw);
      if (!/^https?:$/.test(parsed.protocol)) return "";
      return parsed.toString();
    } catch (_error) {
      return "";
    }
  }

  function buildTrackedUrl(platform) {
    const base = cleanUrl(destinationUrl.value) || cleanUrl(sourceUrl.value);
    if (!base) return "";
    const url = new URL(base);
    url.searchParams.set("utm_source", platform.replace(/[^a-z0-9]+/gi, "-").toLowerCase());
    url.searchParams.set("utm_medium", "social");
    url.searchParams.set("utm_campaign", campaign.value.trim() || "relaydaemon");
    return url.toString();
  }

  function titleFrom(text) {
    const sentence = splitSentences(text)[0] || "Studio update";
    return clip(sentence.replace(/[.!?]+$/, ""), 78, "");
  }

  function hookFrom(text) {
    return clip(splitSentences(text)[0] || stripSocialNoise(text), 150);
  }

  function restFrom(text) {
    const sentences = splitSentences(text);
    return normalizeWhitespace(sentences.slice(1).join(" ") || stripSocialNoise(text));
  }

  function classify(text) {
    const lower = text.toLowerCase();
    const scores = {
      "Release announcement": (lower.match(/\brelease|released|available now|launched|shipped|version\b/g) || []).length * 3,
      "Product promotion": (lower.match(/\bbuy|download|store|sale|product|core set|itch\.io\b/g) || []).length * 2,
      "Cradlepoint lore": (lower.match(/\bveilcorp|entity|needlepoint|archive|operator|handler|sanguine|transmission\b/g) || []).length * 2,
      "Studio / business news": (lower.match(/\bstudio|funding|partner|development|publishing|business|founder\b/g) || []).length * 2,
      "Meme / cultural commentary": (lower.match(/\bmeme|lol|lmao|apparently|bureaucracy|because humanity\b/g) || []).length * 2,
      "Personal commentary": (lower.match(/\bi\b|\bmy\b|\bme\b|\bwe\b|\bthink|\bfeel|\bnoticed\b/g) || []).length,
    };
    if (objective.value === "personal") scores["Personal commentary"] += 8;
    if (objective.value === "lore") scores["Cradlepoint lore"] += 8;
    if (objective.value === "funding") scores["Studio / business news"] += 8;
    if (objective.value === "sale") scores["Product promotion"] += 8;
    if (objective.value === "announcement") scores["Release announcement"] += 5;
    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    return {
      value: sorted[0][1] > 0 ? sorted[0][0] : "Personal commentary",
      reason: sorted[0][1] > 0 ? `Matched ${sorted[0][1]} source and objective signals.` : "No specialist signals found; using the least promotional class.",
    };
  }

  function detectLayer(text, contentClass) {
    if (/veilcorp|archive transmission|entity file|operator notice/i.test(text)) {
      return { value: "Archive / in-universe", key: "archive", reason: "VeilCorp or Archive terminology is carrying the post." };
    }
    if (/veildaemon|veilforge|operator tool|handler tool/i.test(text)) {
      return { value: "Product / platform", key: "platform", reason: "The post concerns a connected product or application." };
    }
    if (/studio|funding|partner|publishing|development/i.test(text) || /Studio|Product|Release/.test(contentClass)) {
      return { value: "Cradlepoint Studio", key: "studio", reason: "Real-world studio or commercial language is primary." };
    }
    if (/cradlepoint|needlepoint|sanguine|entity/i.test(text)) {
      return { value: "Cradlepoint universe", key: "cradlepoint", reason: "The fictional universe is primary without a VeilCorp attribution." };
    }
    return { value: "Personal", key: "personal", reason: "No project identity clearly outranks the author’s own perspective." };
  }

  function detectVoice(layer) {
    if (voice.value !== "auto") {
      return { value: voice.options[voice.selectedIndex].text, key: voice.value, reason: "Selected manually for this package." };
    }
    const key = layer.key === "archive" ? "archive" : layer.key === "personal" ? "personal" : "studio";
    return { value: key[0].toUpperCase() + key.slice(1), key, reason: `Selected from the detected ${layer.value} reality layer.` };
  }

  function ctaFor(goal) {
    const map = {
      discussion: "Join the discussion",
      traffic: "Read more",
      sale: "View the release",
      announcement: "See what changed",
      lore: "Enter the archive",
      funding: "Review the opportunity",
      personal: "Tell me what you think",
    };
    return map[goal] || "Read more";
  }

  function getHashtags(text, layer, max = 4) {
    const tags = [];
    const anchor = brandTags[layer.key] || brandTags.studio;
    if (anchor) tags.push(anchor);
    const discovery = discoveryRules.find((rule) => rule.pattern.test(text));
    if (discovery) tags.push(...discovery.tags);
    else if (layer.key !== "personal") tags.push("#IndieTTRPG");
    for (const rule of subjectRules) {
      if (rule.pattern.test(text) && tags.length < max) tags.push(rule.tag);
    }
    return [...new Set(tags)].slice(0, max);
  }

  function scanFlags(text, layer) {
    const approval = [];
    const canon = [];
    const lower = text.toLowerCase();
    if (/\b(price|priced|\$\d|sale)\b/i.test(text)) approval.push("Pricing or sale language requires explicit factual approval.");
    if (/\b(release date|launch date|available now|ships? on|coming on)\b/i.test(text)) approval.push("Release timing or availability requires explicit approval.");
    if (/\b(fund|funding|invest|revenue|traction|percent|%)\b/i.test(text)) approval.push("Funding or performance claims require evidence and explicit approval.");
    if (/\bpolitic|election|medical|legal|financial advice\b/i.test(text)) approval.push("Sensitive or regulated commentary requires explicit approval.");
    if (/\b(killed|blood|gore|sexual|suicide|self-harm|violence)\b/i.test(text)) approval.push("Potentially explicit material detected; review the content warning.");
    if (/\b(arg|in-world|fiction|lore|canon|continuity|leaked|hacker)\b/i.test(lower)) canon.push("Meta-language detected. Remove it from diegetic Archive variants unless the context explicitly requires disclosure.");
    if (/veilcorp.{0,40}(studio|company|developer)|(?:studio|company).{0,40}veilcorp/i.test(lower)) canon.push("Possible reality-layer collision: VeilCorp is not the real-world studio.");
    if (/(mobile ar|ritual sites).{0,55}(live|available|launched|shipping|released)/i.test(lower)) canon.push("Mobile AR and Ritual Sites remain proposed or developing until a ship decision is verified.");
    if (/\b(players?|game master|\bgm\b)\b/i.test(lower)) canon.push("Legacy role terminology detected. Public Cradlepoint copy normally uses Operator and Handler.");
    if (layer.key === "archive" && /cradlepoint studios/i.test(lower)) canon.push("Archive voice and Studio identity appear together. Confirm that the blur is deliberate.");
    const codeKinds = machineCodeKinds(text);
    if (codeKinds.qr) approval.push("QR code detected or inferred. A replacement may use the repository’s direct-URL SVG generator after the destination is confirmed; the final asset still requires a human scan test.");
    if (codeKinds.barcode) approval.push("One-dimensional or non-QR barcode detected or inferred. Do not auto-replace it; encoded data and remediation require manual review.");
    if (["unavailable", "inconclusive"].includes(state.codeScan.status) && !codeKinds.qr && !codeKinds.barcode) approval.push("Automatic QR/barcode inspection was inconclusive. Manual inspection and scan confirmation are required.");
    if (state.codeScan.status === "clear" && !codeKinds.qr && !codeKinds.barcode) approval.push("Automatic inspection found no supported QR code or barcode in the attached image.");
    if (!approval.length) approval.push("No mandatory approval category detected. Human review still applies.");
    if (!canon.length) canon.push("No known reality-layer or terminology collision detected.");
    return { approval, canon };
  }

  function possibleCode(text) {
    const filename = state.media ? state.media.name : "";
    return state.codeScan.status === "detected" || /\b(qr|barcode|scan code|scan this)\b/i.test(`${text} ${filename}`);
  }

  function machineCodeKinds(text) {
    const filename = state.media ? state.media.name : "";
    const combined = `${text || ""} ${filename}`;
    const formats = state.codeScan.formats || [];
    return {
      qr: formats.includes("qr_code") || /\bqr(?: code)?|scan code|scan this\b/i.test(combined),
      barcode: formats.some((format) => format !== "qr_code") || /\bbar[ -]?code\b/i.test(combined),
    };
  }

  function codeRemediation(analysis) {
    const destination = cleanUrl(destinationUrl.value) || cleanUrl(sourceUrl.value);
    if (analysis.codeKinds.barcode) return "Barcode requires manual encoded-data review; no automatic replacement.";
    if (analysis.codeKinds.qr && destination) return "QR replacement eligible through the local direct-URL SVG generator; scan-test the final asset.";
    if (analysis.codeKinds.qr) return "Confirm a direct destination URL before generating a replacement QR; scan-test the final asset.";
    if (["unavailable", "inconclusive"].includes(state.codeScan.status)) return "Automatic inspection inconclusive; manual code review required.";
    if (state.codeScan.status === "clear") return "No supported machine-readable code detected; visual review still applies.";
    return "No media code inspection recorded.";
  }

  function deriveAlt(text) {
    if (altText.value.trim()) return normalizeWhitespace(altText.value);
    if (!state.media && !imageUrl.value.trim()) return "No media attached.";
    const name = state.media ? state.media.name.replace(/[-_]+/g, " ").replace(/\.[^.]+$/, "") : "Attached image";
    return `${name}. Visual supporting a post about ${clip(hookFrom(text).toLowerCase(), 140, "")}. Review visible text and atmosphere before publishing.`;
  }

  function analyze(text) {
    const contentClass = classify(text);
    const layer = detectLayer(text, contentClass.value);
    const appliedVoice = detectVoice(layer);
    const flags = scanFlags(text, layer);
    const inferredCode = possibleCode(text);
    const codeKinds = machineCodeKinds(text);
    const mediaNeedsManualScan = Boolean(state.media || imageUrl.value.trim()) && ["scanning", "unavailable", "inconclusive"].includes(state.codeScan.status);
    return {
      contentClass,
      layer,
      voice: appliedVoice,
      cta: ctaFor(objective.value),
      flags,
      possibleCode: inferredCode,
      codeKinds,
      codeRequiresConfirmation: inferredCode || mediaNeedsManualScan,
      hashtags: getHashtags(text, layer, 5),
      alt: deriveAlt(text),
    };
  }

  function voiceLead(analysis, hook) {
    if (analysis.voice.key === "archive") return `OBSERVATION LOG // ${hook}`;
    if (analysis.voice.key === "studio") return hook;
    return hook;
  }

  function joinParts(parts) {
    return parts.filter(Boolean).map(normalizeWhitespace).filter(Boolean).join("\n\n");
  }

  function tagsFor(platform, analysis, count) {
    if (["discord", "reddit", "itch", "site-news"].includes(platform)) return "";
    if (platform === "threads") return analysis.hashtags.slice(0, 1).join(" ");
    if (platform === "bluesky") return analysis.hashtags.slice(0, 2).join(" ");
    if (platform === "x") return analysis.hashtags.slice(0, 3).join(" ");
    return analysis.hashtags.slice(0, count).join(" ");
  }

  function generateCopy(config, text, analysis) {
    const clean = stripSocialNoise(text);
    const hook = hookFrom(clean);
    const rest = restFrom(clean);
    const link = buildTrackedUrl(config.id);
    const ctaLine = link ? `${analysis.cta}: ${link}` : analysis.cta;
    const voicedHook = voiceLead(analysis, hook);
    const shortBody = clip(rest, 420);
    const fullerBody = clip(rest || clean, 950);
    const contextBody = clip(clean, 1800);
    const cw = contentWarning.value.trim();
    const mediaExists = Boolean(state.media || imageUrl.value.trim());

    switch (config.id) {
      case "x":
        return clip(joinParts([voicedHook, clip(shortBody, 240), ctaLine, tagsFor("x", analysis, 3)]), config.limit);
      case "facebook-personal":
        return clip(joinParts([hook, fullerBody, ctaLine, tagsFor(config.id, { ...analysis, hashtags: analysis.hashtags.filter((tag) => tag !== "#VeilCorpArchives") }, 3)]), config.limit);
      case "facebook-cradlepoint":
        return clip(joinParts([voicedHook, fullerBody, ctaLine, tagsFor(config.id, analysis, 4)]), config.limit);
      case "instagram":
        return clip(joinParts([voicedHook, clip(fullerBody, 850), link ? `${analysis.cta} through the named route.` : analysis.cta, tagsFor(config.id, analysis, 5)]), config.limit);
      case "threads":
        return clip(joinParts([hook, clip(shortBody, 220), link, tagsFor(config.id, analysis, 1)]), config.limit);
      case "bluesky": {
        const base = joinParts([hook, clip(shortBody, 95), link, tagsFor(config.id, analysis, 2)]);
        return clip(base, config.limit);
      }
      case "mastodon":
        return clip(joinParts([cw ? `CW: ${cw}` : "", voicedHook, clip(shortBody, 220), ctaLine, tagsFor(config.id, analysis, 4)]), config.limit);
      case "linkedin":
        return clip(joinParts([hook, `The working decision: ${fullerBody}`, "The useful part is not identical distribution. It is preserving the claim while translating context, format, and audience expectations.", ctaLine, tagsFor(config.id, { ...analysis, hashtags: ["#CradlepointStudios", "#CreativeTechnology", "#IndieGameDev"] }, 4)]), config.limit);
      case "discord":
        return clip(joinParts([`**${titleFrom(text)}**`, clip(contextBody, 1100), link ? `**${analysis.cta}:** ${link}` : `**Next action:** ${analysis.cta}`]), config.limit);
      case "patreon":
        return joinParts([`# Archive log: ${titleFrom(text)}`, contextBody, `## Why this matters\n${clip(rest || clean, 1200)}`, link ? `Continue through the primary door: ${link}` : "No external destination assigned.", `Classification: ${analysis.contentClass.value} · ${analysis.layer.value}`]);
      case "reddit":
        return joinParts([`Title: ${clip(titleFrom(text), 120, "")}`, `Body:\n${clip(contextBody, 2400)}`, "Disclosure: I created or am directly involved with this work.", link ? `Relevant link: ${link}` : ""]);
      case "itch":
        return joinParts([`Title: ${clip(titleFrom(text), 90, "")}`, `What changed:\n${clip(contextBody, 1800)}`, `Who this is for:\nOperators, Handlers, and readers following Cradlepoint releases.`, link ? `Review or download: ${link}` : ""]);
      case "tiktok":
        return mediaExists ? joinParts([`Spoken hook: ${clip(hook, 120)}`, `Overlay text: ${clip(titleFrom(text), 55, "")}`, `Caption: ${clip(shortBody || hook, 280)}`, `CTA: ${analysis.cta}`, `Tags: ${tagsFor(config.id, analysis, 5)}`]) : "Media required before TikTok output is generated.";
      case "youtube":
        return mediaExists ? joinParts([`Title: ${clip(titleFrom(text), 75, "")}`, `Spoken hook: ${clip(hook, 120)}`, `Overlay text: ${clip(titleFrom(text), 55, "")}`, `Description:\n${clip(contextBody, 900)}${link ? `\n\n${analysis.cta}: ${link}` : ""}`, `Hashtags: ${tagsFor(config.id, analysis, 3)}`, `Metadata tags: ${analysis.hashtags.map((tag) => tag.slice(1)).join(", ")}`]) : "Video required before YouTube Shorts output is generated.";
      case "site-news":
        return joinParts([`Title: ${titleFrom(text)}`, `Summary: ${clip(hook, 180)}`, `Body:\n${contextBody}`, `Author / voice: ${analysis.voice.value}`, `Category: ${analysis.contentClass.value}`, `Reality layer: ${analysis.layer.value}`, `Canon status: Review required`, `Primary link: ${cleanUrl(destinationUrl.value) || "Not assigned"}`, `Tags: ${analysis.hashtags.map((tag) => tag.slice(1)).join(", ") || "None"}`, `Content warning: ${cw || "None"}`, `Publication status: Draft`]);
      default:
        return clean;
    }
  }

  function variantNote(config) {
    if (config.mediaOnly && !(state.media || imageUrl.value.trim())) return "Unavailable until media is attached.";
    if (config.id === "instagram") return "Link stays out of the caption body; route is named instead.";
    if (config.id === "mastodon") return "Confirm the destination instance limit before publishing.";
    if (config.id === "reddit") return "Check subreddit rules and revise the disclosure for context.";
    if (config.id === "site-news") return "Permanent source draft; publishing is not implemented in this MVP.";
    return "Editable draft · approval required";
  }

  function makeVariants(text, analysis) {
    return platformConfig.map((config) => ({
      ...config,
      copy: generateCopy(config, text, analysis),
      selected: config.defaultOn && !(config.mediaOnly && !(state.media || imageUrl.value.trim())),
      disabled: config.mediaOnly && !(state.media || imageUrl.value.trim()),
      utm: buildTrackedUrl(config.id),
      alt: analysis.alt,
      hashtags: tagsFor(config.id, analysis, config.id === "instagram" ? 5 : 4),
      note: variantNote(config),
      codeGuidance: codeRemediation(analysis),
    }));
  }

  function renderAnalysis() {
    const analysis = state.analysis;
    $("#detected-class").textContent = analysis.contentClass.value;
    $("#class-reason").textContent = analysis.contentClass.reason;
    $("#detected-layer").textContent = analysis.layer.value;
    $("#layer-reason").textContent = analysis.layer.reason;
    $("#detected-voice").textContent = analysis.voice.value;
    $("#voice-reason").textContent = analysis.voice.reason;
    $("#detected-cta").textContent = analysis.cta;
    $("#destination-summary").textContent = cleanUrl(destinationUrl.value) || "No destination assigned; generated CTAs remain text-only.";
    renderFlagList($("#approval-flags"), analysis.flags.approval);
    renderFlagList($("#canon-flags"), analysis.flags.canon);
    renderCodeScan();
    $("#analysis-panel").hidden = false;
  }

  function renderFlagList(list, items) {
    list.replaceChildren(...items.map((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      if (/^No /.test(item)) li.className = "clear-note";
      return li;
    }));
  }

  function renderCodeScan() {
    const heuristic = state.analysis ? state.analysis.possibleCode : false;
    const hasMedia = Boolean(state.media || imageUrl.value.trim());
    const panel = $("#code-confirmation");
    panel.hidden = !hasMedia && !heuristic;
    if (panel.hidden) return;

    const labels = {
      "not-run": "Machine-readable code scan not run",
      scanning: "Inspecting image for machine-readable codes…",
      clear: "No supported QR code or barcode detected",
      detected: "Machine-readable code detected",
      unavailable: "Automatic QR/barcode detector unavailable",
      inconclusive: "Automatic QR/barcode scan inconclusive",
    };
    $("#code-scan-status").textContent = labels[state.codeScan.status] || labels["not-run"];
    $("#code-scan-detail").textContent = state.codeScan.detail;
    const requiresConfirmation = heuristic || ["detected", "unavailable", "inconclusive"].includes(state.codeScan.status);
    $("#code-verify-label").hidden = !requiresConfirmation;
    if (!requiresConfirmation) codeVerified.checked = false;
  }

  function renderVariants() {
    const grid = $("#variant-grid");
    const fragment = document.createDocumentFragment();
    state.variants.forEach((variant) => {
      const article = document.createElement("article");
      article.className = `variant-card${variant.selected ? " is-selected" : ""}${variant.disabled ? " is-disabled" : ""}`;
      article.dataset.platform = variant.id;
      article.innerHTML = `
        <header class="variant-header">
          <label class="variant-select">
            <input class="destination-check" type="checkbox" ${variant.selected ? "checked" : ""} ${variant.disabled ? "disabled" : ""} aria-label="Approve ${escapeHtml(variant.name)}">
            <span><strong>${escapeHtml(variant.name)}</strong><small>Target ${escapeHtml(variant.target)}</small></span>
          </label>
          <span class="count-badge"></span>
        </header>
        <div class="variant-body">
          <label>Draft<textarea class="variant-copy" rows="10">${escapeHtml(variant.copy)}</textarea></label>
          <div class="variant-meta">
            <div><span>Crop</span><strong>${escapeHtml(variant.crop)}</strong></div>
            <div><span>Hashtags</span><strong>${escapeHtml(variant.hashtags || "None")}</strong></div>
            <div><span>Alt text</span><strong>${escapeHtml(variant.alt)}</strong></div>
            <div><span>Tracked destination</span><strong>${escapeHtml(variant.utm || "Not assigned")}</strong></div>
            <div><span>Machine-readable check</span><strong>${escapeHtml(variant.codeGuidance)}</strong></div>
          </div>
        </div>
        <footer class="variant-footer"><p>${escapeHtml(variant.note)}</p><button class="copy-variant" type="button">Copy</button></footer>`;
      fragment.append(article);
    });
    grid.replaceChildren(fragment);
    $$(".variant-card", grid).forEach(updateVariantCard);
    $("#review-panel").hidden = false;
    $("#export-panel").hidden = false;
    updateSelectedCount();
  }

  function escapeHtml(value) {
    const div = document.createElement("div");
    div.textContent = String(value || "");
    return div.innerHTML;
  }

  function handleVariantInput(event) {
    const card = event.target.closest(".variant-card");
    if (!card) return;
    const variant = state.variants.find((item) => item.id === card.dataset.platform);
    if (!variant) return;
    if (event.target.matches(".variant-copy")) variant.copy = event.target.value;
    if (event.target.matches(".destination-check")) {
      variant.selected = event.target.checked;
      card.classList.toggle("is-selected", variant.selected);
    }
    updateVariantCard(card);
    updateSelectedCount();
  }

  async function handleVariantClick(event) {
    const button = event.target.closest(".copy-variant");
    if (!button) return;
    const card = button.closest(".variant-card");
    const variant = state.variants.find((item) => item.id === card.dataset.platform);
    if (!variant) return;
    await copyText(variant.copy);
    const original = button.textContent;
    button.textContent = "Copied";
    window.setTimeout(() => { button.textContent = original; }, 1300);
  }

  function updateVariantCard(card) {
    const variant = state.variants.find((item) => item.id === card.dataset.platform);
    if (!variant) return;
    const count = countText(variant.copy, variant.graphemes);
    const badge = $(".count-badge", card);
    badge.textContent = `${count} / ${variant.limit}`;
    badge.classList.toggle("over", count > variant.limit);
    badge.classList.toggle("warning", count <= variant.limit && count > variant.limit * 0.9);
  }

  function updateSelectedCount() {
    const count = state.variants.filter((variant) => variant.selected && !variant.disabled).length;
    $("#selected-count").textContent = String(count);
  }

  function captureDraft() {
    return {
      source: sourceText.value,
      sourceUrl: sourceUrl.value,
      destinationUrl: destinationUrl.value,
      imageUrl: imageUrl.value,
      altText: altText.value,
      objective: objective.value,
      voice: voice.value,
      contentWarning: contentWarning.value,
      campaign: campaign.value,
      savedAt: new Date().toISOString(),
    };
  }

  function saveDraft() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(captureDraft()));
      $("#save-state").textContent = "Saved on this device";
    } catch (_error) {
      $("#save-state").textContent = "Device storage unavailable";
    }
  }

  function restoreDraft() {
    try {
      const draft = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!draft) {
        $("#form-message").textContent = "No saved draft exists on this device.";
        return;
      }
      sourceText.value = draft.source || "";
      sourceUrl.value = draft.sourceUrl || "";
      destinationUrl.value = draft.destinationUrl || "";
      imageUrl.value = draft.imageUrl || "";
      altText.value = draft.altText || "";
      objective.value = draft.objective || "discussion";
      voice.value = draft.voice || "auto";
      contentWarning.value = draft.contentWarning || "";
      campaign.value = draft.campaign || "relaydaemon";
      updateSourceCount();
      updateImageUrlPreview();
      $("#form-message").textContent = `Restored the draft saved ${new Date(draft.savedAt).toLocaleString()}.`;
    } catch (_error) {
      $("#form-message").textContent = "The saved draft could not be read.";
    }
  }

  function clearDraft() {
    localStorage.removeItem(STORAGE_KEY);
    $("#save-state").textContent = "Not saved";
    $("#form-message").textContent = "Saved device draft cleared. Current form left intact.";
  }

  function updateSourceCount() {
    const count = countText(sourceText.value);
    $("#source-count").textContent = `${count.toLocaleString()} characters`;
    $("#source-count").style.color = count > MAX_SOURCE ? "var(--relay-danger)" : "";
  }

  function revokeObjectUrl() {
    if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
    state.objectUrl = null;
  }

  function renderMediaPreview(src, type, name, meta) {
    const frame = $("#preview-frame");
    frame.replaceChildren();
    const element = document.createElement(type.startsWith("video/") ? "video" : "img");
    element.src = src;
    if (element.tagName === "VIDEO") element.controls = true;
    else element.alt = "Local preview of attached source media";
    frame.append(element);
    $("#media-name").textContent = name;
    $("#media-meta").textContent = meta;
    $("#media-preview").hidden = false;
  }

  async function handleMediaFile() {
    revokeObjectUrl();
    const file = mediaFile.files[0];
    state.media = file || null;
    codeVerified.checked = false;
    if (!file) {
      updateImageUrlPreview();
      return;
    }
    state.objectUrl = URL.createObjectURL(file);
    renderMediaPreview(state.objectUrl, file.type, file.name, `${file.type || "Unknown type"} · ${formatBytes(file.size)}`);
    await inspectMediaForCodes(file);
  }

  async function updateImageUrlPreview() {
    if (state.media) return;
    const url = cleanUrl(imageUrl.value);
    if (!url) {
      $("#media-preview").hidden = true;
      state.codeScan = { status: "not-run", formats: [], detail: "No media has been inspected." };
      renderCodeScan();
      return;
    }
    renderMediaPreview(url, "image/remote", "Remote image", "Preview only · verify rights and final dimensions");
    codeVerified.checked = false;
    state.codeScan = { status: "scanning", formats: [], detail: "Fetching the remote image for local inspection." };
    renderCodeScan();
    try {
      const response = await fetch(url, { mode: "cors" });
      if (!response.ok) throw new Error("Image request failed");
      const blob = await response.blob();
      await inspectMediaForCodes(blob);
    } catch (_error) {
      state.codeScan = { status: "inconclusive", formats: [], detail: "The remote host did not permit local inspection. Inspect the final asset manually." };
      renderCodeScan();
    }
  }

  async function inspectMediaForCodes(source) {
    if (String(source.type || "").startsWith("video/")) {
      state.codeScan = { status: "inconclusive", formats: [], detail: "Video frames are not scanned in this MVP. Inspect the final cut manually." };
      renderCodeScan();
      return;
    }
    state.codeScan = { status: "scanning", formats: [], detail: "Checking QR codes and common one- and two-dimensional barcode formats on this device." };
    renderCodeScan();
    if (!("BarcodeDetector" in window) || typeof createImageBitmap !== "function") {
      state.codeScan = { status: "unavailable", formats: [], detail: "This browser cannot inspect machine-readable codes automatically. Manual confirmation is required." };
      renderCodeScan();
      return;
    }
    try {
      const requested = ["qr_code", "aztec", "code_128", "code_39", "code_93", "codabar", "data_matrix", "ean_13", "ean_8", "itf", "pdf417", "upc_a", "upc_e"];
      const supported = typeof BarcodeDetector.getSupportedFormats === "function"
        ? await BarcodeDetector.getSupportedFormats()
        : requested;
      const formats = requested.filter((format) => supported.includes(format));
      if (!formats.length) throw new Error("No supported code formats");
      const bitmap = await createImageBitmap(source);
      const detections = await new BarcodeDetector({ formats }).detect(bitmap);
      bitmap.close();
      const foundFormats = [...new Set(detections.map((item) => item.format || "unknown"))];
      state.codeScan = detections.length
        ? { status: "detected", formats: foundFormats, detail: `${detections.length} machine-readable code${detections.length === 1 ? "" : "s"} detected. Confirm the final rendered asset scans before export.` }
        : { status: "clear", formats: [], detail: `No code was detected across ${formats.length} supported formats. Continue visual review; detection is not a guarantee.` };
    } catch (_error) {
      state.codeScan = { status: "inconclusive", formats: [], detail: "The attached image could not be conclusively inspected. Manual confirmation is required." };
    }
    renderCodeScan();
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function generate() {
    const text = normalizeWhitespace(sourceText.value);
    if (!text) {
      $("#form-message").textContent = "Relay requires an original post or draft.";
      sourceText.focus();
      return;
    }
    if (countText(text) > MAX_SOURCE) {
      $("#form-message").textContent = `Source exceeds the ${MAX_SOURCE.toLocaleString()} character MVP limit.`;
      return;
    }
    saveDraft();
    state.analysis = analyze(text);
    state.variants = makeVariants(text, state.analysis);
    renderAnalysis();
    renderVariants();
    $("#form-message").textContent = `${state.variants.length} destination drafts generated. Review and edit before export.`;
    $("#analysis-panel").scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
  }

  function packageData() {
    const selected = state.variants.filter((variant) => variant.selected && !variant.disabled);
    return {
      relayVersion: "1.0.0-mvp",
      generatedAt: new Date().toISOString(),
      publicationStatus: "draft",
      original: {
        text: normalizeWhitespace(sourceText.value),
        sourceUrl: cleanUrl(sourceUrl.value) || null,
        destinationUrl: cleanUrl(destinationUrl.value) || null,
        mediaName: state.media ? state.media.name : null,
        imageUrl: cleanUrl(imageUrl.value) || null,
      },
      interpretation: {
        contentClass: state.analysis.contentClass.value,
        realityLayer: state.analysis.layer.value,
        voice: state.analysis.voice.value,
        objective: objective.value,
        cta: state.analysis.cta,
        approvalFlags: state.analysis.flags.approval,
        canonFlags: state.analysis.flags.canon,
        machineReadableCodeScan: state.codeScan.status,
        detectedCodeFormats: state.codeScan.formats,
        possibleMachineReadableCode: state.analysis.possibleCode || state.codeScan.status === "detected",
        machineReadableCodeVerified: (state.analysis.possibleCode || ["detected", "unavailable", "inconclusive"].includes(state.codeScan.status)) ? codeVerified.checked : null,
      },
      machineReadableRemediation: {
        qrDetectedOrInferred: state.analysis.codeKinds.qr,
        barcodeDetectedOrInferred: state.analysis.codeKinds.barcode,
        qrReplacementEligible: state.analysis.codeKinds.qr && Boolean(cleanUrl(destinationUrl.value) || cleanUrl(sourceUrl.value)),
        qrGenerator: state.analysis.codeKinds.qr ? "scripts/generate-veilcorp-qr.mjs" : null,
        qrDestination: state.analysis.codeKinds.qr ? (cleanUrl(destinationUrl.value) || cleanUrl(sourceUrl.value) || null) : null,
        barcodeRequiresManualReview: state.analysis.codeKinds.barcode,
        guidance: codeRemediation(state.analysis),
      },
      media: {
        altText: state.analysis.alt,
        contentWarning: contentWarning.value.trim() || null,
      },
      approvedVariants: selected.map((variant) => ({
        platform: variant.name,
        copy: variant.copy,
        characterCount: countText(variant.copy, variant.graphemes),
        characterLimit: variant.limit,
        crop: variant.crop,
        altText: variant.alt,
        hashtags: variant.hashtags ? variant.hashtags.split(/\s+/) : [],
        trackedDestination: variant.utm || null,
        status: "approved-for-copy",
      })),
    };
  }

  function packageMarkdown(data) {
    const lines = [
      "# RelayDaemon social package",
      "",
      `Generated: ${data.generatedAt}`,
      `Status: ${data.publicationStatus}`,
      "",
      "## Preserved source",
      "",
      data.original.text,
      "",
      `Source URL: ${data.original.sourceUrl || "Not assigned"}`,
      `Primary destination: ${data.original.destinationUrl || "Not assigned"}`,
      "",
      "## Interpretation",
      "",
      `- Content class: ${data.interpretation.contentClass}`,
      `- Reality layer: ${data.interpretation.realityLayer}`,
      `- Voice: ${data.interpretation.voice}`,
      `- Objective: ${data.interpretation.objective}`,
      `- CTA: ${data.interpretation.cta}`,
      `- Code scan verified: ${data.interpretation.machineReadableCodeVerified === null ? "Not applicable" : data.interpretation.machineReadableCodeVerified ? "Yes" : "No"}`,
      "",
      "### Approval flags",
      "",
      ...data.interpretation.approvalFlags.map((flag) => `- ${flag}`),
      "",
      "### Canon and disclosure checks",
      "",
      ...data.interpretation.canonFlags.map((flag) => `- ${flag}`),
      "",
      "### Machine-readable remediation",
      "",
      `- Guidance: ${data.machineReadableRemediation.guidance}`,
      `- QR replacement eligible: ${data.machineReadableRemediation.qrReplacementEligible ? "Yes" : "No"}`,
      `- QR generator: ${data.machineReadableRemediation.qrGenerator || "Not applicable"}`,
      `- Barcode manual review: ${data.machineReadableRemediation.barcodeRequiresManualReview ? "Required" : "Not indicated"}`,
      "",
    ];
    data.approvedVariants.forEach((variant) => {
      lines.push(
        `## ${variant.platform}`,
        "",
        variant.copy,
        "",
        `- Count: ${variant.characterCount} / ${variant.characterLimit}`,
        `- Crop: ${variant.crop}`,
        `- Alt text: ${variant.altText}`,
        `- Hashtags: ${variant.hashtags.join(" ") || "None"}`,
        `- Tracked destination: ${variant.trackedDestination || "Not assigned"}`,
        ""
      );
    });
    return lines.join("\n");
  }

  async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.append(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }

  function download(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function canExport() {
    if (!state.analysis) return false;
    if (state.codeScan.status === "scanning") {
      $("#export-message").textContent = "Machine-readable code inspection is still running.";
      return false;
    }
    const codeConfirmationRequired = state.analysis.possibleCode || ["detected", "unavailable", "inconclusive"].includes(state.codeScan.status);
    if (codeConfirmationRequired && !codeVerified.checked) {
      $("#export-message").textContent = "Complete the manual QR/barcode scan confirmation before releasing this package.";
      $("#code-confirmation").scrollIntoView({ behavior: "smooth", block: "center" });
      return false;
    }
    if (!state.variants.some((variant) => variant.selected && !variant.disabled)) {
      $("#export-message").textContent = "Select at least one destination before export.";
      return false;
    }
    return true;
  }

  function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  form.addEventListener("submit", (event) => { event.preventDefault(); generate(); });
  $("#variant-grid").addEventListener("input", handleVariantInput);
  $("#variant-grid").addEventListener("click", handleVariantClick);
  $("#regenerate").addEventListener("click", generate);
  sourceText.addEventListener("input", updateSourceCount);
  mediaFile.addEventListener("change", handleMediaFile);
  imageUrl.addEventListener("change", updateImageUrlPreview);
  $("#restore-draft").addEventListener("click", restoreDraft);
  $("#clear-draft").addEventListener("click", clearDraft);
  $("#select-all").addEventListener("click", () => {
    state.variants.forEach((variant) => { if (!variant.disabled) variant.selected = true; });
    renderVariants();
  });
  $("#select-none").addEventListener("click", () => {
    state.variants.forEach((variant) => { variant.selected = false; });
    renderVariants();
  });
  $("#copy-package").addEventListener("click", async () => {
    if (!canExport()) return;
    await copyText(packageMarkdown(packageData()));
    $("#export-message").textContent = "Approved package copied.";
  });
  $("#download-markdown").addEventListener("click", () => {
    if (!canExport()) return;
    download("relaydaemon-package.md", packageMarkdown(packageData()), "text/markdown;charset=utf-8");
    $("#export-message").textContent = "Markdown package downloaded.";
  });
  $("#download-json").addEventListener("click", () => {
    if (!canExport()) return;
    download("relaydaemon-package.json", `${JSON.stringify(packageData(), null, 2)}\n`, "application/json;charset=utf-8");
    $("#export-message").textContent = "JSON package downloaded.";
  });
  window.addEventListener("beforeunload", revokeObjectUrl);

  updateSourceCount();
  if (localStorage.getItem(STORAGE_KEY)) $("#save-state").textContent = "Saved draft available";
})();
