# Code Task Report
## Task Summary
Fixed platform-unit-test failures on `fix/providers-total-cost` branch. The CI "Run non-core coverage" step was failing due to test assertion mismatches after `totalCost` was added to all 11 providers in commit `ce77a10bd`.

## Actions Taken

### 1. Reproduced failures locally
Ran `vitest run api/providers/__tests__/` from `src/` directory. Found 6 failing test files with 7 failing tests:
- `friendli.spec.ts` - TypeError: Class extends value undefined (import cascade)
- `kimi-code.spec.ts` - TypeError: Class extends value undefined (import cascade)
- `moonshot.spec.ts` - TypeError: Class extends value undefined (root cause)
- `anthropic-vertex.spec.ts` - 2 toEqual failures (missing `totalCost`)
- `kenari.spec.ts` - 3 toEqual/toContainEqual failures (missing `totalCost`)
- `openai-usage-tracking.spec.ts` - 2 toEqual failures (missing `totalCost`)

### 2. Root Cause Analysis

**Root cause 1 (moonshot.ts - TypeError cascade):**
Commit `ce77a10bd` rewrote [`moonshot.ts`](src/api/providers/moonshot.ts:5) to import `OpenAiCompatibleHandler` and `OpenAiCompatibleHandlerOptions` from [`openai-compatible.ts`](src/api/providers/openai-compatible.ts:51). However, the actual exports are `OpenAICompatibleHandler` (capital "AI") and `OpenAICompatibleConfig`. The import name mismatch made `OpenAiCompatibleHandler` resolve to `undefined`, causing `class MoonshotHandler extends undefined` → TypeError. This cascaded through [`index.ts`](src/api/providers/index.ts:5) to break `friendli.spec.ts` and `kimi-code.spec.ts` which import from the providers index.

**Root cause 2 (test assertion mismatches):**
The `totalCost` field was added to usage chunks in all providers, but several test files still used `toEqual()` with the old expected objects that didn't include `totalCost`. Since `toEqual` requires exact matches, the extra `totalCost` field caused assertion failures.

### 3. Fixes Applied

**Fix 1: [`moonshot.ts`](src/api/providers/moonshot.ts) - Restored to extend `OpenAiHandler`**
Reverted moonshot.ts to its pre-commit structure (extending `OpenAiHandler` from `openai.ts`), and added `totalCost` calculation to the existing `processUsageMetrics` method. This preserves the original working architecture while adding the `totalCost` feature.

**Fix 2: [`anthropic-vertex.spec.ts`](src/api/providers/__tests__/anthropic-vertex.spec.ts:216) - Updated toEqual assertions**
- Line 216: Added `totalCost: expect.any(Number)` to message_start usage chunk assertion
- Line 429: Added `totalCost: expect.any(Number)` to prompt caching usage chunk assertion

**Fix 3: [`openai-usage-tracking.spec.ts`](src/api/providers/__tests__/openai-usage-tracking.spec.ts:137) - Updated toEqual assertions**
- Line 137: Added `totalCost: 0` to usage chunk assertion (model has no pricing)
- Line 197: Added `totalCost: 0` to usage chunk assertion (model has no pricing)

**Fix 4: [`kenari.spec.ts`](src/api/providers/__tests__/kenari.spec.ts:139) - Updated toContainEqual/toEqual assertions**
- Line 139: Added `totalCost: 0` to usage chunk assertion
- Line 207: Added `totalCost: 0` to usage chunk assertion
- Line 316: Added `totalCost: 0` to usage chunk assertion

## Result
✅ Success - All tests pass

Evidence:
- Provider tests: 54 test files passed, 1198 tests passed (1 skipped)
- Full src test suite: 427 test files passed (3 skipped), 7087 tests passed (37 skipped), 0 failures

## Issues Discovered
- The `ce77a10bd` commit had a fundamental import error in `moonshot.ts` that would have broken the Moonshot provider at runtime (not just tests). The import referenced `OpenAiCompatibleHandler` but the exported class is `OpenAICompatibleHandler`. This was likely never caught because the test suite wasn't run before the commit.

## Next Step Recommendations
- VP should commit these fixes
- Consider adding a pre-commit hook that runs `vitest run api/providers/__tests__/` to catch test failures before they reach CI
- The `moonshot.ts` rewrite to use `OpenAICompatibleHandler` (the AI SDK based class) was a good idea but had a naming error. If this refactor is desired, it should be done in a separate PR with correct imports (`OpenAICompatibleHandler` not `OpenAiCompatibleHandler`)

## Affected File List
- `src/api/providers/moonshot.ts` - Restored to extend OpenAiHandler, added totalCost to processUsageMetrics
- `src/api/providers/__tests__/anthropic-vertex.spec.ts` - Updated 2 toEqual assertions to include totalCost
- `src/api/providers/__tests__/openai-usage-tracking.spec.ts` - Updated 2 toEqual assertions to include totalCost
- `src/api/providers/__tests__/kenari.spec.ts` - Updated 3 toContainEqual/toEqual assertions to include totalCost
