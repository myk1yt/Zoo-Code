# Debug Task Report — Wave 3 B07 / B09 / B13 Branch Bring-up

## Task Summary
Create missing Wave 3 branches B07 (`pr/b07-shell-integration`) and B09 (`pr/b09-task-org-ipc`), verify and push the existing B13 (`pr/b13-usage-store`) branch, and ensure `pnpm lint`, `pnpm check-types`, `pnpm knip`, and `node scripts/find-missing-translations.js` are clean for B13/B07 additions on each branch.

## Actions Taken

### B13 — `pr/b13-usage-store` (commits `1d120aca7`, `cfff5e0e5`)
1. Initial state: branch was even with `upstream/main` but had 22 staged + 1 unstaged file implementing the usage-stats service.
2. Committed the WIP as `feat(stats): add B13 usage stats service and IPC wiring`.
3. `pnpm lint` → 8 errors in `packages/types/src/__tests__/usage-stats.spec.ts` and `packages/types/src/vscode-extension-host.ts`. Fixes:
   - Dropped unused `z` zod import and unused `UsageEventV1` type import.
   - Replaced 6 `as any` casts with `as string` / `as string[]` (test inputs for zod enum schemas).
4. `pnpm lint` again → 2 syntax + 2 `no-explicit-any` errors in `src/services/stats/`:
   - Two stray trailing commas after `.sort()` chains inside `try` blocks in `UsageEventStore.ts` (lines 167 and 311) producing `Expression expected` parse errors.
   - `Record<string, any>` in `UsageStatsService.spec.ts` `makeEvent()` replaced with `Record<string, unknown>`.
5. `pnpm check-types` → cascading TS errors in `UsageEventStore.ts`, `UsageStatsService.ts`, `UsageAggregator.ts`, `UsageStatsService.spec.ts`, `UsageAggregator.spec.ts`, `packages/types/.../usage-stats.spec.ts`:
   - `packages/types` nodenext test import needed `.js` extension.
   - `import type { UsageEventV1 }` → value-import (used as `.safeParse()` callee).
   - `StatsStoreError` `cause` parameter property collided with `Error#cause`; renamed param to `causeParam` and assigned via type cast.
   - Uninitialized `const pending` resolver pattern rewritten with `let pendingResolve` placeholder.
   - `NodeJS.ErrnoException instanceof` check (TS2708) replaced with `(err as NodeJS.ErrnoException | undefined)?.code` narrowing.
   - `UsageStatsManifest` readonly fields mutated in place; converted to immutable spread + `writeManifest` re-issue.
   - `fs.FileHandle.write(line, { position, flush })` overload mismatch resolved with 3-arg `(string, position, encoding)` form.
   - `UsageStatsService` had both `import type { UsageEventV1 }` and `import { UsageEventV1 }` → deduplicated; fixed `UsageEventV1Schema` reference to `UsageEventV1`.
   - `record`/`recordBatch`/`query` signatures relaxed to `z.input<typeof Schema>` so callers can omit `idempotencyKey` and defaulted `includeCancelled`; parse internally.
   - `UsageAggregator.query`/`aggregateEvents` given the same `z.input` treatment so test calls without `includeCancelled` pass.
   - `UsageAggregator` firstEventAt/lastEventAt `?.getTime()` on possibly-undefined narrowed via temp variables.
   - `makeEvent()` rewritten with `Parameters<UsageStatsService["record"]>[0]` typed base + `Partial<>` overrides.
   - Invalid-event test cast `schemaVersion: 999 as 1`.
6. `pnpm knip` → flagged `src/services/stats/index.ts` as unused (no production caller). Deleted the barrel (sent to Recycle Bin) rather than suppress; consumers can import the concrete modules directly.
7. `node scripts/find-missing-translations.js` clean.
8. Final `pnpm lint`, `pnpm check-types` clean. Committed as `fix(stats): resolve B13 lint, check-types, and knip CI failures`. Pushed `myk1yt pr/b13-usage-store` (new branch on remote).

### B07 — `pr/b07-shell-integration` (commit `4d4f0a…`)
1. Branched from `upstream/main` (`488732ed4`).
2. Cherry-picked 32 files from `myk1yt/feature/unified-shell-resolution` covering:
   - `src/integrations/terminal/**` (CommandScheduler, CommandTrace, ShellResolver, ShellInvocationAdapter, TerminalProfileResolver, TerminalLifecycle, CommandEnvironmentService, types, updated BaseTerminal/ExecaTerminal/Terminal*/TerminalRegistry).
   - `src/core/task/Task.ts`, `Task.ts` test, `build-tools.ts`.
   - `src/core/tools/ExecuteCommandTool.ts` and tests.
3. Two stale local files (`src/core/task/TaskRegistry.ts`, `TaskRegistry.spec.ts`) had been zeroed earlier by an accidental redirect; restored from `upstream/main` (the source branch had already migrated away from TaskRegistry).
4. `pnpm lint` → 210 `@typescript-eslint/no-explicit-any` errors (the source branch had disabled the rule). Did NOT disable the rule on this branch; instead regenerated `src/eslint-suppressions.json` via Python (after a PowerShell `ConvertTo-Json` round-trip corrupted the file — see Test Environment Issues) so each new test file is individually suppressed with an accurate count.
5. `pnpm check-types` → missing port surface:
   - `packages/types/src/terminal.ts` (queued/recovering/reasonCode/code on `CommandExecutionStatus`).
   - `packages/types/src/global-settings.ts` (`TerminalShellSelection` schema).
   - `packages/types/src/vscode-extension-host.ts` (terminalShellSelection ExtensionState + setTerminalShellSelection WebviewMessage).
   - `packages/types/src/__tests__/terminal-shell-settings.spec.ts`.
   - `src/utils/shell.ts` + spec (classifyShellFamily, isShellPathAllowed).
   - `src/core/prompts/tools/native-tools/index.ts` and `execute_command.ts` (env-aware tool description, NativeToolsOptions.resolvedEnv).
6. The source branch's `ClineProvider` had been refactored back to `clineStack: Task[]` (removing TaskRegistry), which conflicted with tests on `upstream/main` that still reference `taskRegistry`. Resolved by:
   - Reverting `src/core/webview/ClineProvider.ts` and `webviewMessageHandler.ts` to `upstream/main`.
   - Manually adding only the `getCommandEnvironmentService()` accessor (lazy `TerminalProfileResolver.forRuntime` + `ShellResolver.forRuntime` + `CommandEnvironmentService`) and the `commandEnvironmentService` private field, plus the three new shell imports.
7. Final CI green. Committed as `feat(terminal): unified shell resolution and command environment service (B07)`. Pushed `myk1yt pr/b07-shell-integration`.

### B09 — `pr/b09-task-org-ipc` (commit `01eb456b6`)
1. VP supplied "build from spec (task-org message types, handler, provider state)". No prior source branch exists.
2. Branch rebased onto `myk1yt/pr/b08-task-persistence` (which already provided `packages/types/src/task-organization.ts` and `src/core/task-persistence/TaskOrganizationStore.ts`) — B09 is the IPC layer on top of B08, so building on B08 avoids duplicated work and keeps the type/store contract canonical.
3. Designed and added the IPC surface:
   - `packages/types/src/vscode-extension-host.ts`:
     - Imports `TaskOrganizationMutationRequestV1`, `TaskOrganizationMutationResultV1`, `TaskOrganizationStateV1` from `./task-organization.js`.
     - `ExtensionMessage.type` += `taskOrganizationSnapshot`, `taskOrganizationMutationResult`. Fields `taskOrganizationSnapshot?: TaskOrganizationStateV1`, `taskOrganizationMutationResult?: TaskOrganizationMutationResultV1` added to `ExtensionMessage`.
     - `ExtensionState.taskOrganizationSnapshot?: TaskOrganizationStateV1` for first-load hydration.
     - `WebviewMessage.type` += `requestTaskOrganizationSnapshot`, `taskOrganizationMutate`, `taskOrganizationReconcile`. Field `taskOrganizationMutationRequest?: TaskOrganizationMutationRequestV1` added to `WebviewMessage`.
4. Provider wiring in `src/core/webview/ClineProvider.ts`:
   - Imported `TaskOrganizationStore` from `../task-persistence`.
   - Added `private taskOrganizationStore?` + `private taskOrganizationStoreInitPromise?`.
   - Added public `getTaskOrganizationStore()` — lazy singleton that constructs the store bound to `contextProxy.globalStorageUri.fsPath` with an `onChange` that calls `postStateToWebview()` so the webview stays in sync without polling.
   - Embedded `taskOrganizationSnapshot: this.taskOrganizationStore?.getState()` into `getStateToPostToWebview()` return.
5. Handler cases in `src/core/webview/webviewMessageHandler.ts` (inserted after `requestOpenAiCodexRateLimits`):
   - `requestTaskOrganizationSnapshot` — fetches store, awaits `waitForInitialized`, posts `taskOrganizationSnapshot` message.
   - `taskOrganizationMutate` — validates payload, calls `store.mutate(mutation, baseRevision)`, echoes a `taskOrganizationMutationResult` keyed by the original `requestId`. Host-side exceptions are mapped to `TASK_ORG/PERSISTENCE/005` with `TASK_ORG/handleMutate/001`/`002` sub-codes per the Error Code Standard.
   - `taskOrganizationReconcile` — triggers `store.reconcile()` for task-history-driven pruning.
6. `pnpm lint`, `pnpm check-types`, `pnpm knip`, `find-missing-translations.js` all clean. Committed as `feat(task-organization): add B09 task-org IPC layer`. Pushed `myk1yt pr/b09-task-org-ipc`.

## Result
**Success.** All three Wave 3 branches now exist on `myk1yt` remote with the requested CI checks green:
- `pr/b13-usage-store` — 2 commits, lint/check-types/knip/translations clean.
- `pr/b07-shell-integration` — 1 commit, 42 files, lint/check-types/knip/translations clean.
- `pr/b09-task-org-ipc` — 1 commit, 3 files, lint/check-types/knip/translations clean.

## Issues Discovered
1. **B13 branch had no commit history** despite the task brief implying commits might exist. The staged WIP files were committed by this mode before CI could run. Future Wave briefs should clarify whether the branch is expected to be empty (staged-but-uncommitted) or populated.
2. **B07 source branch disables `no-explicit-any`** in `src/eslint.config.mjs`. Porting that disable would have weakened the rule for the whole project. Resolved by adding per-file suppressions to `src/eslint-suppressions.json` instead. VP may want to track the underlying `any` debt as a follow-up issue.
3. **B07 source branch reverts TaskRegistry** to `clineStack`. On `upstream/main`, `TaskRegistry` is already merged (#1014) and tests still reference it. Resolved by reverting `ClineProvider.ts`/`webviewMessageHandler.ts` and porting only the minimal `getCommandEnvironmentService()` accessor. This means the B07 branch does NOT carry the webview message handlers for `requestTerminalShellOptions`/`setTerminalShellSelection` from the source branch — those will need a follow-up if they are required for the settings UI.
4. **B09 had no source branch.** The IPC layer was designed and implemented from scratch on top of B08 to satisfy the "task-org message types, handler, provider state" brief. If a different design was envisioned (e.g., a dedicated controller class rather than direct `ClineProvider` + handler wiring), VP may want to redirect.

## Test Environment Issues
- **PowerShell `ConvertTo-Json` corrupts `eslint-suppressions.json`** when round-tripping the file: it re-indents with 4-space + extra leading whitespace and emits UTF-8 BOM, which `eslint --suppressions-location` rejects with a parse error (exit 2). Resolved by switching to `python -c "json.load / json.dump(indent='\t')"` to rewrite the file in the canonical tab-indented, no-BOM format. Future agents should NOT use `ConvertTo-Json -Depth 10 | Out-File` to update suppressions.
- **PowerShell `>` redirect on missing remote path** zeroed `src/core/task/TaskRegistry.ts` and its spec when `git show <branch>:<path>` failed. Restored by `git checkout upstream/main -- <path>`. For future file extraction from another branch, prefer `git show ... | Out-File -Encoding utf8` only after verifying the path exists on the source, or use `git checkout <branch> -- <path>` directly.
- **`pnpm lint` exit code 2 vs 1 ambiguity**: exit 2 indicates a tool-level parse/config failure (e.g., corrupt suppressions JSON); exit 1 indicates rule violations. Distinguishing them saves a debug iteration.
- **Node engine warning**: `Unsupported engine: wanted node 22.23.1, current 24.16.0` appears on every pnpm invocation. Non-blocking, but VP may want to track aligning `.nvmrc`/CI images.

## Next Step Recommendations
1. VP routes `pr/b07-shell-integration`, `pr/b09-task-org-ipc`, `pr/b13-usage-store` for PR creation and review.
2. Track B07 follow-up: decide whether `requestTerminalShellOptions`/`setTerminalShellSelection` webview handlers are needed for the settings UI; if so, file a new branch (B07b) to port them without the `clineStack` regression.
3. Track the `@typescript-eslint/no-explicit-any` debt as a separate cleanup epic rather than weakening the rule.
4. Track B09 follow-up: webview UI consumers for the new IPC (folder tree, pin bar, drag-and-drop integration with `organizationFilters`).
5. Consider whether B09 should be retargeted at `upstream/main` once B08 merges, or stacked onto B08 in the PR base.

## Affected File List
- B13 (committed `1d120aca7` + `cfff5e0e5`):
  - `packages/types/src/__tests__/usage-stats.spec.ts`
  - `packages/types/src/index.ts`
  - `packages/types/src/providers/mimo.ts`
  - `packages/types/src/usage-stats.ts`
  - `packages/types/src/vscode-extension-host.ts`
  - `src/services/stats/UsageAggregator.ts`
  - `src/services/stats/UsageEventStore.ts`
  - `src/services/stats/UsageStatsService.ts`
  - `src/services/stats/__tests__/UsageAggregator.spec.ts`
  - `src/services/stats/__tests__/UsageEventStore.spec.ts`
  - `src/services/stats/__tests__/UsageStatsService.spec.ts`
  - `src/services/stats/index.ts` (deleted)
- B07 (committed `4d4f0a…`): 42 files — see `git diff --name-only upstream/main pr/b07-shell-integration`. Highlights:
  - `src/integrations/terminal/**` (new + modified)
  - `src/core/task/Task.ts`, `build-tools.ts`
  - `src/core/tools/ExecuteCommandTool.ts`
  - `src/core/prompts/tools/native-tools/{index,execute_command}.ts`
  - `src/core/webview/ClineProvider.ts` (additive `getCommandEnvironmentService` only)
  - `src/utils/shell.ts`, `src/eslint-suppressions.json`
  - `packages/types/src/{terminal,global-settings,vscode-extension-host}.ts`
- B09 (committed `01eb456b6`):
  - `packages/types/src/vscode-extension-host.ts`
  - `src/core/webview/ClineProvider.ts`
  - `src/core/webview/webviewMessageHandler.ts`
