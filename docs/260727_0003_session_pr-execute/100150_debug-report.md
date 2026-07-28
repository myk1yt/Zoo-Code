# Debug Task Report — B04 CI Test Failure Fix

## Task Summary
Fix CI failure on B04 PR #6 (`myk1yt/Zoo-Code`) in `SettingsView.change-detection.spec.tsx`:
`mode synchronization > resets changeDetected and syncs cachedState when mode changes after dirty state`.

## Root Cause Analysis

### Symptom
After the B04 rebase (commits `0d166f124` and `22fc0ac90`), the change-detection test that
verifies mode-driven cachedState synchronization began failing on CI.

### Causal Chain (Reverse Dependency Map)
- `SettingsView.change-detection.spec.tsx` (test, **not** modified by B04) asserts:
  1. When `extensionState.mode` changes, the sync `useEffect` in `SettingsView.tsx` MUST run.
  2. The effect MUST copy the new `extensionState` into `cachedState` and reset `changeDetected` to `false`.
- B04 modified `webview-ui/src/components/settings/SettingsView.tsx` (+29/-7) to wire
  `pendingTerminalShellSelection` state, `TerminalSettings` props, and a new
  `setTerminalShellSelection` IPC message.

### Root Cause
While resolving rebase conflicts in `webview-ui/src/components/settings/SettingsView.tsx`,
B04 **silently reverted upstream PR #925** (commit `badb82c56`,
`fix(webview): sync cachedState on mode changes in SettingsView`, merged July 22).

PR #925 was an upstream bug fix that:
1. Added `mode` to the destructured extensionState fields.
2. Introduced a `prevMode = useRef(mode)` reference.
3. Made the cachedState sync `useEffect` re-run when `mode` changes, with a
   `prevApiConfigName.current === currentApiConfigName && prevMode.current === mode` guard.
4. Strengthened the change-detection spec to make the `mode` dependency load-bearing
   (comment in spec lines 677-679: *"This makes the `mode` dependency load-bearing:
   without it, React would not re-run the sync effect."*).

B04's version of the effect returned to the pre-#925 form:

```ts
useEffect(() => {
    // Update only when currentApiConfigName is changed.
    if (prevApiConfigName.current === currentApiConfigName) {
        return
    }
    setCachedState((prev) => ({ ...prev, ...extensionState }))
    prevApiConfigName.current = currentApiConfigName
    setChangeDetected(false)
}, [currentApiConfigName, extensionState])
```

With `mode` no longer in the dep array and no `prevMode` ref, the effect does not re-run
on a mode-only change. The test then fails at the assertion
`expect(updatedSaveButton.disabled).toBe(true)` because `changeDetected` is never reset.

This is a **regression against upstream behavior**, not a legitimate behavior change
introduced by B04. The correct fix is to restore the upstream `mode`-sync logic while
preserving B04's terminal-shell additions.

## Fix Details

### File Modified
`webview-ui/src/components/settings/SettingsView.tsx` — 3 surgical `apply_diff` blocks.

### Changes (restores PR #925 semantics)

1. Line 134 — re-add `mode` to the destructured fields:
   ```ts
   const { currentApiConfigName, listApiConfigMeta, uriScheme, settingsImportedAt, mode } = extensionState
   ```

2. After line 153 — re-add the `prevMode` ref:
   ```ts
   const prevMode = useRef(mode)
   ```

3. Lines 227-237 — restore mode-aware sync effect:
   ```ts
   useEffect(() => {
       // Update when currentApiConfigName or mode changes.
       // Expected to be triggered by loadApiConfiguration/upsertApiConfiguration or mode switch.
       if (prevApiConfigName.current === currentApiConfigName && prevMode.current === mode) {
           return
       }
       setCachedState((prevCachedState) => ({ ...prevCachedState, ...extensionState }))
       prevApiConfigName.current = currentApiConfigName
       prevMode.current = mode
       setChangeDetected(false)
   }, [currentApiConfigName, mode, extensionState])
   ```

### B04 Functionality Preserved
The fix is strictly additive to the upstream regression — none of B04's additions
were touched:
- `pendingTerminalShellSelection` state and setter (lines 139-141).
- `terminalShellSelection` from `cachedState` destructure.
- The `setTerminalShellSelection` postMessage block in `handleSubmit`.
- `setPendingTerminalShellSelection(undefined)` in the discard-dialog handler.
- `TerminalSettings` props wiring (`terminalShellSelection={pendingTerminalShellSelection ?? terminalShellSelection}`,
  `onShellSelectionChange={setPendingTerminalShellSelection}`).

## Verification Results

### Test Executions (all from `webview-ui/` per repo rules)

| Test Suite | Command | Result |
|---|---|---|
| Change detection | `npx vitest run src/components/settings/__tests__/SettingsView.change-detection.spec.tsx` | ✅ 6/6 passed (4.89s) |
| Terminal shell | `npx vitest run src/components/settings/__tests__/TerminalSettings.shell.spec.tsx` | ✅ 7/7 passed (4.63s) |
| Full SettingsView suite | `npx vitest run src/components/settings/__tests__/SettingsView` | ✅ 32/32 passed across 3 files (14.64s) |

The previously failing test (`resets changeDetected and syncs cachedState when mode changes
after dirty state`) now passes, alongside all sibling tests.

## Issues Discovered

### Rebase conflict resolution regression risk
The B04 rebase appears to have used an older base version of the cachedState sync effect
when merging with upstream, silently undoing PR #925. This class of bug is invisible to
TypeScript/ESLint because both versions are syntactically valid. Only the strengthened
upstream test caught it. VP may want to scan other recently-rebased PRs (B01–B05+) for
similar accidental reverts by diffing their touched files against `upstream/main` and
looking for *deletions* of recently-merged upstream fixes.

## Test Environment Issues

None encountered. The repo's documented test invocation
(`cd webview-ui; npx vitest run <path>`) worked on the first attempt. No mock or
fixture changes were required.

## Next Step Recommendations (for VP)

1. **Commit** the fix on `pr/b04-shell-contracts`. Suggested message:
   ```
   fix(settings): restore mode-based cachedState sync reverted in B04 rebase

   The B04 rebase silently reverted upstream PR #925 (badb82c56), causing the
   change-detection spec's mode synchronization test to fail. Restore the
   mode dependency and prevMode ref while preserving the terminal shell
   selection wiring added by B04.
   ```
2. **Push** with `--force-with-lease` to `myk1yt/pr/b04-shell-contracts` (as instructed
   in the original task brief). Debug mode is forbidden from executing git commits/pushes,
   so this step must be performed by VP.
3. **Re-run CI** on PR #6 and confirm the previously failing job is green.
4. **Audit other rebased PRs** for accidental reverts of recently-merged upstream fixes.

## Affected File List

| File | Action | Reason |
|---|---|---|
| `webview-ui/src/components/settings/SettingsView.tsx` | Modified (3-line surgical diff) | Restore upstream PR #925 mode-sync logic |
| `webview-ui/src/components/settings/__tests__/SettingsView.change-detection.spec.tsx` | Unchanged | Test was correct; it caught the regression |
| `webview-ui/src/components/settings/__tests__/TerminalSettings.shell.spec.tsx` | Unchanged | Verified still passing |
