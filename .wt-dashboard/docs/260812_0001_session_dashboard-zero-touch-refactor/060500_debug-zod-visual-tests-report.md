# Debug Task Report: Fix `z is not defined` in dashboard visual tests

## Task Summary
Three Playwright CT dashboard visual tests (`DashboardSummary`, `DashboardView`, `UsageHeatmap`) failed with `ReferenceError: z is not defined` at `ExtensionStateContext-*.js:5361`. Diagnose the root cause and fix it so all 11 visual tests pass.

## Root Cause Analysis (two distinct bugs)

### Bug 1 — Zod pulled into the browser bundle
- `DashboardView.visual.fixture.tsx` imported `ExtensionStateContextProvider` from `@/context/ExtensionStateContext`.
- The real `ExtensionStateContext` module imports `@roo-code/types`, which bundles Zod. Zod is not browser-compatible under Playwright CT and crashes the whole bundle with `ReferenceError: z is not defined`, aborting mount for all three tests.

### Bug 2 — Playwright CT dual-module-instantiation (the "empty label" bug)
- After severing the Zod chain, `DashboardSummary`/`UsageHeatmap` still failed: components mounted but every translated label rendered **empty**.
- Probe evidence: `t("dashboard:summary.totalTokens")` resolved to `"Total Tokens"` in the test module, yet the rendered `<span>` was empty. This is the dual-context hazard already documented in `DashboardView.visual.fixture.tsx`: defining translation helpers in the SAME file that also imports the component under test makes the Playwright CT Vite pipeline instantiate `@/i18n/TranslationContext` twice. The component then reads a different `TranslationContext` instance than the provider supplies.
- The working tests (`TaskList`, `DashboardView`) avoid this by keeping provider wiring inside a dedicated fixture file that shares the component's module graph.

### Bug 3 — Missing `TooltipProvider`
- Once the components rendered, `StandardTooltip` (used by `DashboardSummary` cards and `UsageHeatmap` day cells) threw `` `Tooltip` must be used within `TooltipProvider` ``. The Zod crash had masked this.

### Bug 4 — Assertion casing mismatch
- `DashboardSummary.visual.tsx` asserted `"Total tokens"` etc., but `en/dashboard.json` defines `"Total Tokens"` (title case). Assertions corrected to the locale source of truth.

## Actions Taken
1. Added `webview-ui/playwright/ExtensionStateContext.mock.tsx` — a browser-safe, Zod-free mock exporting `ExtensionStateContextProvider`, `useExtensionState`, and `mergeExtensionState`. Setters are supplied via a `Proxy` no-op so any `setX` destructure works.
2. `playwright-ct.config.ts`: added exact-match (regex) aliases redirecting `@/context/ExtensionStateContext` and `@src/context/ExtensionStateContext` to the mock; converted the alias block to array form so exact entries win over the `@`/`@src` prefixes.
3. Created `DashboardSummary.visual.fixture.tsx` and `UsageHeatmap.visual.fixture.tsx` exporting ONLY the mounted component (the proven single-context pattern), each wrapping with both translation providers and `TooltipProvider`.
4. Slimmed `DashboardSummary.visual.tsx` and `UsageHeatmap.visual.tsx` to mount the fixture and assert.
5. Added `TooltipProvider` to `DashboardView.visual.fixture.tsx`.
6. Fixed label assertions in `DashboardSummary.visual.tsx` to match `en/dashboard.json` casing.

## Result
- `npx playwright test -c playwright-ct.config.ts --update-snapshots` → **11 passed, 0 failed** (previously 3 failed / 8 passed).
- `eslint --prune-suppressions --max-warnings=0` on all touched files → clean, no suppression-count increase.
- Regenerated only the dashboard screenshots; unrelated settings screenshots were reverted to avoid cross-platform churn.

## Issues Discovered
- Playwright CT's `ctViteConfig.resolve.alias` and custom `plugins` are NOT reliably honored for the component bundle (a `buildStart` throwing plugin never fired, and identical content-hash `ExtensionStateContext-D6UJ3TYb.js` persisted across config edits). The reliable lever is editing the test/fixture source so the offending module is never imported — hence the fixture pattern is the robust fix, with the alias as defense-in-depth for `DashboardView`'s direct provider import.

## Test Environment Notes
- No test-env infrastructure faults required fixing. (Caches cleared during diagnosis: `playwright-transform-cache`, `node_modules/.cache`.)

## Next Step Recommendations
- Commit the fix together with the user's concurrent `UsageStatsStreamCoordinator.ts` snapshot-fallback fix (49/49 unit tests passing), per user instruction.
- Consider documenting the "fixture-only component export" rule in `webview-ui/AGENTS.md` so future visual tests avoid the dual-context trap.

## Affected File List
- `webview-ui/playwright-ct.config.ts` (modified)
- `webview-ui/playwright/ExtensionStateContext.mock.tsx` (new)
- `webview-ui/src/components/dashboard/__tests__/DashboardSummary.visual.tsx` (modified)
- `webview-ui/src/components/dashboard/__tests__/DashboardSummary.visual.fixture.tsx` (new)
- `webview-ui/src/components/dashboard/__tests__/UsageHeatmap.visual.tsx` (modified)
- `webview-ui/src/components/dashboard/__tests__/UsageHeatmap.visual.fixture.tsx` (new)
- `webview-ui/src/components/dashboard/__tests__/DashboardView.visual.fixture.tsx` (modified)
- `webview-ui/src/components/dashboard/__tests__/__screenshots__/{dashboard-summary,dashboard-view,usage-heatmap}-dark.png` (regenerated)
- `src/services/stats/UsageStatsStreamCoordinator.ts` (user's concurrent fix, included per instruction)
