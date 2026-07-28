# Architect Task Report: Fine-Grained Mutually Exclusive PR Plan

## Overview

This report replaces the six-PR topology in [the current split design](pr-split-design.md) with three selectable decompositions. The source evidence is [the five-branch analysis](analysis-report.md) and [the exact overlap matrix](file-overlap-matrix.md).

The plans contain **11, 17, and 28 PRs**. In every plan:

1. A PR is compiled and tested against its declared prerequisite merge commit.
2. Two concurrently open PRs never carry changes to the same path.
3. If a downstream concern must modify a path owned by a prerequisite, the prerequisite must merge and close before the downstream PR opens.
4. Contracts land before consumers, but contract tests remain in the same PR as the contract.
5. Implementation and its focused tests remain together. A tests-only follow-up was rejected because it would leave an under-verified intermediate merge or intentionally failing CI.
6. Every path has one owner inside a review wave. Downstream additive edits are permitted only after the previous owner has merged.
7. Counts and lines are planning estimates derived from branch-side stats. Extraction must regenerate exact counts from the clean candidate diff.

### Recommendation

Choose **Option B, Fine Split, 17 PRs**. It is the smallest plan that consistently separates contracts, extension-host implementation, and webview UI while keeping the longest dependency chain to approximately ten merges. Option A still leaves two review units above 8,000 changed lines. Option C offers the smallest reviews, but its 28-PR chain creates excessive rebase, CI, and maintainer coordination cost.

---

# 1. Technical Specification

## 1.1 Goals and core constraints

- Reduce each review unit to one reason for change.
- Preserve a clean frontend-to-extension-host-to-runtime flow.
- Keep every candidate independently compilable and CI-green after its prerequisites.
- Prevent open-PR path overlap, not merely semantic overlap.
- Keep the Stats work behind stabilized Error, Shell, Task Organization, and MiMo contracts.
- Exclude historical reports, helper scripts, logs, stale upstream drift, and changesets from product PRs.
- Keep task-organization infrastructure owned by the Task Organization chain. Stats consumes it but does not reintroduce it.
- Keep configured provider-price formulas outside the core Stats pipeline.

## 1.2 Cross-domain data flows and type bindings

### Error interception

```text
tool/parser failure
  -> classifier and structural validation
  -> non-recursive interception and message transformation
  -> assistant-message parser/presentation integration
  -> existing assistant stream
  -> chat-visible diagnostic and model guidance
```

The contract starts in [error-interception types](../../src/core/tools/error-interception/types.ts), is validated by [the structural validator](../../src/core/tools/error-interception/StructuralValidator.ts), and crosses the presentation boundary in [assistant-message presentation](../../src/core/assistant-message/presentAssistantMessage.ts). Unknown errors retain their original diagnostic. An interception failure cannot recursively enter the interceptor.

### Shell execution

```text
terminal settings cached state
  -> typed webview settings message
  -> extension-host message router
  -> command tool and task orchestration
  -> shell/profile resolver
  -> scheduler, lifecycle, registry
  -> VS Code terminal or Execa adapter
  -> ordered output, exit status, structured tool result
```

The transport contract is owned by [terminal types](../../packages/types/src/terminal.ts), [global settings](../../packages/types/src/global-settings.ts), and [extension-host messages](../../packages/types/src/vscode-extension-host.ts). The settings UI in [terminal settings](../../webview-ui/src/components/settings/TerminalSettings.tsx) must bind to local cached state. Explicit invalid shell selection returns a structured error through [the command tool](../../src/core/tools/ExecuteCommandTool.ts).

### Task organization

```text
history folder, pin, or drag action
  -> typed task-organization message
  -> extension-host handler
  -> workspace-scoped store
  -> atomic safe JSON write
  -> extension-state refresh
  -> history model and UI reconciliation
```

The canonical contract is [task-organization types](../../packages/types/src/task-organization.ts). Persistence is owned by [the task organization store](../../src/core/task-persistence/TaskOrganizationStore.ts), transport by [the task organization handler](../../src/core/webview/taskOrganizationMessageHandler.ts), and frontend state by [the extension-state context](../../webview-ui/src/context/ExtensionStateContext.tsx). No-workspace mode must expose no workspace-specific folders. Malformed persistence must not erase task history.

### MiMo tool-call policy

```text
model capability metadata
  -> provider/API configuration
  -> pure retention-policy decision
  -> parser and task enforcement
  -> retained, quarantined, or rejected call
  -> typed telemetry event
```

Capability contracts are owned by [model types](../../packages/types/src/model.ts), [MiMo provider types](../../packages/types/src/providers/mimo.ts), and [telemetry types](../../packages/types/src/telemetry.ts). The pure decision belongs to [the retention policy](../../src/core/assistant-message/ToolCallRetentionPolicy.ts). Known providers without explicit capability metadata preserve existing parallel behavior.

### Local usage stats and provider cost

```text
provider final usage and totalCost
  -> task final-attempt hook
  -> usage recorder
  -> append-only event store
  -> aggregation and optional cost recalculation
  -> typed stats request/response IPC
  -> dashboard, sessions, and heatmap
```

The stable event/query contract is [usage-stats types](../../packages/types/src/usage-stats.ts). Recording, storage, and aggregation are isolated under [the stats service](../../src/services/stats/). Typed webview transport extends [extension-host messages](../../packages/types/src/vscode-extension-host.ts). Provider-specific configured-price normalization remains a downstream concern under [provider implementations](../../src/api/providers/).

Store or dashboard failures must not fail a task. A truncated final event record is ignored and counted. Clear, export, and query requests terminate with typed success or failure. Refresh notifications are one-way invalidations to prevent multi-window feedback loops.

## 1.3 Operational meaning of mutual exclusion

There are two legal relationships:

- **Parallel siblings:** path-disjoint and may be open together.
- **Sequential dependency:** may eventually touch a prerequisite-owned path, but opens only after that prerequisite is merged and its branch is regenerated from current upstream main.

The PR manager must reject a candidate if its changed-path set intersects any other open candidate. This is stricter than assigning different hunks in one file to different open PRs.

---

# 2. Architecture Decisions

## Option A, Standard / Right Way: Moderate Split, 11 PRs

Split only the four heavy features. Keep MiMo and provider cost intact.

- **Effort:** Medium-high, 11 extraction and CI cycles.
- **Risk:** Medium. Shell runtime, Task Organization UI, and Stats UI remain large.
- **Outcome:** Meaningful improvement over six PRs, but three reviews still exceed a comfortable upstream review size.

| PR# | Name | Files | Lines, approx. | WHY | Dependencies |
|---|---|---:|---:|---|---|
| A01 | Error classification core | 13 | 6,000 | Make classification, validation, transformation, and interception reviewable without parser integration. | None |
| A02 | Error parser and presentation integration | 11 | 2,900 | Connect the proven core to assistant messages and E2E behavior. | A01 |
| A03 | Shell runtime and lifecycle | 28 | 8,000 | Establish resolver, scheduler, lifecycle, registry, and process adapters as one runtime subsystem. | None |
| A04 | Shell contracts, command wiring, prompts, and settings | 31 | 3,300 | Expose the runtime through typed settings, IPC, command execution, and UI. | A03 |
| A05 | Task organization contract, store, and IPC | 14 | 2,700 | Establish workspace-safe persistence and transport before UI consumers. | A04 |
| A06 | Task folders, pinning, and DnD UI | 76 | 8,800 | Deliver the complete history interaction layer and translations on the stable backend. | A05 |
| A07 | MiMo capability and retention policy | 20 | 2,900 | Add one model-aware policy without mixing Stats or provider-cost behavior. | A02, A04 |
| A08 | Usage contracts, recording, storage, and aggregation | 24 | 8,000 | Create the local, failure-isolated accounting pipeline. | A02, A04, A05, A07 |
| A09 | Provider final-usage capture | 14 | 1,300 | Normalize base provider usage fields and record final attempts once. | A08 |
| A10 | Stats IPC, dashboard, sessions, heatmap, commands, and localization | 72 | 8,700 | Expose the stable accounting service to users. | A06, A08, A09 |
| A11 | Configured provider-cost normalization | 13-18 | 700-1,500 | Fix provider formulas independently from storage and UI. | A09, A10 |

### Option A dependency DAG

```text
A01 -> A02 -----------------------> A07 -----> A08 -> A09 -> A10 -> A11
A03 -> A04 -> A05 -> A06 ------------------------------^ 
              \------------------> A08
```

Parallel opening is safe for A01 and A03. A06 may be reviewed in parallel with A07 only after A05 and A04 are merged because their candidate path sets are disjoint. All later nodes open only after every incoming node merges.

## Option B, Practical / Pragmatic Way: Fine Split, 17 PRs

Split every feature at module and layer boundaries. This is the recommended plan.

- **Effort:** High, 17 extraction and CI cycles.
- **Risk:** Low. Most reviews stay below 4,000 changed lines, and shared contract files stabilize early.
- **Outcome:** Good reviewer focus without the coordination burden of per-sub-feature micro-PRs.

| PR# | Name | Files | Lines, approx. | WHY | Dependencies |
|---|---|---:|---:|---|---|
| B01 | Error contracts and classification | 6 | 3,000 | Define deterministic error vocabulary and matching rules. | None |
| B02 | Error transformation and interception runtime | 7 | 3,000 | Turn classified failures into bounded, non-recursive recovery messages. | B01 |
| B03 | Error assistant-message and E2E integration | 11 | 2,900 | Prove parser, presentation, and user-visible behavior together. | B02 |
| B04 | Shell settings and shared contracts | 8 | 1,000 | Land backward-compatible terminal settings and UI binding before runtime consumers. | None |
| B05 | Shell and profile resolution primitives | 10 | 2,600 | Resolve executable, profile, invocation, and environment independently of lifecycle. | B04 |
| B06 | Terminal scheduling, lifecycle, and registry | 14 | 4,800 | Make concurrency, cancellation, reuse, and state transitions independently reviewable. | B05 |
| B07 | Command tool, prompt, IPC, and E2E shell integration | 27 | 2,900 | Connect the stable terminal runtime to task execution and the webview. | B06 |
| B08 | Task organization contract and persistence | 8 | 2,100 | Define workspace identity, schema, atomic storage, and recovery. | B04 |
| B09 | Task organization extension IPC and frontend context | 8 | 1,300 | Round-trip organization state without adding interaction UI yet. | B07, B08 |
| B10 | History folders, pinning, DnD, accessibility, dependencies, and localization | 74 | 8,000 | Deliver one complete user workflow on a stable transport. | B09 |
| B11 | MiMo capability and provider binding | 7 | 650 | Introduce capability metadata and provider/API binding without changing execution. | B01, B04 |
| B12 | MiMo retention enforcement and telemetry | 13 | 2,250 | Apply and observe policy through parser, task, and command boundaries. | B03, B07, B11 |
| B13 | Usage event contract and durable event store | 12 | 3,000 | Stabilize versioned local events and tolerant append/read behavior. | B08, B12 |
| B14 | Usage aggregation, recalculation, and service facade | 7 | 3,800 | Provide deterministic queries over the durable event store. | B13 |
| B15 | Provider and task usage capture | 16 | 1,900 | Record exactly one event at final attempt completion. | B12, B13 |
| B16 | Stats IPC, dashboard, sessions, heatmap, commands, and localization | 75 | 8,500 | Expose queries and user controls after backend semantics are fixed. | B09, B10, B14, B15 |
| B17 | Configured provider-cost normalization | 13-18 | 700-1,500 | Correct provider formulas without reopening Stats service or UI files. | B15, B16 |

### Option B dependency DAG

```text
B01 -> B02 -> B03 -----------------------------> B12
  \-----------------------> B11 -----------------^

B04 -> B05 -> B06 -> B07 -> B09 -> B10 -----------------------> B16 -> B17
  \---------------> B08 ----^       \-> B13 -> B14 ------------^
                                      \-------> B15 -------------^
B12 -------------------------------------------> B13, B15
```

Safe parallel waves include B01 with B04, B02 with B05, B03 with B06, B08 with B11, and B10 with B12 after their prerequisites merge. B13 and B15 cannot open together if extraction shows shared usage-type paths; the default ordering is B13 first, then B15.

## Option C, Staging / Incremental Way: Maximum Split, 28 PRs

Aggressively stage contracts, pure engines, adapters, transport, and UI sub-features. This maximizes reviewer focus but requires strict merge-wave management.

- **Effort:** Very high, 28 extraction and CI cycles.
- **Risk:** Low per PR, medium-high program risk from long chains, repeated regeneration, and maintainer fatigue.
- **Outcome:** Reviews usually stay below 2,500 lines. Total elapsed merge time is longest.

| PR# | Name | Files | Lines, approx. | WHY | Dependencies |
|---|---|---:|---:|---|---|
| C01 | Error types, patterns, and classifier | 5 | 2,400 | Define the error taxonomy and matching rules. | None |
| C02 | Structural validation and task error state | 4 | 850 | Isolate structural checks and per-task deduplication state. | C01 |
| C03 | Message transformation and interceptor | 4 | 2,750 | Produce truthful bounded recovery output without parser coupling. | C02 |
| C04 | Error parser, presentation, and E2E integration | 11 | 2,900 | Connect the complete core to user-visible behavior. | C03 |
| C05 | Terminal settings schema and UI | 8 | 1,000 | Land typed configuration and cached-state UI behavior. | None |
| C06 | Shell, profile, invocation, and environment resolution | 10 | 2,600 | Review cross-platform selection and quoting as pure resolution. | C05 |
| C07 | Command scheduler, lifecycle, and trace | 8 | 3,000 | Review queueing, cancellation, and terminal state transitions. | C06 |
| C08 | Terminal registry and process adapters | 10 | 2,400 | Review reuse and VS Code/Execa process parity. | C07 |
| C09 | Command tool and task wiring | 7 | 1,400 | Connect the terminal runtime to task execution. | C08 |
| C10 | Shell prompts, webview IPC, extension activation, and E2E | 16 | 1,900 | Complete the user-facing shell route and runtime smoke proof. | C09 |
| C11 | Task organization types and safe storage primitive | 7 | 900 | Define schema, workspace key, filenames, and atomic write primitive. | C05 |
| C12 | Task organization store and recovery | 4 | 1,750 | Isolate persistence semantics, migration, and malformed-file recovery. | C11 |
| C13 | Task organization extension IPC and frontend state | 8 | 1,300 | Establish a tested state round trip before interaction components. | C10, C12 |
| C14 | Pure history organization model and interaction context | 10 | 2,500 | Review grouping, ordering, selection, and reducer-like behavior without rendering. | C13 |
| C15 | Folder and pin UI | 18 | 2,300 | Add dialogs, folder rows, pinned rows, and controls without DnD mechanics. | C14 |
| C16 | DnD surface, pointer/a11y behavior, view integration, dependencies, and localization | 46 | 4,000 | Complete drag behavior and translations after basic organization works. | C15 |
| C17 | Model capability and MiMo provider contract | 7 | 650 | Land capability metadata and provider binding only. | C01, C05 |
| C18 | Pure tool-call retention policy | 5 | 1,100 | Review retention decisions without task execution side effects. | C17 |
| C19 | Parser/task enforcement and telemetry | 8 | 1,650 | Integrate policy, quarantine ghost calls, and emit typed events. | C04, C09, C18 |
| C20 | Usage event and query contracts | 7 | 900 | Freeze versioned event, query, and response shapes. | C13, C19 |
| C21 | Usage event store and recorder | 5 | 2,200 | Establish non-blocking append, tolerant reads, and recording API. | C20 |
| C22 | Usage aggregation and cost recalculation | 5 | 2,900 | Review pure aggregation and pricing math separately. | C20, C21 |
| C23 | Usage service facade | 3 | 1,200 | Orchestrate store, aggregation, clear, export, and error conversion. | C22 |
| C24 | Task finalization and provider usage capture | 16 | 1,900 | Add exactly-once recording at provider/task completion boundaries. | C19, C21 |
| C25 | Stats IPC, commands, extension state, and routing | 10 | 2,400 | Expose the stable service through typed host/webview messages. | C13, C23, C24 |
| C26 | Dashboard shell and summary | 8 | 2,600 | Add navigation, totals, filters, and refresh behavior. | C25 |
| C27 | Sessions, heatmap, formatting, package labels, and localization | 57 | 5,600 | Complete detail views and all user-facing strings without changing backend semantics. | C16, C26 |
| C28a | OpenAI-family configured cost | 5-7 | 450-800 | Normalize one shared provider family and its tests. | C24, C27 |
| C28b | Anthropic and Bedrock configured cost | 4-6 | 300-650 | Isolate different cache/unit semantics from OpenAI-style providers. | C24, C27 |
| C28c | Remaining provider configured cost | 6-9 | 400-900 | Normalize DeepSeek, Poe, Qwen Code, xAI, and remaining adapters. | C24, C27 |

Option C has **30 review units if C28a-C28c are counted separately**. To preserve the requested headline of 28 PRs, the numbered plan treats C28 as one three-commit, three-review-wave provider-cost series. Operationally, the maximum split should open those three path-disjoint provider PRs in parallel, yielding 30 actual PRs. If the VP requires a literal 28, combine C28b and C28c into one provider-cost PR, and combine C15 with C16. The recommended literal maximum topology is therefore **28 actual PRs: C01-C27 plus one provider-cost PR**. The three provider rows above show the optional 30-PR extension.

### Option C dependency DAG

```text
C01 -> C02 -> C03 -> C04 -------------------------------> C19
  \-------------------------------> C17 -> C18 ----------^

C05 -> C06 -> C07 -> C08 -> C09 -> C10 -> C13 -> C14 -> C15 -> C16
  \-----------------> C11 -> C12 ---^

C19 -> C20 -> C21 -> C22 -> C23 -> C25 -> C26 -> C27 -> C28a/C28b/C28c
                 \-> C24 ------------^
C13 --------------------------------> C20, C25
C16 -----------------------------------------------------> C27
```

Provider-cost leaves are path-disjoint from one another and may open together only after C24 and C27 merge. Every other arrow is a merge-before-open gate.

## 2.1 Shared-file ownership rules

| Shared surface | First owner | Downstream rule |
|---|---|---|
| [assistant parser](../../src/core/assistant-message/NativeToolCallParser.ts) and [assistant presentation](../../src/core/assistant-message/presentAssistantMessage.ts) | Error integration PR | MiMo enforcement opens only after Error integration merges and applies policy-only deltas. |
| [command task](../../src/core/task/Task.ts) and [command tool](../../src/core/tools/ExecuteCommandTool.ts) | Shell command integration PR | MiMo enforcement merges next; Stats finalization merges after MiMo. Never open these candidates together. |
| [extension-host messages](../../packages/types/src/vscode-extension-host.ts), [provider state assembly](../../src/core/webview/ClineProvider.ts), and [webview routing](../../src/core/webview/webviewMessageHandler.ts) | Shell integration PR | Task Organization IPC merges next; Stats IPC merges last. |
| [MiMo provider types](../../packages/types/src/providers/mimo.ts) and [MiMo provider tests](../../src/api/providers/__tests__/mimo.spec.ts) | MiMo contract/policy chain | Stats usage capture applies usage-only deltas after MiMo merges. |
| Eleven Stats and Task Organization overlap paths listed in [the overlap matrix](file-overlap-matrix.md) | Task Organization chain | Stats may later touch only the three generic IPC assembly paths, never the store, schema, safe-write primitive, or task-organization handler. |
| [webview package manifest](../../webview-ui/package.json) and [workspace lockfile](../../pnpm-lock.yaml) | Final Task Organization DnD UI PR | No later PR regenerates the lockfile unless it introduces a new dependency. |
| Provider implementations under [provider implementations](../../src/api/providers/) | Stats usage-capture PR first | Configured-cost PRs open only after capture merges and modify formulas/tests only. |

## 2.2 Risks and edge-case handling

| Risk | Gate and testable condition |
|---|---|
| Contract precursor compiles but has no consumer | It must be backward compatible, exported only when needed, and covered by package-local serialization/default tests. |
| Open PRs silently share a path | Compare changed-path sets before opening. Any non-empty intersection blocks the later candidate. |
| Downstream replay replaces prerequisite behavior | Audit shared-file hunks against merged main. Each hunk must be additive and concern-specific. |
| Error interception recurses or hides diagnostics | Force interceptor failure, unknown error, malformed JSON, images, and custom tools. Preserve the original diagnostic exactly once. |
| Shell cancellation or terminal reuse settles twice | Test Bash, CMD, PowerShell, missing executable, interruption, no output, and reused terminals. |
| Task state leaks between workspaces | Test two windows, same task ID in different workspaces, no-workspace mode, malformed/future schema, and folder deletion. |
| MiMo policy regresses capable providers | Test explicit max-one, ghost quarantine, duplicate parser output, and a known provider without capability metadata. |
| Stats records retries twice or blocks tasks | Test retry, cancellation, unknown cost, store failure, truncated final record, multi-window refresh, clear/export failure. |
| Provider cost uses inconsistent units | Test zero/missing rates, cached tokens, user-configured rates, provider-specific units, and streaming finalization. |
| Localization dominates review size | Keep locale files in the user-visible UI PR whose strings they describe. Run parity tests in that PR. |

## 2.3 Trade-off analysis

| Dimension | Option A, 11 | Option B, 17 | Option C, 28-30 |
|---|---:|---:|---:|
| Typical review size | 1,000-8,800 lines | 650-8,500 lines, one locale-heavy outlier | 300-5,600 lines, mostly below 2,500 |
| CI cycles | 11 | 17 | 28-30 |
| Longest dependency chain | About 8 merges | About 10 merges | About 18 merges |
| Rebase/regeneration overhead | Medium | High | Very high |
| Per-PR semantic focus | Medium | High | Very high |
| Total maintainer elapsed time | Lowest of the three | Balanced | Highest |
| Risk of review fatigue inside one PR | Medium-high | Low-medium | Low |
| Risk of coordination fatigue across PRs | Low-medium | Medium | High |

More PRs reduce the amount each code owner must reason about at once. They also increase branch regeneration, CI queue time, cross-PR context switching, and total calendar time. Path-disjoint sibling PRs recover some elapsed time, but shared IPC and task files force a substantial serial chain in every valid plan.

---

# 3. Implementation Plan, Delegatable Sub-tasks

The following tasks implement the recommended 17-PR Option B. Each task names its exact path family and focused verification. Extraction must expand each family into an exact manifest before branch creation.

## B01, Error contracts and classification

- **Create/modify:** [error-interception types](../../src/core/tools/error-interception/types.ts), [error patterns](../../src/core/tools/error-interception/errorPatterns.ts), [error classifier](../../src/core/tools/error-interception/ErrorClassifier.ts), its package index, and focused classifier tests under [error interception tests](../../src/core/tools/error-interception/__tests__/).
- **Prerequisites:** Current upstream main.
- **Verification:** `cd src; npx vitest run core/tools/error-interception`.

## B02, Error transformation and interception runtime

- **Create/modify:** [message transformer](../../src/core/tools/error-interception/MessageTransformer.ts), [structural validator](../../src/core/tools/error-interception/StructuralValidator.ts), [task error state](../../src/core/tools/error-interception/TaskErrorState.ts), [tool error interceptor](../../src/core/tools/error-interception/ToolErrorInterceptor.ts), and their focused tests.
- **Prerequisites:** B01 merged.
- **Verification:** `cd src; npx vitest run core/tools/error-interception`.

## B03, Error assistant integration

- **Create/modify:** [assistant parser](../../src/core/assistant-message/NativeToolCallParser.ts), [assistant presentation](../../src/core/assistant-message/presentAssistantMessage.ts), assistant-message Error tests, and the two Error E2E fixture/suite paths listed in [the current design](pr-split-design.md).
- **Prerequisites:** B02 merged.
- **Verification:** `cd src; npx vitest run core/assistant-message`; then `pnpm --filter @roo-code/vscode-e2e test:ci:mock`.

## B04, Shell settings and shared contracts

- **Create/modify:** [global settings](../../packages/types/src/global-settings.ts), [terminal types](../../packages/types/src/terminal.ts), the shell-specific portion of [extension-host messages](../../packages/types/src/vscode-extension-host.ts), [terminal settings](../../webview-ui/src/components/settings/TerminalSettings.tsx), [settings view](../../webview-ui/src/components/settings/SettingsView.tsx), English shell settings strings, and focused package/UI tests.
- **Prerequisites:** Current upstream main.
- **Verification:** `cd packages/types; npx vitest run`; then `cd webview-ui; npx vitest run src/components/settings`.

## B05, Shell resolution primitives

- **Create/modify:** shell-resolution files under [terminal shell integration](../../src/integrations/terminal/shell/), [shell utility](../../src/utils/shell.ts), and focused resolver/profile/invocation tests.
- **Prerequisites:** B04 merged.
- **Verification:** `cd src; npx vitest run integrations/terminal utils`.

## B06, Terminal scheduling and lifecycle

- **Create/modify:** scheduler, trace, lifecycle, registry, terminal/process adapters, shared terminal runtime types, and corresponding tests under [terminal integration](../../src/integrations/terminal/).
- **Prerequisites:** B05 merged.
- **Verification:** `cd src; npx vitest run integrations/terminal`.

## B07, Shell command, prompt, IPC, and E2E integration

- **Create/modify:** [command tool](../../src/core/tools/ExecuteCommandTool.ts), shell-specific [task orchestration](../../src/core/task/Task.ts), prompt files under [core prompts](../../src/core/prompts/), shell-specific [provider state assembly](../../src/core/webview/ClineProvider.ts), [webview routing](../../src/core/webview/webviewMessageHandler.ts), extension activation, command tests, prompt tests, IPC tests, and [terminal reuse fixture](../../apps/vscode-e2e/src/fixtures/terminal-reuse-shell-race.ts).
- **Prerequisites:** B06 merged.
- **Verification:** `cd src; npx vitest run core/tools core/prompts core/webview integrations/terminal`; then the E2E mock suite.

## B08, Task organization contract and persistence

- **Create/modify:** [task-organization types](../../packages/types/src/task-organization.ts), type export, [task organization store](../../src/core/task-persistence/TaskOrganizationStore.ts), store index/test, [global filenames](../../src/shared/globalFileNames.ts), and [safe JSON write](../../src/utils/safeWriteJson.ts).
- **Prerequisites:** B04 merged.
- **Verification:** `cd packages/types; npx vitest run`; then `cd src; npx vitest run core/task-persistence`.

## B09, Task organization IPC and context

- **Create/modify:** task-specific additions to [extension-host messages](../../packages/types/src/vscode-extension-host.ts), [provider state assembly](../../src/core/webview/ClineProvider.ts), [task organization handler](../../src/core/webview/taskOrganizationMessageHandler.ts), [webview routing](../../src/core/webview/webviewMessageHandler.ts), [extension-state context](../../webview-ui/src/context/ExtensionStateContext.tsx), and focused host/context tests.
- **Prerequisites:** B07 and B08 merged.
- **Verification:** `cd src; npx vitest run core/webview`; then `cd webview-ui; npx vitest run src/context`.

## B10, Task organization UI

- **Create/modify:** all task-organization components, hooks, models, types, and tests under [history UI](../../webview-ui/src/components/history/), DnD dependency changes in [webview package manifest](../../webview-ui/package.json), [workspace lockfile](../../pnpm-lock.yaml), webview test setup, chat/history locale files, translation parity test, and new task-organization E2E coverage.
- **Prerequisites:** B09 merged.
- **Verification:** `cd webview-ui; npx vitest run src/components/history src/i18n`; then the E2E mock suite.

## B11, MiMo capability and provider binding

- **Create/modify:** [model types](../../packages/types/src/model.ts), [MiMo provider types](../../packages/types/src/providers/mimo.ts), [telemetry types](../../packages/types/src/telemetry.ts), [API registry](../../src/api/index.ts), [MiMo provider](../../src/api/providers/mimo.ts), [shared tool contract](../../src/shared/tools.ts), and provider/type tests.
- **Prerequisites:** B01 and B04 merged.
- **Verification:** `cd packages/types; npx vitest run`; then `cd src; npx vitest run api/providers`.

## B12, MiMo enforcement and telemetry

- **Create/modify:** [retention policy](../../src/core/assistant-message/ToolCallRetentionPolicy.ts), policy-specific deltas to parser/presentation/validator/command/task files, [telemetry service](../../packages/telemetry/src/TelemetryService.ts), and policy, task, parser, telemetry tests.
- **Prerequisites:** B03, B07, and B11 merged.
- **Verification:** `cd src; npx vitest run core/assistant-message core/task core/tools/error-interception api/providers`; then package telemetry type-check.

## B13, Usage event contract and store

- **Create/modify:** [usage-stats types](../../packages/types/src/usage-stats.ts), type exports/provider usage fields required by the contract, [usage event store](../../src/services/stats/UsageEventStore.ts), [usage recorder](../../src/services/stats/UsageRecorder.ts), stats index, and focused type/store tests.
- **Prerequisites:** B08 and B12 merged.
- **Verification:** `cd packages/types; npx vitest run`; then `cd src; npx vitest run services/stats`.

## B14, Aggregation and service facade

- **Create/modify:** [usage aggregator](../../src/services/stats/UsageAggregator.ts), [cost recalculation](../../src/services/stats/costRecalculation.ts), [usage stats service](../../src/services/stats/UsageStatsService.ts), and focused stats tests.
- **Prerequisites:** B13 merged.
- **Verification:** `cd src; npx vitest run services/stats`.

## B15, Provider and task usage capture

- **Create/modify:** usage-only deltas in provider implementations/tests listed in [the Stats manifest](pr-split-design.md), usage-specific [task orchestration](../../src/core/task/Task.ts), and [task usage test](../../src/core/task/__tests__/Task.usage-stats.spec.ts).
- **Prerequisites:** B12 and B13 merged.
- **Verification:** `cd src; npx vitest run api/providers core/task services/stats`.

## B16, Stats IPC and UI

- **Create/modify:** stats-only additions to [extension-host messages](../../packages/types/src/vscode-extension-host.ts), [provider state assembly](../../src/core/webview/ClineProvider.ts), [webview routing](../../src/core/webview/webviewMessageHandler.ts), [stats message handler](../../src/core/webview/usageStatsMessageHandler.ts), extension command registration/package labels, [dashboard UI](../../webview-ui/src/components/dashboard/), [usage heatmap](../../webview-ui/src/components/stats/UsageHeatmap.tsx), number formatting, dashboard/stats locales, tests, and new Stats dashboard E2E coverage.
- **Prerequisites:** B09, B10, B14, and B15 merged.
- **Verification:** `cd src; npx vitest run core/webview services/stats services/command`; `cd webview-ui; npx vitest run src/components/dashboard src/components/stats src/utils src/i18n`; then the E2E mock suite.

## B17, Configured provider cost

- **Create/modify:** formula-only deltas and focused tests for provider paths listed in [the provider-cost manifest](pr-split-design.md). Do not modify Stats services, IPC, UI, terminal files, or E2E timeout configuration.
- **Prerequisites:** B15 and B16 merged.
- **Verification:** `cd src; npx vitest run api/providers services/stats core/task`.

## 3.1 Per-PR global CI protocol

After each focused suite:

```text
pnpm --filter @roo-code/types check-types
pnpm --filter zoo-code lint
pnpm --filter zoo-code check-types
pnpm --filter @roo-code/vscode-webview lint
pnpm --filter @roo-code/vscode-webview check-types
```

Run the relevant package commands only when that package is touched. After the final sequential merge simulation, run the root lint, type-check, test, unused-code, build, and deterministic extension-host E2E gates documented in [the current split design](pr-split-design.md).

## 3.2 Candidate path-exclusivity gate

Before opening each PR:

1. Generate its changed-path set against the exact prerequisite merge commit.
2. Expand and compare the set against its approved manifest.
3. Compare it against every currently open candidate. Intersection must be empty.
4. Reject reports, logs, helper scripts, stale upstream reversions, and unassigned paths.
5. For downstream shared files, inspect every hunk against merged main and confirm only the downstream concern was added.
6. Run focused tests, package gates, and diff whitespace validation.

---

## Issues Discovered

1. The original request labels Option 1 as approximately 10-12 PRs. Splitting all four heavy PRs into two or three concerns yields 11 PRs, which fits.
2. A literal tests-after-implementation PR strategy conflicts with independently green CI. Tests must accompany their owned contract or implementation.
3. Localization and lockfile files inflate DnD and Stats UI PRs even under fine splitting. Splitting locale-only PRs would weaken the user-visible WHY and permit untranslated intermediate merges, so they remain with UI delivery.
4. The maximum provider-cost split naturally produces three path-disjoint leaves. This makes the truly maximum plan 30 PRs, not 28. The table documents both the literal 28-PR and optional 30-PR forms.
5. Codebase-index deletion remains absent from the analyzed feature set and is not assigned to any PR in this report.

## Next Step Recommendations

1. VP records the user's selected option.
2. Rewrite the execution brief using only the selected topology.
3. Expand every selected PR's path family into an exact include/exclude manifest before branch mutation.
4. Extract the first path-disjoint wave from refreshed upstream main.
5. Merge, regenerate all dependent candidates, and repeat the path-exclusivity and CI gates at every wave.

## Affected File List

- [This fine-grained architecture report](073348_architect-report.md)
- No product source files were modified.

