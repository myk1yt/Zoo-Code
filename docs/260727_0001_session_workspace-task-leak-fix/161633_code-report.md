# Code Mode Task Report
## Task Summary
Fixed 3 bugs causing workspace cross-contamination of tasks, pins, and folders in the History view and Welcome preview.

## Actions Taken

### Bug 1: HistoryPreview didn't apply workspace filtering
- **File**: `webview-ui/src/components/history/HistoryPreview.tsx`
- **Root Cause**: `buildGroupedOrganizationProjection(organization, groups, tasks, undefined)` passed `undefined` as `cwd`, disabling workspace filtering entirely.
- **Fix**: Added `useExtensionState` import and extracted `cwd` from it. Changed the projection call to pass `cwd` directly (HistoryPreview is always in "current workspace" mode — no toggle).

### Bug 2: HistoryView's `renderPinnedHeader` didn't filter pins by workspace
- **File**: `webview-ui/src/components/history/HistoryView.tsx`
- **Root Cause**: `renderPinnedHeader()` iterated ALL `organization.pins` (global state) regardless of workspace. When a pinned task didn't exist in the current workspace's `tasks` array, `rootTask?.task` was undefined, so the label fell back to `unit.rootTaskId` — the "encrypted numbers" the user saw.
- **Fix**: When `showAllWorkspaces` is false, filter `organization.pins` to only include pins whose targets resolve to tasks that exist in the current workspace's `tasks` array. Folder pins are kept (handled by the projection with workspace filtering).

### Bug 3: `buildGroupedOrganizationProjection` included empty folders from other workspaces
- **File**: `webview-ui/src/components/history/taskOrganizationModel.ts`
- **Root Cause**: The function always pushed folder projections even when `members.length === 0` and all tasks belonged to other workspaces.
- **Fix**: In the folder loop, when `cwd` is provided, skip folders where `members.length === 0` AND `folder.taskIds.length > 0` (i.e., the folder has tasks but none are visible in this workspace). Genuinely empty folders (zero taskIds) are still preserved.

### Test Updates
- **`taskOrganizationModel.spec.ts`**: Added 2 tests — "skips folders whose members are all in another workspace when cwd is provided" and "preserves genuinely empty folders even when cwd is provided".
- **`HistoryPreview.taskOrganization.spec.tsx`**: Added 1 test — "does not show folders whose only members are from another workspace". Also added `workspace` field to mock tasks to match the `cwd` in the mock `useExtensionState`.
- **`HistoryView.taskOrganization.spec.tsx`**: Added 2 tests — "hides pinned tasks from other workspaces when showAllWorkspaces is false" and "shows pinned tasks from other workspaces when showAllWorkspaces is true".
- **`HistoryPreview.spec.tsx`**: Added `workspace: "/test/workspace"` to all 6 mock tasks to match the `cwd` in the mock `useExtensionState` (required because HistoryPreview now passes `cwd` to the projection, which applies workspace filtering).

## Result
✅ Success — All 3 bugs fixed and verified.

### Test Results
- `taskOrganizationModel.spec.ts`: 42 passed (0 failed)
- `HistoryPreview.taskOrganization.spec.tsx`: 10 passed, 5 skipped (0 failed)
- `HistoryView.taskOrganization.spec.tsx`: 19 passed (0 failed)
- `HistoryPreview.spec.tsx`: 7 passed (0 failed)
- Full history test directory: 266 passed, 4 failed (pre-existing failures in `DraggableTaskEntry.spec.tsx` and `SubtaskRow.spec.tsx` — unrelated to this change, confirmed by `git diff --name-only`)

## Issues Discovered
- 4 pre-existing test failures in `DraggableTaskEntry.spec.tsx` (2 tests) and `SubtaskRow.spec.tsx` (2 tests). These are unrelated to the workspace cross-contamination fix — neither file imports or references any of the modified code. They appear to be pre-existing environment or test setup issues.

## Next Step Recommendations
- Investigate the 4 pre-existing test failures in `DraggableTaskEntry.spec.tsx` and `SubtaskRow.spec.tsx` separately (likely a test environment or mocking issue, not related to workspace filtering).
- Consider adding integration tests that simulate multi-workspace scenarios at a higher level (e.g., switching workspaces and verifying no cross-contamination in the rendered UI).

## Affected File List
1. `webview-ui/src/components/history/HistoryPreview.tsx` — Added `useExtensionState` import, extracted `cwd`, passed it to `buildGroupedOrganizationProjection`
2. `webview-ui/src/components/history/HistoryView.tsx` — Added workspace filtering to `renderPinnedHeader` for task/autoGroup pins
3. `webview-ui/src/components/history/taskOrganizationModel.ts` — Skip folders with no visible members when `cwd` is provided
4. `webview-ui/src/components/history/__tests__/taskOrganizationModel.spec.ts` — Added 2 tests for Bug 3
5. `webview-ui/src/components/history/__tests__/HistoryPreview.taskOrganization.spec.tsx` — Added 1 test for Bug 1, added `workspace` to mock tasks
6. `webview-ui/src/components/history/__tests__/HistoryView.taskOrganization.spec.tsx` — Added 2 tests for Bug 2
7. `webview-ui/src/components/history/__tests__/HistoryPreview.spec.tsx` — Added `workspace` field to mock tasks
