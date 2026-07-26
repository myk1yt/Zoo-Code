# Ask Mode Full Audit Report: Error Interception Middleware — Error Hiding Fix

## Date: 2026-07-26 09:38 KST
## Mode: ask (CPO Full Audit)
## Session Folder: docs/260726_0003_session_error-hiding-fix/

---

## [1. Philosophy & UX/UI Diagnostics]

### User Intent (Original Statement)
> "에러메시지와 AI에게 전달하는 메시지 전부가 Zoo Code상에서도 보이고, AI모델에게도 해야할 일을 전달하도록 해야해. 내가 원하는건 단지 유저의 개입 없이 계속 진행되는거지, 실제에러내역을 감추는건 아니야."

**Translation**: "All error messages and AI-guidance messages must be visible in the Zoo Code UI AND sent to the AI model. What I want is simply to continue without user intervention — NOT to hide actual error details."

### Intent Alignment Assessment
The fix directly addresses the user's core complaint. The user's design principle is binary: **both** user visibility **and** AI guidance must happen for every intercepted error. The fix adds `cline.say("error", ...)` to 3 paths that previously only sent AI guidance (`pushToolResultToUserContent`) without any user-visible notification.

**Verdict**: The philosophical direction is correct. The fix does not alter the autonomous-continue behavior (no new `cline.ask()` calls that would pause for user input). It only adds visibility. This is exactly what the user asked for.

### UX Improvement
Before the fix, a user watching the Zoo Code chat would see the AI silently "fix" its behavior after a structural error, with no explanation of what went wrong. This is disorienting — the user cannot trust a system that hides its failures. After the fix, the user sees the error message in the chat UI, understands what happened, and can verify the AI received proper guidance. This is a significant trust and transparency improvement.

---

## [2. 1:1 Cross-Validation Results]

### Root Cause Verification (Task 1)

The debug report identified 3 bypass paths in [`presentAssistantMessage.ts`](Zoo-Code/src/core/assistant-message/presentAssistantMessage.ts:1) that sent AI guidance via `pushToolResultToUserContent` but never called `cline.say("error")`:

| # | Path | Debug Report Location | Actual Code Location | Root Cause Confirmed? |
|---|------|----------------------|----------------------|-----------------------|
| 1 | Structural preflight (CWD_OBJECT_MISUSE, NESTED_PARAM_OVERFLOW) | Lines 716-775 | Lines 759-781 | ✅ Yes |
| 2 | Validation catch (modeRestriction, unknownTool, fileRestriction) | Lines 810-848 | Lines 838-860 | ✅ Yes |
| 3 | Missing nativeArgs (PARAM_MISSING, INVALID_JSON_ARGUMENTS) | Lines 519-559 | Lines 550-563 | ✅ Yes |

**Root cause is correct.** All 3 paths had `pushToolResultToUserContent` (AI guidance) without `cline.say("error")` (user visibility).

### Fix Completeness Verification (Task 2)

Each fix was verified at the source code level:

**Fix 1 — Structural Preflight Path** ([`presentAssistantMessage.ts:773`](Zoo-Code/src/core/assistant-message/presentAssistantMessage.ts:773)):
```typescript
await cline.say("error", `[${variant}] ${errorMessage}`)
cline.pushToolResultToUserContent({ ... })
```
✅ Present and correct. The `cline.say("error")` call precedes `pushToolResultToUserContent`, ensuring the user sees the error before the AI guidance is sent.

**Fix 2 — Validation Catch Path** ([`presentAssistantMessage.ts:852`](Zoo-Code/src/core/assistant-message/presentAssistantMessage.ts:852)):
```typescript
await cline.say("error", `Validation error: ${errorMessage}`)
cline.pushToolResultToUserContent({ ... })
```
✅ Present and correct.

**Fix 3 — Missing nativeArgs Path** ([`presentAssistantMessage.ts:555`](Zoo-Code/src/core/assistant-message/presentAssistantMessage.ts:555)):
```typescript
await cline.say("error", `Invalid tool call: ${errorMessage}`)
cline.pushToolResultToUserContent({ ... })
```
✅ Present and correct.

### Exhaustive Path Audit — All `pushToolResultToUserContent` Calls

I performed a comprehensive search for ALL `pushToolResultToUserContent` calls in the file to verify no other error-hiding paths exist:

| Line | Context | Has `cline.say("error")`? | Verdict |
|------|---------|---------------------------|---------|
| 139 | `didRejectTool` — MCP tool skipped due to prior rejection | ❌ No | ✅ **Correct** — This is a user-initiated rejection, not an error. The user already knows they rejected the tool. |
| 196 | `rawPushToolResult` — MCP tool normal result | ❌ No | ✅ **Correct** — This is a successful tool result, not an error. |
| 489 | `didRejectTool` — regular tool skipped due to prior rejection | ❌ No | ✅ **Correct** — Same as line 139, user-initiated. |
| 556 | **Fix 3: Missing nativeArgs** | ✅ Yes (line 555) | ✅ **Fixed** |
| 610 | `rawPushToolResult` — regular tool normal result | ❌ No | ✅ **Correct** — Successful result, not an error. |
| 774 | **Fix 1: Structural preflight** | ✅ Yes (line 773) | ✅ **Fixed** |
| 853 | **Fix 2: Validation catch** | ✅ Yes (line 852) | ✅ **Fixed** |
| 1185 | Unknown tool handler | ✅ Yes (line 1172) | ✅ **Already working** — `cline.say("error", t("tools:unknownToolError", ...))` was already present. |

**No additional error-hiding paths found.** All 8 `pushToolResultToUserContent` calls are now accounted for. The 3 that needed fixes are fixed; the remaining 5 are either non-error paths (successful results, user rejections) or already had `cline.say("error")`.

### Other Error Paths (Already Working)

| Path | Location | User Visibility | Status |
|------|----------|-----------------|--------|
| Missing `tool_use.id` (legacy XML) | Line 398 | ✅ `cline.say("error", errorMessage)` | ✅ Already working |
| `decoratedHandleError` (tool execution errors) | Via `rawHandleError` | ✅ `cline.say("error", ...)` | ✅ Already working |
| Unknown tool handler | Line 1172 | ✅ `cline.say("error", t("tools:unknownToolError", ...))` | ✅ Already working |
| Tool repetition | Line 895 | ⚠️ `cline.ask()` (user prompt) | 🟡 Partial — uses `cline.ask()` which shows a user prompt, so the user IS notified, but via a different mechanism. Lower priority as noted in the code report. |

### Intent Preservation Verification (Task 3)

The fix preserves the original design perfectly:

| Design Principle | Before Fix | After Fix |
|-----------------|-----------|-----------|
| User sees errors in UI | ❌ 3 paths hidden | ✅ All paths visible |
| AI gets guided payload | ✅ All paths | ✅ All paths (unchanged) |
| Autonomous continue (no user intervention) | ✅ No new `cline.ask()` | ✅ No new `cline.ask()` |
| Error details not hidden | ❌ Hidden in 3 paths | ✅ Fully visible |

The `cline.say("error", ...)` call is non-blocking — it adds a message to `clineMessages` and renders in the UI, but does NOT pause execution or require user input. This is critical: the user's requirement for "유저의 개입 없이 계속 진행" (continue without user intervention) is fully preserved.

### Regression Check (Task 4)

**Duplicate Message Risk**: LOW. Each `cline.say("error")` call is in a distinct code path that `break`s immediately after. There is no scenario where two of these paths execute for the same tool call:
- Path 1 (structural preflight, line 773) `break`s at line 781
- Path 2 (validation catch, line 852) `break`s at line 860
- Path 3 (missing nativeArgs, line 555) `break`s at line 563

These are mutually exclusive — a tool call hits at most ONE of these paths.

**Message Order**: CORRECT. In all 3 fixes, `cline.say("error")` is called BEFORE `pushToolResultToUserContent`. This means:
1. User sees the error message in the chat UI first
2. AI receives the guided payload second

This ordering is logical — the user sees what went wrong, then sees (implicitly) that the AI was guided to fix it.

**Test Count Discrepancy**: The code report states "18 tests pass" and "All 18 tests pass", but the task description says "19/19 passing". The test file search reveals 19 `it()` blocks in the error-interception spec file. This is a minor reporting discrepancy in the code report (18 vs 19), not a code issue. The actual test count is 19 based on the test file structure.

**`consecutiveMistakeCount` Interaction**: All 3 fixed paths already increment `cline.consecutiveMistakeCount++` before the `cline.say("error")` call. The addition of `cline.say("error")` does not affect this counter. No regression risk.

**`recordToolError` Interaction**: Paths 1 and 3 already call `cline.recordToolError(...)` in try/catch blocks. Path 2 (validation catch) does NOT call `recordToolError` — this is a pre-existing pattern, not introduced by the fix. No regression.

### Diagnostic Files Verification (Task 5)

The 3 diagnostic files all showed `EI/PARAM_TYPE_MISMATCH/002` errors from `mimo-v2.5-pro` generating parallel tool calls. These errors were intercepted by the structural preflight path (Path 1, now fixed at line 773).

**Before fix**: The interceptor caught the parallel-call parameter bleeding, generated guided JSON, sent it to the AI via `pushToolResultToUserContent`, and the AI corrected its behavior — but the user saw nothing in the UI.

**After fix**: The same flow now also calls `cline.say("error", "[CWD_OBJECT_MISUSE] ...")` (or `[NESTED_PARAM_OVERFLOW]` depending on the variant), so the user sees the structural error in the chat UI.

**Verdict**: ✅ All 3 diagnostic file scenarios are now properly handled. The user will see the error AND the AI will still receive guidance.

---

## [3. Inquiries for VP & User]

No critical trade-off decisions are required. The fix is straightforward and correct.

**Minor Note for VP** (non-blocking):
- The code report mentions "18 tests pass" but the test file contains 19 `it()` blocks. This is likely a typo in the report (the task description says 19/19). VP should verify the actual test run output if precision is needed.
- The tool repetition path (line 895) uses `cline.ask()` which shows a user prompt — this is a different visibility mechanism. The code report correctly notes this as a lower-priority optional enhancement. No action needed now.

---

## [4. Final Verdict]

### **PASS** ✅

The implementation faithfully reflects the user's original intent: "에러메시지와 AI에게 전달하는 메시지 전부가 Zoo Code상에서도 보이고, AI모델에게도 해야할 일을 전달하도록 해야해."

**Evidence**:
1. ✅ Root cause correctly identified (3 paths missing `cline.say("error")`)
2. ✅ All 3 paths fixed with `cline.say("error")` preceding `pushToolResultToUserContent`
3. ✅ No additional error-hiding paths exist (exhaustive audit of all 8 `pushToolResultToUserContent` calls)
4. ✅ Intent preserved — user sees errors AND AI gets guidance, autonomous continue unaffected
5. ✅ No regression risk — paths are mutually exclusive, message order is correct, no duplicate messages
6. ✅ All 3 diagnostic file scenarios now properly handled
7. ✅ Tests cover all 6 affected test cases with `cline.say("error")` assertions

VP may proceed to VP Final Review (Phase 7).

---

## Affected File List
| File | Role |
|------|------|
| `Zoo-Code/src/core/assistant-message/presentAssistantMessage.ts` | Main file with 3 fixes (lines 555, 773, 852) |
| `Zoo-Code/src/core/assistant-message/__tests__/presentAssistantMessage-error-interception.spec.ts` | Test file with 6 `cline.say("error")` assertions + 3 `nativeArgs` fixes |
| `Zoo-Code/src/core/tools/error-interception/ToolErrorInterceptor.ts` | Interceptor (no changes needed, verified correct) |
