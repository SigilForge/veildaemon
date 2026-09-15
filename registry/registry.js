(() => {
  const library = document.querySelector("[data-rights-library]");
  if (!library) return;

  const input = library.querySelector("[data-rights-search]");
  const summary = library.querySelector("[data-rights-summary]");
  const facetFilters = Array.from(library.querySelectorAll("[data-rights-filter]"));
  const permissionFilter = library.querySelector("[data-rights-permission-filter]");
  const grid = library.querySelector(".rights-record-grid");
  let cards = Array.from(library.querySelectorAll("[data-rights-card]"));
  if (!input || !summary || cards.length === 0) return;

  let index = buildFallbackIndex();

  function normalize(value) {
    return String(value || "").toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  }

  function flatten(value) {
    if (Array.isArray(value)) return value.flatMap(flatten);
    if (value && typeof value === "object") return Object.values(value).flatMap(flatten);
    return value == null ? [] : [String(value)];
  }

  function termsForRecord(record) {
    return [
      record.slug,
      record.recordId,
      record.title,
      record.status,
      ...flatten(record.work),
      ...flatten(record.publisher),
      ...flatten(record.permissions),
      ...flatten(record.licensing),
      ...flatten(record.verification),
      ...flatten(record.technicalArtifacts),
    ];
  }

  function valueAt(record, path) {
    return path.split(".").reduce((value, key) => value?.[key], record);
  }

  function titleCase(value) {
    return String(value || "")
      .replace(/[_-]+/g, " ")
      .replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
  }

  function safePathOrUrl(value, fallback) {
    const text = String(value || "");
    if (/^https:\/\//i.test(text) || text.startsWith("/")) return text;
    return fallback;
  }

  function statusClass(record) {
    if (record.status === "published" || record.status === "updated") return "shipping";
    if (record.status === "withdrawn" || record.status === "archived") return "planning";
    if (record.availability === "scheduled") return "future";
    return "live";
  }

  function displayAvailability(record) {
    return titleCase(record.availability || record.licensing?.availability || "recorded");
  }

  function externalLinkAttributes(link) {
    if (/^https:\/\//i.test(link.href) && !link.href.startsWith(`${window.location.origin}/`)) {
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    }
  }

  function createCard(record) {
    const card = document.createElement("article");
    card.dataset.rightsCard = "";
    card.dataset.rightsSlug = record.slug;

    const title = document.createElement("h3");
    title.textContent = record.title || "Untitled record";

    const status = document.createElement("p");
    const pill = document.createElement("span");
    pill.className = `status-pill ${statusClass(record)}`;
    pill.textContent = `${titleCase(record.status || "published")} · ${displayAvailability(record)}`;
    status.append(pill);

    const type = document.createElement("p");
    type.className = "muted";
    type.textContent = `${titleCase(record.work?.type || "other")} · ${titleCase(record.work?.category || "other")}`;

    const description = document.createElement("p");
    description.textContent = record.description || record.permissionsSummary || "Published Creator Rights Record.";

    const links = document.createElement("p");
    const recordLink = document.createElement("a");
    recordLink.href = safePathOrUrl(record.publicRecordUrl, `/rights/${record.slug}/`);
    recordLink.textContent = "View record";
    externalLinkAttributes(recordLink);

    const jsonLink = document.createElement("a");
    jsonLink.href = safePathOrUrl(record.jsonUrl, `/rights/${record.slug}.json`);
    jsonLink.textContent = "JSON metadata";
    externalLinkAttributes(jsonLink);

    links.append(recordLink, " · ", jsonLink);
    card.append(title, status, type, description, links);
    return card;
  }

  function buildFallbackIndex() {
    return cards.map((card) => ({
      card,
      record: null,
      text: normalize(card.textContent),
    }));
  }

  function activeFilterCount() {
    return [
      ...facetFilters.map((filter) => filter.value),
      permissionFilter?.value,
    ].filter(Boolean).length;
  }

  function updateSummary(visible, query, filters) {
    if (!query && filters === 0) {
      summary.textContent = `Showing all ${cards.length} records.`;
      return;
    }
    const parts = [];
    if (query) parts.push(`"${query}"`);
    if (filters > 0) parts.push(`${filters} filter${filters === 1 ? "" : "s"}`);
    summary.textContent = `${visible} of ${cards.length} records match ${parts.join(" and ")}.`;
  }

  function matchesFacets(item) {
    const { record } = item;
    for (const filter of facetFilters) {
      if (!filter.value) continue;
      if (!record || valueAt(record, filter.dataset.rightsFilter) !== filter.value) return false;
    }

    const permissionValue = permissionFilter?.value;
    if (permissionValue) {
      if (!record) return false;
      const [permission, value] = permissionValue.split(":");
      if (record.permissions?.[permission] !== value) return false;
    }

    return true;
  }

  function applyFilter() {
    const query = normalize(input.value);
    const filters = activeFilterCount();
    let visible = 0;

    for (const item of index) {
      const match = (!query || item.text.includes(query)) && matchesFacets(item);
      item.card.hidden = !match;
      if (match) visible += 1;
    }

    updateSummary(visible, query, filters);
  }

  function mergeCards(records) {
    if (!grid) return;
    const existing = new Set(cards.map((card) => card.dataset.rightsSlug));
    for (const record of records) {
      if (!record?.slug || existing.has(record.slug)) continue;
      const card = createCard(record);
      grid.append(card);
      cards.push(card);
      existing.add(record.slug);
    }
  }

  function registryApiUrl() {
    if (window.__CREATOR_RIGHTS_LIVE_REGISTRY_URL__) return window.__CREATOR_RIGHTS_LIVE_REGISTRY_URL__;
    if (library.dataset.rightsLiveRegistry) return library.dataset.rightsLiveRegistry;
    if (/^(localhost|127\.0\.0\.1)$/.test(window.location.hostname)) return "";
    return "https://api.veildaemon.app/api/creator-rights/registry";
  }

  async function fetchRegistry(url) {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`Registry index request failed: ${response.status}`);
    return response.json();
  }

  async function loadStructuredIndex() {
    const registries = [await fetchRegistry("/registry/records.json")];
    const liveUrl = registryApiUrl();
    if (liveUrl) {
      try {
        registries.push(await fetchRegistry(liveUrl));
      } catch {
        summary.dataset.rightsLiveStatus = "unavailable";
      }
    }

    const allRecords = registries.flatMap((registry) => registry.records || []);
    mergeCards(allRecords);
    const records = new Map();
    for (const record of allRecords) {
      if (record?.slug && !records.has(record.slug)) records.set(record.slug, record);
    }
    index = cards.map((card) => {
      const record = records.get(card.dataset.rightsSlug);
      const terms = record ? termsForRecord(record) : [card.textContent];
      return {
        card,
        record: record || null,
        text: normalize(terms.join(" ")),
      };
    });
    applyFilter();
  }

  input.addEventListener("input", applyFilter);
  for (const filter of facetFilters) filter.addEventListener("change", applyFilter);
  permissionFilter?.addEventListener("change", applyFilter);
  applyFilter();
  loadStructuredIndex().catch(() => {
    index = buildFallbackIndex();
    applyFilter();
  });
})();
