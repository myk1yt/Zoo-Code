# Architect Task Report: Five-Branch File-Level Dependency Analysis

## Task Summary

This report replaces the assumptions in the outdated [execution brief](../260727_0001_session_split-pr-plan/execution-brief.md) with a fresh comparison of five feature branches against `main` at commit, file, module, and cross-boundary levels.

The critical result is that **none of the five branches is file-independent** after upstream noise and inherited Error work are removed. Sequential merges therefore require rebasing or regenerating every remaining PR against the newly merged `main`, followed by overlap-focused tests.

## Actions Taken

1. Fetched `upstream` and verified that `main` equals `upstream/main` at `d27153a251d2051b6a8e73d305b06ffbc5ac6970`.
2. Snapshotted all six branch tips before and after analysis.
3. Collected requested two-dot stats and file lists.
4. Removed upstream-only drift by comparing branch-side changes from each merge base.
5. Separated six genuine Mimo commits from inherited Error-interception commits.
6. Calculated exact pairwise file intersections and shared module surfaces.
7. Compared the combined branch against the union of all five individual branch path sets.
8. Checked the combined branch specifically for changes under [the code-index service](../../src/services/code-index/).

## Result

**Success.** The stable branch tips, raw counts, filtered counts, exact overlap files, combined-only files, and Mimo-exclusive commits are documented below and in the companion [file overlap matrix](file-overlap-matrix.md).

---

# 1. Technical Specification

## 1.1 Analysis baseline

| Ref | Snapshot commit | Behind `main` | Branch-side commits |
|---|---:|---:|---:|
| `main` | `d27153a251d2051b6a8e73d305b06ffbc5ac6970` | 0 | 0 |
| `feature/unified-shell-resolution` | `8e6799525540272cba96e21c1c3b77563946b0df` | 16 | 3 |
| `feat/error-interception-middleware` | `5c8c495e0603ce71aa19e42d9ef5027de5cc329b` | 0 | 18 |
| `fix/mimo-parallel-tool-call-policy` | `b7edba688def019abbac64c937014536e551b6ee` | 6 | 20 total, 6 Mimo-exclusive |
| `feature/local-usage-stats` | `9968e390d3137a2d7803bd7b6880cda52793d09c` | 15 | 41 |
| `feature/task-dnd-ux` | `838f992498217aada8bc9ea8fe6ee3590a5e8c3e` | 16 | 3 |
| `feature/combined-all-features` | `87c1555285e65edb9dc86c2a6318d50ff57d74dc` | 6 | 72 |

### Noise-filtering rule

The requested two-dot comparison compares the two endpoint trees. If a feature branch is behind `main`, newer upstream files appear as feature deletions or reversions. To prevent these from entering the PR dependency model:

1. **Raw evidence:** preserve the requested two-dot stats unchanged.
2. **Upstream-noise filter:** use the merge-base-to-branch tree delta to retain only branch-side net files.
3. **Inherited-feature filter:** for Mimo, compare patch-equivalent history against Error and use only the six Mimo commits beginning at `d17049f01`.
4. **Operational-noise flag:** retain reports and helper scripts in evidence, but mark them as non-product artifacts instead of silently deleting them from the analysis.

This is stricter than simply dropping merge commits. Merge commits can contain real conflict resolutions, while endpoint tree drift can exist without a merge commit.

## 1.2 Per-branch change summary

| Branch | Requested two-dot stat | Branch-side filtered stat | Upstream-only paths removed | Primary modules |
|---|---:|---:|---:|---|
| Shell | 189 files, +12,278 / -6,533 | 61 files, +11,325 / -513 | 128 | [terminal integration](../../src/integrations/terminal/), [terminal tools](../../src/core/tools/ExecuteCommandTool.ts), [terminal settings](../../webview-ui/src/components/settings/TerminalSettings.tsx) |
| Error | 26 files, +8,940 / -69 | 26 files, +8,940 / -69 | 0 | [assistant message pipeline](../../src/core/assistant-message/), [error interception](../../src/core/tools/error-interception/) |
| Mimo branch tip | 61 files, +12,040 / -1,076 | 45 files, +11,727 / -225 | 16 | Error inheritance plus Mimo policy |
| Mimo exclusive six commits | n/a | 20 files, +2,739 / -160 | inherited Error files excluded | [tool-call retention policy](../../src/core/assistant-message/ToolCallRetentionPolicy.ts), [Mimo provider](../../src/api/providers/mimo.ts), [telemetry](../../packages/telemetry/src/TelemetryService.ts) |
| Stats | 284 files, +27,420 / -6,046 | 190 files, +26,694 / -279 | 94 | [stats service](../../src/services/stats/), [dashboard](../../webview-ui/src/components/dashboard/), provider streams, shared task organization |
| DnD | 203 files, +12,418 / -6,185 | 89 files, +11,465 / -165 | 114 | [history UI](../../webview-ui/src/components/history/), [task organization store](../../src/core/task-persistence/TaskOrganizationStore.ts), webview IPC |

### Shell module distribution, 61 filtered files

| Module | Files |
|---|---:|
| [terminal integration](../../src/integrations/terminal/) | 26 |
| [core prompts](../../src/core/prompts/) | 12 |
| [shared types](../../packages/types/) | 4 |
| [core webview](../../src/core/webview/) | 4 |
| [core tools](../../src/core/tools/) | 3 |
| [settings UI](../../webview-ui/src/components/settings/) | 3 |
| [core task](../../src/core/task/) | 2 |
| [utilities](../../src/utils/) | 2 |
| Other, including three historical reports | 5 |

### Error module distribution, 26 filtered files

| Module | Files |
|---|---:|
| [error interception](../../src/core/tools/error-interception/) | 13 |
| [assistant message pipeline](../../src/core/assistant-message/) | 9 |
| [VS Code E2E fixtures](../../apps/vscode-e2e/) | 2 |
| Root/config | 2 |

### Mimo exclusive module distribution, 20 files

| Module | Files |
|---|---:|
| [assistant message pipeline](../../src/core/assistant-message/) | 8 |
| [shared types](../../packages/types/) | 3 |
| [Mimo provider](../../src/api/providers/mimo.ts) and API registry | 3 |
| [core task](../../src/core/task/) | 2 |
| [telemetry](../../packages/telemetry/src/TelemetryService.ts) | 1 |
| [core prompts](../../src/core/prompts/) | 1 |
| [core tools](../../src/core/tools/) | 1 |
| [shared tool contract](../../src/shared/tools.ts) | 1 |

### Stats module distribution, 190 filtered files

| Module | Files |
|---|---:|
| Historical reports under [docs](../) | 72 |
| [webview localization](../../webview-ui/src/i18n/) | 36 |
| Package localization files under [extension source](../../src/) | 18 |
| [API providers](../../src/api/providers/) | 13 |
| [stats service](../../src/services/stats/) | 10 |
| [shared types](../../packages/types/) | 8 |
| [dashboard UI](../../webview-ui/src/components/dashboard/) | 8 |
| [core webview](../../src/core/webview/) | 5 |
| [task persistence](../../src/core/task-persistence/) | 3 |
| Other product/config files | 17 |

### DnD module distribution, 89 filtered files

| Module | Files |
|---|---:|
| [webview localization](../../webview-ui/src/i18n/) | 37 |
| [history UI](../../webview-ui/src/components/history/) | 35 |
| [shared types](../../packages/types/) | 3 |
| [task persistence](../../src/core/task-persistence/) | 3 |
| [core webview](../../src/core/webview/) | 4 |
| [webview context](../../webview-ui/src/context/) | 2 |
| Root/config and shared utilities | 5 |

## 1.3 Frontend to backend communication and shared types

The overlap files are not merely textual conflicts. They sit on five UI-to-system data paths:

### Shell resolution

```text
TerminalSettings UI
  -> webview settings message
  -> ClineProvider / webviewMessageHandler
  -> ExecuteCommandTool
  -> TerminalRegistry / ShellResolver / CommandScheduler
  -> VS Code terminal or execa process
  -> terminal output and structured tool result
```

Bindings are carried by [terminal types](../../packages/types/src/terminal.ts), [global settings](../../packages/types/src/global-settings.ts), and [extension-host messages](../../packages/types/src/vscode-extension-host.ts). Shell-resolution errors must remain structured through [the command tool](../../src/core/tools/ExecuteCommandTool.ts), rather than being swallowed in terminal adapters.

### Error interception

```text
Tool execution failure
  -> ToolErrorInterceptor / StructuralValidator
  -> presentAssistantMessage
  -> structured error details in extension message stream
  -> Chat UI rendering and AI guidance
```

The critical interface is between [the interception types](../../src/core/tools/error-interception/types.ts), [assistant message presentation](../../src/core/assistant-message/presentAssistantMessage.ts), and parser tests. A later Mimo PR modifies the same parser and presentation boundary.

### Mimo tool-call policy

```text
Provider/model capability metadata
  -> API configuration and Mimo handler
  -> ToolCallRetentionPolicy
  -> NativeToolCallParser / Task execution
  -> retained, quarantined, or rejected tool calls
  -> telemetry event
```

Bindings cross [model types](../../packages/types/src/model.ts), [Mimo provider types](../../packages/types/src/providers/mimo.ts), [telemetry types](../../packages/types/src/telemetry.ts), [API registry](../../src/api/index.ts), and [shared tool types](../../src/shared/tools.ts). Policy failures must preserve known-provider parallel behavior while enforcing one-call limits only where capability data requires it.

### Local usage stats

```text
Provider stream completion / task event
  -> usage event contract
  -> append-only local stats service and aggregation
  -> webview request/response message
  -> DashboardView / UsageHeatmap
```

The cross-boundary surface includes provider `totalCost`, [stats services](../../src/services/stats/), [extension-host message types](../../packages/types/src/vscode-extension-host.ts), [ClineProvider](../../src/core/webview/ClineProvider.ts), and the [dashboard](../../webview-ui/src/components/dashboard/). Partial or malformed local records must not block task completion or dashboard loading.

### Task DnD

```text
History drag/drop or folder action
  -> task-organization webview message
  -> taskOrganizationMessageHandler
  -> TaskOrganizationStore
  -> safe JSON write scoped to workspace
  -> refreshed extension state and History UI
```

Bindings cross [task organization types](../../packages/types/src/task-organization.ts), [extension-host messages](../../packages/types/src/vscode-extension-host.ts), [the handler](../../src/core/webview/taskOrganizationMessageHandler.ts), [the store](../../src/core/task-persistence/TaskOrganizationStore.ts), and [safe JSON writes](../../src/utils/safeWriteJson.ts). Errors must be surfaced without cross-workspace task, pin, or folder contamination.

---

# 2. Architecture Decisions

## 2.1 File overlap matrix

This matrix uses the filtered branch-side file set and the **six-commit Mimo-exclusive set**. Counts in parentheses are exact shared files.

| | Shell | Error | Mimo exclusive | Stats | DnD |
|---|---:|---:|---:|---:|---:|
| Shell | 61 | 0 | 3 | 4 | 3 |
| Error | 0 | 26 | 5 | 1 | 0 |
| Mimo exclusive | 3 | 5 | 20 | 3 | 0 |
| Stats | 4 | 1 | 3 | 190 | 11 |
| DnD | 3 | 0 | 0 | 11 | 89 |

The exact paths are in the [machine-readable companion matrix](file-overlap-matrix.md).

### Interpretation

- **Stats is the central merge-risk branch:** it overlaps Shell, Error, Mimo, and DnD.
- **Mimo is not a standalone branch:** it is based on an earlier Error branch state and has direct six-commit overlaps with both Error and Shell.
- **DnD has no direct Error or Mimo file overlap**, but it shares 11 persistence/IPC files with Stats and three IPC files with Shell.
- **Shell and Error have zero direct file overlap**, making them the only clearly parallel pair at the file level.
- **Error and DnD also have zero direct file overlap**, as do Mimo and DnD, but transitive overlap through Stats and Shell still matters for a full sequence.

## 2.2 Module overlap summary

| Shared module | Branches | Conflict meaning |
|---|---|---|
| [shared types](../../packages/types/) | Shell, Mimo, Stats, DnD | Type binding changes can break extension/webview compilation even without same-file overlap. |
| [core task](../../src/core/task/) | Shell, Mimo, Stats | Runtime command execution, policy, and usage recording meet in task orchestration. |
| [core tools](../../src/core/tools/) | Shell, Error, Mimo | Command execution and interception order must be integrated deliberately. |
| [assistant message pipeline](../../src/core/assistant-message/) | Error, Mimo | Five exact files overlap after inherited Error work is removed. |
| [core webview](../../src/core/webview/) | Shell, Stats, DnD | IPC state assembly and message handling are a three-feature conflict surface. |
| [task persistence](../../src/core/task-persistence/) | Stats, DnD | Stats imported the same task-organization infrastructure used by DnD. |
| [API providers](../../src/api/providers/) | Mimo, Stats | Mimo policy metadata and provider cost recording share provider tests and configuration. |
| [webview localization](../../webview-ui/src/i18n/) | Shell, Stats, DnD | Translation parity and JSON merge conflicts. |
| Root/config | Error, Mimo, Stats, DnD | Ignore rules, lint suppressions, package/lock configuration. |

## 2.3 Independence assessment

**Truly independent branches: none.** Every branch shares at least one exact file with another branch after filtering.

| Branch | Branches with exact overlap | Independent? |
|---|---|---|
| Shell | Mimo, Stats, DnD | No |
| Error | Mimo, Stats | No |
| Mimo exclusive | Shell, Error, Stats | No |
| Stats | Shell, Error, Mimo, DnD | No |
| DnD | Shell, Stats | No |

File-level zero overlap is necessary but not sufficient for independence. Shared type packages and IPC schemas can create compile-time or behavioral dependencies across different files.

## 2.4 Mimo unique commit analysis

The requested `main..branch` logs show 18 commits on Error and 20 on Mimo. SHA comparison is misleading because the Mimo branch contains rebased Error commits with new IDs.

Patch and subject comparison yields:

- 13 Error commits are patch-equivalent in both branches.
- One additional Mimo-side commit, `3a3dc1f12`, is semantically inherited Error maintenance but differs from its Error-branch counterpart after rebase.
- Five Error-side commits are later or divergent relative to the Mimo base.
- The following **six commits are genuinely Mimo-exclusive**:

| Commit | Subject |
|---|---|
| `d17049f01` | Add model-level tool-call capability and policy resolution |
| `5c8b3ce58` | Wire Mimo provider controls and tighten argument normalization |
| `9d87f7fc5` | Add ghost quarantine and maximum-one tool-call enforcement |
| `6e8d4744b` | Add tool-call policy telemetry events |
| `7d1034529` | Resolve no-explicit-any lint errors in Mimo and telemetry files |
| `b7edba688` | Preserve parallel behavior for known providers without explicit capabilities |

The six-commit tree delta modifies 20 files with +2,739 / -160. It must be replayed on top of the final Error implementation, not merged from the current Mimo branch tip.

## 2.5 Combined branch delta analysis

The combined branch has 309 branch-side files with +52,232 / -1,178. The union of the five individual branch-tip path sets has 366 paths.

Path comparison found:

- **11 combined-only paths**, listed below.
- **68 union-only paths**, mostly operational reports, temporary logs/scripts, stale feature artifacts, or paths dropped during integration cleanup.
- No net change and no branch-side history under [the code-index service](../../src/services/code-index/), [the codebase index type contract](../../packages/types/src/codebase-index.ts), or [code index settings](../../webview-ui/src/components/settings/CodeIndexSettings.tsx).

### Combined-only paths

| Path | Delta | Attribution | Assessment |
|---|---:|---|---|
| [terminal reuse fixture](../../apps/vscode-e2e/src/fixtures/terminal-reuse-shell-race.ts) | +12 / -1 | `5c5debed4`, terminal-reuse CI fix | Product-test follow-up not present in the five tips. |
| [check-git-status helper](../../check-git-status.ps1) | +24 / -0 | Stats infrastructure port | Operational noise, exclude from upstream PRs. |
| [push shell helper](../../do-push.sh) | +2 / -0 | Stats infrastructure port | Operational noise, exclude from upstream PRs. |
| [push PowerShell helper](../../push.ps1) | +1 / -0 | Stats infrastructure port | Operational noise, exclude from upstream PRs. |
| [OpenAI-compatible provider test](../../src/api/providers/__tests__/openai-compatible.spec.ts) | +170 / -0 | Provider total-cost CI fix | Real follow-up behavior/test change. |
| [Bedrock provider](../../src/api/providers/bedrock.ts) | +28 / -8 | Stats merge conflict resolution | Inspect and redistribute into provider-cost PR if still required. |
| [DeepSeek provider](../../src/api/providers/deepseek.ts) | +16 / -4 | User-configured pricing fix | Real follow-up change. |
| [OpenAI-compatible provider](../../src/api/providers/openai-compatible.ts) | +13 / -2 | User-configured pricing fix | Real follow-up change. |
| [Poe provider](../../src/api/providers/poe.ts) | +15 / -0 | User-configured pricing fix | Real follow-up change. |
| [Qwen Code provider](../../src/api/providers/qwen-code.ts) | +13 / -2 | User-configured pricing fix | Real follow-up change. |
| [xAI provider](../../src/api/providers/xai.ts) | +6 / -1 | User-configured pricing fix | Real follow-up change. |

### Codebase-indexing deletion verdict

**Not found in the combined branch.** The mentioned deletion feature is not represented by a path, net diff, or branch-side commit touching the current code-index module. It must be located in another ref, stash, worktree, or uncommitted state during the next research step.

## 2.6 Risks and edge cases

| Risk | Severity | Testable condition |
|---|---|---|
| Stale branch drift mistaken for feature deletion | High | Filtered PR contains none of the 128/16/94/114 upstream-only paths identified for Shell/Mimo/Stats/DnD. |
| Mimo reintroduces old Error implementation | High | Mimo PR contains only the six commits' 20-file delta rebased on latest Error. |
| Stats and DnD overwrite task-organization state | High | Workspace isolation, pin/folder persistence, future-schema behavior, and stats collection pass together. |
| Shell, Stats, and DnD conflict in IPC assembly | High | Extension state and message contracts compile; settings, dashboard, and history actions round-trip. |
| Provider `totalCost` fixes are lost | High | Combined-only provider behavior is either assigned to a provider-cost PR or explicitly rejected. |
| Helper scripts leak upstream | Medium | The three combined-only push/status scripts and branch-local temporary artifacts are absent. |
| Localization sets diverge | Medium | Translation parity tests pass after each Stats/DnD/Shell integration. |
| Lockfile ownership becomes ambiguous | Medium | The lockfile is regenerated only by the PR that changes package dependencies. |

## 2.7 Design options for Step 2

### Option A, Standard / Right Way

Build a dependency DAG from the exact overlap files, create clean PR branches from current `main`, replay only feature commits, and rebase every unmerged PR after each upstream merge.

- **Effort:** High.
- **Risk:** Lowest. Conflict resolution happens against the exact upstream state each PR will enter.
- **Outcome:** Mutually exclusive, reviewable PRs with no inherited upstream drift or duplicate Error history.

### Option B, Practical / Pragmatic Way

Extract stable leaf PRs first, create one shared-contract PR for common types/IPC/persistence, then layer feature UI and service PRs on that shared base.

- **Effort:** Medium.
- **Risk:** Medium. The shared PR can become broad and may be harder to justify independently.
- **Outcome:** Fewer repeated conflicts in shared files, with moderately sized review units.

### Option C, Staging / Incremental Way

Prepare only the first zero-overlap pair, Shell and Error, validate both, merge one, regenerate this matrix, then decide the next extraction from the new `main`.

- **Effort:** Low initially, repeated analysis later.
- **Risk:** Medium-high schedule risk. Later branch boundaries remain unresolved until each stage completes.
- **Outcome:** Fast validation of the extraction process without committing to the full split topology.

**Architecture recommendation for Step 2: Option A.** It addresses the user's sequential-merge concern directly. Option B is acceptable only if upstream reviewers accept a shared-contract precursor PR.

---

# 3. Implementation Plan, Sub-tasks

No code or branch mutation was performed in this analysis step. The following tasks are ready for VP delegation during Step 2 and later execution.

## Task 1, lock branch manifests and exclusion lists

- **Exact files to create/modify:** [execution brief](execution-brief.md), [file overlap matrix](file-overlap-matrix.md).
- **Prerequisites:** Current `main` and branch-tip object IDs must match this report.
- **Output:** PR-ready include/exclude manifests for each branch, with Mimo restricted to its six commits.
- **Verification:** Re-run the two-dot and merge-base file counts. No test suite applies because this is manifest generation.
- **Command:** `git diff --name-status main..<candidate-branch>` for each candidate.

## Task 2, design shared type and IPC ownership

- **Exact files to inspect/assign:** [extension-host messages](../../packages/types/src/vscode-extension-host.ts), [task organization types](../../packages/types/src/task-organization.ts), [core provider message assembly](../../src/core/webview/ClineProvider.ts), [webview message handler](../../src/core/webview/webviewMessageHandler.ts).
- **Prerequisites:** Choose Option A or B.
- **Output:** One owning PR for each shared contract, with downstream PR prerequisites stated explicitly.
- **Verification suite:** Package-local type tests plus core webview tests.
- **Commands:** `pnpm --filter @roo-code/types test`; from [extension package](../../src/package.json), `npx vitest run core/webview/__tests__/taskOrganizationMessageHandler.spec.ts`.

## Task 3, extract Shell and Error as the first independent pair

- **Exact files to modify:** Only files in each branch's filtered manifest; no upstream-only noise paths.
- **Prerequisites:** Task 1 complete.
- **Output:** Two clean candidate PR branches from current `main`.
- **Shell verification suites:** [terminal tests](../../src/integrations/terminal/__tests__/), [execute command tests](../../src/core/tools/__tests__/executeCommandTool.spec.ts), [terminal settings tests](../../webview-ui/src/components/settings/__tests__/TerminalSettings.shell.spec.tsx).
- **Error verification suites:** [error interception tests](../../src/core/tools/error-interception/__tests__/), [assistant message tests](../../src/core/assistant-message/__tests__/).
- **Commands:** From [extension package](../../src/package.json), `npx vitest run integrations/terminal core/tools/__tests__/executeCommandTool.spec.ts core/tools/error-interception core/assistant-message`; from [webview package](../../webview-ui/package.json), `npx vitest run src/components/settings/__tests__/TerminalSettings.shell.spec.tsx`.

## Task 4, replay Mimo-exclusive commits on final Error

- **Exact files to modify:** The 20 files in the Mimo-exclusive section of [the companion matrix](file-overlap-matrix.md).
- **Prerequisites:** Error candidate finalized; use only commits `d17049f01` through `b7edba688` listed above.
- **Output:** Mimo PR without inherited Error commits.
- **Verification suites:** [tool policy tests](../../src/core/assistant-message/__tests__/ToolCallRetentionPolicy.spec.ts), [telemetry policy tests](../../src/core/assistant-message/__tests__/ToolCallRetentionPolicy-telemetry.spec.ts), [parser dedup integration](../../src/core/assistant-message/__tests__/presentAssistantMessage-parser-dedup.integration.spec.ts), [Mimo provider tests](../../src/api/providers/__tests__/mimo.spec.ts).
- **Command:** From [extension package](../../src/package.json), `npx vitest run core/assistant-message/__tests__/ToolCallRetentionPolicy.spec.ts core/assistant-message/__tests__/ToolCallRetentionPolicy-telemetry.spec.ts core/assistant-message/__tests__/presentAssistantMessage-parser-dedup.integration.spec.ts api/providers/__tests__/mimo.spec.ts`.

## Task 5, split Stats from shared task organization and provider follow-ups

- **Exact files to modify:** [stats service](../../src/services/stats/), [dashboard UI](../../webview-ui/src/components/dashboard/), provider files assigned from the combined-only table, and explicitly owned shared task-organization files.
- **Prerequisites:** Shared ownership decision from Task 2; review all 11 Stats-DnD overlap files.
- **Output:** Stats core/dashboard PR plus a provider-cost PR if provider changes remain independently useful.
- **Verification suites:** [stats service tests](../../src/services/stats/__tests__/), [dashboard tests](../../webview-ui/src/components/dashboard/__tests__/), provider-local tests.
- **Commands:** From [extension package](../../src/package.json), `npx vitest run services/stats api/providers`; from [webview package](../../webview-ui/package.json), `npx vitest run src/components/dashboard`.

## Task 6, extract DnD after task-organization ownership is fixed

- **Exact files to modify:** [history UI](../../webview-ui/src/components/history/), [task organization store](../../src/core/task-persistence/TaskOrganizationStore.ts), handler and contract files assigned in Task 2.
- **Prerequisites:** Stats shared-infrastructure split finalized; Shell IPC changes integrated or rebased.
- **Output:** Workspace-scoped DnD PR with no duplicated Stats infrastructure.
- **Verification suites:** [task organization store tests](../../src/core/task-persistence/__tests__/TaskOrganizationStore.spec.ts), [message handler tests](../../src/core/webview/__tests__/taskOrganizationMessageHandler.spec.ts), [history UI tests](../../webview-ui/src/components/history/__tests__/).
- **Commands:** From [extension package](../../src/package.json), `npx vitest run core/task-persistence/__tests__/TaskOrganizationStore.spec.ts core/webview/__tests__/taskOrganizationMessageHandler.spec.ts`; from [webview package](../../webview-ui/package.json), `npx vitest run src/components/history`.

## Task 7, locate the missing codebase-index deletion feature

- **Exact files to inspect:** [code-index service](../../src/services/code-index/), [codebase index type contract](../../packages/types/src/codebase-index.ts), [code index settings](../../webview-ui/src/components/settings/CodeIndexSettings.tsx), plus refs/worktrees/stashes identified by VP.
- **Prerequisites:** None; the feature is absent from the six analyzed refs.
- **Output:** A source ref and exact patch, or a confirmed decision that the feature never entered Git history.
- **Verification suite:** [code-index service tests](../../src/services/code-index/__tests__/).
- **Command:** From [extension package](../../src/package.json), `npx vitest run services/code-index` after the feature is located and extracted.

## Task 8, sequential merge simulation

- **Exact files to modify:** None in the analysis branch; use disposable candidate refs or worktrees managed by VP.
- **Prerequisites:** Tasks 3 through 7 complete.
- **Output:** A tested merge order where each PR is rebased onto the exact result of all prior PRs.
- **Verification suites:** Package-local focused tests first, then root lint, type check, unit tests, translation parity, and E2E smoke coverage for terminal, history, dashboard, and tool errors.
- **Commands:** `pnpm lint`; `pnpm check-types`; `pnpm test`; `pnpm knip`; run the focused E2E commands defined by [the VS Code E2E package](../../apps/vscode-e2e/package.json).

---

## Requested raw two-dot stat outputs

The following appendices preserve the exact requested endpoint-tree stats. Large upstream-only surfaces are intentionally shown here but excluded from the filtered matrix.

### `feature/unified-shell-resolution`

```text
 .changeset/itchy-moles-thank.md                    |    5 -
 .github/actions/setup-node-pnpm/action.yml         |    2 +-
 .github/pull_request_template.md                   |   27 +-
 .github/workflows/code-qa.yml                      |   15 +-
 .github/workflows/visual-regression.yml            |   57 -
 .nvmrc                                             |    2 +-
 .tool-versions                                     |    2 +-
 CHANGELOG.md                                       |   27 -
 README.md                                          |   19 +-
 apps/cli/package.json                              |    2 +-
 apps/vscode-e2e/package.json                       |    2 +-
 apps/vscode-e2e/src/fixtures/subtasks.ts           |   67 +-
 apps/vscode-e2e/src/suite/subtasks.test.ts         |   24 +-
 codecov.yml                                        |   34 +-
 .../020400_code-light-report.md                    |   36 +
 .../111030_code-report.md                          |   29 +
 .../234700_code-light-report.md                    |   41 +
 knip.json                                          |    6 +-
 locales/ca/README.md                               |   18 +-
 locales/de/README.md                               |   18 +-
 locales/es/README.md                               |   18 +-
 locales/fr/README.md                               |   18 +-
 locales/hi/README.md                               |   18 +-
 locales/id/README.md                               |   18 +-
 locales/it/README.md                               |   18 +-
 locales/ja/README.md                               |   18 +-
 locales/ko/README.md                               |   18 +-
 locales/nl/README.md                               |   18 +-
 locales/pl/README.md                               |   18 +-
 locales/pt-BR/README.md                            |   18 +-
 locales/ru/README.md                               |   18 +-
 locales/tr/README.md                               |   18 +-
 locales/vi/README.md                               |   18 +-
 locales/zh-CN/README.md                            |   18 +-
 locales/zh-TW/README.md                            |   18 +-
 package.json                                       |    4 +-
 packages/build/package.json                        |    2 +-
 packages/cloud/package.json                        |    2 +-
 packages/config-eslint/base.js                     |    7 +
 packages/config-eslint/package.json                |    1 +
 packages/core/package.json                         |    2 +-
 packages/ipc/package.json                          |    2 +-
 packages/telemetry/package.json                    |    2 +-
 packages/types/package.json                        |    2 +-
 .../src/__tests__/provider-default-model.test.ts   |   63 -
 .../src/__tests__/terminal-shell-settings.spec.ts  |  316 ++++
 packages/types/src/global-settings.ts              |   36 +
 packages/types/src/mode.ts                         |    2 +-
 packages/types/src/providers/index.ts              |   76 +-
 packages/types/src/terminal.ts                     |   11 +
 packages/types/src/vscode-extension-host.ts        |   56 +-
 packages/vscode-shim/package.json                  |    2 +-
 pnpm-lock.yaml                                     |  509 +-----
 renovate.json                                      |    5 -
 src/__tests__/helpers/provider-stub.ts             |   46 +-
 src/__tests__/history-resume-delegation.spec.ts    |    6 -
 .../removeClineFromStack-delegation.spec.ts        |  166 +-
 src/__tests__/single-open-invariant.spec.ts        |   64 +-
 src/api/__tests__/index.spec.ts                    |  146 +-
 src/api/index.ts                                   |   76 +-
 src/api/providers/__tests__/bedrock.spec.ts        |  113 --
 src/api/providers/bedrock.ts                       |   23 -
 .../fetchers/__tests__/modelCache.spec.ts          |  154 +-
 src/api/providers/fetchers/modelCache.ts           |   77 +-
 .../__tests__/getEnvironmentDetails.spec.ts        |   18 -
 src/core/environment/getEnvironmentDetails.ts      |   28 +-
 .../architect-mode-prompt.snap                     |    8 +-
 .../add-custom-instructions/ask-mode-prompt.snap   |    6 +-
 .../mcp-server-creation-disabled.snap              |  127 ++
 .../add-custom-instructions/no-mcp-servers.snap    |    2 +-
 .../system-prompt/consistent-system-prompt.snap    |    8 +-
 .../system-prompt/with-computer-use-support.snap   |    2 +-
 .../system-prompt/with-diff-enabled-false.snap     |    2 +-
 .../system-prompt/with-diff-enabled-true.snap      |    2 +-
 .../system-prompt/with-diff-enabled-undefined.snap |    2 +-
 .../with-different-viewport-size.snap              |    2 +-
 .../system-prompt/with-mcp-hub-provided.snap       |    8 +-
 .../system-prompt/with-undefined-mcp-hub.snap      |    8 +-
 .../__tests__/shell-environment-prompt.spec.ts     |  315 ++++
 src/core/prompts/sections/rules.ts                 |   72 +-
 src/core/prompts/sections/system-info.ts           |   34 +-
 src/core/prompts/system.ts                         |    8 +-
 .../prompts/tools/native-tools/execute_command.ts  |  133 +-
 src/core/prompts/tools/native-tools/index.ts       |   16 +-
 src/core/task/Task.ts                              |   59 +-
 src/core/task/TaskRegistry.ts                      |  119 --
 src/core/task/__tests__/Task.spec.ts               |  265 +--
 src/core/task/__tests__/TaskRegistry.spec.ts       |  301 ----
 src/core/task/build-tools.ts                       |    7 +
 src/core/tools/ExecuteCommandTool.ts               |  427 ++++-
 .../tools/__tests__/executeCommandTool.spec.ts     |  400 ++++-
 .../__tests__/terminal-provider-fallback.spec.ts   |  177 ++
 src/core/webview/ClineProvider.ts                  |  356 +++-
 .../ClineProvider.flicker-free-cancel.spec.ts      |  165 +-
 src/core/webview/__tests__/ClineProvider.spec.ts   |   36 +-
 .../__tests__/terminal-shell-messages.spec.ts      |  468 +++++
 .../__tests__/webviewMessageHandler.spec.ts        |   96 +-
 src/core/webview/generateSystemPrompt.ts           |   24 +
 src/core/webview/webviewMessageHandler.ts          |   93 +-
 src/eslint-suppressions.json                       | 1812 --------------------
 src/eslint.config.mjs                              |    3 +-
 src/extension.ts                                   |    5 +
 src/integrations/terminal/BaseTerminal.ts          |  131 +-
 src/integrations/terminal/CommandScheduler.ts      |  507 ++++++
 src/integrations/terminal/CommandTrace.ts          |  344 ++++
 src/integrations/terminal/ExecaTerminal.ts         |   70 +-
 src/integrations/terminal/ExecaTerminalProcess.ts  |   76 +-
 src/integrations/terminal/Terminal.ts              |  502 +++---
 src/integrations/terminal/TerminalLifecycle.ts     |  600 +++++++
 src/integrations/terminal/TerminalProcess.ts       |   42 +-
 src/integrations/terminal/TerminalRegistry.ts      |  593 ++++++-
 .../terminal/__tests__/CommandScheduler.spec.ts    |  601 +++++++
 .../__tests__/ExecaTerminalProcess.spec.ts         |  240 ++-
 .../__tests__/ShellInvocationAdapter.spec.ts       |  217 +++
 .../terminal/__tests__/ShellResolver.spec.ts       |  691 ++++++++
 .../terminal/__tests__/TerminalLifecycle.spec.ts   | 1043 +++++++++++
 .../terminal/__tests__/TerminalProcess.spec.ts     |   42 +-
 .../__tests__/TerminalProcessExec.bash.spec.ts     |    5 +-
 .../__tests__/TerminalProcessExec.cmd.spec.ts      |    5 +-
 .../__tests__/TerminalProcessExec.pwsh.spec.ts     |    5 +-
 .../terminal/__tests__/TerminalProfile.spec.ts     |  115 +-
 .../terminal/__tests__/TerminalRegistry.spec.ts    |  311 +++-
 .../terminal/shell/CommandEnvironmentService.ts    |  270 +++
 .../terminal/shell/ShellInvocationAdapter.ts       |  168 ++
 src/integrations/terminal/shell/ShellResolver.ts   |  554 ++++++
 .../terminal/shell/TerminalProfileResolver.ts      |  609 +++++++
 src/integrations/terminal/shell/types.ts           |  155 ++
 src/integrations/terminal/types.ts                 |  135 +-
 src/package.json                                   |   10 +-
 src/services/ripgrep/__tests__/index.spec.ts       |   46 -
 src/services/ripgrep/index.ts                      |   12 +-
 src/shared/ProfileValidator.ts                     |   42 +-
 src/shared/__tests__/ProfileValidator.spec.ts      |  105 +-
 src/utils/__tests__/networkProxy.spec.ts           |  166 +-
 src/utils/__tests__/shell.spec.ts                  |  113 +-
 src/utils/networkProxy.ts                          |   73 -
 src/utils/shell.ts                                 |  140 +-
 webview-ui/.gitignore                              |    6 -
 webview-ui/AGENTS.md                               |   64 -
 webview-ui/docker-compose.visual.yml               |   12 -
 webview-ui/package.json                            |    9 +-
 webview-ui/playwright-ct.config.ts                 |   95 -
 webview-ui/playwright/coverage-fixture.ts          |   23 -
 webview-ui/playwright/index.html                   |   12 -
 webview-ui/playwright/index.tsx                    |    9 -
 webview-ui/playwright/run-docker.mjs               |   53 -
 webview-ui/playwright/vscode-theme-dark.css        |   89 -
 .../chat/__tests__/Announcement.spec.tsx           |   16 +-
 webview-ui/src/components/mcp/McpEnabledToggle.tsx |   24 +-
 webview-ui/src/components/mcp/McpView.tsx          |   15 +-
 .../mcp/__tests__/McpEnabledToggle.spec.tsx        |   58 -
 .../src/components/mcp/__tests__/McpView.spec.tsx  |   77 -
 webview-ui/src/components/settings/ApiOptions.tsx  |    9 +-
 .../components/settings/AutoApproveSettings.tsx    |   12 +
 .../settings/ContextManagementSettings.tsx         |    2 +
 .../src/components/settings/PromptsSettings.tsx    |   14 +-
 .../src/components/settings/SettingsView.tsx       |   43 +-
 .../src/components/settings/TerminalSettings.tsx   |  159 +-
 .../__tests__/AutoApproveSettings.spec.tsx         |  100 --
 .../__tests__/ContextManagementSettings.spec.tsx   |   33 +-
 .../settings/__tests__/PromptsSettings.spec.tsx    |   91 -
 .../settings/__tests__/SettingsView.spec.tsx       |   70 +-
 .../SettingsView.unsaved-changes.spec.tsx          |   46 +-
 .../__tests__/TerminalSettings.shell.spec.tsx      |  217 +++
 .../src/components/settings/providers/Ollama.tsx   |   74 +-
 .../settings/providers/__tests__/Ollama.spec.tsx   |  192 +--
 .../welcome/__tests__/RooHero.visual.tsx           |   29 -
 .../__tests__/__screenshots__/zoo-hero-dark.png    |  Bin 20809 -> 0 bytes
 webview-ui/src/i18n/locales/ca/chat.json           |    6 +-
 webview-ui/src/i18n/locales/de/chat.json           |    6 +-
 webview-ui/src/i18n/locales/en/chat.json           |    6 +-
 webview-ui/src/i18n/locales/en/settings.json       |   18 +
 webview-ui/src/i18n/locales/es/chat.json           |    6 +-
 webview-ui/src/i18n/locales/fr/chat.json           |    6 +-
 webview-ui/src/i18n/locales/hi/chat.json           |    6 +-
 webview-ui/src/i18n/locales/id/chat.json           |    6 +-
 webview-ui/src/i18n/locales/it/chat.json           |    6 +-
 webview-ui/src/i18n/locales/ja/chat.json           |    6 +-
 webview-ui/src/i18n/locales/ko/chat.json           |    6 +-
 webview-ui/src/i18n/locales/nl/chat.json           |    6 +-
 webview-ui/src/i18n/locales/pl/chat.json           |    6 +-
 webview-ui/src/i18n/locales/pt-BR/chat.json        |    6 +-
 webview-ui/src/i18n/locales/ru/chat.json           |    6 +-
 webview-ui/src/i18n/locales/tr/chat.json           |    6 +-
 webview-ui/src/i18n/locales/vi/chat.json           |    6 +-
 webview-ui/src/i18n/locales/zh-CN/chat.json        |    6 +-
 webview-ui/src/i18n/locales/zh-TW/chat.json        |    6 +-
 webview-ui/tsconfig.json                           |    2 +-
 webview-ui/vitest.config.ts                        |    4 +-
 189 files changed, 12278 insertions(+), 6533 deletions(-)
```

### `feat/error-interception-middleware`

```text
 .gitignore                                         |    9 +
 apps/vscode-e2e/src/fixtures/apply-diff.ts         |    2 +-
 apps/vscode-e2e/src/suite/subtasks.test.ts         |    3 +
 src/core/assistant-message/NativeToolCallParser.ts |  219 +++-
 .../__tests__/NativeToolCallParser.spec.ts         |  189 +++-
 ...r-interceptor-guided-format.integration.spec.ts |  350 ++++++
 .../presentAssistantMessage-custom-tool.spec.ts    |    6 +-
 ...sentAssistantMessage-error-interception.spec.ts | 1135 ++++++++++++++++++++
 .../presentAssistantMessage-images.spec.ts         |    4 +-
 ...sistantMessage-parser-dedup.integration.spec.ts |  639 +++++++++++
 .../presentAssistantMessage-unknown-tool.spec.ts   |   13 +-
 .../assistant-message/presentAssistantMessage.ts   |  435 +++++++-
 .../tools/error-interception/ErrorClassifier.ts    |  272 +++++
 .../tools/error-interception/MessageTransformer.ts |  483 +++++++++
 .../error-interception/StructuralValidator.ts      |  279 +++++
 .../tools/error-interception/TaskErrorState.ts     |  167 +++
 .../error-interception/ToolErrorInterceptor.ts     |  381 +++++++
 .../__tests__/ErrorClassifier.spec.ts              | 1106 +++++++++++++++++++
 .../__tests__/MessageTransformer.spec.ts           | 1031 ++++++++++++++++++
 .../__tests__/StructuralValidator.spec.ts          |  184 ++++
 .../__tests__/TaskErrorState.spec.ts               |  171 +++
 .../__tests__/ToolErrorInterceptor.spec.ts         |  941 ++++++++++++++++
 src/core/tools/error-interception/errorPatterns.ts |  734 +++++++++++++
 src/core/tools/error-interception/index.ts         |   53 +
 src/core/tools/error-interception/types.ts         |  198 ++++
 src/eslint-suppressions.json                       |    5 -
 26 files changed, 8940 insertions(+), 69 deletions(-)
```

### `fix/mimo-parallel-tool-call-policy`

```text
 .gitignore                                         |    9 +
 apps/vscode-e2e/src/fixtures/apply-diff.ts         |    2 +-
 .../083500_debug-report.md                         |   73 ++
 .../083900_code-report.md                          |   34 +
 .../164100_code-report.md                          |   33 +
 .../170650_code-report.md                          |   79 ++
 .../172000_code-report.md                          |   63 ++
 .../191200_debug-report.md                         |  123 +++
 packages/telemetry/src/TelemetryService.ts         |   65 ++
 .../src/__tests__/provider-default-model.test.ts   |   63 --
 packages/types/src/model.ts                        |   31 +
 packages/types/src/providers/index.ts              |   76 +-
 packages/types/src/providers/mimo.ts               |   14 +
 packages/types/src/telemetry.ts                    |   31 +
 src/api/__tests__/index.spec.ts                    |  146 +--
 src/api/index.ts                                   |  198 +++-
 src/api/providers/__tests__/mimo.spec.ts           |  261 +++--
 .../fetchers/__tests__/modelCache.spec.ts          |  154 +--
 src/api/providers/fetchers/modelCache.ts           |   77 +-
 src/api/providers/mimo.ts                          |   61 +-
 src/core/assistant-message/NativeToolCallParser.ts |  324 +++++-
 .../assistant-message/ToolCallRetentionPolicy.ts   |  310 ++++++
 .../__tests__/NativeToolCallParser.spec.ts         |  504 ++++++++-
 .../ToolCallRetentionPolicy-telemetry.spec.ts      |  238 ++++
 .../__tests__/ToolCallRetentionPolicy.spec.ts      |  342 ++++++
 .../presentAssistantMessage-custom-tool.spec.ts    |    6 +-
 ...sentAssistantMessage-error-interception.spec.ts | 1135 ++++++++++++++++++++
 .../presentAssistantMessage-images.spec.ts         |    4 +-
 ...sistantMessage-parser-dedup.integration.spec.ts |  959 +++++++++++++++++
 .../presentAssistantMessage-unknown-tool.spec.ts   |   13 +-
 .../assistant-message/presentAssistantMessage.ts   |  549 +++++++++-
 .../__tests__/getEnvironmentDetails.spec.ts        |   18 -
 src/core/environment/getEnvironmentDetails.ts      |   28 +-
 .../prompts/tools/native-tools/execute_command.ts  |   18 +-
 src/core/task/Task.ts                              |  294 ++++-
 src/core/task/__tests__/Task.spec.ts               |  265 ++---
 src/core/task/__tests__/tool-call-policy.spec.ts   |  233 ++++
 src/core/tools/ExecuteCommandTool.ts               |    2 +-
 .../tools/error-interception/ErrorClassifier.ts    |  272 +++++
 .../tools/error-interception/MessageTransformer.ts |  483 +++++++++
 .../error-interception/StructuralValidator.ts      |  283 +++++
 .../tools/error-interception/TaskErrorState.ts     |  167 +++
 .../error-interception/ToolErrorInterceptor.ts     |  381 +++++++
 .../__tests__/ErrorClassifier.spec.ts              | 1106 +++++++++++++++++++
 .../__tests__/MessageTransformer.spec.ts           | 1031 ++++++++++++++++++
 .../__tests__/StructuralValidator.spec.ts          |  184 ++++
 .../__tests__/TaskErrorState.spec.ts               |  171 +++
 .../__tests__/ToolErrorInterceptor.spec.ts         |  941 ++++++++++++++++
 src/core/tools/error-interception/errorPatterns.ts |  734 +++++++++++++
 src/core/tools/error-interception/index.ts         |   53 +
 src/core/tools/error-interception/types.ts         |  198 ++++
 src/core/webview/ClineProvider.ts                  |    9 +-
 src/core/webview/__tests__/ClineProvider.spec.ts   |   35 +-
 .../__tests__/webviewMessageHandler.spec.ts        |    2 +-
 src/core/webview/webviewMessageHandler.ts          |    5 +-
 src/eslint-suppressions.json                       |   19 +-
 src/services/ripgrep/__tests__/index.spec.ts       |   46 -
 src/services/ripgrep/index.ts                      |   12 +-
 src/shared/ProfileValidator.ts                     |   42 +-
 src/shared/__tests__/ProfileValidator.spec.ts      |  105 +-
 src/shared/tools.ts                                |    2 +-
 61 files changed, 12040 insertions(+), 1076 deletions(-)
```

### `feature/local-usage-stats`

```text
 .changeset/itchy-moles-thank.md                    |    5 -
 .github/actions/setup-node-pnpm/action.yml         |    2 +-
 .github/pull_request_template.md                   |   27 +-
 .github/workflows/code-qa.yml                      |   15 +-
 .github/workflows/visual-regression.yml            |   57 -
 .gitignore                                         |    1 +
 .nvmrc                                             |    2 +-
 .tool-versions                                     |    2 +-
 apps/cli/package.json                              |    2 +-
 apps/vscode-e2e/package.json                       |    2 +-
 apps/vscode-e2e/src/fixtures/subtasks.ts           |   67 +-
 apps/vscode-e2e/src/suite/subtasks.test.ts         |   24 +-
 codecov.yml                                        |   34 +-
 .../232100_code-light-report.md                    |   28 +
 .../232329_code-light-report.md                    |   51 +
 .../000500_code-report.md                          |   70 +
 .../003500_code-light-report.md                    |   31 +
 .../003558_code-light-report.md                    |   20 +
 .../003800_ask-full-audit-report.md                |  171 ++
 .../010500_zoo-code-cleanup-analysis.md            |  327 ++++
 .../110100_code-port-usage-stats-dashboard.md      |  117 ++
 .../215218_code-report.md                          |   65 +
 .../234700_debug-investigation-report.md           |  247 +++
 .../001313_code-report.md                          |   58 +
 .../021916_code-report.md                          |   31 +
 .../030642_debug-technical-review.md               |  129 ++
 .../031613_code-light-report.md                    |   24 +
 .../035851_verify-all-pr-items.md                  |  218 +++
 .../052538_architect-research-parallel-toolcall.md |  633 +++++++
 .../133112_environment-feedback.md                 |   22 +
 .../141630_code-light-report.md                    |   36 +
 .../145800_code-report.md                          |   54 +
 .../153100_code-report.md                          |   92 +
 .../162700_code-report.md                          |   73 +
 .../175821_code-report.md                          |   89 +
 .../181131_ask-final-audit.md                      |  195 +++
 .../181914_ask-reaudit.md                          |   80 +
 .../184338_code-light-report.md                    |   42 +
 .../190710_code-light-report.md                    |   33 +
 .../225948_architect-report.md                     |  750 ++++++++
 .../230559_ask-light-gate.md                       |  126 ++
 .../231100_debug-technical-gate.md                 |  173 ++
 .../232815_code-report.md                          |   81 +
 .../234200_code-report.md                          |   90 +
 .../requirement-checklist.md                       |   22 +
 .../004000_merge-local-usage-stats.md              |   39 +
 .../004528_merge-task-dnd-ux.md                    |   44 +
 .../005526_merge-mimo-parallel-tool-call-policy.md |   94 +
 .../010855_code-light-report.md                    |   83 +
 .../055101_ask-light-gate-architecture.md          |  148 ++
 .../061635_code-subtask1-report.md                 |   70 +
 .../062538_code-subtask2-report.md                 |   57 +
 .../063629_code-subtask4-report.md                 |   70 +
 .../070500_code-subtask3-report.md                 |  141 ++
 .../074410_code-subtask5-report.md                 |  164 ++
 .../075708_code-light-report.md                    |   27 +
 .../080747_code-report.md                          |   57 +
 .../083343_code-report.md                          |   67 +
 .../083624_code-report.md                          |   21 +
 .../084519_ask-final-audit.md                      |  203 +++
 .../084700_debug-e2e-investigation.md              |  129 ++
 .../085818_combined-branch-build.md                |   63 +
 .../091558_code-light-report.md                    |   35 +
 .../092338_code-light-report.md                    |   24 +
 .../092845_code-report.md                          |   49 +
 .../101350_code-light-report.md                    |   23 +
 .../170530_merge-resolver-report.md                |   50 +
 .../173500_code-report.md                          |   64 +
 .../181000_code-report.md                          |   37 +
 .../184514_debug-systemic-environment-feedback.md  |   29 +
 .../190600_debug-systemic-report.md                |  185 ++
 .../205659_debug-technical-gate.md                 |  111 ++
 .../220911_code-light-report.md                    |   20 +
 .../224550_code-light-report.md                    |   42 +
 .../225634_code-light-report.md                    |   66 +
 .../231056_code-light-report.md                    |   34 +
 .../231527_debug-technical-review.md               |  144 ++
 .../decisions.md                                   |    5 +
 .../requirement-checklist.md                       |   54 +
 .../114322_code-report.md                          |   39 +
 .../201700_code-report.md                          |   34 +
 .../211308_code-report.md                          |   27 +
 .../225130_code-report.md                          |   50 +
 .../split-pr-plan.md                               |  263 +++
 .../260727_read_file_anchor_out_of_range.md        |   22 +
 knip.json                                          |    6 +-
 package.json                                       |    4 +-
 packages/build/package.json                        |    2 +-
 packages/cloud/package.json                        |    2 +-
 packages/config-eslint/base.js                     |    7 +
 packages/config-eslint/package.json                |    1 +
 packages/core/package.json                         |    2 +-
 packages/ipc/package.json                          |    2 +-
 packages/telemetry/package.json                    |    2 +-
 packages/types/package.json                        |    2 +-
 .../src/__tests__/provider-default-model.test.ts   |   63 -
 packages/types/src/__tests__/usage-stats.spec.ts   |  323 ++++
 packages/types/src/index.ts                        |    2 +
 packages/types/src/mode.ts                         |    2 +-
 packages/types/src/providers/index.ts              |   76 +-
 packages/types/src/providers/mimo.ts               |   26 +-
 packages/types/src/providers/qwen-code.ts          |    8 +-
 packages/types/src/task-organization.ts            |  175 ++
 packages/types/src/usage-stats.ts                  |  189 ++
 packages/types/src/vscode-extension-host.ts        |   89 +-
 packages/types/src/vscode.ts                       |    1 +
 packages/vscode-shim/package.json                  |    2 +-
 pnpm-lock.yaml                                     |  509 +-----
 renovate.json                                      |    5 -
 src-test-log-tail.txt                              |  530 ++++++
 src-test-log.txt                                   |  530 ++++++
 src/__tests__/helpers/provider-stub.ts             |   46 +-
 src/__tests__/history-resume-delegation.spec.ts    |    6 -
 .../removeClineFromStack-delegation.spec.ts        |  166 +-
 src/__tests__/single-open-invariant.spec.ts        |   64 +-
 src/activate/registerCommands.ts                   |    9 +
 src/api/__tests__/index.spec.ts                    |  146 +-
 src/api/index.ts                                   |   76 +-
 .../providers/__tests__/anthropic-vertex.spec.ts   |    2 +
 src/api/providers/__tests__/bedrock.spec.ts        |  113 --
 src/api/providers/__tests__/kenari.spec.ts         |    3 +
 src/api/providers/__tests__/mimo.spec.ts           |    8 +-
 src/api/providers/__tests__/mistral.spec.ts        |   38 +
 src/api/providers/__tests__/moonshot.spec.ts       |  359 ++--
 .../__tests__/openai-usage-tracking.spec.ts        |    6 +-
 src/api/providers/__tests__/openai.spec.ts         |    4 +
 src/api/providers/anthropic-vertex.ts              |   26 +-
 src/api/providers/bedrock.ts                       |   23 -
 .../fetchers/__tests__/modelCache.spec.ts          |  154 +-
 src/api/providers/fetchers/modelCache.ts           |   77 +-
 src/api/providers/kenari.ts                        |   18 +-
 src/api/providers/mistral.ts                       |    9 +-
 src/api/providers/moonshot.ts                      |   95 +-
 src/api/providers/openai-codex.ts                  |   19 +-
 src/api/providers/openai.ts                        |   42 +-
 .../__tests__/getEnvironmentDetails.spec.ts        |   18 -
 src/core/environment/getEnvironmentDetails.ts      |   28 +-
 .../architect-mode-prompt.snap                     |    2 +-
 .../add-custom-instructions/no-mcp-servers.snap    |    2 +-
 .../system-prompt/consistent-system-prompt.snap    |    2 +-
 .../system-prompt/with-computer-use-support.snap   |    2 +-
 .../system-prompt/with-diff-enabled-false.snap     |    2 +-
 .../system-prompt/with-diff-enabled-true.snap      |    2 +-
 .../system-prompt/with-diff-enabled-undefined.snap |    2 +-
 .../with-different-viewport-size.snap              |    2 +-
 .../system-prompt/with-mcp-hub-provided.snap       |    2 +-
 .../system-prompt/with-undefined-mcp-hub.snap      |    2 +-
 src/core/task-persistence/TaskOrganizationStore.ts |  877 ++++++++++
 .../__tests__/TaskOrganizationStore.spec.ts        |  696 ++++++++
 src/core/task-persistence/index.ts                 |    1 +
 src/core/task/Task.ts                              |  207 ++-
 src/core/task/TaskRegistry.ts                      |  119 --
 src/core/task/__tests__/Task.spec.ts               |  265 +--
 src/core/task/__tests__/Task.usage-stats.spec.ts   |  552 ++++++
 src/core/task/__tests__/TaskRegistry.spec.ts       |  301 ----
 src/core/webview/ClineProvider.ts                  |  204 ++-
 .../ClineProvider.flicker-free-cancel.spec.ts      |  165 +-
 src/core/webview/__tests__/ClineProvider.spec.ts   |   36 +-
 .../__tests__/usageStatsMessageHandler.spec.ts     | 1239 +++++++++++++
 .../__tests__/webviewMessageHandler.spec.ts        |   96 +-
 src/core/webview/taskOrganizationMessageHandler.ts |   76 +
 src/core/webview/usageStatsMessageHandler.ts       |  901 ++++++++++
 src/core/webview/webviewMessageHandler.ts          |  100 +-
 src/eslint-suppressions.json                       | 1812 --------------------
 src/eslint.config.mjs                              |    3 +-
 src/package.json                                   |   23 +-
 src/package.nls.ca.json                            |    1 +
 src/package.nls.de.json                            |    1 +
 src/package.nls.es.json                            |    1 +
 src/package.nls.fr.json                            |    1 +
 src/package.nls.hi.json                            |    1 +
 src/package.nls.id.json                            |    1 +
 src/package.nls.it.json                            |    1 +
 src/package.nls.ja.json                            |    1 +
 src/package.nls.json                               |    1 +
 src/package.nls.ko.json                            |    1 +
 src/package.nls.nl.json                            |    1 +
 src/package.nls.pl.json                            |    1 +
 src/package.nls.pt-BR.json                         |    1 +
 src/package.nls.ru.json                            |    1 +
 src/package.nls.tr.json                            |    1 +
 src/package.nls.vi.json                            |    1 +
 src/package.nls.zh-CN.json                         |    1 +
 src/package.nls.zh-TW.json                         |    1 +
 .../command/__tests__/built-in-commands.spec.ts    |    1 +
 src/services/ripgrep/__tests__/index.spec.ts       |   46 -
 src/services/ripgrep/index.ts                      |   12 +-
 src/services/stats/UsageAggregator.ts              |  594 +++++++
 src/services/stats/UsageEventStore.ts              |  868 ++++++++++
 src/services/stats/UsageRecorder.ts                |  167 ++
 src/services/stats/UsageStatsService.ts            |  627 +++++++
 .../stats/__tests__/UsageAggregator.spec.ts        | 1074 ++++++++++++
 .../stats/__tests__/UsageEventStore.spec.ts        |  417 +++++
 .../stats/__tests__/UsageStatsService.spec.ts      |  868 ++++++++++
 .../stats/__tests__/costRecalculation.spec.ts      |  326 ++++
 src/services/stats/costRecalculation.ts            |  189 ++
 src/services/stats/index.ts                        |   25 +
 src/shared/ProfileValidator.ts                     |   42 +-
 src/shared/__tests__/ProfileValidator.spec.ts      |  105 +-
 src/shared/globalFileNames.ts                      |    1 +
 src/utils/__tests__/networkProxy.spec.ts           |  166 +-
 src/utils/networkProxy.ts                          |   73 -
 src/utils/safeWriteJson.ts                         |  186 +-
 src/vitest.config.ts                               |    4 +-
 turbo-noncore-log.txt                              |   16 +
 webview-ui/.gitignore                              |    6 -
 webview-ui/AGENTS.md                               |   64 -
 webview-ui/docker-compose.visual.yml               |   12 -
 webview-ui/package.json                            |    9 +-
 webview-ui/playwright-ct.config.ts                 |   95 -
 webview-ui/playwright/coverage-fixture.ts          |   23 -
 webview-ui/playwright/index.html                   |   12 -
 webview-ui/playwright/index.tsx                    |    9 -
 webview-ui/playwright/run-docker.mjs               |   53 -
 webview-ui/playwright/vscode-theme-dark.css        |   89 -
 webview-ui/src/App.tsx                             |    5 +-
 .../src/components/dashboard/DashboardSummary.tsx  |   74 +
 .../src/components/dashboard/DashboardView.tsx     |  902 ++++++++++
 .../src/components/dashboard/SessionDetail.tsx     |  240 +++
 .../src/components/dashboard/SessionList.tsx       |  241 +++
 .../dashboard/__tests__/DashboardSummary.spec.tsx  |  100 ++
 .../dashboard/__tests__/DashboardView.spec.tsx     | 1251 ++++++++++++++
 .../dashboard/__tests__/SessionDetail.spec.tsx     |  175 ++
 .../dashboard/__tests__/SessionList.spec.tsx       |  188 ++
 webview-ui/src/components/mcp/McpEnabledToggle.tsx |   24 +-
 webview-ui/src/components/mcp/McpView.tsx          |   15 +-
 .../mcp/__tests__/McpEnabledToggle.spec.tsx        |   58 -
 .../src/components/mcp/__tests__/McpView.spec.tsx  |   77 -
 webview-ui/src/components/settings/ApiOptions.tsx  |    9 +-
 .../components/settings/AutoApproveSettings.tsx    |   12 +
 .../settings/ContextManagementSettings.tsx         |    2 +
 .../src/components/settings/PromptsSettings.tsx    |   14 +-
 .../src/components/settings/SettingsView.tsx       |    7 +-
 .../__tests__/AutoApproveSettings.spec.tsx         |  100 --
 .../__tests__/ContextManagementSettings.spec.tsx   |   33 +-
 .../settings/__tests__/PromptsSettings.spec.tsx    |   91 -
 .../settings/__tests__/SettingsView.spec.tsx       |   70 +-
 .../SettingsView.unsaved-changes.spec.tsx          |   46 +-
 .../src/components/settings/providers/Ollama.tsx   |   74 +-
 .../settings/providers/__tests__/Ollama.spec.tsx   |  192 +--
 webview-ui/src/components/stats/UsageHeatmap.tsx   |  285 +++
 .../stats/__tests__/UsageHeatmap.spec.tsx          |  514 ++++++
 .../welcome/__tests__/RooHero.visual.tsx           |   29 -
 .../__tests__/__screenshots__/zoo-hero-dark.png    |  Bin 20809 -> 0 bytes
 webview-ui/src/i18n/locales/ca/dashboard.json      |   92 +
 webview-ui/src/i18n/locales/ca/stats.json          |   82 +
 webview-ui/src/i18n/locales/de/dashboard.json      |   92 +
 webview-ui/src/i18n/locales/de/stats.json          |   82 +
 webview-ui/src/i18n/locales/en/dashboard.json      |   92 +
 webview-ui/src/i18n/locales/en/stats.json          |   82 +
 webview-ui/src/i18n/locales/es/dashboard.json      |   92 +
 webview-ui/src/i18n/locales/es/stats.json          |   82 +
 webview-ui/src/i18n/locales/fr/dashboard.json      |   92 +
 webview-ui/src/i18n/locales/fr/stats.json          |   82 +
 webview-ui/src/i18n/locales/hi/dashboard.json      |   92 +
 webview-ui/src/i18n/locales/hi/stats.json          |   82 +
 webview-ui/src/i18n/locales/id/dashboard.json      |   92 +
 webview-ui/src/i18n/locales/id/stats.json          |   82 +
 webview-ui/src/i18n/locales/it/dashboard.json      |   92 +
 webview-ui/src/i18n/locales/it/stats.json          |   82 +
 webview-ui/src/i18n/locales/ja/dashboard.json      |   92 +
 webview-ui/src/i18n/locales/ja/stats.json          |   82 +
 webview-ui/src/i18n/locales/ko/dashboard.json      |   92 +
 webview-ui/src/i18n/locales/ko/stats.json          |   82 +
 webview-ui/src/i18n/locales/nl/dashboard.json      |   92 +
 webview-ui/src/i18n/locales/nl/stats.json          |   82 +
 webview-ui/src/i18n/locales/pl/dashboard.json      |   92 +
 webview-ui/src/i18n/locales/pl/stats.json          |   82 +
 webview-ui/src/i18n/locales/pt-BR/dashboard.json   |   92 +
 webview-ui/src/i18n/locales/pt-BR/stats.json       |   82 +
 webview-ui/src/i18n/locales/ru/dashboard.json      |   92 +
 webview-ui/src/i18n/locales/ru/stats.json          |   82 +
 webview-ui/src/i18n/locales/tr/dashboard.json      |   92 +
 webview-ui/src/i18n/locales/tr/stats.json          |   82 +
 webview-ui/src/i18n/locales/vi/dashboard.json      |   92 +
 webview-ui/src/i18n/locales/vi/stats.json          |   82 +
 webview-ui/src/i18n/locales/zh-CN/dashboard.json   |   92 +
 webview-ui/src/i18n/locales/zh-CN/stats.json       |   82 +
 webview-ui/src/i18n/locales/zh-TW/dashboard.json   |   92 +
 webview-ui/src/i18n/locales/zh-TW/stats.json       |   82 +
 .../src/utils/__tests__/formatNumber.spec.ts       |  150 ++
 webview-ui/src/utils/formatNumber.ts               |   43 +
 webview-ui/tsconfig.json                           |    2 +-
 webview-ui/vitest.config.ts                        |    4 +-
 284 files changed, 27420 insertions(+), 6046 deletions(-)
```

### `feature/task-dnd-ux`

```text
 .changeset/itchy-moles-thank.md                    |    5 -
 .github/actions/setup-node-pnpm/action.yml         |    2 +-
 .github/pull_request_template.md                   |   27 +-
 .github/workflows/code-qa.yml                      |   15 +-
 .github/workflows/visual-regression.yml            |   57 -
 .nvmrc                                             |    2 +-
 .tool-versions                                     |    2 +-
 CHANGELOG.md                                       |   27 -
 README.md                                          |   19 +-
 apps/cli/package.json                              |    2 +-
 apps/vscode-e2e/package.json                       |    2 +-
 apps/vscode-e2e/src/fixtures/subtasks.ts           |   67 +-
 apps/vscode-e2e/src/suite/subtasks.test.ts         |   24 +-
 codecov.yml                                        |   34 +-
 knip.json                                          |    6 +-
 locales/ca/README.md                               |   18 +-
 locales/de/README.md                               |   18 +-
 locales/es/README.md                               |   18 +-
 locales/fr/README.md                               |   18 +-
 locales/hi/README.md                               |   18 +-
 locales/id/README.md                               |   18 +-
 locales/it/README.md                               |   18 +-
 locales/ja/README.md                               |   18 +-
 locales/ko/README.md                               |   18 +-
 locales/nl/README.md                               |   18 +-
 locales/pl/README.md                               |   18 +-
 locales/pt-BR/README.md                            |   18 +-
 locales/ru/README.md                               |   18 +-
 locales/tr/README.md                               |   18 +-
 locales/vi/README.md                               |   18 +-
 locales/zh-CN/README.md                            |   18 +-
 locales/zh-TW/README.md                            |   18 +-
 package.json                                       |    4 +-
 packages/build/package.json                        |    2 +-
 packages/cloud/package.json                        |    2 +-
 packages/config-eslint/base.js                     |    7 +
 packages/config-eslint/package.json                |    1 +
 packages/core/package.json                         |    2 +-
 packages/ipc/package.json                          |    2 +-
 packages/telemetry/package.json                    |    2 +-
 packages/types/package.json                        |    2 +-
 .../src/__tests__/provider-default-model.test.ts   |   63 -
 packages/types/src/index.ts                        |    1 +
 packages/types/src/mode.ts                         |    2 +-
 packages/types/src/providers/index.ts              |   76 +-
 packages/types/src/task-organization.ts            |  175 ++
 packages/types/src/vscode-extension-host.ts        |   34 +
 packages/vscode-shim/package.json                  |    2 +-
 pnpm-lock.yaml                                     |  565 ++----
 renovate.json                                      |    5 -
 src/__tests__/helpers/provider-stub.ts             |   46 +-
 src/__tests__/history-resume-delegation.spec.ts    |    6 -
 .../removeClineFromStack-delegation.spec.ts        |  166 +-
 src/__tests__/single-open-invariant.spec.ts        |   64 +-
 src/api/__tests__/index.spec.ts                    |  146 +-
 src/api/index.ts                                   |   76 +-
 src/api/providers/__tests__/bedrock.spec.ts        |  113 --
 src/api/providers/bedrock.ts                       |   23 -
 .../fetchers/__tests__/modelCache.spec.ts          |  154 +-
 src/api/providers/fetchers/modelCache.ts           |   77 +-
 .../__tests__/getEnvironmentDetails.spec.ts        |   18 -
 src/core/environment/getEnvironmentDetails.ts      |   28 +-
 .../architect-mode-prompt.snap                     |    2 +-
 .../add-custom-instructions/no-mcp-servers.snap    |    2 +-
 .../system-prompt/consistent-system-prompt.snap    |    2 +-
 .../system-prompt/with-computer-use-support.snap   |    2 +-
 .../system-prompt/with-diff-enabled-false.snap     |    2 +-
 .../system-prompt/with-diff-enabled-true.snap      |    2 +-
 .../system-prompt/with-diff-enabled-undefined.snap |    2 +-
 .../with-different-viewport-size.snap              |    2 +-
 .../system-prompt/with-mcp-hub-provided.snap       |    2 +-
 .../system-prompt/with-undefined-mcp-hub.snap      |    2 +-
 src/core/task-persistence/TaskOrganizationStore.ts |  869 ++++++++++
 .../__tests__/TaskOrganizationStore.spec.ts        |  693 ++++++++
 src/core/task-persistence/index.ts                 |    1 +
 src/core/task/Task.ts                              |    3 +-
 src/core/task/TaskRegistry.ts                      |  119 --
 src/core/task/__tests__/Task.spec.ts               |  265 +--
 src/core/task/__tests__/TaskRegistry.spec.ts       |  301 ----
 src/core/webview/ClineProvider.ts                  |  171 +-
 .../ClineProvider.flicker-free-cancel.spec.ts      |  165 +-
 src/core/webview/__tests__/ClineProvider.spec.ts   |   36 +-
 .../taskOrganizationMessageHandler.spec.ts         |  276 +++
 .../__tests__/webviewMessageHandler.spec.ts        |   96 +-
 src/core/webview/taskOrganizationMessageHandler.ts |   76 +
 src/core/webview/webviewMessageHandler.ts          |   56 +-
 src/eslint-suppressions.json                       | 1812 --------------------
 src/eslint.config.mjs                              |    3 +-
 src/package.json                                   |   10 +-
 src/services/ripgrep/__tests__/index.spec.ts       |   46 -
 src/services/ripgrep/index.ts                      |   12 +-
 src/shared/ProfileValidator.ts                     |   42 +-
 src/shared/__tests__/ProfileValidator.spec.ts      |  105 +-
 src/shared/globalFileNames.ts                      |    1 +
 src/utils/__tests__/networkProxy.spec.ts           |  166 +-
 src/utils/networkProxy.ts                          |   73 -
 src/utils/safeWriteJson.ts                         |  186 +-
 webview-ui/.gitignore                              |    6 -
 webview-ui/AGENTS.md                               |   64 -
 webview-ui/docker-compose.visual.yml               |   12 -
 webview-ui/package.json                            |   12 +-
 webview-ui/playwright-ct.config.ts                 |   95 -
 webview-ui/playwright/coverage-fixture.ts          |   23 -
 webview-ui/playwright/index.html                   |   12 -
 webview-ui/playwright/index.tsx                    |    9 -
 webview-ui/playwright/run-docker.mjs               |   53 -
 webview-ui/playwright/vscode-theme-dark.css        |   89 -
 .../chat/__tests__/Announcement.spec.tsx           |   16 +-
 .../src/components/history/DeleteFoldersDialog.tsx |   63 +
 .../src/components/history/DraggableTaskEntry.tsx  |   84 +
 .../src/components/history/FolderNameDialog.tsx    |  135 ++
 .../src/components/history/HistoryPreview.tsx      |  238 ++-
 webview-ui/src/components/history/HistoryView.tsx  |  849 ++++++++-
 .../src/components/history/ManualFolderItem.tsx    |  332 ++++
 webview-ui/src/components/history/PinButton.tsx    |   80 +
 .../src/components/history/PinnedHistoryItem.tsx   |   87 +
 webview-ui/src/components/history/SubtaskRow.tsx   |   54 +-
 .../src/components/history/TaskGroupItem.tsx       |   16 +
 webview-ui/src/components/history/TaskItem.tsx     |   32 +-
 .../src/components/history/TaskItemFooter.tsx      |   30 +-
 .../history/TaskOrganizationDndSurface.tsx         |  164 ++
 .../history/TaskOrganizationErrorBoundary.tsx      |   44 +
 .../history/TaskOrganizationInteractionContext.tsx |  233 +++
 .../history/TaskOrganizationPointerSensor.ts       |   69 +
 .../history/__tests__/DeleteFoldersDialog.spec.tsx |   43 +
 .../history/__tests__/DraggableTaskEntry.spec.tsx  |  210 +++
 .../history/__tests__/HistoryPreview.spec.tsx      |   30 +-
 .../HistoryPreview.taskOrganization.spec.tsx       |  605 +++++++
 .../HistoryView.taskOrganization.spec.tsx          | 1032 +++++++++++
 .../history/__tests__/ManualFolderItem.spec.tsx    |  309 ++++
 .../history/__tests__/PinButton.spec.tsx           |   77 +
 .../history/__tests__/TaskItemFooter.spec.tsx      |   20 -
 .../__tests__/TaskOrganizationDndSurface.spec.tsx  |  356 ++++
 .../TaskOrganizationErrorBoundary.spec.tsx         |  143 ++
 .../TaskOrganizationInteractionContext.spec.tsx    |  247 +++
 .../TaskOrganizationPointerSensor.spec.ts          |  123 ++
 .../__tests__/taskOrganizationModel.setup.ts       |   45 +
 .../__tests__/taskOrganizationModel.spec.ts        |  741 ++++++++
 .../taskOrganizationModel.vitest.config.ts         |   25 +
 .../__tests__/useTaskOrganizationDnd.spec.tsx      |  231 +++
 .../components/history/taskOrganizationModel.ts    |  714 ++++++++
 webview-ui/src/components/history/types.ts         |  115 +-
 .../components/history/useTaskOrganizationDnd.ts   |  263 +++
 webview-ui/src/components/mcp/McpEnabledToggle.tsx |   24 +-
 webview-ui/src/components/mcp/McpView.tsx          |   15 +-
 .../mcp/__tests__/McpEnabledToggle.spec.tsx        |   58 -
 .../src/components/mcp/__tests__/McpView.spec.tsx  |   77 -
 webview-ui/src/components/settings/ApiOptions.tsx  |    9 +-
 .../components/settings/AutoApproveSettings.tsx    |   12 +
 .../settings/ContextManagementSettings.tsx         |    2 +
 .../src/components/settings/PromptsSettings.tsx    |   14 +-
 .../src/components/settings/SettingsView.tsx       |    7 +-
 .../__tests__/AutoApproveSettings.spec.tsx         |  100 --
 .../__tests__/ContextManagementSettings.spec.tsx   |   33 +-
 .../settings/__tests__/PromptsSettings.spec.tsx    |   91 -
 .../settings/__tests__/SettingsView.spec.tsx       |   70 +-
 .../SettingsView.unsaved-changes.spec.tsx          |   46 +-
 .../src/components/settings/providers/Ollama.tsx   |   74 +-
 .../settings/providers/__tests__/Ollama.spec.tsx   |  192 +--
 .../welcome/__tests__/RooHero.visual.tsx           |   29 -
 .../__tests__/__screenshots__/zoo-hero-dark.png    |  Bin 20809 -> 0 bytes
 webview-ui/src/context/ExtensionStateContext.tsx   |   61 +-
 ...ExtensionStateContext.taskOrganization.spec.tsx |  265 +++
 .../src/i18n/__tests__/translation-parity.spec.ts  |   91 +
 webview-ui/src/i18n/locales/ca/chat.json           |   10 +-
 webview-ui/src/i18n/locales/ca/history.json        |   47 +-
 webview-ui/src/i18n/locales/de/chat.json           |   10 +-
 webview-ui/src/i18n/locales/de/history.json        |   47 +-
 webview-ui/src/i18n/locales/en/chat.json           |   10 +-
 webview-ui/src/i18n/locales/en/history.json        |   47 +-
 webview-ui/src/i18n/locales/es/chat.json           |   10 +-
 webview-ui/src/i18n/locales/es/history.json        |   47 +-
 webview-ui/src/i18n/locales/fr/chat.json           |   10 +-
 webview-ui/src/i18n/locales/fr/history.json        |   47 +-
 webview-ui/src/i18n/locales/hi/chat.json           |   10 +-
 webview-ui/src/i18n/locales/hi/history.json        |   47 +-
 webview-ui/src/i18n/locales/id/chat.json           |   10 +-
 webview-ui/src/i18n/locales/id/history.json        |   47 +-
 webview-ui/src/i18n/locales/it/chat.json           |   10 +-
 webview-ui/src/i18n/locales/it/history.json        |   47 +-
 webview-ui/src/i18n/locales/ja/chat.json           |   10 +-
 webview-ui/src/i18n/locales/ja/history.json        |   47 +-
 webview-ui/src/i18n/locales/ko/chat.json           |   10 +-
 webview-ui/src/i18n/locales/ko/history.json        |   47 +-
 webview-ui/src/i18n/locales/nl/chat.json           |   10 +-
 webview-ui/src/i18n/locales/nl/history.json        |   47 +-
 webview-ui/src/i18n/locales/pl/chat.json           |   10 +-
 webview-ui/src/i18n/locales/pl/history.json        |   47 +-
 webview-ui/src/i18n/locales/pt-BR/chat.json        |   10 +-
 webview-ui/src/i18n/locales/pt-BR/history.json     |   47 +-
 webview-ui/src/i18n/locales/ru/chat.json           |   10 +-
 webview-ui/src/i18n/locales/ru/history.json        |   47 +-
 webview-ui/src/i18n/locales/tr/chat.json           |   10 +-
 webview-ui/src/i18n/locales/tr/history.json        |   47 +-
 webview-ui/src/i18n/locales/vi/chat.json           |   10 +-
 webview-ui/src/i18n/locales/vi/history.json        |   47 +-
 webview-ui/src/i18n/locales/zh-CN/chat.json        |   10 +-
 webview-ui/src/i18n/locales/zh-CN/history.json     |   47 +-
 webview-ui/src/i18n/locales/zh-TW/chat.json        |   10 +-
 webview-ui/src/i18n/locales/zh-TW/history.json     |   47 +-
 webview-ui/tsconfig.json                           |    2 +-
 webview-ui/vitest.config.ts                        |    4 +-
 webview-ui/vitest.setup.ts                         |    7 +
 203 files changed, 12418 insertions(+), 6185 deletions(-)
```

## Requested commit logs

### Error branch

```text
5c8c495e0 docs: add flaky-test note for interrupted-child E2E
cc4008dd8 fix: correct PushToolResult type in integration test
321da70c8 fix(e2e): update apply-diff fixture to match <error_details> format + add integration test for INVALID_JSON_ARGUMENTS
fefbe54ae fix: resolve CI lint and test failures for PR #1009
3d9964eaf fix(error-interception): address PR review findings and improve guidance
a10a145de fix(error-interception): rebase onto upstream/main and fix eslint no-explicit-any suppressions
3f5497e86 fix(error-interception): update stale test assertion for unknown tool error format
d5255546c fix(error-interception): add non-null assertion in test to satisfy TS strict mode
9d3e65d27 feat(error-interception): user-friendly error UI with structured detail view
f81d1fb0a fix(error-interception): show errors to user in UI alongside AI guidance
5b800dcac feat(error-interception): improve AI guidance quality for 4 patterns
027191514 fix(error-interception): add logging to silent error paths
37b9b1c5d feat(error-interception): add INVALID_JSON_ARGUMENTS pattern for concatenated JSON objects
4e29301bc test: add 13 targeted tests for 80%+ Codecov patch coverage
7d45ce145 test: add 3 targeted coverage tests for 80% Codecov threshold
6bd6ec265 fix: update e2e fixture and add coverage tests for Codecov
f5bb527d0 fix(error-interception): address CodeRabbit review findings
f41920598 feat(error-interception): add deterministic error interception middleware
```

### Mimo branch

```text
b7edba688 fix: preserve parallel behavior for known providers without explicit capabilities
7d1034529 fix: resolve no-explicit-any lint errors in mimo and telemetry files
6e8d4744b feat: add tool-call policy telemetry events
9d87f7fc5 feat: add ghost quarantine and max-one tool call enforcement
5c8b3ce58 feat: wire MiMo provider controls and tighten argument normalization
d17049f01 feat: add model-level tool-call capability and policy resolution
a259fb2fd fix(error-interception): address PR review findings and improve guidance
3a3dc1f12 fix(error-interception): rebase onto upstream/main and fix eslint no-explicit-any suppressions
1b5a15a17 fix(error-interception): update stale test assertion for unknown tool error format
2cd943b28 fix(error-interception): add non-null assertion in test to satisfy TS strict mode
4b98fc035 feat(error-interception): user-friendly error UI with structured detail view
1b5f9dcab fix(error-interception): show errors to user in UI alongside AI guidance
4a409d3e6 feat(error-interception): improve AI guidance quality for 4 patterns
eff068e83 fix(error-interception): add logging to silent error paths
b0fc216f7 feat(error-interception): add INVALID_JSON_ARGUMENTS pattern for concatenated JSON objects
333fa2ca6 test: add 13 targeted tests for 80%+ Codecov patch coverage
0d5e0ce43 test: add 3 targeted coverage tests for 80% Codecov threshold
a588459f0 fix: update e2e fixture and add coverage tests for Codecov
73b8bdbb2 fix(error-interception): address CodeRabbit review findings
b8fca8502 feat(error-interception): add deterministic error interception middleware
```

## Issues Discovered

1. The outdated brief says DnD has one commit; the current branch has three branch-side commits.
2. The current Mimo branch is based on an earlier, not final, Error-interception state.
3. The combined branch contains real provider-pricing follow-ups absent by path from all five individual branch tips.
4. The combined branch also contains three push/status helper scripts that should not enter upstream PRs.
5. The mentioned codebase-indexing deletion is absent from all analyzed combined-branch code-index paths.
6. Historical report files account for a large part of Stats and some Shell/Mimo branch-side file counts; they are branch artifacts, not product dependencies.

## Next Step Recommendations

Proceed to Step 2 using Option A. Establish exact PR manifests and ownership for shared type, IPC, task-persistence, and provider files before creating any candidate branches.

## Affected File List

- [analysis report](analysis-report.md)
- [file overlap matrix](file-overlap-matrix.md)
- Three timestamped [environment feedback reports](./)

