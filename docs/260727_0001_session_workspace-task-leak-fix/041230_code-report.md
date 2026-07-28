# Code Task Report
## Task Summary
Fix workspace-specific task/folder leakage when no workspace is open (cwd is empty string `""`).

## Actions Taken

### 1. Root Cause Analysis
The `buildGroupedOrganizationProjection` function in [`taskOrganizationModel.ts`](webview-ui/src/components/history/taskOrganizationModel.ts:631) used `!cwd` to detect "no workspace filtering", but `!""` is `true` — the same as `!undefined`. This conflated two distinct states:
- `cwd === undefined`: "show all workspaces" (HistoryView's `showAllWorkspaces` mode)
- `cwd === ""`: "no workspace open" (should hide workspace-specific items)

The `isVisibleInWorkspace` function (line 632) returned `true` for all groups when `cwd` was falsy, and the folder skip condition (line 677) was guarded by `cwd &&`, bypassing the skip when `cwd` was `""`.

### 2. Fix Applied
Two surgical changes in [`buildGroupedOrganizationProjection`](webview-ui/src/components/history/taskOrganizationModel.ts:580):

**Change A — `isVisibleInWorkspace` (line 631-640):**
Changed `if (!cwd)` to `if (cwd === undefined)`. This ensures:
- `undefined` → show all (no filtering)
- `""` → apply workspace filtering (only tasks with `workspace === ""` pass `taskBelongsToWorkspace`)

**Change B — Folder skip condition (line 677-684):**
Changed `if (cwd && members.length === 0 && folder.taskIds.length > 0)` to `if (cwd !== undefined && members.length === 0 && folder.taskIds.length > 0)`. This ensures:
- `undefined` → folders with empty members (due to dedup) are preserved
- `""` → folders with no visible members are skipped (the bug fix)
- Any real workspace path → same behavior as before

### 3. Tests Added
Two new test cases in [`taskOrganizationModel.spec.ts`](webview-ui/src/components/history/__tests__/taskOrganizationModel.spec.ts:620):

1. **"skips folders with cross-workspace members when cwd is empty string"** — verifies that a folder whose `taskIds` reference tasks from `/workspace/other` is NOT shown when `cwd === ""`, while a task with `workspace: ""` appears as unfiled.

2. **"preserves genuinely empty folders when cwd is empty string"** — verifies that a folder with zero `taskIds` still appears when `cwd === ""`.

## Result
✅ Success — all tests pass.

### Test Results
| Test File | Tests | Result |
|-----------|-------|--------|
| `taskOrganizationModel.spec.ts` | 44 | ✅ All pass |
| `HistoryPreview.taskOrganization.spec.tsx` | 14 | ✅ All pass (1 skipped) |
| `HistoryView.taskOrganization.spec.tsx` | 17 | ✅ All pass (4 skipped) |
| `HistoryPreview.spec.tsx` | 5 | ✅ All pass |

## Issues Discovered
- The original bug description suggested simply removing `cwd &&` from the folder skip condition. This would have broken the "show all workspaces" case (`cwd === undefined`), where folders with empty members due to deduplication must be preserved. The fix uses `cwd !== undefined` instead to distinguish the two states.
- `filterByWorkspace` (the flat/virtualized rendering path) has the same `!cwd` early return at line 317, but it is not used by any component — only in tests. No fix needed.

## Next Step Recommendations
- Consider auditing `filterByWorkspace` for consistency if it gets adopted by a component in the future.
- The `taskBelongsToWorkspace` function normalizes path separators, which is correct for comparing real workspace paths. When `cwd === ""`, it compares `normalizedWorkspace === ""`, which correctly matches tasks with empty/undefined workspace fields.

## Affected File List
- `webview-ui/src/components/history/taskOrganizationModel.ts` (2 changes: `isVisibleInWorkspace` guard + folder skip condition)
- `webview-ui/src/components/history/__tests__/taskOrganizationModel.spec.ts` (2 new test cases)
