# Option B, 17-PR 실행 브리프

> **Status:** Approved execution topology. This file supersedes the obsolete brief in the prior session folder and is the **single source of truth** for branch reconstruction, opening order, file ownership, verification, and merge sequencing.

## 1. 미션 (Mission)

Reconstruct the five historical feature lines and combined-only provider-cost fixes as **17 purpose-led upstream pull requests**, each built from clean `upstream/main` at Zoo Code `3.72.0`. Each PR must explain why it exists, stay small enough for its code owner to review, preserve a green and behaviorally intact `3.72.0` at every merge point, and obey one strict invariant: **no two open PRs may change the same file path**. Historical branches are evidence only. Never merge or publish their branch-tip trees wholesale.

## 2. 기준선 (Baseline)

| Item | Authoritative value | Operational rule |
|---|---|---|
| Upstream | `https://github.com/Zoo-Code-Org/Zoo-Code.git` | Remote `upstream`. |
| Fork | `https://github.com/myk1yt/Zoo-Code.git` | Remote `myk1yt`; push candidate branches here. |
| Recorded upstream baseline | `d27153a251d2051b6a8e73d305b06ffbc5ac6970` | Analyzed `main` and `upstream/main` matched. Refresh before every wave. If upstream advances, record the new SHA and regenerate all unopened dependants. |
| Product version | `3.72.0` | Authoritative in [`src/package.json`](../../src/package.json:6). No intermediate merge may regress it. |
| Baseline subject | `fix(ripgrep): support @vscode/ripgrep >=1.18 platform-package layout (#1024) (#1032)` | Analysis anchor only, not permission to ignore newer upstream. |
| Source evidence | Shell `8e6799525`; Error `5c8c495e0`; MiMo-only `d17049f01..b7edba688`; Stats `9968e390d`; DnD `838f99249`; combined `87c155528` | Read-only evidence. Extract by concern and path. |

### 기준선 확인 명령 (Baseline gate)

```powershell
git fetch upstream
git fetch myk1yt
git remote -v
git rev-parse upstream/main
git show upstream/main:src/package.json | ConvertFrom-Json | Select-Object -ExpandProperty version
git status --short
```

Expected at the recorded baseline: SHA `d27153a251d2051b6a8e73d305b06ffbc5ac6970`, version `3.72.0`, clean worktree. If `upstream/main` changes, use its refreshed SHA for new branches, but do not silently change product-version scope.

## 3. 기술 흐름 (Technical Specification)

The split follows actual frontend ↔ extension-host ↔ runtime boundaries, not historical commit boundaries.

```text
Error: tool/parser failure -> classification -> bounded interceptor
  -> assistant parser/presentation -> assistant stream -> chat diagnosis

Shell: cached TerminalSettings UI -> typed settings IPC -> command/task orchestration
  -> resolver -> scheduler/lifecycle/registry -> VS Code terminal or Execa
  -> ordered output + exit status + structured tool result

Task organization: history action -> typed IPC -> workspace-scoped store
  -> atomic JSON write -> extension-state refresh -> folders/pins/DnD UI

MiMo: model capability -> provider binding -> retention decision
  -> parser/task enforcement -> retained/quarantined/rejected call -> telemetry

Stats: final usage + totalCost -> final-attempt hook -> recorder -> event store
  -> aggregation/recalculation -> typed Stats IPC -> dashboard/sessions/heatmap
```

Cross-boundary errors remain typed and concern-local. Error interception never recurses. Explicit shell selection never silently falls back. Task organization never crosses workspace identity. Stats store or UI failure never fails a task. Provider-cost normalization may change formulas, but never Stats storage or UI semantics.

## 4. 17개 PR 표 (Approved PR Register)

Counts and lines are planning estimates from branch-side stats. Before opening a PR, regenerate its exact manifest against its actual prerequisite merge commit.

| PR | Name | WHY it exists | Files | Lines | Dependencies | Complexity | Focused verification |
|---|---|---|---:|---:|---|---|---|
| B01 | Error contracts and classification | Define deterministic error vocabulary and matching rules without mixing recovery runtime or parser integration. | ~6 | ~3,000 | None | Standard | `cd src; npx vitest run core/tools/error-interception` |
| B02 | Error transformation and interception runtime | Convert classified failures into bounded, truthful, non-recursive recovery messages. | ~7 | ~3,000 | B01 | Standard | `cd src; npx vitest run core/tools/error-interception` |
| B03 | Error assistant-message and E2E integration | Prove parser, presentation, and user-visible error behavior together after the runtime is stable. | ~11 | ~2,900 | B02 | Standard | `cd src; npx vitest run core/assistant-message`; `pnpm --filter @roo-code/vscode-e2e test:ci:mock` |
| B04 | Shell settings and shared contracts | Land backward-compatible shell settings and cached-state UI binding before runtime consumers. | ~8 | ~1,000 | None | Light | `cd packages/types; npx vitest run`; `cd webview-ui; npx vitest run src/components/settings` |
| B05 | Shell and profile resolution primitives | Isolate executable, profile, invocation, quoting, and environment resolution from lifecycle state. | ~10 | ~2,600 | B04 | Standard | `cd src; npx vitest run integrations/terminal utils` |
| B06 | Terminal scheduling, lifecycle, and registry | Make queueing, cancellation, reuse, adapters, and state transitions independently reviewable. | ~14 | ~4,800 | B05 | Heavy | `cd src; npx vitest run integrations/terminal` |
| B07 | Command tool, prompt, IPC, and E2E shell integration | Connect the stable terminal subsystem to task execution, prompts, host routing, and E2E behavior. | ~27 | ~2,900 | B06 | Heavy | `cd src; npx vitest run core/tools core/prompts core/webview integrations/terminal`; `pnpm --filter @roo-code/vscode-e2e test:ci:mock` |
| B08 | Task organization contract and persistence | Define workspace identity, schema, filenames, atomic storage, and malformed-data recovery independently of UI. | ~8 | ~2,100 | B04 | Standard | `cd packages/types; npx vitest run`; `cd src; npx vitest run core/task-persistence` |
| B09 | Task organization extension IPC and frontend context | Establish a typed state round trip before adding history interactions. | ~8 | ~1,300 | B07, B08 | Standard | `cd src; npx vitest run core/webview`; `cd webview-ui; npx vitest run src/context` |
| B10 | History folders, pinning, DnD, accessibility, dependencies, localization | Deliver one complete, accessible task-organization workflow on stable transport. | ~74 | ~8,000 | B09 | Heavy, locale-heavy | `cd webview-ui; npx vitest run src/components/history src/i18n`; `pnpm --filter @roo-code/vscode-e2e test:ci:mock` |
| B11 | MiMo capability and provider binding | Introduce capability metadata and provider/API binding without changing execution behavior. | ~7 | ~650 | B01, B04 | Light | `cd packages/types; npx vitest run`; `cd src; npx vitest run api/providers` |
| B12 | MiMo retention enforcement and telemetry | Apply max-one and ghost-quarantine policy through parser/task/tool boundaries and make decisions observable. | ~13 | ~2,250 | B03, B07, B11 | Heavy | `cd src; npx vitest run core/assistant-message core/task core/tools/error-interception api/providers`; `pnpm --filter @roo-code/telemetry check-types` |
| B13 | Usage event contract and durable event store | Stabilize versioned local events and tolerant append/read behavior before queries or UI. | ~12 | ~3,000 | B08, B12 | Standard | `cd packages/types; npx vitest run`; `cd src; npx vitest run services/stats` |
| B14 | Usage aggregation, recalculation, and service facade | Provide deterministic queries and cost recalculation over the stable event store. | ~7 | ~3,800 | B13 | Standard | `cd src; npx vitest run services/stats` |
| B15 | Provider and task usage capture | Record exactly one event at final-attempt completion without blocking task execution. | ~16 | ~1,900 | B12, B13 | Heavy | `cd src; npx vitest run api/providers core/task services/stats` |
| B16 | Stats IPC, dashboard, sessions, heatmap, commands, localization | Expose stable Stats semantics and user controls only after backend and Task Organization contracts are fixed. | ~75 | ~8,500 | B09, B10, B14, B15 | Heavy, locale-heavy | `cd src; npx vitest run core/webview services/stats services/command`; `cd webview-ui; npx vitest run src/components/dashboard src/components/stats src/utils src/i18n`; `pnpm --filter @roo-code/vscode-e2e test:ci:mock` |
| B17 | Configured provider-cost normalization | Correct provider-specific configured-price formulas without reopening Stats services, IPC, or UI. | ~13–18 | ~700–1,500 | B15, B16 | Standard | `cd src; npx vitest run api/providers services/stats core/task` |

## 5. 의존성 DAG (Dependency DAG)

Every arrow means **merge before downstream branch construction/opening**, unless a wave rule explicitly identifies path-disjoint siblings.

```text
B01 -> B02 -> B03 -------------------------------> B12
  \-----------------------> B11 -------------------^

B04 -> B05 -> B06 -> B07 -> B09 -> B10 ------------------------> B16 -> B17
  \---------------> B08 ----^        \-> B13 -> B14 ------------^
                                        \-----> B15 --------------^
B12 --------------------------------------------> B13, B15
```

## 6. 머지 웨이브 (Merge Waves)

| Wave | Candidates | Parallel/open rule | Exit condition |
|---|---|---|---|
| 0 | Baseline and manifests | No PR opens. Freeze refreshed upstream SHA and exact candidate manifests. | Baseline recorded; worktree clean; version `3.72.0`. |
| 1 | B01 + B04 | Path-disjoint siblings, may be open together. | Both merged. |
| 2 | B02 + B05 + B08 + B11 | Construct only after Wave 1. Open together only after pairwise path intersections are empty. | All four merged. |
| 3 | B03 + B06 | Path-disjoint siblings after their own prerequisites. | Both merged. |
| 4 | B07 | Serial conflict-surface owner for command/task/IPC paths. | Merged. |
| 5 | B09 + B12 | Nominal siblings. Open together only if exact regenerated path sets are disjoint; otherwise merge B09 first, regenerate B12. | Both merged. |
| 6 | B10 + B13 | Nominal siblings after B09/B12. Open together only if the path gate is empty. | Both merged. |
| 7 | B14 | Serial Stats service layer. | Merged. |
| 8 | B15 | Serial because it consumes B13 and edits provider/task surfaces owned earlier by B12. | Merged. |
| 9 | B16 | Serial UI/IPC integration after B10, B14, B15. | Merged. |
| 10 | B17 | Final formula-only leaf. | Merged and full candidate verification green. |

The safe-pair examples in the architecture report are advisory, not exemptions. The regenerated exact path set is authoritative. B13 and B15 are always sequential by default because extraction may share usage/provider-type paths.

## 7. 실행 순서 (Execution Order)

### 7.1 공통 브랜치 생성 템플릿

Use one clean branch per PR. Never create it from a historical feature branch.

```powershell
git fetch upstream
git switch -c pr/b01-error-contracts upstream/main
git rev-parse HEAD
```

For every later PR, first wait until all declared prerequisites are merged upstream, refresh, then create the branch from the new `upstream/main`:

```powershell
git fetch upstream
git switch -c pr/b02-error-runtime upstream/main
```

Use one of two reconstruction methods:

```powershell
# Use only when the historical commit is entirely inside this PR's approved manifest.
git cherry-pick -x <source-commit-sha>

# Use when one source commit mixes concerns. Apply without committing, stage only
# approved paths/hunks, review the staged patch, then commit the one concern.
git cherry-pick --no-commit <source-commit-sha>
git diff --cached --name-only
git diff --cached
git commit -m "<type>(<scope>): <purpose-led subject>"
```

MiMo is the critical exception. The current MiMo tip contains inherited Error history. Reconstruct B11/B12 from only these six evidence commits, splitting their hunks by the B11/B12 boundaries:

```powershell
git cherry-pick --no-commit d17049f01
git cherry-pick --no-commit 5c8b3ce58
git cherry-pick --no-commit 9d87f7fc5
git cherry-pick --no-commit 6e8d4744b
git cherry-pick --no-commit 7d1034529
git cherry-pick --no-commit b7edba688
```

Do not merge or cherry-pick the MiMo branch tip. The six commands above are an evidence list, not a blind batch: apply one commit, stage and commit only the current PR's owned hunks, restore a clean index/worktree, then continue. B11 and B12 each receive only their owned subset.

### 7.2 진행 중 PR 리베이스 템플릿

If upstream advances while a PR remains open, rebase just in time, rerun the full PR gate, and force-push only with lease:

```powershell
git fetch upstream
git switch <candidate-branch>
git rebase upstream/main
git diff --check upstream/main...HEAD
git push --force-with-lease myk1yt <candidate-branch>
```

If a conflict touches a shared file, preserve merged upstream behavior first and reapply only the current PR's concern. Never solve a conflict by accepting a historical whole file.

### 7.3 웨이브별 절차

1. **Wave 0:** Run the baseline gate. Record the exact SHA. Expand all path-family estimates into candidate manifests. Reject reports, logs, helpers, changesets, stale reversions, and unassigned files.
2. **Wave 1:** Create B01 and B04 from the same refreshed `upstream/main`. Run focused and package gates independently. Run the path-exclusivity gate, push, and open both only if intersection is empty. Merge both before Wave 2.
3. **Wave 2:** Refresh upstream after B01/B04 merge. Create B02, B05, B08, and B11 independently from that same merge state. B11 contains capability/provider binding only, no execution enforcement. Pairwise compare all four manifests before opening.
4. **Wave 3:** After Wave 2 merges, create B03 and B06 from refreshed upstream. B03 owns Error parser/presentation integration. B06 owns terminal lifecycle only. Verify together on an integration branch before merging the second sibling.
5. **Wave 4:** Create B07 only after B06. It becomes the first owner of command/task and generic IPC integration surfaces. Run Shell E2E before merge.
6. **Wave 5:** Refresh after B07. Create B09 and B12. B09 applies task-organization-only additive IPC/context hunks. B12 applies MiMo-only policy hunks while retaining B03 Error behavior and B07 Shell behavior. If their manifests overlap, merge B09, refresh, regenerate B12, then open it.
7. **Wave 6:** After B09/B12 merge, create B10 and B13. B10 owns history UI dependencies, lockfile, and task-organization locales. B13 owns the usage event contract/store. Open together only after an empty intersection check.
8. **Wave 7:** Create B14 from B13-merged upstream. It adds aggregation/recalculation/service behavior only, with no provider capture or UI.
9. **Wave 8:** Create B15 after B12 and B13. Replay provider usage and task-finalization hunks surgically. Verify exactly one final-attempt event and failure isolation.
10. **Wave 9:** Create B16 only after B10, B14, and B15. It may add Stats-only hunks to generic IPC files, but no task-organization store/schema code and no provider formulas.
11. **Wave 10:** Create B17 after B16. Reconstruct configured-price formulas from current upstream plus combined-branch evidence. Do not cherry-pick combined merge-resolution files wholesale. After B17, run the final sequential candidate gate.

### 7.4 PR 브랜치 이름

Use these exact branch names: `pr/b01-error-contracts`, `pr/b02-error-runtime`, `pr/b03-error-integration`, `pr/b04-shell-contracts`, `pr/b05-shell-resolution`, `pr/b06-terminal-lifecycle`, `pr/b07-shell-integration`, `pr/b08-task-org-persistence`, `pr/b09-task-org-ipc`, `pr/b10-task-org-ui`, `pr/b11-mimo-capability`, `pr/b12-mimo-enforcement`, `pr/b13-usage-store`, `pr/b14-usage-aggregation`, `pr/b15-usage-capture`, `pr/b16-stats-ui`, and `pr/b17-provider-cost`.

## 8. 공유 파일 소유권 (Shared-File Ownership Rules)

“Owner” means first legal modifier in this program. A downstream PR may touch the path only after the owner has merged, and only with concern-specific additive hunks.

| Shared surface | First owner | Legal downstream order and constraint |
|---|---|---|
| [`NativeToolCallParser.ts`](../../src/core/assistant-message/NativeToolCallParser.ts) and [`presentAssistantMessage.ts`](../../src/core/assistant-message/presentAssistantMessage.ts) | B03 | B12 may add policy retention/quarantine only. Preserve Error formatting, deduplication, images, custom-tool, and unknown-tool behavior. |
| [`StructuralValidator.ts`](../../src/core/tools/error-interception/StructuralValidator.ts) | B02 | B12 may add policy-data validation only. It must not replace the Error contract/runtime. |
| [`execute_command.ts`](../../src/core/prompts/tools/native-tools/execute_command.ts), [`ExecuteCommandTool.ts`](../../src/core/tools/ExecuteCommandTool.ts), [`Task.ts`](../../src/core/task/Task.ts) | B07 | B12 adds MiMo policy hooks; B15 adds usage finalization. Order is B07 → B12 → B15. |
| [`vscode-extension-host.ts`](../../packages/types/src/vscode-extension-host.ts), [`ClineProvider.ts`](../../src/core/webview/ClineProvider.ts), [`webviewMessageHandler.ts`](../../src/core/webview/webviewMessageHandler.ts) | B07 | B09 adds task-organization-only unions/state/handler routing; B16 adds Stats-only wiring. Order is B07 → B09 → B16. |
| [`task-organization.ts`](../../packages/types/src/task-organization.ts), [`TaskOrganizationStore.ts`](../../src/core/task-persistence/TaskOrganizationStore.ts), [`taskOrganizationMessageHandler.ts`](../../src/core/webview/taskOrganizationMessageHandler.ts), [`globalFileNames.ts`](../../src/shared/globalFileNames.ts), [`safeWriteJson.ts`](../../src/utils/safeWriteJson.ts) | B08/B09 by layer | Stats never recreates or modifies task-organization schema/store/handler/filenames/safe-write behavior. |
| [`mimo.ts`](../../packages/types/src/providers/mimo.ts) and [`mimo.spec.ts`](../../src/api/providers/__tests__/mimo.spec.ts) | B11/B12 | B15 may add usage-only fields/assertions after B12. It must retain capability metadata and policy coverage. |
| [`webview-ui/package.json`](../../webview-ui/package.json) and [`pnpm-lock.yaml`](../../pnpm-lock.yaml) | B10 | No later PR regenerates the lockfile unless it introduces a new dependency. B16 must not churn it for unrelated reasons. |
| Shell settings locale [`settings.json`](../../webview-ui/src/i18n/locales/en/settings.json) | B04 | Later PRs do not mix task or Stats strings into this concern. |
| Task UI locale families (`chat.json`, `history.json`) | B10 | B16 owns only dashboard/stats and command-label strings. |
| Stats service files under [`src/services/stats/`](../../src/services/stats/) | B13 then B14 | B15 consumes recorder APIs. B16 consumes service APIs. B17 must not modify these files. |
| Provider implementations under [`src/api/providers/`](../../src/api/providers/) | B15 for usage capture | B17 opens only after B15/B16 and changes formulas plus focused tests only. |
| [`.gitignore`](../../.gitignore) | No PR | Branch-local scripts/session patterns are not feature behavior. Exclude unless upstream independently requests an ignore-policy change. |

The 11 historical Stats × DnD overlap paths belong to B08/B09/B10 as Task Organization infrastructure, except the three generic IPC assembly paths that B16 may later extend additively. The exact historical list is in the [`file-overlap-matrix.md`](file-overlap-matrix.md:88).

## 9. 경로 상호배타성 게이트 (Path-Exclusivity Gate)

### 9.1 후보 자체 검사

Run on every candidate before push/open:

```powershell
git diff --name-only upstream/main...HEAD | Sort-Object -Unique | Set-Content .git/pr-candidate-paths.txt
git diff --name-status upstream/main...HEAD
git log --oneline upstream/main..HEAD
git diff --check upstream/main...HEAD
```

The temporary manifest stays under `.git` and must never be committed. Review every path against the PR's approved include list. A candidate fails if it includes a report, local helper, log, changeset, stale upstream reversal, unrelated lint cleanup, timeout change, or unassigned combined-only path.

### 9.2 열린 PR과의 교집합 검사

For each already-open branch, create its path set against current upstream, then compare:

```powershell
git diff --name-only upstream/main...myk1yt/pr/b01-error-contracts | Sort-Object -Unique | Set-Content .git/pr-open-paths.txt
Compare-Object (Get-Content .git/pr-candidate-paths.txt) (Get-Content .git/pr-open-paths.txt) -IncludeEqual -ExcludeDifferent
```

Repeat for **every open PR**. Expected output is empty. Any shared path blocks the later PR, even if the branches edit different hunks. Merge or close the first owner, refresh upstream, reconstruct the downstream candidate, retest, then rerun this gate.

### 9.3 전체 열린 후보 매트릭스

For a wave with more than two candidates, save one sorted manifest per candidate under `.git/pr-manifests/` and compare every pair:

```powershell
Get-ChildItem .git/pr-manifests/*.txt | ForEach-Object {
  $left = $_
  Get-ChildItem .git/pr-manifests/*.txt | Where-Object FullName -gt $left.FullName | ForEach-Object {
    $shared = Compare-Object (Get-Content $left.FullName) (Get-Content $_.FullName) -IncludeEqual -ExcludeDifferent
    if ($shared) { Write-Error "Path overlap: $($left.Name) x $($_.Name)"; $shared }
  }
}
```

No error and no shared-path output is the opening condition. This gate is operational, not semantic. Different files in one type package can still create compile dependencies, so type-check all touched packages even when intersections are empty.

## 10. PR별 CI 프로토콜 (Per-PR CI Protocol)

### 10.1 Focused suite

Run the exact `npx vitest run` command in the 17-PR table from the package directory named by the command. Do not run root Vitest. Where two package directories are shown, run each command separately. E2E-marked PRs also run:

```powershell
pnpm --filter @roo-code/vscode-e2e test:ci:mock
```

### 10.2 Touched-package gate

After focused tests, run every applicable package gate. Never omit a touched package:

```powershell
pnpm --filter @roo-code/types check-types
pnpm --filter zoo-code lint
pnpm --filter zoo-code check-types
pnpm --filter zoo-code test
pnpm --filter @roo-code/vscode-webview lint
pnpm --filter @roo-code/vscode-webview check-types
pnpm --filter @roo-code/vscode-webview test
```

If B12 modifies telemetry, also run its package type-check. If a PR modifies package dependencies, run a frozen install check and ensure only its owner changes the lockfile.

### 10.3 PR-open evidence

Attach these results to each PR body:

1. Refreshed upstream base SHA and product version.
2. Focused Vitest commands and pass counts.
3. Touched-package lint, type-check, and test results.
4. E2E result when required.
5. `git diff --check` result.
6. Exact changed-path manifest and empty intersections against all open PRs.
7. Shared-file note naming any later PR expected to modify the same path after merge.

### 10.4 Merge-wave integration gate

After each wave's first sibling merges, validate the remaining sibling against refreshed upstream before merging it:

```powershell
git fetch upstream
git switch <candidate-branch>
git rebase upstream/main
git diff --check upstream/main...HEAD
```

Rerun that PR's focused and touched-package gates after rebase. A prior green result does not survive a changed base automatically.

### 10.5 Final 17-PR sequential simulation

After B17, validate the exact cumulative candidate in merge order:

```powershell
pnpm lint
pnpm check-types
pnpm test
pnpm knip
pnpm build
pnpm --filter @roo-code/vscode-e2e test:ci:mock
```

The full gate must prove Error, Shell, Task Organization, MiMo, Stats, and provider-cost behavior together. `3.72.0` remains the release baseline throughout.

## 11. 위험 완화 (Risk Mitigation)

| Risk | Required mitigation and acceptance condition |
|---|---|
| Stats conflict hub | Delay B13–B16 until Error, Shell, Task Organization, and MiMo contracts have merged. Omit duplicate task-organization port commit `191bf51e6`. B16's generic IPC hunks must be Stats-only. |
| MiMo inherits stale Error | Use only the six MiMo-exclusive evidence commits, never the MiMo branch tip. B12 must preserve final B03 parser/presentation tests and final B07 command behavior. |
| Stale branch drift reverts `3.72.0` | Build from refreshed upstream. Exclude the identified upstream-only paths: Shell 128, MiMo 16, Stats 94, DnD 114. Compare endpoint evidence to merge-base-filtered intent. |
| Shared path in two open PRs | Empty pairwise path intersection is mandatory. Different hunks do not qualify as exclusive. |
| Error recursion or hidden diagnostics | Test malformed/concatenated JSON, unknown tools, images, custom tools, and interceptor failure. Preserve the original diagnostic exactly once. |
| Shell lifecycle double settlement | Test Bash, CMD, PowerShell, missing executable, interruption, no output, and terminal reuse. Cancellation and completion each settle once. |
| Task state leaks across workspaces | Test no-workspace mode, two windows, same task ID in different workspaces, malformed/future schema, and folder deletion. Atomic write failure is recoverable. |
| MiMo regresses capable providers | Test explicit max-one, ghost quarantine, duplicate parser output, and a known provider without capability metadata. Existing capable providers retain parallel calls. |
| Stats blocks tasks or double-counts retries | Test retry, cancellation, unknown cost, store failure, truncated final record, clear/export failure, and multi-window refresh. Exactly one event is recorded per final attempt. |
| Provider formulas use inconsistent units | Test zero/missing/configured rates, cached tokens, provider-specific units, and streaming finalization. `totalCost` is absent only when genuinely unknowable. |
| Combined-only provider fixes get lost | B17 reconstructs OpenAI-compatible, Bedrock, DeepSeek, Poe, Qwen Code, xAI, and any still-missing Anthropic Vertex/Kenari/Mistral/OpenAI formulas plus focused tests. |
| Whole-file conflict resolution overwrites owners | Compare each shared-file hunk to merged upstream. Preserve upstream first, apply only current concern, and rerun all retained tests. |
| Localization/lockfile review noise | User-visible UI PR owns its locales. B10 owns DnD dependencies and lockfile. Do not split translations into testless follow-ups or regenerate lockfiles elsewhere. |
| Operational artifacts leak upstream | Exclude session docs, `check-git-status.ps1`, `do-push.sh`, `push.ps1`, logs, temporary scripts, unrelated timeout edits, and changesets. |

## 12. Codebase Indexing 삭제 기능

This feature is **not part of B01–B17**. It was absent from all five analyzed feature refs, the combined branch's net path delta, and branch-side history under the current code-index module. Do not guess its implementation, fold it into Stats, or expand the approved 17-PR scope silently.

Run a separate investigation across other refs, worktrees, stashes, and any user-held patch. Candidate surfaces are [`src/services/code-index/`](../../src/services/code-index/), [`codebase-index.ts`](../../packages/types/src/codebase-index.ts), and [`CodeIndexSettings.tsx`](../../webview-ui/src/components/settings/CodeIndexSettings.tsx). Only after locating an exact patch and a reviewable WHY may the VP assign a new independent PR number, dependency analysis, ownership, and tests.

Post-discovery focused verification:

```powershell
cd src; npx vitest run services/code-index
```

## 13. PR 설명 계약 (PR Description Contract)

Every PR body begins with:

1. **WHY:** the user or maintainer problem this review unit solves.
2. **Scope:** exact path families and behavior owned here.
3. **Dependencies:** prerequisite PRs already merged, or `None`.
4. **Non-goals:** neighboring concerns deliberately excluded.
5. **Verification:** exact commands and results.
6. **Shared-file note:** later PRs expected to touch an owned path after merge.
7. **Exclusion attestation:** no reports, helpers, stale reversions, unrelated changesets, or operational noise.

Reviewability is the main optimization. A PR that cannot explain one coherent reason for change must be split or reconstructed before opening.

## 14. 구현 계획 (Delegatable Sub-tasks)

Each row is an independent VP delegation boundary. The exact file family and focused command are authoritative in the 17-PR table; extraction expands it into a final include manifest.

| Task | Exact create/modify boundary | Prerequisite | Verification protocol |
|---|---|---|---|
| B01 | Error interception types, patterns, classifier, index, focused tests | Refreshed upstream | Error-interception Vitest + extension package gates |
| B02 | Transformer, validator, task error state, interceptor, focused tests | B01 merged | Error-interception Vitest + extension package gates |
| B03 | Assistant parser/presentation, Error integration tests, Error E2E fixtures | B02 merged | Assistant Vitest + E2E mock |
| B04 | Global/terminal/settings contracts, shell IPC portion, cached-state settings UI, English settings strings/tests | Refreshed upstream | Types and settings Vitest + touched-package gates |
| B05 | Terminal shell resolver/profile/invocation/environment files, shell utility/tests | B04 merged | Terminal/utils Vitest |
| B06 | Scheduler, trace, lifecycle, registry, adapters, terminal runtime types/tests | B05 merged | Terminal Vitest |
| B07 | Command tool, Task shell hunks, prompts, host routing, activation, command/IPC/E2E tests | B06 merged | Core Shell suites + E2E mock |
| B08 | Task-organization contract/export, persistence store/index/test, filename and safe-write utilities | B04 merged | Types + task-persistence Vitest |
| B09 | Task-org message union, provider assembly, isolated handler/router, frontend context/tests | B07/B08 merged | Core webview + frontend context Vitest |
| B10 | History components/hooks/models/tests, DnD dependencies/lockfile, setup, task locales, E2E | B09 merged | History/i18n Vitest + E2E mock |
| B11 | Model/MiMo/telemetry contracts, API registry, MiMo provider, shared tool contract/tests | B01/B04 merged | Types + provider Vitest |
| B12 | Retention policy, policy-only parser/validator/tool/task hunks, telemetry service/tests | B03/B07/B11 merged | Assistant/task/error/provider suites + telemetry type-check |
| B13 | Usage-stats contract/export, required usage fields, event store/recorder/index/tests | B08/B12 merged | Types + Stats service Vitest |
| B14 | Aggregator, cost recalculation, Stats service facade/tests | B13 merged | Stats service Vitest |
| B15 | Usage-only provider/test deltas, Task finalization, exactly-once usage test | B12/B13 merged | Providers + Task + Stats Vitest |
| B16 | Stats IPC/routing/handler, commands/labels, dashboard/heatmap/formatting/locales/tests/E2E | B09/B10/B14/B15 merged | Host Stats + webview Stats/i18n + E2E mock |
| B17 | Provider formula-only deltas and focused tests | B15/B16 merged | Provider + Stats + Task Vitest |

## 15. 참조 문서 (Reference Documents)

- [`073348_architect-report.md`](073348_architect-report.md:154), approved Option B design, estimates, DAG, ownership, and focused commands.
- [`analysis-report.md`](analysis-report.md:26), five-branch evidence, baseline, commit ancestry, combined-only changes, and code-index verdict.
- [`file-overlap-matrix.md`](file-overlap-matrix.md:1), exact pairwise path overlap evidence and MiMo-exclusive manifest.
- [`pr-split-design.md`](pr-split-design.md:26), earlier six-PR cross-domain flows, edge cases, detailed source manifests, and combined-only provider disposition. Its six-PR topology is superseded; its evidence remains useful.
- [`decisions.md`](decisions.md:1), user approvals and immutable requirements.

## 16. 완료 조건 (Program Definition of Done)

The 17-PR operation is complete only when all conditions are true:

- Every PR began from the clean upstream merge state required by its dependencies.
- Every PR body explains WHY, scope, non-goals, dependencies, verification, and shared-file sequencing.
- No two concurrently open PRs shared a changed path.
- Every rebase reran focused and touched-package gates.
- All shared-file edits followed the declared owner order and preserved prior tests.
- All 17 PRs merged in dependency order without breaking Zoo Code `3.72.0`.
- The final cumulative lint, type-check, tests, unused-code check, build, and extension-host E2E passed.
- Codebase-indexing deletion remained a separate investigation unless a later user-approved plan assigned it a new PR.
