# PR Split Design, Option A

## Overview

This design converts the five analyzed feature branches into **six upstream PRs** built from clean, current `main` branches. The sixth PR isolates provider cost normalization found only in the combined branch. It does not copy branch tips wholesale.

The governing rule is simple: **one final PR owns each changed path**. A later PR may modify a path already merged by an earlier dependency, but no two simultaneously open PRs carry the same feature patch. Every PR description must lead with its purpose, the user-visible problem it solves, and why that concern is separate from the other PRs.

Evidence comes from the [branch analysis](analysis-report.md) and [exact overlap matrix](file-overlap-matrix.md). The baseline recorded by that evidence is `main@d27153a251d2051b6a8e73d305b06ffbc5ac6970`. Before extraction, the VP must refresh current upstream `main`; all candidate branches start from that refreshed commit.

### Chosen split

| ID | PR name | Core WHY | Complexity | Dependency |
|---|---|---|---:|---|
| PR-1 | Deterministic error interception and guided recovery | Turn malformed tool calls and tool failures into stable, actionable feedback instead of silent or opaque failures. | 🔴 HEAVY | None |
| PR-2 | Unified cross-platform shell resolution and terminal lifecycle | Make command execution select and invoke the correct shell consistently, with deterministic lifecycle and reuse behavior. | 🔴 HEAVY | None |
| PR-3 | Workspace-safe task folders, pinning, and drag-and-drop | Let users organize task history without leaking organization state across workspaces. | 🔴 HEAVY | PR-2 |
| PR-4 | MiMo model-aware tool-call retention policy | Prevent unsupported parallel calls and ghost calls while preserving parallel behavior for capable providers. | 🟡 STANDARD | PR-1 and PR-2 |
| PR-5 | Local usage accounting and dashboard | Give users private, local usage and cost visibility without coupling task execution to dashboard availability. | 🔴 HEAVY | PR-1, PR-2, PR-3, and PR-4 |
| PR-6 | User-configured provider cost normalization | Make provider streams report consistent `totalCost` when users configure prices, so PR-5 records correct costs. | 🟡 STANDARD | PR-5 |

`Shell` and `Error` are the only first-wave pair with zero exact file overlap, so PR-1 and PR-2 can be prepared and reviewed in parallel. Every later branch is recreated after its prerequisites merge.

---

# 1. Technical Specification

## 1.1 Goals and hard constraints

1. Create every candidate from current upstream `main`; never submit a stale branch-tip tree.
2. Replay feature commits or reconstruct their patch by concern. Do not merge the combined branch.
3. Keep the five original concerns separate and add only one justified combined-only follow-up, PR-6.
4. Replay the six MiMo-exclusive commits `d17049f01`, `5c8b3ce58`, `9d87f7fc5`, `6e8d4744b`, `7d1034529`, and `b7edba688` on top of the final PR-1 result. Do not merge `fix/mimo-parallel-tool-call-policy`.
5. Assign the 11 Stats × DnD shared paths to PR-3. Stats must omit commit `191bf51e6` and retain only the minimal Stats-specific edits from `9968e390d` after PR-3 is present.
6. Exclude upstream drift, session reports, logs, helper scripts, unrelated lint cleanup, and unrelated E2E timeout changes.
7. A candidate fails the split gate if its patch contains any path not named in its manifest, except conflict-resolution edits required by its stated prerequisite. Such edits must be recorded in the PR body and tested.
8. Keep changesets out of scope, consistent with [agent guidance](../../AGENTS.md).

## 1.2 Frontend ↔ extension-host data flows

### PR-1, error interception

```text
Tool invocation or parser failure
  -> ToolErrorInterceptor / StructuralValidator
  -> presentAssistantMessage
  -> structured <error_details> plus AI guidance
  -> assistant-message stream
  -> chat rendering and retry decision
```

The contract is internal to the extension host, but the result crosses into the webview through the existing assistant stream. Parser normalization must happen before classification. The interceptor must not throw while reporting a prior failure. Unknown errors retain the original diagnostic and add bounded guidance.

### PR-2, shell resolution

```text
TerminalSettings local cachedState
  -> typed settings message
  -> webviewMessageHandler / ClineProvider
  -> ExecuteCommandTool
  -> ShellResolver -> ShellInvocationAdapter
  -> CommandScheduler / TerminalLifecycle / TerminalRegistry
  -> VS Code terminal or Execa process
  -> ordered output, exit status, structured tool result
```

Settings inputs must bind to the local `cachedState`, not directly to live extension state. The transport types live in [global-settings.ts](../../packages/types/src/global-settings.ts), [terminal.ts](../../packages/types/src/terminal.ts), and [vscode-extension-host.ts](../../packages/types/src/vscode-extension-host.ts). Resolution errors remain structured at `ExecuteCommandTool`; terminal adapters must not silently downgrade them to empty output.

### PR-3, task organization and DnD

```text
History drag, drop, pin, folder action
  -> typed task-organization webview message
  -> webviewMessageHandler
  -> taskOrganizationMessageHandler
  -> TaskOrganizationStore
  -> safeWriteJson in workspace-scoped storage
  -> ClineProvider state refresh
  -> ExtensionStateContext -> History UI
```

The canonical type contract and persistence implementation are owned by PR-3. All reads and writes require a workspace identity. No-workspace mode returns no workspace-specific folders. Unknown future schema fields are preserved or rejected predictably; a malformed organization file cannot erase history.

### PR-4, MiMo policy

```text
Model capability metadata
  -> provider registry / MiMo handler
  -> ToolCallRetentionPolicy
  -> NativeToolCallParser / presentAssistantMessage
  -> Task tool scheduling and ExecuteCommandTool
  -> retained, quarantined, or rejected calls
  -> typed telemetry event
```

The policy is capability-driven, not provider-name-driven. A known provider without explicit capability data keeps existing parallel behavior. MiMo may enforce a maximum of one eligible call. Ghost calls are quarantined before execution. PR-1 remains the authority for structural error classification; PR-4 extends its validator without replacing interception behavior.

### PR-5 and PR-6, local usage accounting

```text
Provider stream final usage and totalCost
  -> Task attempt-finalization hook
  -> UsageRecorder
  -> append-only NDJSON UsageEventStore
  -> UsageAggregator / costRecalculation
  -> usageStatsMessageHandler
  -> typed request/response over webview IPC
  -> DashboardView / UsageHeatmap
```

Recording happens once per finalized API attempt. Store or dashboard failures do not fail the task. Reads tolerate a truncated final NDJSON record. Clear/export/query operations return explicit success or error results. PR-6 normalizes `totalCost` at provider stream boundaries; PR-5 remains the owner of event storage, aggregation, IPC, and display.

## 1.3 Shared type and error rules

| Boundary | Owning PR | Contract rule | Error rule |
|---|---|---|---|
| Assistant parser ↔ interception | PR-1 | Structural parser output is the classifier input. | Preserve original tool error and add deterministic details; never recursively intercept interceptor failures. |
| Terminal settings ↔ command runtime | PR-2 | Typed shell settings are optional and backward compatible. | Invalid profile or executable returns an actionable command error; no silent fallback when the user explicitly selected a shell. |
| History UI ↔ task persistence | PR-3 | Task/folder/pin IDs and workspace key are typed in one task-organization contract. | Reject cross-workspace mutations; isolate malformed files and avoid destructive rewrite. |
| Provider/model ↔ tool policy | PR-4 | Capability metadata resolves to one explicit retention policy. | Unsupported extra calls are quarantined/reported; known-provider defaults remain unchanged. |
| Provider stream ↔ local stats | PR-5, then PR-6 | Usage events have stable IDs, timestamp, task/session identity, token fields, provider/model/mode, and optional cost. | Recording is non-blocking; malformed records are skipped and counted rather than crashing queries. |
| Extension host ↔ dashboard | PR-5 | Typed query/export/clear request and response variants live in the extension-host contract. | Every request terminates with success or typed failure; stale windows receive refresh events without feedback loops. |

---

# 2. Architecture Decisions

## 2.1 Decision and alternatives

The user selected Option A. These are the three evaluated designs; only Option A is authorized.

### Option A, Standard / Right Way, selected

- **Design:** Clean branches from current `main`, one path owner, prerequisite-aware replay, and regeneration after every merge.
- **Effort:** High.
- **Risk:** Lowest. Conflicts are resolved against the exact tree upstream will merge.
- **Outcome:** Six reviewable PRs with no stale drift, duplicated Error history, or duplicated task-organization infrastructure.

### Option B, Practical / Pragmatic Way, not selected

- **Design:** Introduce a shared contract/infrastructure precursor and layer several feature PRs on it.
- **Effort:** Medium.
- **Risk:** Medium. The precursor has weak user value on its own and obscures WHY the shared files exist.
- **Outcome:** Fewer mechanical conflicts but a broader, harder-to-justify upstream review.

### Option C, Staging / Incremental Way, not selected

- **Design:** Extract only Shell and Error, then redesign after each merge.
- **Effort:** Low initially, repeated later.
- **Risk:** Medium-high schedule and scope risk; Stats/DnD ownership remains unsettled.
- **Outcome:** Fast first proof but no complete five-feature submission plan.

## 2.2 Dependency DAG

```text
current upstream main
  |-------------------------------|
  v                               v
PR-1 Error interception       PR-2 Shell resolution
  |                               |
  |                               v
  |                           PR-3 Task DnD
  |------------------|------------|
                     v
              PR-4 MiMo policy
                     |
                     v
              PR-5 Local stats
                     |
                     v
          PR-6 Provider cost normalization
```

Logical prerequisites:

- PR-3 waits for PR-2 because both modify [vscode-extension-host.ts](../../packages/types/src/vscode-extension-host.ts), [ClineProvider.ts](../../src/core/webview/ClineProvider.ts), and [webviewMessageHandler.ts](../../src/core/webview/webviewMessageHandler.ts).
- PR-4 waits for PR-1 and PR-2 because it modifies five PR-1 paths and three PR-2 paths.
- PR-5 waits for PR-1 only to eliminate the `.gitignore` conflict by excluding branch-local ignore changes; it waits for PR-2, PR-3, and PR-4 because it modifies their shared type, task, provider, and webview surfaces.
- PR-6 waits for PR-5 because provider `totalCost` is consumed by the local usage event pipeline.

## 2.3 Merge order

1. **Merge PR-1 and PR-2 in either order.** They have zero exact file overlap. Run their full focused suites independently and together before proceeding.
2. **Recreate and merge PR-3 on top of both.** PR-3 becomes the sole owner of task-organization contracts and persistence.
3. **Recreate and merge PR-4 on top of PR-1 + PR-2 + PR-3.** Replay only the six MiMo commits, resolving Error and Shell boundaries against their merged implementations.
4. **Reconstruct and merge PR-5 on top of PR-1 through PR-4.** Exclude the duplicate task-organization port and keep only Stats-specific integration edits.
5. **Reconstruct and merge PR-6 on top of PR-5.** Use the combined-only provider commits as evidence, not as a wholesale cherry-pick.

This sequence contains the Stats conflict hub until all four of its overlapping features have stable merged contracts.

## 2.4 Shared-file ownership

### Exact overlap ownership

| Shared path or set | Owner | Downstream rule |
|---|---|---|
| [src/core/assistant-message/NativeToolCallParser.ts](../../src/core/assistant-message/NativeToolCallParser.ts) | PR-1 | PR-4 applies only policy-specific deltas after PR-1. |
| [src/core/assistant-message/presentAssistantMessage.ts](../../src/core/assistant-message/presentAssistantMessage.ts) | PR-1 | PR-4 inserts retention/quarantine behavior without replacing PR-1 error formatting. |
| [src/core/assistant-message/__tests__/NativeToolCallParser.spec.ts](../../src/core/assistant-message/__tests__/NativeToolCallParser.spec.ts) | PR-1 | PR-4 adds capability/policy cases to the merged suite. |
| [src/core/assistant-message/__tests__/presentAssistantMessage-parser-dedup.integration.spec.ts](../../src/core/assistant-message/__tests__/presentAssistantMessage-parser-dedup.integration.spec.ts) | PR-1 | PR-4 adds dedup/retention scenarios on the merged fixture. |
| [src/core/tools/error-interception/StructuralValidator.ts](../../src/core/tools/error-interception/StructuralValidator.ts) | PR-1 | PR-4 may extend validation only for policy data. |
| [src/core/prompts/tools/native-tools/execute_command.ts](../../src/core/prompts/tools/native-tools/execute_command.ts) | PR-2 | PR-4 adds policy wording while retaining shell semantics. |
| [src/core/tools/ExecuteCommandTool.ts](../../src/core/tools/ExecuteCommandTool.ts) | PR-2 | PR-4 adds policy enforcement hooks without changing shell ownership. |
| [src/core/task/Task.ts](../../src/core/task/Task.ts) | PR-2 first, PR-4 second, PR-5 last | Each downstream PR changes only its concern: policy, then usage finalization. |
| [packages/types/src/providers/mimo.ts](../../packages/types/src/providers/mimo.ts) | PR-4 | PR-5 consumes final pricing/cost fields without reverting capability metadata. |
| [src/api/providers/__tests__/mimo.spec.ts](../../src/api/providers/__tests__/mimo.spec.ts) | PR-4 | PR-5 adds usage/cost assertions to the merged provider test. |
| [packages/types/src/vscode-extension-host.ts](../../packages/types/src/vscode-extension-host.ts) | PR-2 first, PR-3 canonical task-org owner, PR-5 final stats extension | Message unions are additive; no PR copies an older whole union. |
| [src/core/webview/ClineProvider.ts](../../src/core/webview/ClineProvider.ts) | PR-2 first, PR-3 task-org owner, PR-5 stats owner | State assembly stays additive and covered by boundary tests. |
| [src/core/webview/webviewMessageHandler.ts](../../src/core/webview/webviewMessageHandler.ts) | PR-2 first, PR-3 task-org owner, PR-5 stats owner | Each concern registers one isolated handler branch. |
| All 11 Stats × DnD paths from the overlap matrix | PR-3 | PR-5 excludes commit `191bf51e6` and reapplies only Stats-specific fixes from `9968e390d`. |
| `.gitignore` | Neither PR-1 nor PR-5 | Exclude branch-local script/session patterns; upstream ignore policy is not feature behavior. |

### The 11 Stats × DnD paths, all owned by PR-3

[packages/types/src/index.ts](../../packages/types/src/index.ts), [packages/types/src/task-organization.ts](../../packages/types/src/task-organization.ts), [packages/types/src/vscode-extension-host.ts](../../packages/types/src/vscode-extension-host.ts), [src/core/task-persistence/TaskOrganizationStore.ts](../../src/core/task-persistence/TaskOrganizationStore.ts), [src/core/task-persistence/index.ts](../../src/core/task-persistence/index.ts), [src/core/task-persistence/__tests__/TaskOrganizationStore.spec.ts](../../src/core/task-persistence/__tests__/TaskOrganizationStore.spec.ts), [src/core/webview/ClineProvider.ts](../../src/core/webview/ClineProvider.ts), [src/core/webview/taskOrganizationMessageHandler.ts](../../src/core/webview/taskOrganizationMessageHandler.ts), [src/core/webview/webviewMessageHandler.ts](../../src/core/webview/webviewMessageHandler.ts), [src/shared/globalFileNames.ts](../../src/shared/globalFileNames.ts), and [src/utils/safeWriteJson.ts](../../src/utils/safeWriteJson.ts).

PR-5 still modifies three of those integration files, [vscode-extension-host.ts](../../packages/types/src/vscode-extension-host.ts), [ClineProvider.ts](../../src/core/webview/ClineProvider.ts), and [webviewMessageHandler.ts](../../src/core/webview/webviewMessageHandler.ts), for Stats-only additive message/state wiring. It must not carry task-organization definitions, handlers, store logic, filenames, or safe-write code.

## 2.5 Combined-only path disposition

| Combined-only path | Decision | PR / reason |
|---|---|---|
| [apps/vscode-e2e/src/fixtures/terminal-reuse-shell-race.ts](../../apps/vscode-e2e/src/fixtures/terminal-reuse-shell-race.ts) | Include | PR-2. Commit `5c5debed4` fixes a terminal-reuse fixture re-match loop and directly verifies Shell behavior. |
| [check-git-status.ps1](../../check-git-status.ps1) | Reject | Local operational helper, no product behavior. |
| [do-push.sh](../../do-push.sh) | Reject | Local push helper, forbidden operational noise. |
| [push.ps1](../../push.ps1) | Reject | Local push helper, forbidden operational noise. |
| [src/api/providers/__tests__/openai-compatible.spec.ts](../../src/api/providers/__tests__/openai-compatible.spec.ts) | Include | PR-6. Focused regression coverage for configured-price `totalCost`. |
| [src/api/providers/bedrock.ts](../../src/api/providers/bedrock.ts) | Include after reconstruction | PR-6. Keep only configured-price cost normalization, not merge-resolution drift. |
| [src/api/providers/deepseek.ts](../../src/api/providers/deepseek.ts) | Include | PR-6. Configured-price cost normalization. |
| [src/api/providers/openai-compatible.ts](../../src/api/providers/openai-compatible.ts) | Include | PR-6. Shared configured-price cost normalization. |
| [src/api/providers/poe.ts](../../src/api/providers/poe.ts) | Include | PR-6. Missing `totalCost` calculation. |
| [src/api/providers/qwen-code.ts](../../src/api/providers/qwen-code.ts) | Include | PR-6. Configured-price cost normalization on top of PR-5 types. |
| [src/api/providers/xai.ts](../../src/api/providers/xai.ts) | Include | PR-6. Configured-price cost normalization. |

PR-6 may also need the four provider files changed by source commit `f0a7c9c9d`, namely [anthropic-vertex.ts](../../src/api/providers/anthropic-vertex.ts), [kenari.ts](../../src/api/providers/kenari.ts), [mistral.ts](../../src/api/providers/mistral.ts), and [openai.ts](../../src/api/providers/openai.ts), plus targeted tests. Those paths are not combined-only because Stats already touched them. They belong to PR-6 if and only if the clean PR-5 baseline still lacks equivalent `totalCost` behavior.

Do **not** carry unrelated changes from `fa8f19a6c`: the E2E timeout change and [BaseTerminal.ts](../../src/integrations/terminal/BaseTerminal.ts) edit are excluded. Keep only provider-cost tests.

## 2.6 Risk mitigation for the Stats conflict hub

1. **Delay Stats extraction.** Do not prepare its final branch while PR-2, PR-3, or PR-4 is still changing.
2. **Drop duplicate infrastructure.** Omit `191bf51e6` entirely. Treat PR-3 as the canonical source of task-organization code.
3. **Surgical replay.** Replay early Stats commits by concern, then reconstruct later fixes. Do not cherry-pick `9968e390d` wholesale because it combines provider-cost work and task-organization test fixes.
4. **Three-way contract audit.** Before PR-5 opens, compare its final [vscode-extension-host.ts](../../packages/types/src/vscode-extension-host.ts), [ClineProvider.ts](../../src/core/webview/ClineProvider.ts), and [webviewMessageHandler.ts](../../src/core/webview/webviewMessageHandler.ts) to merged main. The only new hunks must be Stats message/state wiring.
5. **Provider separation.** Keep base usage fields and existing provider final-usage recording in PR-5. Move configured-price normalization and combined-only provider paths to PR-6.
6. **Localization isolation.** PR-5 owns only [dashboard.json](../../webview-ui/src/i18n/locales/en/dashboard.json) and [stats.json](../../webview-ui/src/i18n/locales/en/stats.json), plus package command labels. PR-3 owns task-organization strings in [chat.json](../../webview-ui/src/i18n/locales/en/chat.json) and [history.json](../../webview-ui/src/i18n/locales/en/history.json). PR-2 owns [en/settings.json](../../webview-ui/src/i18n/locales/en/settings.json) shell text.
7. **No lockfile unless justified.** PR-3 owns [webview-ui/package.json](../../webview-ui/package.json) and `pnpm-lock.yaml` because DnD UI dependencies originate there. No other PR regenerates the lockfile unless it adds a dependency.

## 2.7 Edge cases and acceptance conditions

| Area | Edge case | Acceptance condition |
|---|---|---|
| Error | Concatenated JSON, unknown tool, image message, custom tool, interceptor failure | Original content survives; one structured error is shown; no duplicate execution or recursive failure. |
| Shell | Bash/CMD/PowerShell quoting, missing shell, interrupted child, reused terminal, no output | Correct adapter and executable are selected; cancellation settles once; ordered output and non-zero exit remain visible. |
| DnD | No workspace, two windows, same task ID in different workspaces, malformed/future JSON, folder deletion | No cross-contamination; no-workspace hides workspace folders; safe write is atomic; user gets recoverable failure. |
| MiMo | Explicit max-one, ghost call, known provider without metadata, duplicate parser emission | At most one eligible MiMo call executes; ghosts are quarantined; existing providers retain parallel behavior. |
| Stats | Retry attempts, cancellation, missing cost, malformed last record, clear/export failure, multiple windows | Exactly one event per final attempt; task completion is unaffected; reads remain available; all windows converge without refresh loop. |
| Provider cost | Zero/missing/user-configured rates, cached tokens, streaming completion, provider-specific units | `totalCost` is absent only when genuinely unknowable and matches the shared calculation when rates exist. |

## 2.8 Codebase-indexing deletion

The requested codebase-indexing deletion feature is **not present** in any analyzed branch, the combined branch path delta, or branch-side history under the current code-index module. It is not assigned to PR-1 through PR-6.

Run a separate research task over other refs, worktrees, stashes, and any user-held patch. Candidate paths are `src/services/code-index/`, [packages/types/src/codebase-index.ts](../../packages/types/src/codebase-index.ts), and [webview-ui/src/components/settings/CodeIndexSettings.tsx](../../webview-ui/src/components/settings/CodeIndexSettings.tsx). Only after an exact patch and WHY are found should it receive a new independent PR number and dependency analysis.

---

# 3. PR Specifications and Exact Manifests

## PR-1, Deterministic error interception and guided recovery

### Purpose, WHY

Tool failures currently risk surfacing as opaque parser failures, inconsistent guidance, or silent paths. This PR creates one deterministic interception pipeline that classifies known failures, preserves original diagnostics, and emits user-readable recovery details for both the user and the model.

It must exist separately because it changes failure semantics and parser behavior, not provider policy, shell selection, history organization, or usage accounting. Keeping it isolated lets reviewers evaluate whether failures remain truthful and non-recursive before MiMo builds policy on the same parser boundary.

- **Source branch:** `feat/error-interception-middleware` at analyzed tip `5c8c495e0`.
- **Dependencies:** None.
- **Complexity:** 🔴 HEAVY.

### Files included, exact 24-product-file manifest

- [apps/vscode-e2e/src/fixtures/apply-diff.ts](../../apps/vscode-e2e/src/fixtures/apply-diff.ts)
- [apps/vscode-e2e/src/suite/subtasks.test.ts](../../apps/vscode-e2e/src/suite/subtasks.test.ts)
- [src/core/assistant-message/NativeToolCallParser.ts](../../src/core/assistant-message/NativeToolCallParser.ts)
- [src/core/assistant-message/__tests__/NativeToolCallParser.spec.ts](../../src/core/assistant-message/__tests__/NativeToolCallParser.spec.ts)
- [src/core/assistant-message/__tests__/error-interceptor-guided-format.integration.spec.ts](../../src/core/assistant-message/__tests__/error-interceptor-guided-format.integration.spec.ts)
- [src/core/assistant-message/__tests__/presentAssistantMessage-custom-tool.spec.ts](../../src/core/assistant-message/__tests__/presentAssistantMessage-custom-tool.spec.ts)
- [src/core/assistant-message/__tests__/presentAssistantMessage-error-interception.spec.ts](../../src/core/assistant-message/__tests__/presentAssistantMessage-error-interception.spec.ts)
- [src/core/assistant-message/__tests__/presentAssistantMessage-images.spec.ts](../../src/core/assistant-message/__tests__/presentAssistantMessage-images.spec.ts)
- [src/core/assistant-message/__tests__/presentAssistantMessage-parser-dedup.integration.spec.ts](../../src/core/assistant-message/__tests__/presentAssistantMessage-parser-dedup.integration.spec.ts)
- [src/core/assistant-message/__tests__/presentAssistantMessage-unknown-tool.spec.ts](../../src/core/assistant-message/__tests__/presentAssistantMessage-unknown-tool.spec.ts)
- [src/core/assistant-message/presentAssistantMessage.ts](../../src/core/assistant-message/presentAssistantMessage.ts)
- [src/core/tools/error-interception/ErrorClassifier.ts](../../src/core/tools/error-interception/ErrorClassifier.ts)
- [src/core/tools/error-interception/MessageTransformer.ts](../../src/core/tools/error-interception/MessageTransformer.ts)
- [src/core/tools/error-interception/StructuralValidator.ts](../../src/core/tools/error-interception/StructuralValidator.ts)
- [src/core/tools/error-interception/TaskErrorState.ts](../../src/core/tools/error-interception/TaskErrorState.ts)
- [src/core/tools/error-interception/ToolErrorInterceptor.ts](../../src/core/tools/error-interception/ToolErrorInterceptor.ts)
- [src/core/tools/error-interception/__tests__/ErrorClassifier.spec.ts](../../src/core/tools/error-interception/__tests__/ErrorClassifier.spec.ts)
- [src/core/tools/error-interception/__tests__/MessageTransformer.spec.ts](../../src/core/tools/error-interception/__tests__/MessageTransformer.spec.ts)
- [src/core/tools/error-interception/__tests__/StructuralValidator.spec.ts](../../src/core/tools/error-interception/__tests__/StructuralValidator.spec.ts)
- [src/core/tools/error-interception/__tests__/TaskErrorState.spec.ts](../../src/core/tools/error-interception/__tests__/TaskErrorState.spec.ts)
- [src/core/tools/error-interception/__tests__/ToolErrorInterceptor.spec.ts](../../src/core/tools/error-interception/__tests__/ToolErrorInterceptor.spec.ts)
- [src/core/tools/error-interception/errorPatterns.ts](../../src/core/tools/error-interception/errorPatterns.ts)
- [src/core/tools/error-interception/index.ts](../../src/core/tools/error-interception/index.ts)
- [src/core/tools/error-interception/types.ts](../../src/core/tools/error-interception/types.ts)

### Files excluded

- `.gitignore`: excludes local scripts and all session folders, unrelated to runtime behavior and too broad for upstream.
- [src/eslint-suppressions.json](../../src/eslint-suppressions.json): include only if the clean replay creates the exact suppression-count removal; prefer lint-clean implementation without editing the generated suppression ledger.
- Any session report or local helper artifact.

### Conflict risk

- PR-4 later changes five owned files: parser, presentation, two tests, and [StructuralValidator.ts](../../src/core/tools/error-interception/StructuralValidator.ts).
- PR-5 has only the rejected `.gitignore` overlap.
- Highest semantic risk: parser deduplication and error interception must remain ordered when PR-4 inserts retention policy.

### Verification commands

From the extension package directory:

```powershell
cd src; npx vitest run core/tools/error-interception core/assistant-message/__tests__/NativeToolCallParser.spec.ts core/assistant-message/__tests__/error-interceptor-guided-format.integration.spec.ts core/assistant-message/__tests__/presentAssistantMessage-error-interception.spec.ts core/assistant-message/__tests__/presentAssistantMessage-parser-dedup.integration.spec.ts
```

From the VS Code E2E package after bundling:

```powershell
pnpm --filter @roo-code/vscode-e2e test:ci:mock
```

PR gate:

```powershell
pnpm --filter zoo-code lint; pnpm --filter zoo-code check-types; pnpm --filter zoo-code test
```

## PR-2, Unified cross-platform shell resolution and terminal lifecycle

### Purpose, WHY

Command execution currently spans settings, prompts, terminal reuse, shell discovery, quoting, child processes, and cancellation. Platform-specific fallbacks can select the wrong executable or lose lifecycle state. This PR supplies one typed shell-resolution path and one terminal lifecycle model so the same user command is invoked predictably across Bash, CMD, and PowerShell.

It must exist separately because terminal execution is a subsystem with its own settings, IPC, scheduler, lifecycle, and tests. It has zero exact overlap with PR-1 and can deliver user value independently.

- **Source branch:** `feature/unified-shell-resolution` at analyzed tip `8e6799525`, plus combined-only fixture fix `5c5debed4`.
- **Dependencies:** None.
- **Complexity:** 🔴 HEAVY.

### Files included, exact 59-product-file manifest

- [apps/vscode-e2e/src/fixtures/terminal-reuse-shell-race.ts](../../apps/vscode-e2e/src/fixtures/terminal-reuse-shell-race.ts)
- [packages/types/src/__tests__/terminal-shell-settings.spec.ts](../../packages/types/src/__tests__/terminal-shell-settings.spec.ts)
- [packages/types/src/global-settings.ts](../../packages/types/src/global-settings.ts)
- [packages/types/src/terminal.ts](../../packages/types/src/terminal.ts)
- [packages/types/src/vscode-extension-host.ts](../../packages/types/src/vscode-extension-host.ts)
- [src/core/prompts/__tests__/__snapshots__/add-custom-instructions/architect-mode-prompt.snap](../../src/core/prompts/__tests__/__snapshots__/add-custom-instructions/architect-mode-prompt.snap)
- [src/core/prompts/__tests__/__snapshots__/add-custom-instructions/ask-mode-prompt.snap](../../src/core/prompts/__tests__/__snapshots__/add-custom-instructions/ask-mode-prompt.snap)
- [src/core/prompts/__tests__/__snapshots__/add-custom-instructions/mcp-server-creation-disabled.snap](../../src/core/prompts/__tests__/__snapshots__/add-custom-instructions/mcp-server-creation-disabled.snap)
- [src/core/prompts/__tests__/__snapshots__/system-prompt/consistent-system-prompt.snap](../../src/core/prompts/__tests__/__snapshots__/system-prompt/consistent-system-prompt.snap)
- [src/core/prompts/__tests__/__snapshots__/system-prompt/with-mcp-hub-provided.snap](../../src/core/prompts/__tests__/__snapshots__/system-prompt/with-mcp-hub-provided.snap)
- [src/core/prompts/__tests__/__snapshots__/system-prompt/with-undefined-mcp-hub.snap](../../src/core/prompts/__tests__/__snapshots__/system-prompt/with-undefined-mcp-hub.snap)
- [src/core/prompts/__tests__/shell-environment-prompt.spec.ts](../../src/core/prompts/__tests__/shell-environment-prompt.spec.ts)
- [src/core/prompts/sections/rules.ts](../../src/core/prompts/sections/rules.ts)
- [src/core/prompts/sections/system-info.ts](../../src/core/prompts/sections/system-info.ts)
- [src/core/prompts/system.ts](../../src/core/prompts/system.ts)
- [src/core/prompts/tools/native-tools/execute_command.ts](../../src/core/prompts/tools/native-tools/execute_command.ts)
- [src/core/prompts/tools/native-tools/index.ts](../../src/core/prompts/tools/native-tools/index.ts)
- [src/core/task/Task.ts](../../src/core/task/Task.ts)
- [src/core/task/build-tools.ts](../../src/core/task/build-tools.ts)
- [src/core/tools/ExecuteCommandTool.ts](../../src/core/tools/ExecuteCommandTool.ts)
- [src/core/tools/__tests__/executeCommandTool.spec.ts](../../src/core/tools/__tests__/executeCommandTool.spec.ts)
- [src/core/tools/__tests__/terminal-provider-fallback.spec.ts](../../src/core/tools/__tests__/terminal-provider-fallback.spec.ts)
- [src/core/webview/ClineProvider.ts](../../src/core/webview/ClineProvider.ts)
- [src/core/webview/__tests__/terminal-shell-messages.spec.ts](../../src/core/webview/__tests__/terminal-shell-messages.spec.ts)
- [src/core/webview/generateSystemPrompt.ts](../../src/core/webview/generateSystemPrompt.ts)
- [src/core/webview/webviewMessageHandler.ts](../../src/core/webview/webviewMessageHandler.ts)
- [src/extension.ts](../../src/extension.ts)
- [src/integrations/terminal/BaseTerminal.ts](../../src/integrations/terminal/BaseTerminal.ts)
- [src/integrations/terminal/CommandScheduler.ts](../../src/integrations/terminal/CommandScheduler.ts)
- [src/integrations/terminal/CommandTrace.ts](../../src/integrations/terminal/CommandTrace.ts)
- [src/integrations/terminal/ExecaTerminal.ts](../../src/integrations/terminal/ExecaTerminal.ts)
- [src/integrations/terminal/ExecaTerminalProcess.ts](../../src/integrations/terminal/ExecaTerminalProcess.ts)
- [src/integrations/terminal/Terminal.ts](../../src/integrations/terminal/Terminal.ts)
- [src/integrations/terminal/TerminalLifecycle.ts](../../src/integrations/terminal/TerminalLifecycle.ts)
- [src/integrations/terminal/TerminalProcess.ts](../../src/integrations/terminal/TerminalProcess.ts)
- [src/integrations/terminal/TerminalRegistry.ts](../../src/integrations/terminal/TerminalRegistry.ts)
- [src/integrations/terminal/__tests__/CommandScheduler.spec.ts](../../src/integrations/terminal/__tests__/CommandScheduler.spec.ts)
- [src/integrations/terminal/__tests__/ExecaTerminalProcess.spec.ts](../../src/integrations/terminal/__tests__/ExecaTerminalProcess.spec.ts)
- [src/integrations/terminal/__tests__/ShellInvocationAdapter.spec.ts](../../src/integrations/terminal/__tests__/ShellInvocationAdapter.spec.ts)
- [src/integrations/terminal/__tests__/ShellResolver.spec.ts](../../src/integrations/terminal/__tests__/ShellResolver.spec.ts)
- [src/integrations/terminal/__tests__/TerminalLifecycle.spec.ts](../../src/integrations/terminal/__tests__/TerminalLifecycle.spec.ts)
- [src/integrations/terminal/__tests__/TerminalProcess.spec.ts](../../src/integrations/terminal/__tests__/TerminalProcess.spec.ts)
- [src/integrations/terminal/__tests__/TerminalProcessExec.bash.spec.ts](../../src/integrations/terminal/__tests__/TerminalProcessExec.bash.spec.ts)
- [src/integrations/terminal/__tests__/TerminalProcessExec.cmd.spec.ts](../../src/integrations/terminal/__tests__/TerminalProcessExec.cmd.spec.ts)
- [src/integrations/terminal/__tests__/TerminalProcessExec.pwsh.spec.ts](../../src/integrations/terminal/__tests__/TerminalProcessExec.pwsh.spec.ts)
- [src/integrations/terminal/__tests__/TerminalProfile.spec.ts](../../src/integrations/terminal/__tests__/TerminalProfile.spec.ts)
- [src/integrations/terminal/__tests__/TerminalRegistry.spec.ts](../../src/integrations/terminal/__tests__/TerminalRegistry.spec.ts)
- [src/integrations/terminal/shell/CommandEnvironmentService.ts](../../src/integrations/terminal/shell/CommandEnvironmentService.ts)
- [src/integrations/terminal/shell/ShellInvocationAdapter.ts](../../src/integrations/terminal/shell/ShellInvocationAdapter.ts)
- [src/integrations/terminal/shell/ShellResolver.ts](../../src/integrations/terminal/shell/ShellResolver.ts)
- [src/integrations/terminal/shell/TerminalProfileResolver.ts](../../src/integrations/terminal/shell/TerminalProfileResolver.ts)
- [src/integrations/terminal/shell/types.ts](../../src/integrations/terminal/shell/types.ts)
- [src/integrations/terminal/types.ts](../../src/integrations/terminal/types.ts)
- [src/utils/__tests__/shell.spec.ts](../../src/utils/__tests__/shell.spec.ts)
- [src/utils/shell.ts](../../src/utils/shell.ts)
- [webview-ui/src/components/settings/SettingsView.tsx](../../webview-ui/src/components/settings/SettingsView.tsx)
- [webview-ui/src/components/settings/TerminalSettings.tsx](../../webview-ui/src/components/settings/TerminalSettings.tsx)
- [webview-ui/src/components/settings/__tests__/TerminalSettings.shell.spec.tsx](../../webview-ui/src/components/settings/__tests__/TerminalSettings.shell.spec.tsx)
- [webview-ui/src/i18n/locales/en/settings.json](../../webview-ui/src/i18n/locales/en/settings.json)

### Files excluded

- Three branch-local reports under `docs/260726_0003_session_error-hiding-fix/`.
- Upstream-only reversions and unrelated settings, MCP, provider, visual-test, package, lockfile, lint-suppression, ripgrep, proxy, and localization drift listed in the raw two-dot diff.
- No changeset.

### Conflict risk

- PR-3 later changes [vscode-extension-host.ts](../../packages/types/src/vscode-extension-host.ts), [ClineProvider.ts](../../src/core/webview/ClineProvider.ts), and [webviewMessageHandler.ts](../../src/core/webview/webviewMessageHandler.ts).
- PR-4 later changes [execute_command.ts](../../src/core/prompts/tools/native-tools/execute_command.ts), [Task.ts](../../src/core/task/Task.ts), and [ExecuteCommandTool.ts](../../src/core/tools/ExecuteCommandTool.ts).
- PR-5 later changes the same type/webview triplet and [Task.ts](../../src/core/task/Task.ts).
- The combined-only fixture fix is test-only but must match the final scheduler behavior.

### Verification commands

```powershell
cd src; npx vitest run integrations/terminal core/tools/__tests__/executeCommandTool.spec.ts core/tools/__tests__/terminal-provider-fallback.spec.ts core/webview/__tests__/terminal-shell-messages.spec.ts core/prompts/__tests__/shell-environment-prompt.spec.ts utils/__tests__/shell.spec.ts
```

```powershell
cd webview-ui; npx vitest run src/components/settings/__tests__/TerminalSettings.shell.spec.tsx
```

```powershell
cd packages/types; npx vitest run src/__tests__/terminal-shell-settings.spec.ts
```

```powershell
pnpm --filter zoo-code lint; pnpm --filter zoo-code check-types; pnpm --filter @roo-code/vscode-webview check-types
```

Run the E2E mock suite because terminal reuse requires a real extension host:

```powershell
pnpm --filter @roo-code/vscode-e2e test:ci:mock
```

## PR-3, Workspace-safe task folders, pinning, and drag-and-drop

### Purpose, WHY

History is a flat list, making long-running work hard to organize. Folder moves, pinning, and drag-and-drop also introduce a serious workspace-isolation risk if task organization is persisted globally or shown with no active workspace. This PR adds organization UX and a workspace-scoped persistence contract.

It must exist separately because it is an end-to-end history feature with its own schema, storage, IPC, React state, DnD dependencies, accessibility behavior, and isolation guarantees. Stats copied this infrastructure only to integrate a combined branch; that copy is not a Stats requirement and belongs here.

- **Source branch:** `feature/task-dnd-ux`, all three branch-side commits `0453c3a70`, `234f292ff`, and `838f99249`.
- **Dependencies:** PR-2 merged, and PR-1 should also be on final `main` before opening to keep one shared baseline.
- **Complexity:** 🔴 HEAVY.

### Files included, exact 89-file manifest

```text
packages/types/src/index.ts
packages/types/src/task-organization.ts
packages/types/src/vscode-extension-host.ts
pnpm-lock.yaml
src/core/task-persistence/TaskOrganizationStore.ts
src/core/task-persistence/__tests__/TaskOrganizationStore.spec.ts
src/core/task-persistence/index.ts
src/core/webview/ClineProvider.ts
src/core/webview/__tests__/taskOrganizationMessageHandler.spec.ts
src/core/webview/taskOrganizationMessageHandler.ts
src/core/webview/webviewMessageHandler.ts
src/shared/globalFileNames.ts
src/utils/safeWriteJson.ts
webview-ui/package.json
webview-ui/src/components/history/DeleteFoldersDialog.tsx
webview-ui/src/components/history/DraggableTaskEntry.tsx
webview-ui/src/components/history/FolderNameDialog.tsx
webview-ui/src/components/history/HistoryPreview.tsx
webview-ui/src/components/history/HistoryView.tsx
webview-ui/src/components/history/ManualFolderItem.tsx
webview-ui/src/components/history/PinButton.tsx
webview-ui/src/components/history/PinnedHistoryItem.tsx
webview-ui/src/components/history/SubtaskRow.tsx
webview-ui/src/components/history/TaskGroupItem.tsx
webview-ui/src/components/history/TaskItem.tsx
webview-ui/src/components/history/TaskItemFooter.tsx
webview-ui/src/components/history/TaskOrganizationDndSurface.tsx
webview-ui/src/components/history/TaskOrganizationErrorBoundary.tsx
webview-ui/src/components/history/TaskOrganizationInteractionContext.tsx
webview-ui/src/components/history/TaskOrganizationPointerSensor.ts
webview-ui/src/components/history/__tests__/DeleteFoldersDialog.spec.tsx
webview-ui/src/components/history/__tests__/DraggableTaskEntry.spec.tsx
webview-ui/src/components/history/__tests__/HistoryPreview.spec.tsx
webview-ui/src/components/history/__tests__/HistoryPreview.taskOrganization.spec.tsx
webview-ui/src/components/history/__tests__/HistoryView.taskOrganization.spec.tsx
webview-ui/src/components/history/__tests__/ManualFolderItem.spec.tsx
webview-ui/src/components/history/__tests__/PinButton.spec.tsx
webview-ui/src/components/history/__tests__/TaskItemFooter.spec.tsx
webview-ui/src/components/history/__tests__/TaskOrganizationDndSurface.spec.tsx
webview-ui/src/components/history/__tests__/TaskOrganizationErrorBoundary.spec.tsx
webview-ui/src/components/history/__tests__/TaskOrganizationInteractionContext.spec.tsx
webview-ui/src/components/history/__tests__/TaskOrganizationPointerSensor.spec.ts
webview-ui/src/components/history/__tests__/taskOrganizationModel.setup.ts
webview-ui/src/components/history/__tests__/taskOrganizationModel.spec.ts
webview-ui/src/components/history/__tests__/taskOrganizationModel.vitest.config.ts
webview-ui/src/components/history/__tests__/useTaskOrganizationDnd.spec.tsx
webview-ui/src/components/history/taskOrganizationModel.ts
webview-ui/src/components/history/types.ts
webview-ui/src/components/history/useTaskOrganizationDnd.ts
webview-ui/src/context/ExtensionStateContext.tsx
webview-ui/src/context/__tests__/ExtensionStateContext.taskOrganization.spec.tsx
webview-ui/src/i18n/__tests__/translation-parity.spec.ts
webview-ui/src/i18n/locales/ca/chat.json
webview-ui/src/i18n/locales/ca/history.json
webview-ui/src/i18n/locales/de/chat.json
webview-ui/src/i18n/locales/de/history.json
webview-ui/src/i18n/locales/en/chat.json
webview-ui/src/i18n/locales/en/history.json
webview-ui/src/i18n/locales/es/chat.json
webview-ui/src/i18n/locales/es/history.json
webview-ui/src/i18n/locales/fr/chat.json
webview-ui/src/i18n/locales/fr/history.json
webview-ui/src/i18n/locales/hi/chat.json
webview-ui/src/i18n/locales/hi/history.json
webview-ui/src/i18n/locales/id/chat.json
webview-ui/src/i18n/locales/id/history.json
webview-ui/src/i18n/locales/it/chat.json
webview-ui/src/i18n/locales/it/history.json
webview-ui/src/i18n/locales/ja/chat.json
webview-ui/src/i18n/locales/ja/history.json
webview-ui/src/i18n/locales/ko/chat.json
webview-ui/src/i18n/locales/ko/history.json
webview-ui/src/i18n/locales/nl/chat.json
webview-ui/src/i18n/locales/nl/history.json
webview-ui/src/i18n/locales/pl/chat.json
webview-ui/src/i18n/locales/pl/history.json
webview-ui/src/i18n/locales/pt-BR/chat.json
webview-ui/src/i18n/locales/pt-BR/history.json
webview-ui/src/i18n/locales/ru/chat.json
webview-ui/src/i18n/locales/ru/history.json
webview-ui/src/i18n/locales/tr/chat.json
webview-ui/src/i18n/locales/tr/history.json
webview-ui/src/i18n/locales/vi/chat.json
webview-ui/src/i18n/locales/vi/history.json
webview-ui/src/i18n/locales/zh-CN/chat.json
webview-ui/src/i18n/locales/zh-CN/history.json
webview-ui/src/i18n/locales/zh-TW/chat.json
webview-ui/src/i18n/locales/zh-TW/history.json
webview-ui/vitest.setup.ts
```

### Files excluded

- All 114 upstream-only paths in the raw two-dot diff.
- Stats service, dashboard, usage types, provider recording, and package NLS files.
- Any task-organization copy from Stats commit `191bf51e6`; PR-3 is the authority.

### Conflict risk

- Eleven original overlaps with Stats are resolved by ownership here.
- Three paths inherit PR-2 IPC changes and require additive merge: [vscode-extension-host.ts](../../packages/types/src/vscode-extension-host.ts), [ClineProvider.ts](../../src/core/webview/ClineProvider.ts), and [webviewMessageHandler.ts](../../src/core/webview/webviewMessageHandler.ts).
- `pnpm-lock.yaml` is high-risk and must be regenerated only after [webview-ui/package.json](../../webview-ui/package.json) is final.
- Localization JSON conflicts are mechanical but parity-sensitive.

### Verification commands

```powershell
cd src; npx vitest run core/task-persistence/__tests__/TaskOrganizationStore.spec.ts core/webview/__tests__/taskOrganizationMessageHandler.spec.ts
```

```powershell
cd webview-ui; npx vitest run src/components/history src/context/__tests__/ExtensionStateContext.taskOrganization.spec.tsx src/i18n/__tests__/translation-parity.spec.ts
```

```powershell
pnpm --filter @roo-code/types check-types; pnpm --filter zoo-code check-types; pnpm --filter @roo-code/vscode-webview check-types; pnpm --filter @roo-code/vscode-webview lint
```

No existing E2E test directly proves real extension-host workspace switching. Add [apps/vscode-e2e/src/suite/task-organization.test.ts](../../apps/vscode-e2e/src/suite/task-organization.test.ts) in PR-3 and run:

```powershell
pnpm --filter @roo-code/vscode-e2e test:ci:mock
```

## PR-4, MiMo model-aware tool-call retention policy

### Purpose, WHY

Some model/provider combinations emit parallel or duplicate native tool calls they cannot reliably support, while other providers depend on parallel execution. A global one-call limit would regress capable providers. This PR introduces model capability metadata and a retention policy that restricts MiMo where required, quarantines ghost calls, and leaves known-provider defaults intact.

It must exist separately because this is provider capability policy layered over PR-1's error pipeline and PR-2's execution path. Reviewers can validate the policy matrix without re-reviewing interception or shell architecture.

- **Source branch:** exactly six exclusive commits from `fix/mimo-parallel-tool-call-policy`: `d17049f01` through `b7edba688` as listed above.
- **Dependencies:** PR-1 and PR-2 merged. PR-3 should be merged first to stabilize the common base, though it has zero exact overlap.
- **Complexity:** 🟡 STANDARD.

### Files included, exact 20-file manifest

- [packages/telemetry/src/TelemetryService.ts](../../packages/telemetry/src/TelemetryService.ts)
- [packages/types/src/model.ts](../../packages/types/src/model.ts)
- [packages/types/src/providers/mimo.ts](../../packages/types/src/providers/mimo.ts)
- [packages/types/src/telemetry.ts](../../packages/types/src/telemetry.ts)
- [src/api/index.ts](../../src/api/index.ts)
- [src/api/providers/__tests__/mimo.spec.ts](../../src/api/providers/__tests__/mimo.spec.ts)
- [src/api/providers/mimo.ts](../../src/api/providers/mimo.ts)
- [src/core/assistant-message/NativeToolCallParser.ts](../../src/core/assistant-message/NativeToolCallParser.ts)
- [src/core/assistant-message/ToolCallRetentionPolicy.ts](../../src/core/assistant-message/ToolCallRetentionPolicy.ts)
- [src/core/assistant-message/__tests__/NativeToolCallParser.spec.ts](../../src/core/assistant-message/__tests__/NativeToolCallParser.spec.ts)
- [src/core/assistant-message/__tests__/ToolCallRetentionPolicy-telemetry.spec.ts](../../src/core/assistant-message/__tests__/ToolCallRetentionPolicy-telemetry.spec.ts)
- [src/core/assistant-message/__tests__/ToolCallRetentionPolicy.spec.ts](../../src/core/assistant-message/__tests__/ToolCallRetentionPolicy.spec.ts)
- [src/core/assistant-message/__tests__/presentAssistantMessage-parser-dedup.integration.spec.ts](../../src/core/assistant-message/__tests__/presentAssistantMessage-parser-dedup.integration.spec.ts)
- [src/core/assistant-message/presentAssistantMessage.ts](../../src/core/assistant-message/presentAssistantMessage.ts)
- [src/core/prompts/tools/native-tools/execute_command.ts](../../src/core/prompts/tools/native-tools/execute_command.ts)
- [src/core/task/Task.ts](../../src/core/task/Task.ts)
- [src/core/task/__tests__/tool-call-policy.spec.ts](../../src/core/task/__tests__/tool-call-policy.spec.ts)
- [src/core/tools/ExecuteCommandTool.ts](../../src/core/tools/ExecuteCommandTool.ts)
- [src/core/tools/error-interception/StructuralValidator.ts](../../src/core/tools/error-interception/StructuralValidator.ts)
- [src/shared/tools.ts](../../src/shared/tools.ts)

### Files excluded

- All 14 inherited/rebased Error commits and every error-interception file not in the 20-file exclusive delta.
- Six historical reports, `.gitignore`, E2E Error fixtures, profile/ripgrep/webview drift, and any upstream-only path.
- Any branch-tip merge or whole-tree transplant.

### Conflict risk

- Five files overlap PR-1 and three overlap PR-2. Resolve by intent, never by selecting an entire side.
- Three later overlaps with Stats: [providers/mimo.ts](../../packages/types/src/providers/mimo.ts), [mimo.spec.ts](../../src/api/providers/__tests__/mimo.spec.ts), and [Task.ts](../../src/core/task/Task.ts).
- Telemetry schema and emitter must land atomically.

### Verification commands

```powershell
cd src; npx vitest run core/assistant-message/__tests__/ToolCallRetentionPolicy.spec.ts core/assistant-message/__tests__/ToolCallRetentionPolicy-telemetry.spec.ts core/assistant-message/__tests__/NativeToolCallParser.spec.ts core/assistant-message/__tests__/presentAssistantMessage-parser-dedup.integration.spec.ts core/task/__tests__/tool-call-policy.spec.ts api/providers/__tests__/mimo.spec.ts core/tools/error-interception
```

```powershell
pnpm --filter @roo-code/types test; pnpm --filter @roo-code/types check-types; pnpm --filter @roo-code/telemetry check-types; pnpm --filter zoo-code lint; pnpm --filter zoo-code check-types
```

## PR-5, Local usage accounting and dashboard

### Purpose, WHY

Users cannot audit local token use, costs, sessions, modes, and provider/model distribution without sending usage data elsewhere or manually reading task history. This PR records final API-attempt usage locally, aggregates it defensively, and exposes a typed dashboard query/export/clear flow.

It must exist separately because usage accounting is a local data pipeline with privacy, durability, aggregation, IPC, and dashboard concerns. It should not own history DnD infrastructure or provider-specific configured-price normalization. Separating PR-6 makes the core event schema reviewable even if some providers initially report unknown cost.

- **Source branch:** `feature/local-usage-stats`, reconstructed by concern on top of PR-1 through PR-4. Exclude commit `191bf51e6`; split `9968e390d` surgically.
- **Dependencies:** PR-1, PR-2, PR-3, and PR-4 merged.
- **Complexity:** 🔴 HEAVY.

### Files included, exact product manifest

The final candidate includes the following. Every locale glob means the exact 18 locales `ca`, `de`, `en`, `es`, `fr`, `hi`, `id`, `it`, `ja`, `ko`, `nl`, `pl`, `pt-BR`, `ru`, `tr`, `vi`, `zh-CN`, and `zh-TW`.

- [packages/types/src/__tests__/usage-stats.spec.ts](../../packages/types/src/__tests__/usage-stats.spec.ts)
- [packages/types/src/index.ts](../../packages/types/src/index.ts)
- [packages/types/src/providers/mimo.ts](../../packages/types/src/providers/mimo.ts)
- [packages/types/src/providers/qwen-code.ts](../../packages/types/src/providers/qwen-code.ts)
- [packages/types/src/usage-stats.ts](../../packages/types/src/usage-stats.ts)
- [packages/types/src/vscode-extension-host.ts](../../packages/types/src/vscode-extension-host.ts)
- [packages/types/src/vscode.ts](../../packages/types/src/vscode.ts)
- [src/activate/registerCommands.ts](../../src/activate/registerCommands.ts)
- [src/api/providers/__tests__/anthropic-vertex.spec.ts](../../src/api/providers/__tests__/anthropic-vertex.spec.ts)
- [src/api/providers/__tests__/kenari.spec.ts](../../src/api/providers/__tests__/kenari.spec.ts)
- [src/api/providers/__tests__/mimo.spec.ts](../../src/api/providers/__tests__/mimo.spec.ts)
- [src/api/providers/__tests__/mistral.spec.ts](../../src/api/providers/__tests__/mistral.spec.ts)
- [src/api/providers/__tests__/moonshot.spec.ts](../../src/api/providers/__tests__/moonshot.spec.ts)
- [src/api/providers/__tests__/openai-usage-tracking.spec.ts](../../src/api/providers/__tests__/openai-usage-tracking.spec.ts)
- [src/api/providers/__tests__/openai.spec.ts](../../src/api/providers/__tests__/openai.spec.ts)
- [src/api/providers/anthropic-vertex.ts](../../src/api/providers/anthropic-vertex.ts)
- [src/api/providers/kenari.ts](../../src/api/providers/kenari.ts)
- [src/api/providers/mistral.ts](../../src/api/providers/mistral.ts)
- [src/api/providers/moonshot.ts](../../src/api/providers/moonshot.ts)
- [src/api/providers/openai-codex.ts](../../src/api/providers/openai-codex.ts)
- [src/api/providers/openai.ts](../../src/api/providers/openai.ts)
- [src/core/task/Task.ts](../../src/core/task/Task.ts)
- [src/core/task/__tests__/Task.usage-stats.spec.ts](../../src/core/task/__tests__/Task.usage-stats.spec.ts)
- [src/core/webview/ClineProvider.ts](../../src/core/webview/ClineProvider.ts)
- [src/core/webview/__tests__/usageStatsMessageHandler.spec.ts](../../src/core/webview/__tests__/usageStatsMessageHandler.spec.ts)
- [src/core/webview/usageStatsMessageHandler.ts](../../src/core/webview/usageStatsMessageHandler.ts)
- [src/core/webview/webviewMessageHandler.ts](../../src/core/webview/webviewMessageHandler.ts)
- [src/package.json](../../src/package.json)
- [src/package.nls.ca.json](../../src/package.nls.ca.json)
- [src/package.nls.de.json](../../src/package.nls.de.json)
- [src/package.nls.json](../../src/package.nls.json)
- [src/package.nls.es.json](../../src/package.nls.es.json)
- [src/package.nls.fr.json](../../src/package.nls.fr.json)
- [src/package.nls.hi.json](../../src/package.nls.hi.json)
- [src/package.nls.id.json](../../src/package.nls.id.json)
- [src/package.nls.it.json](../../src/package.nls.it.json)
- [src/package.nls.ja.json](../../src/package.nls.ja.json)
- [src/package.nls.ko.json](../../src/package.nls.ko.json)
- [src/package.nls.nl.json](../../src/package.nls.nl.json)
- [src/package.nls.pl.json](../../src/package.nls.pl.json)
- [src/package.nls.pt-BR.json](../../src/package.nls.pt-BR.json)
- [src/package.nls.ru.json](../../src/package.nls.ru.json)
- [src/package.nls.tr.json](../../src/package.nls.tr.json)
- [src/package.nls.vi.json](../../src/package.nls.vi.json)
- [src/package.nls.zh-CN.json](../../src/package.nls.zh-CN.json)
- [src/package.nls.zh-TW.json](../../src/package.nls.zh-TW.json)
- [src/services/command/__tests__/built-in-commands.spec.ts](../../src/services/command/__tests__/built-in-commands.spec.ts)
- [src/services/stats/UsageAggregator.ts](../../src/services/stats/UsageAggregator.ts)
- [src/services/stats/UsageEventStore.ts](../../src/services/stats/UsageEventStore.ts)
- [src/services/stats/UsageRecorder.ts](../../src/services/stats/UsageRecorder.ts)
- [src/services/stats/UsageStatsService.ts](../../src/services/stats/UsageStatsService.ts)
- [src/services/stats/__tests__/UsageAggregator.spec.ts](../../src/services/stats/__tests__/UsageAggregator.spec.ts)
- [src/services/stats/__tests__/UsageEventStore.spec.ts](../../src/services/stats/__tests__/UsageEventStore.spec.ts)
- [src/services/stats/__tests__/UsageStatsService.spec.ts](../../src/services/stats/__tests__/UsageStatsService.spec.ts)
- [src/services/stats/__tests__/costRecalculation.spec.ts](../../src/services/stats/__tests__/costRecalculation.spec.ts)
- [src/services/stats/costRecalculation.ts](../../src/services/stats/costRecalculation.ts)
- [src/services/stats/index.ts](../../src/services/stats/index.ts)
- [src/vitest.config.ts](../../src/vitest.config.ts)
- [webview-ui/src/App.tsx](../../webview-ui/src/App.tsx)
- [webview-ui/src/components/dashboard/DashboardSummary.tsx](../../webview-ui/src/components/dashboard/DashboardSummary.tsx)
- [webview-ui/src/components/dashboard/DashboardView.tsx](../../webview-ui/src/components/dashboard/DashboardView.tsx)
- [webview-ui/src/components/dashboard/SessionDetail.tsx](../../webview-ui/src/components/dashboard/SessionDetail.tsx)
- [webview-ui/src/components/dashboard/SessionList.tsx](../../webview-ui/src/components/dashboard/SessionList.tsx)
- [webview-ui/src/components/dashboard/__tests__/DashboardSummary.spec.tsx](../../webview-ui/src/components/dashboard/__tests__/DashboardSummary.spec.tsx)
- [webview-ui/src/components/dashboard/__tests__/DashboardView.spec.tsx](../../webview-ui/src/components/dashboard/__tests__/DashboardView.spec.tsx)
- [webview-ui/src/components/dashboard/__tests__/SessionDetail.spec.tsx](../../webview-ui/src/components/dashboard/__tests__/SessionDetail.spec.tsx)
- [webview-ui/src/components/dashboard/__tests__/SessionList.spec.tsx](../../webview-ui/src/components/dashboard/__tests__/SessionList.spec.tsx)
- [webview-ui/src/components/stats/UsageHeatmap.tsx](../../webview-ui/src/components/stats/UsageHeatmap.tsx)
- [webview-ui/src/components/stats/__tests__/UsageHeatmap.spec.tsx](../../webview-ui/src/components/stats/__tests__/UsageHeatmap.spec.tsx)
- [webview-ui/src/i18n/locales/ca/dashboard.json](../../webview-ui/src/i18n/locales/ca/dashboard.json)
- [webview-ui/src/i18n/locales/de/dashboard.json](../../webview-ui/src/i18n/locales/de/dashboard.json)
- [webview-ui/src/i18n/locales/en/dashboard.json](../../webview-ui/src/i18n/locales/en/dashboard.json)
- [webview-ui/src/i18n/locales/es/dashboard.json](../../webview-ui/src/i18n/locales/es/dashboard.json)
- [webview-ui/src/i18n/locales/fr/dashboard.json](../../webview-ui/src/i18n/locales/fr/dashboard.json)
- [webview-ui/src/i18n/locales/hi/dashboard.json](../../webview-ui/src/i18n/locales/hi/dashboard.json)
- [webview-ui/src/i18n/locales/id/dashboard.json](../../webview-ui/src/i18n/locales/id/dashboard.json)
- [webview-ui/src/i18n/locales/it/dashboard.json](../../webview-ui/src/i18n/locales/it/dashboard.json)
- [webview-ui/src/i18n/locales/ja/dashboard.json](../../webview-ui/src/i18n/locales/ja/dashboard.json)
- [webview-ui/src/i18n/locales/ko/dashboard.json](../../webview-ui/src/i18n/locales/ko/dashboard.json)
- [webview-ui/src/i18n/locales/nl/dashboard.json](../../webview-ui/src/i18n/locales/nl/dashboard.json)
- [webview-ui/src/i18n/locales/pl/dashboard.json](../../webview-ui/src/i18n/locales/pl/dashboard.json)
- [webview-ui/src/i18n/locales/pt-BR/dashboard.json](../../webview-ui/src/i18n/locales/pt-BR/dashboard.json)
- [webview-ui/src/i18n/locales/ru/dashboard.json](../../webview-ui/src/i18n/locales/ru/dashboard.json)
- [webview-ui/src/i18n/locales/tr/dashboard.json](../../webview-ui/src/i18n/locales/tr/dashboard.json)
- [webview-ui/src/i18n/locales/vi/dashboard.json](../../webview-ui/src/i18n/locales/vi/dashboard.json)
- [webview-ui/src/i18n/locales/zh-CN/dashboard.json](../../webview-ui/src/i18n/locales/zh-CN/dashboard.json)
- [webview-ui/src/i18n/locales/zh-TW/dashboard.json](../../webview-ui/src/i18n/locales/zh-TW/dashboard.json)
- [webview-ui/src/i18n/locales/ca/stats.json](../../webview-ui/src/i18n/locales/ca/stats.json)
- [webview-ui/src/i18n/locales/de/stats.json](../../webview-ui/src/i18n/locales/de/stats.json)
- [webview-ui/src/i18n/locales/en/stats.json](../../webview-ui/src/i18n/locales/en/stats.json)
- [webview-ui/src/i18n/locales/es/stats.json](../../webview-ui/src/i18n/locales/es/stats.json)
- [webview-ui/src/i18n/locales/fr/stats.json](../../webview-ui/src/i18n/locales/fr/stats.json)
- [webview-ui/src/i18n/locales/hi/stats.json](../../webview-ui/src/i18n/locales/hi/stats.json)
- [webview-ui/src/i18n/locales/id/stats.json](../../webview-ui/src/i18n/locales/id/stats.json)
- [webview-ui/src/i18n/locales/it/stats.json](../../webview-ui/src/i18n/locales/it/stats.json)
- [webview-ui/src/i18n/locales/ja/stats.json](../../webview-ui/src/i18n/locales/ja/stats.json)
- [webview-ui/src/i18n/locales/ko/stats.json](../../webview-ui/src/i18n/locales/ko/stats.json)
- [webview-ui/src/i18n/locales/nl/stats.json](../../webview-ui/src/i18n/locales/nl/stats.json)
- [webview-ui/src/i18n/locales/pl/stats.json](../../webview-ui/src/i18n/locales/pl/stats.json)
- [webview-ui/src/i18n/locales/pt-BR/stats.json](../../webview-ui/src/i18n/locales/pt-BR/stats.json)
- [webview-ui/src/i18n/locales/ru/stats.json](../../webview-ui/src/i18n/locales/ru/stats.json)
- [webview-ui/src/i18n/locales/tr/stats.json](../../webview-ui/src/i18n/locales/tr/stats.json)
- [webview-ui/src/i18n/locales/vi/stats.json](../../webview-ui/src/i18n/locales/vi/stats.json)
- [webview-ui/src/i18n/locales/zh-CN/stats.json](../../webview-ui/src/i18n/locales/zh-CN/stats.json)
- [webview-ui/src/i18n/locales/zh-TW/stats.json](../../webview-ui/src/i18n/locales/zh-TW/stats.json)
- [webview-ui/src/utils/__tests__/formatNumber.spec.ts](../../webview-ui/src/utils/__tests__/formatNumber.spec.ts)
- [webview-ui/src/utils/formatNumber.ts](../../webview-ui/src/utils/formatNumber.ts)

The package-NLS brace is shorthand only. The extraction manifest must expand it to the exact 18 real paths, including [src/package.nls.json](../../src/package.nls.json) for English/default.

### Files excluded

- `.gitignore`, all 72 historical reports, `src-test-log.txt`, `src-test-log-tail.txt`, and `turbo-noncore-log.txt`.
- All 11 task-organization paths as imported by `191bf51e6`: PR-3 owns the contract/store/handler/file-write infrastructure.
- Specifically exclude [packages/types/src/task-organization.ts](../../packages/types/src/task-organization.ts), `src/core/task-persistence/**`, [src/core/webview/taskOrganizationMessageHandler.ts](../../src/core/webview/taskOrganizationMessageHandler.ts), [src/shared/globalFileNames.ts](../../src/shared/globalFileNames.ts), and [src/utils/safeWriteJson.ts](../../src/utils/safeWriteJson.ts) from the Stats patch.
- Upstream-only dependency/config/UI drift and all stale deletions from the raw two-dot diff.
- Combined-only provider paths assigned to PR-6.

### Conflict risk

- This is the conflict hub. It modifies PR-2/PR-3 IPC assembly, PR-2/PR-4 task orchestration, and PR-4 MiMo provider types/tests.
- Provider stream handlers may emit partial usage on retry or cancellation. Recording must occur once at finalization.
- NDJSON durability and query-time cost recalculation can disagree if event versioning is implicit.
- Dashboard refresh across multiple webview windows can loop unless refresh events are one-way invalidations.

### Verification commands

```powershell
cd packages/types; npx vitest run src/__tests__/usage-stats.spec.ts
```

```powershell
cd src; npx vitest run services/stats core/task/__tests__/Task.usage-stats.spec.ts core/webview/__tests__/usageStatsMessageHandler.spec.ts api/providers/__tests__/anthropic-vertex.spec.ts api/providers/__tests__/kenari.spec.ts api/providers/__tests__/mimo.spec.ts api/providers/__tests__/mistral.spec.ts api/providers/__tests__/moonshot.spec.ts api/providers/__tests__/openai-usage-tracking.spec.ts api/providers/__tests__/openai.spec.ts services/command/__tests__/built-in-commands.spec.ts
```

```powershell
cd webview-ui; npx vitest run src/components/dashboard src/components/stats src/utils/__tests__/formatNumber.spec.ts src/i18n/__tests__/translation-parity.spec.ts
```

```powershell
pnpm --filter @roo-code/types check-types; pnpm --filter zoo-code lint; pnpm --filter zoo-code check-types; pnpm --filter @roo-code/vscode-webview lint; pnpm --filter @roo-code/vscode-webview check-types
```

No existing E2E suite proves the complete dashboard IPC round trip. Add [apps/vscode-e2e/src/suite/usage-stats-dashboard.test.ts](../../apps/vscode-e2e/src/suite/usage-stats-dashboard.test.ts) and run:

```powershell
pnpm --filter @roo-code/vscode-e2e test:ci:mock
```

## PR-6, User-configured provider cost normalization

### Purpose, WHY

PR-5 can record cost only if provider streams emit it consistently. Several providers omit `totalCost` or ignore user-configured input/output prices, causing the dashboard to under-report spend and making providers incomparable. This PR normalizes configured-price cost calculation at provider completion boundaries and adds provider-focused regressions.

It must exist separately because it is provider behavior, not storage or dashboard behavior. Reviewers can validate formulas and streaming semantics provider by provider, while PR-5 remains a stable local accounting pipeline.

- **Source branch:** combined branch commits `f0a7c9c9d` and the provider-test subset of `fa8f19a6c`; inspect merge-resolution commit `c49e95fc6` only for [bedrock.ts](../../src/api/providers/bedrock.ts) reconciliation. Do not cherry-pick these commits whole.
- **Dependencies:** PR-5 merged.
- **Complexity:** 🟡 STANDARD.

### Files included, exact candidate manifest

- [src/api/providers/anthropic-vertex.ts](../../src/api/providers/anthropic-vertex.ts)
- [src/api/providers/bedrock.ts](../../src/api/providers/bedrock.ts)
- [src/api/providers/deepseek.ts](../../src/api/providers/deepseek.ts)
- [src/api/providers/kenari.ts](../../src/api/providers/kenari.ts)
- [src/api/providers/mistral.ts](../../src/api/providers/mistral.ts)
- [src/api/providers/moonshot.ts](../../src/api/providers/moonshot.ts)
- [src/api/providers/openai-compatible.ts](../../src/api/providers/openai-compatible.ts)
- [src/api/providers/openai.ts](../../src/api/providers/openai.ts)
- [src/api/providers/poe.ts](../../src/api/providers/poe.ts)
- [src/api/providers/qwen-code.ts](../../src/api/providers/qwen-code.ts)
- [src/api/providers/xai.ts](../../src/api/providers/xai.ts)
- [src/api/providers/__tests__/openai-compatible.spec.ts](../../src/api/providers/__tests__/openai-compatible.spec.ts)
- [src/api/providers/__tests__/openai.spec.ts](../../src/api/providers/__tests__/openai.spec.ts)

During extraction, add or retain focused tests beside every changed provider. Existing PR-5 provider tests may be modified only to assert the new cost behavior; they are not duplicated in the initial manifest above.

### Files excluded

- [apps/vscode-e2e/src/suite/tools/terminal-reuse-shell-race.test.ts](../../apps/vscode-e2e/src/suite/tools/terminal-reuse-shell-race.test.ts) and [src/integrations/terminal/BaseTerminal.ts](../../src/integrations/terminal/BaseTerminal.ts) from `fa8f19a6c`, because an E2E timeout is unrelated to provider cost.
- Stats services, usage types, dashboard components, task logic, and localization already owned by PR-5.
- The combined branch as a merge source.

### Conflict risk

- [moonshot.ts](../../src/api/providers/moonshot.ts), [openai.ts](../../src/api/providers/openai.ts), [anthropic-vertex.ts](../../src/api/providers/anthropic-vertex.ts), [kenari.ts](../../src/api/providers/kenari.ts), [mistral.ts](../../src/api/providers/mistral.ts), [qwen-code.ts](../../src/api/providers/qwen-code.ts), and their tests may already contain PR-5 usage-recording edits. Apply formula changes to the merged implementation.
- Provider units, cached token fields, missing rates, and stream-finalization shapes differ.
- [bedrock.ts](../../src/api/providers/bedrock.ts) contains a combined merge resolution; reconstruct behavior from current upstream plus the intended formula rather than selecting the combined file.

### Verification commands

```powershell
cd src; npx vitest run api/providers/__tests__/anthropic-vertex.spec.ts api/providers/__tests__/kenari.spec.ts api/providers/__tests__/mistral.spec.ts api/providers/__tests__/moonshot.spec.ts api/providers/__tests__/openai-compatible.spec.ts api/providers/__tests__/openai.spec.ts api/providers/__tests__/mimo.spec.ts api/providers/__tests__/openai-usage-tracking.spec.ts services/stats/__tests__/costRecalculation.spec.ts core/task/__tests__/Task.usage-stats.spec.ts
```

Add missing focused tests for Bedrock, DeepSeek, Poe, Qwen Code, and xAI in their existing provider test files. If a file does not exist on merged `main`, create:

- [src/api/providers/__tests__/deepseek.spec.ts](../../src/api/providers/__tests__/deepseek.spec.ts)
- [src/api/providers/__tests__/poe.spec.ts](../../src/api/providers/__tests__/poe.spec.ts)
- [src/api/providers/__tests__/qwen-code.spec.ts](../../src/api/providers/__tests__/qwen-code.spec.ts)
- [src/api/providers/__tests__/xai.spec.ts](../../src/api/providers/__tests__/xai.spec.ts)

Then run:

```powershell
cd src; npx vitest run api/providers
```

```powershell
pnpm --filter zoo-code lint; pnpm --filter zoo-code check-types
```

---

# 4. Integration Test Strategy

## 4.1 At each merge point

| Merge point | Required focused verification | Cross-feature scenario |
|---|---|---|
| After PR-1 | Error interception and parser suites; E2E mock suite | Invalid tool JSON produces one visible error and no duplicate call. |
| After PR-2 | Terminal, execute-command, shell settings, type, and terminal E2E suites | Explicit PowerShell/Bash/CMD selection round-trips UI → IPC → resolver → process with cancellation. |
| After PR-3 | Task store, handler, history/context, parity, and new workspace-switch E2E | Move/pin tasks in workspace A, switch to B/no-workspace, verify zero leakage, return to A and recover state. |
| After PR-4 | PR-1 suites plus MiMo policy/task/telemetry suites | MiMo ghost/extra calls are quarantined; a known provider without explicit metadata still executes supported parallel calls; shell execution remains correct. |
| After PR-5 | Stats service, task usage, IPC, dashboard, provider, history, shell, and MiMo focused suites | A tool attempt that errors, retries, executes a shell command, and succeeds records attempts exactly once and renders the final dashboard without corrupting history organization. |
| After PR-6 | All provider cost tests plus Stats cost recalculation and dashboard summary | User-configured prices produce identical provider `totalCost`, stored event cost, aggregate total, and displayed total. |

## 4.2 Candidate-wide quality gate

Run after each candidate's focused tests. Run again after the final sequential merge simulation:

```powershell
pnpm lint
pnpm check-types
pnpm test
pnpm knip
pnpm build
```

Then run the real extension-host smoke suite:

```powershell
pnpm --filter @roo-code/vscode-e2e test:ci:mock
```

Use `test:ci` only when the required real provider credentials and network conditions are available. Mock E2E remains mandatory for deterministic protocol coverage.

## 4.3 Mutual-exclusion gate

For each candidate before opening a PR:

1. Diff candidate against its exact current-main base.
2. Compare every changed path to that PR's expanded include manifest.
3. Reject branch-local docs, logs, scripts, upstream reversions, and unassigned combined-only paths.
4. For a downstream PR, inspect each prerequisite-owned shared file hunk. It must add only the downstream concern and retain all merged tests.
5. Confirm no candidate contains another feature's source commits.

Read-only commands:

```powershell
git diff --name-status upstream/main...<candidate-branch>
git log --oneline upstream/main..<candidate-branch>
git diff --check upstream/main...<candidate-branch>
```

Do not use endpoint two-dot file lists as the sole noise filter when a candidate is behind main. Regenerate every candidate after each prerequisite merge.

---

# 5. Implementation Plan, Delegatable Sub-tasks

## Sub-task 1, extract PR-1 Error

- **Exact files to create/modify:** PR-1's 24-file manifest above.
- **Prerequisites:** Refresh upstream main; verify Error tip `5c8c495e0` remains available as evidence.
- **Work boundary:** Error parser, classifier, transformer, state, presentation, tests, and two E2E fixture/suite edits only.
- **Verification suite:** Error interception and assistant-message tests plus E2E mock.
- **Exact commands:** PR-1 commands above.

## Sub-task 2, extract PR-2 Shell in parallel

- **Exact files to create/modify:** PR-2's 59-file manifest, including the combined-only terminal fixture.
- **Prerequisites:** Refresh upstream main; verify Shell tip `8e6799525` and fixture fix `5c5debed4`.
- **Work boundary:** Terminal settings/types/IPC, prompt context, command tool, resolver, scheduler, lifecycle, adapters, tests.
- **Verification suite:** Terminal integration, core tool/webview/prompt tests, webview settings, types, E2E mock.
- **Exact commands:** PR-2 commands above.

## Sub-task 3, extract PR-3 DnD after PR-1 and PR-2

- **Exact files to create/modify:** PR-3's 89-file manifest and new [apps/vscode-e2e/src/suite/task-organization.test.ts](../../apps/vscode-e2e/src/suite/task-organization.test.ts).
- **Prerequisites:** PR-1 and PR-2 merged; DnD's three commits available.
- **Work boundary:** Task-organization types/store/handler/IPC/history UI/localization/dependencies only.
- **Verification suite:** Store, handler, all history organization tests, context, parity, new E2E.
- **Exact commands:** PR-3 commands above.

## Sub-task 4, replay PR-4 MiMo after PR-3

- **Exact files to create/modify:** The exact 20-file MiMo-exclusive manifest.
- **Prerequisites:** PR-1 through PR-3 merged; replay only the six named commits.
- **Work boundary:** Capability metadata, retention policy, parser/presentation integration, task/tool hook, telemetry.
- **Verification suite:** MiMo provider, retention, parser, task, telemetry, and full Error regression suites.
- **Exact commands:** PR-4 commands above.

## Sub-task 5, reconstruct PR-5 Stats after PR-4

- **Exact files to create/modify:** PR-5's expanded manifest and new [apps/vscode-e2e/src/suite/usage-stats-dashboard.test.ts](../../apps/vscode-e2e/src/suite/usage-stats-dashboard.test.ts).
- **Prerequisites:** PR-1 through PR-4 merged; remove `191bf51e6`; split `9968e390d` by concern.
- **Work boundary:** Usage contracts, provider final usage fields, recording/store/aggregation, stats IPC, dashboard, stats localization. No task-organization infrastructure.
- **Verification suite:** Types, Stats services, Task usage, IPC, dashboard/heatmap, providers, parity, new E2E.
- **Exact commands:** PR-5 commands above.

## Sub-task 6, reconstruct PR-6 Provider Cost

- **Exact files to create/modify:** PR-6's 13-file initial manifest plus provider-local tests where absent.
- **Prerequisites:** PR-5 merged; source evidence commits `f0a7c9c9d`, `fa8f19a6c`, and `c49e95fc6` available.
- **Work boundary:** Provider completion cost formulas and tests only. No E2E timeout, terminal, Stats storage, or dashboard edits.
- **Verification suite:** All provider tests, Stats cost recalculation, Task usage, lint, and type check.
- **Exact commands:** PR-6 commands above.

## Sub-task 7, investigate codebase-index deletion separately

- **Exact files to inspect:** `src/services/code-index/**`, [packages/types/src/codebase-index.ts](../../packages/types/src/codebase-index.ts), [webview-ui/src/components/settings/CodeIndexSettings.tsx](../../webview-ui/src/components/settings/CodeIndexSettings.tsx), and non-analyzed refs/worktrees/stashes.
- **Prerequisites:** None; do not attach it to PR-1 through PR-6.
- **Work boundary:** Research only until a source patch and rationale are proven.
- **Verification suite:** Existing `src/services/code-index/__tests__/` after extraction.
- **Exact command:** `cd src; npx vitest run services/code-index`.

## Sub-task 8, sequential integration simulation

- **Exact files to create/modify:** No product file by design; use clean candidate refs/worktrees managed by VP.
- **Prerequisites:** All six candidates ready.
- **Work boundary:** Simulate merge order PR-1/PR-2 → PR-3 → PR-4 → PR-5 → PR-6, regenerating each downstream diff.
- **Verification suite:** Every merge-point suite in Section 4, then root quality gate and E2E mock.
- **Exact commands:** Section 4.2 commands.

---

# 6. PR Description Contract

Every upstream PR body must begin with these four fields before implementation details:

```text
Problem: What user-visible or system failure exists today?
Why this PR: Why is this concern independently reviewable and necessary?
Scope: Which boundary and exact behavior change?
Non-goals: Which neighboring feature PRs are explicitly excluded?
```

Then include:

1. Data flow across UI, typed IPC, extension host, storage/provider/runtime, and response.
2. Exact test commands and observed results.
3. Dependency line, including the prerequisite PR number when known.
4. Shared-file note identifying downstream PRs expected to touch the same file later.
5. Exclusion note confirming no historical reports, helper scripts, stale upstream reversions, or unrelated changesets are present.

This contract answers the user's core concern: each PR states not only what changed, but **why the PR exists as its own upstream contribution**.
