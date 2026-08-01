/**
 * Pressure Round action economy: Main Action / Move / Frequency Use / Reaction
 * per Operator per round. Rides the Cell Sync bus's existing deliberate-boundary
 * contract (cell-sync.js) rather than inventing a fourth "round" concept —
 * Handler's session.pressureRound is ground truth, budgets reset when Handler
 * ends a Pressure Round, an Operator's spend rides their next Send to Cell.
 */
(function () {
  const SLOTS = ["main", "move", "frequency", "reaction"];

  function emptyBudget() {
    return { main: true, move: true, frequency: true, reaction: true };
  }

  function safeKey(value) {
    return String(value == null ? "" : value).trim().slice(0, 120);
  }

  /** Fresh budgets for every known seat, stamped to the round that just started. */
  function resetBudgetsForRound(round, seatKeys) {
    const budgets = {};
    (Array.isArray(seatKeys) ? seatKeys : []).forEach((key) => {
      const operatorKey = safeKey(key);
      if (operatorKey) budgets[operatorKey] = emptyBudget();
    });
    return { round: Math.max(0, Number(round) || 0), budgets };
  }

  /** Sets one slot's spent/available state for one seat directly (absolute, not
   *  append-only -- calling this again with the opposite value fully undoes it).
   *  Never throws on an unknown slot/seat. */
  function setSlotSpent(economy, operatorKey, slot, spent) {
    if (!SLOTS.includes(slot)) return economy;
    const key = safeKey(operatorKey);
    if (!key) return economy;
    const budgets = { ...(economy?.budgets || {}) };
    const current = budgets[key] || emptyBudget();
    budgets[key] = { ...current, [slot]: !spent };
    return { round: Number(economy?.round) || 0, budgets };
  }

  /** Returns a new snapshot with one slot marked spent for one seat. */
  function spendSlot(economy, operatorKey, slot) {
    return setSlotSpent(economy, operatorKey, slot, true);
  }

  /** Returns a new snapshot with one slot restored to available for one seat
   *  -- undoes a spend, e.g. after a mistaken click or a revised declaration. */
  function restoreSlot(economy, operatorKey, slot) {
    return setSlotSpent(economy, operatorKey, slot, false);
  }

  /** Resets one seat's action-economy slots to fully available without
   *  advancing the round or touching any other seat's budget. */
  function resetSeatBudget(economy, operatorKey) {
    const key = safeKey(operatorKey);
    if (!key) return economy;
    const budgets = { ...(economy?.budgets || {}) };
    budgets[key] = emptyBudget();
    return { round: Number(economy?.round) || 0, budgets };
  }

  /** Unknown seat = fresh round for them (nothing spent yet), not blocked. */
  function isSlotAvailable(economy, operatorKey, slot) {
    if (!SLOTS.includes(slot)) return true;
    const key = safeKey(operatorKey);
    const budget = economy?.budgets?.[key];
    if (!budget) return true;
    return budget[slot] !== false;
  }

  function budgetFor(economy, operatorKey) {
    const key = safeKey(operatorKey);
    return (economy?.budgets && economy.budgets[key]) || emptyBudget();
  }

  window.VeilDaemonPressureRoundEconomy = {
    SLOTS,
    emptyBudget,
    resetBudgetsForRound,
    setSlotSpent,
    spendSlot,
    restoreSlot,
    resetSeatBudget,
    isSlotAvailable,
    budgetFor
  };
}());
