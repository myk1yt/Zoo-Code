# Code Task Report: B05 Shell Resolution Branch

## Task Summary
Built the `pr/b05-shell-resolution` branch from `pr/b04-shell-contracts` baseline, copying shell resolution primitives (ShellResolver, TerminalProfileResolver, ShellInvocationAdapter, CommandEnvironmentService, types) from `feature/unified-shell-resolution`.

## Actions Taken
1. Created branch `pr/b05-shell-resolution` from `pr/b04-shell-contracts` (commit `563a35075`)
2. Checked file existence on B04: `src/utils/shell.ts` and `src/integrations/terminal/__tests__/TerminalProfile.spec.ts` already existed (modified files); all `src/integrations/terminal/shell/` files were new
3. Copied all 10 files from `feature/unified-shell-resolution` via `git checkout`
4. Verified no upstream regressions: all 3 modified files on B04 are identical to `upstream/main` (empty diffs)
5. Verified staged content matches source branch exactly (empty diffs on all 10 files)
6. Ran focused tests: 204/205 passed initially, 1 failure in `TerminalProfile.spec.ts`
7. Root-caused the failure: the source-only profile test (ARCH-TERMINAL-001) expects `Terminal.ts` to delegate to `TerminalProfileResolver`, but `Terminal.ts` changes are NOT in B05's manifest
8. Fixed: reverted only the ARCH-TERMINAL-001 test back to B04's version (expects `undefined`), kept all 7 new TerminalProfileResolver delegation tests
9. Re-ran tests: 205/205 passed
10. Ran type check: 6 pre-existing errors (bedrock.ts missing modules), zero new errors from B05
11. Committed as `2cc8c18a7` and pushed to `myk1yt/pr/b05-shell-resolution`

## Result
✅ Success — all 10 manifest files committed and pushed

### Test Results
- `ShellResolver.spec.ts`: all passed
- `ShellInvocationAdapter.spec.ts`: all passed
- `TerminalProfile.spec.ts`: all passed (64 tests, including 7 new delegation tests)
- `shell.spec.ts`: all passed
- **Total: 205/205 passed**

### Type Check Results
- B04 baseline: 6 errors (all `bedrock.ts` missing module errors — pre-existing)
- B05: 6 errors (same 6, zero new)
- Zero shell/terminal-related TS errors

## Issues Discovered
- **ARCH-TERMINAL-001 test scope mismatch**: The source branch's `TerminalProfile.spec.ts` includes a test expecting source-only profile resolution (PowerShell profiles resolved to `pwsh.exe`/`powershell.exe`). This behavior requires `Terminal.ts` to delegate to `TerminalProfileResolver`, which is a later PR's scope. Reverted this single test to B04's version. The 7 new TerminalProfileResolver delegation tests pass correctly with B04's Terminal.ts because those methods already exist on B04.

## Next Step Recommendations
- VP should create a PR for `pr/b05-shell-resolution` targeting `pr/b04-shell-contracts`
- The ARCH-TERMINAL-001 behavior change (source-only profile resolution in Terminal.ts) should be included in a later PR that wires Terminal.ts to TerminalProfileResolver

## Affected File List
1. `src/integrations/terminal/shell/ShellResolver.ts` (new)
2. `src/integrations/terminal/shell/TerminalProfileResolver.ts` (new)
3. `src/integrations/terminal/shell/ShellInvocationAdapter.ts` (new)
4. `src/integrations/terminal/shell/CommandEnvironmentService.ts` (new)
5. `src/integrations/terminal/shell/types.ts` (new)
6. `src/utils/shell.ts` (modified — exported `SHELL_ALLOWLIST`, `isShellPathAllowed`, added posix normalization)
7. `src/utils/__tests__/shell.spec.ts` (modified — new tests for exported functions)
8. `src/integrations/terminal/__tests__/ShellResolver.spec.ts` (new)
9. `src/integrations/terminal/__tests__/ShellInvocationAdapter.spec.ts` (new)
10. `src/integrations/terminal/__tests__/TerminalProfile.spec.ts` (modified — 7 new delegation tests, 1 test reverted to B04 version)
