# Zoo-Code/ Duplicate Directory Analysis & Cleanup Plan

**Date:** 2026-07-26
**Analyst:** Project Research Mode
**Scope:** Read-only analysis of `Zoo-Code/` vs root-level source directories

---

## Executive Summary

The `Zoo-Code/` directory is **NOT a stale copy** of the root-level source code. It is a **bidirectional fork** — both `Zoo-Code/src/` and `src/` have evolved independently with **significant unique features in each copy**. The `Zoo-Code/` copy contains entire subsystems (UsageStats, CommandScheduler, Shell Abstraction, Dashboard UI) that are deeply integrated and do NOT exist in the Git-tracked `src/`. Conversely, `src/` has architectural improvements (ServiceFactory, Semble integration, file-search) not present in `Zoo-Code/`.

**Deletion of `Zoo-Code/` without porting unique changes would result in permanent loss of major features.**

---

## 1. Project Structure & Dependencies

### 1.1 Root Layout

| Path | Git-Tracked? | Role |
|------|-------------|------|
| `src/` | ✅ Yes | Main extension source code |
| `webview-ui/` | ✅ Yes | React webview UI |
| `packages/` | ✅ Yes | Shared packages (cloud, types, telemetry, ipc, etc.) |
| `apps/` | ✅ Yes | CLI, vscode-e2e, vscode-nightly |
| `Zoo-Code/src/` | ❌ No | Duplicate with significant unique features |
| `Zoo-Code/webview-ui/` | ❌ No | Duplicate with unique UI components |
| `Zoo-Code/packages/` | ❌ No | Appears identical to root `packages/` |
| `ZooCode/` | ❌ No | Contains only `docs/260726_0001_session_error-hiding-audit/` (not a codebase) |

### 1.2 Root Config Files (Identical)

Both root `package.json`, `tsconfig.json`, `turbo.json`, and `renovate.json` are byte-identical between `Zoo-Code/` and workspace root. The `Zoo-Code/` root also contains `SECURITY.md`, `.env.sample`, and various `.log` files (build artifacts from testing).

---

## 2. Communication Layer (API/IPC) & Data Flow

### 2.1 Features UNIQUE to `Zoo-Code/src/` (NOT in Git-tracked `src/`)

#### 2.1.1 CommandScheduler — Command Serialization System
A global FIFO command lane providing concurrency-1 command execution with per-task cancellation.

| File | Lines | Purpose |
|------|-------|---------|
| [`Zoo-Code/src/integrations/terminal/CommandScheduler.ts`](Zoo-Code/src/integrations/terminal/CommandScheduler.ts:1) | 508 | Singleton scheduler with FIFO queue, terminal creation permits, task cancellation |
| [`Zoo-Code/src/integrations/terminal/CommandTrace.ts`](Zoo-Code/src/integrations/terminal/CommandTrace.ts:1) | — | Command execution tracing |
| [`Zoo-Code/src/integrations/terminal/TerminalLifecycle.ts`](Zoo-Code/src/integrations/terminal/TerminalLifecycle.ts:1) | — | Terminal lifecycle management |
| [`Zoo-Code/src/integrations/terminal/__tests__/CommandScheduler.spec.ts`](Zoo-Code/src/integrations/terminal/__tests__/CommandScheduler.spec.ts:1) | — | Full test suite |
| [`Zoo-Code/src/integrations/terminal/__tests__/TerminalLifecycle.spec.ts`](Zoo-Code/src/integrations/terminal/__tests__/TerminalLifecycle.spec.ts:1) | — | Lifecycle tests |
| [`Zoo-Code/src/integrations/terminal/__tests__/ShellInvocationAdapter.spec.ts`](Zoo-Code/src/integrations/terminal/__tests__/ShellInvocationAdapter.spec.ts:1) | — | Shell adapter tests |
| [`Zoo-Code/src/integrations/terminal/__tests__/ShellResolver.spec.ts`](Zoo-Code/src/integrations/terminal/__tests__/ShellResolver.spec.ts:1) | — | Shell resolver tests |

**Integration Points:**
- [`Zoo-Code/src/extension.ts#L157-L158`](Zoo-Code/src/extension.ts:157): `CommandScheduler.initialize()` at activation
- [`Zoo-Code/src/extension.ts#L397-L398`](Zoo-Code/src/extension.ts:397): `CommandScheduler.cleanup()` at deactivation (MISSING from `src/extension.ts`)
- [`Zoo-Code/src/core/tools/ExecuteCommandTool.ts#L249`](Zoo-Code/src/core/tools/ExecuteCommandTool.ts:249): Commands routed through scheduler
- [`Zoo-Code/src/integrations/terminal/TerminalRegistry.ts#L278`](Zoo-Code/src/integrations/terminal/TerminalRegistry.ts:278): Terminal creation gated by scheduler permits

#### 2.1.2 Shell Abstraction Layer
Complete shell resolution, invocation, and environment management system.

| File | Lines | Purpose |
|------|-------|---------|
| [`Zoo-Code/src/integrations/terminal/shell/CommandEnvironmentService.ts`](Zoo-Code/src/integrations/terminal/shell/CommandEnvironmentService.ts:1) | — | Request-scoped shell environment resolver |
| [`Zoo-Code/src/integrations/terminal/shell/ShellResolver.ts`](Zoo-Code/src/integrations/terminal/shell/ShellResolver.ts:1) | — | Shell detection and resolution |
| [`Zoo-Code/src/integrations/terminal/shell/ShellInvocationAdapter.ts`](Zoo-Code/src/integrations/terminal/shell/ShellInvocationAdapter.ts:1) | — | Shell invocation abstraction |
| [`Zoo-Code/src/integrations/terminal/shell/TerminalProfileResolver.ts`](Zoo-Code/src/integrations/terminal/shell/TerminalProfileResolver.ts:1) | — | Terminal profile resolution |
| [`Zoo-Code/src/integrations/terminal/shell/types.ts`](Zoo-Code/src/integrations/terminal/shell/types.ts:1) | — | Type definitions |

**Integration Points:**
- [`Zoo-Code/src/core/webview/ClineProvider.ts#L88`](Zoo-Code/src/core/webview/ClineProvider.ts:88): `import { CommandEnvironmentService }`
- [`Zoo-Code/src/core/webview/ClineProvider.ts#L3092-L3100`](Zoo-Code/src/core/webview/ClineProvider.ts:3092): Lazy initialization of `CommandEnvironmentService`
- [`Zoo-Code/src/core/task/Task.ts#L101`](Zoo-Code/src/core/task/Task.ts:101): Task-level shell environment resolution
- [`Zoo-Code/src/core/webview/generateSystemPrompt.ts#L49-L51`](Zoo-Code/src/core/webview/generateSystemPrompt.ts:49): Shell info in system prompt
- [`Zoo-Code/src/core/webview/webviewMessageHandler.ts#L1814-L1816`](Zoo-Code/src/core/webview/webviewMessageHandler.ts:1814): Terminal shell options handler

**NOTE:** `src/integrations/terminal/shell/` is **EMPTY** in the Git-tracked copy.

#### 2.1.3 Usage Stats System (Entire Feature)
Local token usage statistics: recording, querying, aggregation, export, and dashboard.

| File | Lines | Purpose |
|------|-------|---------|
| [`Zoo-Code/src/services/stats/UsageEventStore.ts`](Zoo-Code/src/services/stats/UsageEventStore.ts:1) | — | Append-only event storage with manifest |
| [`Zoo-Code/src/services/stats/UsageStatsService.ts`](Zoo-Code/src/services/stats/UsageStatsService.ts:1) | — | Main service: query, export, clear |
| [`Zoo-Code/src/services/stats/UsageRecorder.ts`](Zoo-Code/src/services/stats/UsageRecorder.ts:1) | — | Per-task event recording |
| [`Zoo-Code/src/services/stats/UsageAggregator.ts`](Zoo-Code/src/services/stats/UsageAggregator.ts:1) | — | Statistics aggregation |
| [`Zoo-Code/src/services/stats/costRecalculation.ts`](Zoo-Code/src/services/stats/costRecalculation.ts:1) | — | Cost calculation |
| [`Zoo-Code/src/services/stats/index.ts`](Zoo-Code/src/services/stats/index.ts:1) | — | Module re-exports |

**NOTE:** `src/services/stats/` **DOES NOT EXIST** in the Git-tracked copy.

#### 2.1.4 Webview Message Handlers (Unique)

| File | Lines | Purpose |
|------|-------|---------|
| [`Zoo-Code/src/core/webview/usageStatsMessageHandler.ts`](Zoo-Code/src/core/webview/usageStatsMessageHandler.ts:1) | 902 | Handles getUsageStats, clearUsageStats, exportUsageStats, dashboard queries |
| [`Zoo-Code/src/core/webview/taskOrganizationMessageHandler.ts`](Zoo-Code/src/core/webview/taskOrganizationMessageHandler.ts:1) | 77 | Task organization mutations (move, rename, archive) |

**Integration:** Both are imported and wired in [`Zoo-Code/src/core/webview/webviewMessageHandler.ts#L53-L60`](Zoo-Code/src/core/webview/webviewMessageHandler.ts:53) with case handlers at lines 4088-4106.

#### 2.1.5 Dashboard & Stats UI Components

| File | Purpose |
|------|---------|
| [`Zoo-Code/webview-ui/src/components/dashboard/DashboardView.tsx`](Zoo-Code/webview-ui/src/components/dashboard/DashboardView.tsx:1) | Main dashboard view |
| [`Zoo-Code/webview-ui/src/components/dashboard/DashboardSummary.tsx`](Zoo-Code/webview-ui/src/components/dashboard/DashboardSummary.tsx:1) | Dashboard summary card |
| [`Zoo-Code/webview-ui/src/components/dashboard/SessionList.tsx`](Zoo-Code/webview-ui/src/components/dashboard/SessionList.tsx:1) | Session list with filtering |
| [`Zoo-Code/webview-ui/src/components/dashboard/SessionDetail.tsx`](Zoo-Code/webview-ui/src/components/dashboard/SessionDetail.tsx:1) | Per-session detail view |
| [`Zoo-Code/webview-ui/src/components/stats/UsageHeatmap.tsx`](Zoo-Code/webview-ui/src/components/stats/UsageHeatmap.tsx:1) | Usage heatmap visualization |
| Plus all corresponding `__tests__/` files | Full test coverage |

#### 2.1.6 Code Index Processors

| File | Purpose |
|------|---------|
| [`Zoo-Code/src/services/code-index/processors/file-watcher.ts`](Zoo-Code/src/services/code-index/processors/file-watcher.ts:1) | File system watcher for code index |
| [`Zoo-Code/src/services/code-index/processors/__tests__/file-watcher.spec.ts`](Zoo-Code/src/services/code-index/processors/__tests__/file-watcher.spec.ts:1) | Tests |

**NOTE:** `src/services/code-index/processors/file-watcher.ts` **DOES NOT EXIST** in Git-tracked copy.

### 2.2 Features UNIQUE to Git-tracked `src/` (NOT in `Zoo-Code/`)

#### 2.2.1 ServiceFactory Pattern (Code Index)

| File | Lines | Purpose |
|------|-------|---------|
| [`src/services/code-index/service-factory.ts`](src/services/code-index/service-factory.ts:1) | 290 | Factory pattern for creating embedder + vector store + orchestrator |
| [`src/services/code-index/__tests__/service-factory.spec.ts`](src/services/code-index/__tests__/service-factory.spec.ts:1) | — | Tests |

**Integration:** [`src/services/code-index/manager.ts#L7`](src/services/code-index/manager.ts:7) imports and uses `CodeIndexServiceFactory`.

#### 2.2.2 Semble Integration (Code Index Provider)

| File | Purpose |
|------|---------|
| [`src/services/code-index/semble/index.ts`](src/services/code-index/semble/index.ts:1) | Module exports |
| [`src/services/code-index/semble/provider.ts`](src/services/code-index/semble/provider.ts:1) | Semble provider implementation |
| [`src/services/code-index/semble/semble-cli.ts`](src/services/code-index/semble/semble-cli.ts:1) | CLI wrapper |
| [`src/services/code-index/semble/semble-downloader.ts`](src/services/code-index/semble/semble-downloader.ts:1) | Binary downloader |
| [`src/services/code-index/semble/types.ts`](src/services/code-index/semble/types.ts:1) | Type definitions |
| Plus `__tests__/` directory | Full test coverage |

**Integration:** [`src/services/code-index/manager.ts#L11`](src/services/code-index/manager.ts:11) imports `SembleProvider`.

#### 2.2.3 Workspace File Search

| File | Purpose |
|------|---------|
| [`src/services/search/file-search.ts`](src/services/search/file-search.ts:1) | Ripgrep-based file search with FZF ranking |
| [`src/services/search/__tests__/file-search.spec.ts`](src/services/search/__tests__/file-search.spec.ts:1) | Tests |

**Integration Points:**
- [`src/core/webview/webviewMessageHandler.ts#L67`](src/core/webview/webviewMessageHandler.ts:67): `searchWorkspaceFiles`
- [`src/services/checkpoints/ShadowCheckpointService.ts#L13`](src/services/checkpoints/ShadowCheckpointService.ts:13): `executeRipgrep`
- [`src/services/roo-config/index.ts#L197`](src/services/roo-config/index.ts:197): Dynamic import

#### 2.2.4 Additional Infrastructure

| File | Purpose |
|------|---------|
| [`src/services/ripgrep/index.ts`](src/services/ripgrep/index.ts:1) | Ripgrep binary resolution |
| [`src/services/ripgrep/internal/loadRipgrep.ts`](src/services/ripgrep/internal/loadRipgrep.ts:1) | Internal ripgrep loader |
| [`src/services/code-index/shared/`](src/services/code-index/shared/) | Shared utilities (get-relative-path, supported-extensions, validation-helpers) |
| Additional `__tests__/` in `mcp/`, `rules/` | Extended test coverage |

### 2.3 Files That Are Identical or Near-Identical

- Root `package.json`, `tsconfig.json`, `turbo.json`, `renovate.json`
- `packages/` directory (cloud, types, telemetry, ipc, core, vscode-shim, config-eslint, config-typescript)
- `apps/` directory (cli, vscode-e2e, vscode-nightly)
- Most of `src/core/` except the unique additions listed above
- Most of `webview-ui/src/` except the unique additions listed above

---

## 3. Target Code Pinpoint Analysis

### 3.1 ClineProvider.ts Divergence

| Aspect | `Zoo-Code/src/` | `src/` |
|--------|-----------------|--------|
| Total lines | 3084+ (has `getUsageStatsService`, `getCommandEnvironmentService`) | Different (lacks these methods) |
| `usageStatsService` field | ✅ Line 183 | ❌ Missing |
| `commandEnvironmentService` field | ✅ Line 184 | ❌ Missing |
| `UsageStatsService` import | ✅ Line 87 | ❌ Missing |
| `CommandEnvironmentService` import | ✅ Line 88 | ❌ Missing |
| `ShellResolver` import | ✅ Line 89 | ❌ Missing |

### 3.2 extension.ts Divergence

| Aspect | `Zoo-Code/src/extension.ts` | `src/extension.ts` |
|--------|----------------------------|---------------------|
| Total lines | 400 | 395 |
| `CommandScheduler.initialize()` | ✅ Line 158 | ❌ Missing |
| `CommandScheduler.cleanup()` | ✅ Line 398 | ❌ Missing |
| `CommandScheduler` import | ✅ Line 34 | ❌ Missing |

### 3.3 webviewMessageHandler.ts Divergence

| Aspect | `Zoo-Code/src/` | `src/` |
|--------|-----------------|--------|
| `usageStatsMessageHandler` import | ✅ Lines 53-60 | ❌ Missing |
| `taskOrganizationMessageHandler` import | ✅ (via webviewMessageHandler) | ❌ Missing |
| `getUsageStats` case | ✅ Line 4089 | ❌ Missing |
| `clearUsageStats` case | ✅ Line 4094 | ❌ Missing |
| `exportUsageStats` case | ✅ Line 4104 | ❌ Missing |
| `requestTerminalShellOptions` case | ✅ Line 1814 | Different implementation |

### 3.4 ExecuteCommandTool.ts Divergence

| Aspect | `Zoo-Code/src/` | `src/` |
|--------|-----------------|--------|
| `CommandScheduler` import | ✅ Line 33 | ❌ Missing |
| Scheduler integration | ✅ Lines 248-249 | ❌ Missing (commands execute directly) |

---

## 4. Potential Bottlenecks & Legacy Issues

### 4.1 Critical Risk: Feature Loss on Deletion

If `Zoo-Code/` is deleted without porting:
1. **UsageStats system** — entire local usage statistics feature (recording, querying, export, dashboard)
2. **CommandScheduler** — command serialization preventing terminal concurrency issues
3. **Shell Abstraction** — cross-platform shell resolution (ShellResolver, CommandEnvironmentService)
4. **Dashboard UI** — usage dashboard with session tracking, heatmaps
5. **Task Organization** — task mutation handler (move, rename, archive)

### 4.2 Critical Risk: Feature Loss on Overwriting `Zoo-Code/` with `src/`

If `src/` is copied over `Zoo-Code/`:
1. **ServiceFactory pattern** — refactored code-index initialization
2. **Semble integration** — alternative code index provider
3. **File search** — ripgrep-based workspace search
4. **Extended test coverage** — mcp, rules tests

### 4.3 Build Artifacts in `Zoo-Code/`

The following should NOT be ported (build artifacts / testing logs):
- `Zoo-Code/src/test-failures.log`
- `Zoo-Code/file_err.log`, `readfile_*.log`, `vitest_full.log`
- `Zoo-Code/renovate.json` (identical to root, redundant)

### 4.4 packages/ and apps/ Duplication

`Zoo-Code/packages/` and `Zoo-Code/apps/` appear identical to root copies. Safe to ignore during porting.

---

## 5. Cleanup Plan

### 5.1 Recommended Approach: MERGE, Not Delete

Since both copies have unique, deeply integrated features, the correct approach is:

1. **Port `Zoo-Code/`-unique features TO `src/`** (Git-tracked)
2. **Port `src/`-unique features TO `Zoo-Code/`** (or verify they're already integrated)
3. **Delete `Zoo-Code/`** after full merge

### 5.2 Porting Priority (Zoo-Code → src)

| Priority | Feature | Effort | Risk |
|----------|---------|--------|------|
| 🔴 P0 | `src/services/stats/` (entire directory) | Medium | Low (self-contained module) |
| 🔴 P0 | `src/core/webview/usageStatsMessageHandler.ts` | Medium | Medium (wired into ClineProvider) |
| 🔴 P0 | `src/core/webview/taskOrganizationMessageHandler.ts` | Low | Low |
| 🟠 P1 | `src/integrations/terminal/CommandScheduler.ts` + tests | High | High (deep integration) |
| 🟠 P1 | `src/integrations/terminal/shell/` (entire directory) | High | High (deep integration) |
| 🟠 P1 | `src/integrations/terminal/CommandTrace.ts` | Low | Medium |
| 🟠 P1 | `src/integrations/terminal/TerminalLifecycle.ts` + tests | Medium | Medium |
| 🟠 P1 | `extension.ts` changes (CommandScheduler init/cleanup) | Low | High (entry point) |
| 🟡 P2 | `webview-ui/src/components/dashboard/` | Medium | Low (UI only) |
| 🟡 P2 | `webview-ui/src/components/stats/UsageHeatmap.tsx` | Low | Low (UI only) |
| 🟡 P2 | `ClineProvider.ts` changes (service fields + methods) | Medium | High (core provider) |
| 🟡 P2 | `webviewMessageHandler.ts` changes (case handlers) | Medium | Medium |
| 🟡 P2 | `ExecuteCommandTool.ts` changes (scheduler integration) | Medium | High |
| 🟢 P3 | `code-index/processors/file-watcher.ts` + tests | Low | Low |

### 5.3 Porting Priority (src → Zoo-Code, if needed)

| Priority | Feature | Effort | Risk |
|----------|---------|--------|------|
| 🟡 P2 | `service-factory.ts` + tests | Medium | Medium |
| 🟡 P2 | `semble/` directory | High | Medium |
| 🟡 P2 | `search/file-search.ts` + tests | Medium | Low |
| 🟢 P3 | `ripgrep/index.ts`, `internal/loadRipgrep.ts` | Low | Low |
| 🟢 P3 | `code-index/shared/` directory | Low | Low |
| 🟢 P3 | Additional test files (mcp, rules) | Low | Low |

### 5.4 Safe Deletion Order (After Full Merge)

1. **Phase 1:** Delete `Zoo-Code/packages/` (identical to root)
2. **Phase 2:** Delete `Zoo-Code/apps/` (identical to root)
3. **Phase 3:** Delete `Zoo-Code/webview-ui/` (after porting dashboard/stats components)
4. **Phase 4:** Delete `Zoo-Code/src/` (after porting all unique features)
5. **Phase 5:** Delete remaining `Zoo-Code/` root files (logs, .env.sample, SECURITY.md if desired)
6. **Verify:** Build + test pass after each phase

### 5.5 DO NOT Delete

- `ZooCode/` — contains docs subfolder, leave as-is
- Root-level `src/`, `webview-ui/`, `packages/`, `apps/` — these are the Git-tracked source

---

## 6. Summary Statistics

| Metric | `Zoo-Code/src/` Unique | `src/` Unique | Both |
|--------|----------------------|---------------|------|
| Feature modules | 6 major subsystems | 4 subsystems | ~90% shared |
| Estimated unique lines | ~3,000-5,000 | ~1,500-2,500 | — |
| Integration points in ClineProvider | 3 new fields + methods | — | Existing fields modified |
| Integration points in extension.ts | 2 (init + cleanup) | — | Existing code modified |
| Test files unique | ~10 | ~15 | — |
| Risk if lost | 🔴 HIGH (user-visible features) | 🟡 MEDIUM (architecture improvements) | — |

---

## 7. Next Step Recommendations

1. **VP Decision Required:** Approve merge strategy (port Zoo-Code features to src, or maintain both copies)
2. **If merge approved:** Delegate to Architect mode for integration plan, then Code mode for phased porting
3. **If merge rejected:** Document `Zoo-Code/` as a feature branch snapshot and add `.gitignore` entry
4. **Immediate action:** Add `Zoo-Code/` to `.gitignore` to prevent accidental commits of the duplicate
