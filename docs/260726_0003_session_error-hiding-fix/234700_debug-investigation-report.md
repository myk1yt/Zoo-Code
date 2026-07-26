# Debug Investigation Report: Error Interception Middleware — Error Hiding Issue

## Date: 2026-07-26 23:47 KST
## Mode: debug
## Branch: feat/error-interception-middleware (3761994d3)

---

## 1. Diagnostic File Analysis

### File 1: `zoo-diagnostics-019f9b4d-1785019567240.json`
| Field | Value |
|-------|-------|
| Timestamp | 2026-07-25T22:46:07.234Z |
| Version | 3.72.0 |
| Provider | mimo |
| Model | mimo-v2.5-pro |
| Session | Dual .git consolidation task |

**What happened:** The model (mimo-v2.5-pro) repeatedly generated parallel tool calls, causing `EI/PARAM_TYPE_MISMATCH/002` errors. The interceptor caught these and returned guided JSON payloads (`guided_tool_error` with `category: "PARAM_TYPE_MISMATCH"`). The AI read the guidance and changed behavior (switched to sequential calls), but the user saw **nothing** in the Zoo Code UI.

**Intercepted by middleware?** Yes — the guided JSON payloads ARE the interceptor output. But the original error was REPLACED, not supplemented.

**Missing pattern:** The guided payload goes to the AI via `pushToolResultToUserContent`, but `cline.say("error", ...)` is **never called** for structural preflight errors. The user has zero visibility.

---

### File 2: `zoo-diagnostics-019f9a63-1785002175364.json`
| Field | Value |
|-------|-------|
| Timestamp | 2026-07-25T17:56:15.358Z |
| Version | 3.72.0 |
| Provider | mimo |
| Model | mimo-v2.5-pro |
| Session | Error hiding audit + 4-feature merge task |

**What happened:** Same pattern — repeated `EI/PARAM_TYPE_MISMATCH/002` and `EI/PARAM_TYPE_MISMATCH/003` errors from parallel tool call corruption. The model kept trying to create session directories and check branches in parallel, hitting the interceptor each time. User saw nothing.

**Intercepted by middleware?** Yes — all errors were intercepted and guided. The middleware worked as designed for AI guidance.

**Missing pattern:** Same as File 1 — the structural preflight path at lines 716-775 bypasses `cline.say("error")` entirely.

---

### File 3: `zoo-diagnostics-019f9ba1-1785023014126.json`
| Field | Value |
|-------|-------|
| Timestamp | 2026-07-25T23:43:34.122Z |
| Version | 3.72.0 |
| Provider | mimo |
| Model | mimo-v2.5-pro |
| Session | Current session — error-hiding-fix task |

**What happened:** This is the CURRENT session's own diagnostic file. The model hit `EI/PARAM_TYPE_MISMATCH/002` errors while trying to execute git commands in parallel during the dual .git consolidation analysis.

**Intercepted by middleware?** Yes — same interceptor pattern.

**Missing pattern:** Same structural preflight gap. The user only discovered the errors by opening the diagnostic JSON file manually.

---

## 2. Error Visibility Gap Analysis

### The Critical Gap: Structural Preflight Path

**File:** `Zoo-Code/src/core/assistant-message/presentAssistantMessage.ts`  
**Lines:** 716-775

When `validateCwdParameter` or `validateNestedParams` detects a structural issue (like parallel call parameter bleeding), the code executes this path:

```
validateCwdParameter/validateNestedParams detects issue
  → interceptor.transformError() → generates guided JSON
  → cline.pushToolResultToUserContent() → sends to AI
  → break (skips tool execution)
```

**What's missing:** `cline.say("error", errorMessage)` is **never called** in this path.

Compare with the `decoratedHandleError` path (lines 141-173 in `ToolErrorInterceptor.ts`):
```
decoratedHandleError
  → interceptor.transformError() → guided JSON to AI
  → rawHandleError() → calls cline.say("error", ...) → user sees error
```

The decorated path correctly does BOTH: AI guidance AND user visibility. The structural preflight path only does AI guidance.

### The `rawHandleError` Implementation (Lines 248-260, 665-679)

```typescript
const rawHandleError = async (action: string, error: Error) => {
    if (error instanceof AskIgnoredError) { return } // silently ignored
    const errorString = `Error ${action}: ${JSON.stringify(serializeError(error))}`
    await cline.say("error", `Error ${action}:\n${error.message ?? ...}`)
    rawPushToolResult(formatResponse.toolError(errorString))
}
```

This correctly calls `cline.say("error", ...)` which adds to `clineMessages` and shows in the UI. But this is only invoked through `decoratedHandleError`, NOT through the structural preflight path.

### The `cline.say()` → UI Path

`cline.say("error", text)` at `Task.ts:1821` adds a `ClineMessage` with `say: "error"` to `clineMessages`. The webview renders these in the chat UI. This is the correct path for user-visible errors.

### Gap Summary

| Error Path | AI Guidance | User Visibility | Status |
|-----------|------------|-----------------|--------|
| `decoratedHandleError` (tool execution errors) | ✅ guided JSON | ✅ `cline.say("error")` | ✅ Working |
| Structural preflight (lines 716-775) | ✅ guided JSON | ❌ **never calls `cline.say`** | 🔴 **BROKEN** |
| Validation catch (lines 810-848) | ✅ guided JSON | ❌ **never calls `cline.say`** | 🔴 **BROKEN** |
| Missing nativeArgs (lines 519-559) | ✅ guided JSON | ❌ **never calls `cline.say`** | 🔴 **BROKEN** |
| Tool repetition (lines 853-919) | ✅ guided JSON | ⚠️ `cline.ask()` (requires user) | 🟡 Partial |

---

## 3. Previous Fix Verification (b2f6d3ef5)

**Commit:** `b2f6d3ef5 fix(error-interception): add logging to silent error paths`

### Changes Confirmed:

1. **3 empty catch blocks → console.warn** (presentAssistantMessage.ts):
   - Line ~394: `catch (recordErr) { console.warn("[ErrorInterception] Failed to record tool error:", ...) }`
   - Line ~530: Same pattern
   - Line ~752: Same pattern

2. **Unclassified pattern logging** (ToolErrorInterceptor.ts:251-254):
   ```typescript
   console.warn(
       `[ErrorInterceptor] Unclassified error pattern — passing through without guidance. tool=${signal.toolName ?? "unknown"} patternId=${classification.patternId}`,
   )
   ```

### Verdict: INSUFFICIENT

The fix addresses **logging** (console.warn) but does NOT address the **core visibility gap**. Console.warn goes to the extension host output channel, which users typically don't see. The user's complaint is specifically about the **Zoo Code UI chat** not showing errors.

**What the fix does NOT cover:**
- Structural preflight path still has NO `cline.say("error")` call
- Validation catch path still has NO `cline.say("error")` call
- Missing nativeArgs path still has NO `cline.say("error")` call

---

## 4. Silently Swallowed Errors

### Empty Catch Blocks (all → console.warn after b2f6d3ef5)

| Location | Line | Before | After b2f6d3ef5 |
|----------|------|--------|-----------------|
| `presentAssistantMessage.ts` | ~394 | `catch { // Best-effort only }` | `catch (recordErr) { console.warn(...) }` |
| `presentAssistantMessage.ts` | ~530 | `catch { // Best-effort only }` | `catch (recordErr) { console.warn(...) }` |
| `presentAssistantMessage.ts` | ~752 | `catch { // Best-effort only }` | `catch (recordErr) { console.warn(...) }` |
| `ToolErrorInterceptor.ts` | 192-193 | `catch { parsed = undefined }` | unchanged (intentional) |

### Error Paths Returning Without UI Notification

1. **Structural preflight** (lines 716-775): `cline.pushToolResultToUserContent()` sends guided JSON to AI, then `break` — no `cline.say("error")` call.

2. **Validation catch** (lines 810-848): `cline.pushToolResultToUserContent()` sends guided JSON to AI, then `break` — no `cline.say("error")` call.

3. **Missing nativeArgs** (lines 519-559): `cline.pushToolResultToUserContent()` sends guided JSON to AI, then `break` — no `cline.say("error")` call.

### `AskIgnoredError` Silent Path (lines 251-253, 667-669)

```typescript
if (error instanceof AskIgnoredError) { return }
```

This is **intentional** — AskIgnoredError is an internal control flow signal, not a real error. This is correct behavior.

---

## 5. Recommended Fixes

### Fix 1: Add `cline.say("error")` to Structural Preflight Path

**File:** `presentAssistantMessage.ts`  
**Location:** After line 766 (before `cline.pushToolResultToUserContent`)

```typescript
// Add BEFORE pushToolResultToUserContent:
await cline.say("error", `[${variant}] ${errorMessage}`)
```

This ensures the user sees the structural error in the chat UI, while the AI still gets the guided JSON.

### Fix 2: Add `cline.say("error")` to Validation Catch Path

**File:** `presentAssistantMessage.ts`  
**Location:** After line 841 (before `cline.pushToolResultToUserContent`)

```typescript
await cline.say("error", `Validation error: ${errorMessage}`)
```

### Fix 3: Add `cline.say("error")` to Missing nativeArgs Path

**File:** `presentAssistantMessage.ts`  
**Location:** After line 559 (before `cline.pushToolResultToUserContent`)

```typescript
await cline.say("error", `Invalid tool call: ${errorMessage}`)
```

### Fix 4 (Optional): Add `cline.say("error")` to Tool Repetition Path

**File:** `presentAssistantMessage.ts`  
**Location:** After line 878 (before `cline.ask`)

The repetition path already calls `cline.ask()` which shows a user prompt, so this is lower priority.

---

## 6. Affected File List

| File | Role | Change Needed |
|------|------|---------------|
| `Zoo-Code/src/core/assistant-message/presentAssistantMessage.ts` | Main integration point | Add `cline.say("error")` to 3 paths |
| `Zoo-Code/src/core/tools/error-interception/ToolErrorInterceptor.ts` | Interceptor logic | No change needed (already correct) |
| `Zoo-Code/src/core/webview/diagnosticsHandler.ts` | Diagnostics file generation | No change needed |
| `Zoo-Code/src/core/task/Task.ts` | say() implementation | No change needed |

---

## 7. Root Cause Statement

**The Error Interception middleware has a visibility gap in its "bypass" paths.** When the interceptor detects structural issues (parallel call corruption, validation failures, missing arguments), it generates AI guidance and pushes it via `pushToolResultToUserContent`, but **never calls `cline.say("error")`** to inform the user. The `decoratedHandleError` path correctly does both, but the preflight/validation/missing-args paths only serve the AI.

**The user's core principle is violated:** "Don't hide errors from the user while guiding the AI." The current implementation hides structural errors from the user while guiding the AI.

---

## 8. Iteration Log

| # | Approach | Result |
|---|----------|--------|
| 1 | Read 3 diagnostic JSON files | ✅ All show same pattern: EI/PARAM_TYPE_MISMATCH, invisible to user |
| 2 | Read presentAssistantMessage.ts integration points | ✅ Found 2 interceptor integration points (lines 248-277, 665-693) |
| 3 | Read ToolErrorInterceptor.ts decoratedHandleError | ✅ Confirmed: rawHandleError called AFTER transformSignal, so UI gets raw error |
| 4 | Read diagnosticsHandler.ts | ✅ Confirmed: generates diagnostic files, opens in VS Code |
| 5 | Search for cline.say("error") in structural preflight path | 🔴 NOT FOUND — this is the gap |
| 6 | Verify b2f6d3ef5 commit diff | ✅ Confirmed: adds console.warn, NOT cline.say("error") |
| 7 | Search for empty catch blocks | ✅ Found 4 instances (all now have console.warn) |
| 8 | Trace cline.say() → webview UI path | ✅ Confirmed: say("error") adds to clineMessages → rendered in chat |
