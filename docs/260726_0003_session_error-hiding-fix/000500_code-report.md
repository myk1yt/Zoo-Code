# Code Mode Task Report

## Task Summary
Added `cline.say("error", ...)` calls to 3 error interception bypass paths in `presentAssistantMessage.ts` so that structural preflight errors, validation catch errors, and missing nativeArgs errors are now visible to the user in the Zoo Code UI, in addition to being sent to the AI model as guided payloads.

## Actions Taken

### Fix 1: Structural Preflight Path (line ~766)
- **File:** `Zoo-Code/src/core/assistant-message/presentAssistantMessage.ts`
- Added `await cline.say("error", \`[${variant}] ${errorMessage}\`)` before `cline.pushToolResultToUserContent(...)` in the structural preflight block (CWD_OBJECT_MISUSE, NESTED_PARAM_OVERFLOW, STRUCTURAL_MISUSE_REPEAT, MODEL_STUCK_LOOP).
- The user now sees the structural error variant and message in the chat UI.

### Fix 2: Validation Catch Path (line ~843)
- **File:** `Zoo-Code/src/core/assistant-message/presentAssistantMessage.ts`
- Added `await cline.say("error", \`Validation error: ${errorMessage}\`)` before `cline.pushToolResultToUserContent(...)` in the `validateToolUse` catch block (modeRestriction, unknownTool, fileRestriction, typeMismatch).
- The user now sees the validation error in the chat UI.

### Fix 3: Missing nativeArgs Path (line ~553)
- **File:** `Zoo-Code/src/core/assistant-message/presentAssistantMessage.ts`
- Added `await cline.say("error", \`Invalid tool call: ${errorMessage}\`)` before `cline.pushToolResultToUserContent(...)` in the missing/invalid nativeArgs block (PARAM_MISSING, INVALID_JSON_ARGUMENTS).
- The user now sees the invalid tool call error in the chat UI.

### Test Updates
- **File:** `Zoo-Code/src/core/assistant-message/__tests__/presentAssistantMessage-error-interception.spec.ts`
- Added `cline.say("error", ...)` assertions to 6 existing test cases:
  1. CWD_OBJECT_MISUSE structural preflight test
  2. NESTED_PARAM_OVERFLOW structural preflight test
  3. Missing nativeArgs (PARAM_MISSING) test
  4. Validation: "not allowed in" (modeRestriction) test
  5. Validation: "Unknown tool" (unknownTool) test
  6. Validation: "File restriction" (fileRestriction) test
- Added `nativeArgs` to the 3 validation test cases so they bypass the missing-nativeArgs check and actually reach the validation catch path.

## Result
✅ Success — All 18 tests pass.

**Test command run:**
```
cd Zoo-Code\src; npx vitest run core/assistant-message/__tests__/presentAssistantMessage-error-interception.spec.ts
```

**Test results:**
```
Test Files  1 passed (1)
     Tests  18 passed (18)
  Duration  7.30s
```

## Design Principle Compliance
The user's core requirement is satisfied: "에러메시지와 AI에게 전달하는 메시지 전부가 Zoo Code상에서도 보이고, AI모델에게도 해야할 일을 전달하도록 해야해"

| Error Path | AI Guidance (`pushToolResultToUserContent`) | User Visibility (`cline.say("error")`) | Status |
|-----------|---------------------------------------------|----------------------------------------|--------|
| Structural preflight (lines ~766) | ✅ guided JSON | ✅ `cline.say("error")` | ✅ Fixed |
| Validation catch (lines ~843) | ✅ guided JSON | ✅ `cline.say("error")` | ✅ Fixed |
| Missing nativeArgs (lines ~553) | ✅ guided JSON | ✅ `cline.say("error")` | ✅ Fixed |
| `decoratedHandleError` (tool execution) | ✅ guided JSON | ✅ `cline.say("error")` | ✅ Already working |

## Issues Discovered
- The 3 validation test cases (modeRestriction, unknownTool, fileRestriction) were missing `nativeArgs` in their mock tool_use blocks. Without `nativeArgs`, the code hits the "missing nativeArgs" path before reaching the validation catch. This was a pre-existing test setup issue that became visible once the `cline.say("error")` assertions were added. Fixed by adding `nativeArgs` to these test cases.

## Next Step Recommendations
- Consider adding `cline.say("error")` to the tool repetition path (lines ~878) as an optional enhancement (Fix 4 in the debug report). This path currently uses `cline.ask()` which shows a user prompt, so it is lower priority.
- No changes needed to `ToolErrorInterceptor.ts` — it was already correct.

## Affected File List
| File | Change |
|------|--------|
| `Zoo-Code/src/core/assistant-message/presentAssistantMessage.ts` | Added 3 `cline.say("error", ...)` calls |
| `Zoo-Code/src/core/assistant-message/__tests__/presentAssistantMessage-error-interception.spec.ts` | Added 6 `cline.say("error")` assertions + 3 `nativeArgs` fixes |
