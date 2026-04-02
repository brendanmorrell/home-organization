# TODOS

## P1 — High Priority

### Phase 2: Cron jobs for auto-refresh reference data
- **What:** Scheduled jobs that scrape credit card portals and airline sites to auto-update reference card data (remaining credits, points balances, expiring perks)
- **Why:** Eliminates manual data entry for the most valuable reference cards. Makes briefs show live data.
- **Effort:** L (human) -> M (CC+gstack)
- **Depends on:** Phase 1 reference cards + briefs working
- **Context:** Phase 2 of the three-phase plan. The architecture (references table, tags, briefs) supports this. Scraping is fragile (sites change layouts). May need browser automation (Playwright). Auth complexity (logging into bank sites). Consider starting with one card provider as proof of concept.

## P2 — Medium Priority

### Context badges on home screen
- **What:** Small badges showing "3 travel perks expiring" or "Grocery: 5 items" on the home screen, linking to briefs
- **Why:** Turns the home screen from static to a living dashboard
- **Effort:** S-M (human) -> S (CC+gstack)
- **Depends on:** Phase 2 cron jobs for data freshness
- **Context:** Deferred from CEO expansion ceremony because badges with stale manual data aren't helpful. Requires Phase 2 auto-refresh data to be useful.

## P3 — Low Priority / Stretch

### Phase 3: Proactive suggestions
- **What:** Calendar-triggered briefs, push notifications before trips, auto-generated weekend plans from todo list
- **Why:** The "smart life OS" dream. System surfaces info before you ask for it.
- **Effort:** XL (human) -> L (CC+gstack)
- **Depends on:** Phase 2 cron data freshness
- **Context:** User is less confident this will be useful. Validate Phase 2 first.
