(() => {
  const library = document.querySelector("[data-rights-library]");
  if (!library) return;

  const input = library.querySelector("[data-rights-search]");
  const summary = library.querySelector("[data-rights-summary]");
  const cards = Array.from(library.querySelectorAll("[data-rights-card]"));
  if (!input || !summary || cards.length === 0) return;

  const index = cards.map((card) => ({
    card,
    text: card.textContent.toLowerCase().replace(/\s+/g, " ").trim(),
  }));

  function updateSummary(visible, query) {
    if (!query) {
      summary.textContent = `Showing all ${cards.length} records.`;
      return;
    }
    summary.textContent = `${visible} of ${cards.length} records match "${query}".`;
  }

  function applyFilter() {
    const query = input.value.toLowerCase().replace(/\s+/g, " ").trim();
    let visible = 0;

    for (const item of index) {
      const match = !query || item.text.includes(query);
      item.card.hidden = !match;
      if (match) visible += 1;
    }

    updateSummary(visible, query);
  }

  input.addEventListener("input", applyFilter);
  applyFilter();
})();
