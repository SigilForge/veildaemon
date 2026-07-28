(() => {
  const library = document.querySelector("[data-rights-library]");
  if (!library) return;

  const input = library.querySelector("[data-rights-search]");
  const summary = library.querySelector("[data-rights-summary]");
  const facetFilters = Array.from(library.querySelectorAll("[data-rights-filter]"));
  const permissionFilter = library.querySelector("[data-rights-permission-filter]");
  const cards = Array.from(library.querySelectorAll("[data-rights-card]"));
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

  async function loadStructuredIndex() {
    const response = await fetch("/registry/records.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`Registry index request failed: ${response.status}`);
    const registry = await response.json();
    const records = new Map((registry.records || []).map((record) => [record.slug, record]));
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
