# 5-Branch Split PR Plan — Full Decomposition

## Overview

5개 feature 브랜치를 리뷰 가능한 크기의 상호 배타적 PR로 분할합니다.

## Branch Inventory

| # | 브랜치 | 고유 커밋 | 파일 변경 | 줄 변경 |
|---|--------|----------|----------|---------|
| 1 | `feature/unified-shell-resolution` | 3 | 189 | +12,278/-6,533 |
| 2 | `feat/error-interception-middleware` | 18 | 26 | +8,940/-69 |
| 3 | `fix/mimo-parallel-tool-call-policy` | 6 (고유) | 61 | +12,040/-1,076 |
| 4 | `feature/local-usage-stats` | 41 | 284 | +27,420/-6,046 |
| 5 | `feature/task-dnd-ux` | 1 | 203 | +12,089/-6,185 |

**중요 발견**: 브랜치 3(`mimo-parallel-tool-call-policy`)은 브랜치 2(`error-interception-middleware`)의 15개 커밋을 포함하고 있음. 따라서 3번은 2번 위에 6개 고유 커밋만 추가.

## Dependency Graph

```
upstream/main
  │
  ├─[1] unified-shell-resolution (독립)
  │     │
  │     ├─[4C] local-usage-stats PR C: task guard (독립)
  │     ├─[4A] local-usage-stats PR A: terminal fix (1번 의존)
  │     ├─[4B] local-usage-stats PR B: provider totalCost (독립)
  │     └─[4D] local-usage-stats PR D: dashboard (4B 의존)
  │
  ├─[2] error-interception-middleware (독립)
  │     │
  │     └─[3] mimo-parallel-tool-call-policy (2번 의존)
  │
  └─[5] task-dnd-ux (1번 의존)
```

## PR Split Plan

### Group 1: Terminal/Shell Resolution

| PR | 브랜치 | 커밋 | 핵심 파일 | 복잡도 |
|----|--------|------|----------|--------|
| **#1** | `feature/unified-shell-resolution` | 3 | `TerminalProcess.ts`, `BaseTerminal.ts`, `Shell.ts`, `CommandScheduler.ts` | 🟡 중간 |

**커밋 목록**:
- `0ead76de7` feat(terminal): add unified shell resolution system
- `71a85444f` fix(terminal): add logging to silent error paths in shell resolution
- `8e6799525` feat(terminal): port CommandScheduler and Shell abstraction

**비고**: 189 파일 변경이 많아 보이지만, 대부분 upstream merge에서 온 것. 실제 feature 커밋은 3개.

---

### Group 2: Error Interception Middleware

| PR | 브랜치 | 커밋 | 핵심 파일 | 복잡도 |
|----|--------|------|----------|--------|
| **#2** | `feat/error-interception-middleware` | 18 | `src/core/tools/error-interception/`, `presentAssistantMessage.ts` | 🔴 높음 |

**분할 가능성**: 18개 커밋을 2~3개 PR로 더 쪼갤 수 있음:
- **#2a**: 핵심 기능 (ErrorClassifier, MessageTransformer, StructuralValidator, ToolErrorInterceptor)
- **#2b**: UI + 사용자 친화적 에러 표시
- **#2c**: 테스트 + CI 수정

**비고**: `mimo-parallel-tool-call-policy`(#3)가 이 브랜치의 커밋을 포함하므로, #2가 먼저 머지되어야 #3을 올릴 수 있음.

---

### Group 3: MiMo Tool Call Policy

| PR | 브랜치 | 커밋 | 핵심 파일 | 복잡도 |
|----|--------|------|----------|--------|
| **#3** | `fix/mimo-parallel-tool-call-policy` | 6 (고유) | `ToolCallRetentionPolicy.ts`, `mimo.ts`, `TelemetryService.ts` | 🟡 중간 |

**고유 커밋 목록** (error-interception 제외):
- `d17049f01` feat: add model-level tool-call capability and policy resolution
- `5c8b3ce58` feat: wire MiMo provider controls and tighten argument normalization
- `9d87f7fc5` feat: add ghost quarantine and max-one tool call enforcement
- `6e8d4744b` feat: add tool-call policy telemetry events
- `b7edba688` fix: preserve parallel behavior for known providers without explicit capabilities
- `7d1034529` fix: resolve no-explicit-any lint errors in mimo and telemetry files

**선행 조건**: #2 (error-interception)가 먼저 머지되어야 함.

---

### Group 4: Local Usage Stats (이미 분할됨)

| PR | 브랜치 | 커밋 | 핵심 파일 | 복잡도 |
|----|--------|------|----------|--------|
| **#4C** | `fix/task-guard-abandoned-tasks` | 1 | `Task.ts` | 🟢 낮음 |
| **#4A** | `fix/terminal-execa-retry` | 4 | `ExecuteCommandTool.ts`, `TerminalProcess.ts` | 🟢 낮음 |
| **#4B** | `fix/providers-total-cost` | 3 | 11 provider files | 🟢 낮음 |
| **#4D** | `feature/local-usage-stats` | 40 | `services/stats/`, dashboard components, i18n | 🔴 높음 |

**선행 조건**:
- #4A: #1 (unified-shell) 이후 (ExecuteCommandTool.ts 겹침)
- #4B: 독립적
- #4D: #4B 이후 (provider totalCost 의존)

---

### Group 5: Task DnD UX

| PR | 브랜치 | 커밋 | 핵심 파일 | 복잡도 |
|----|--------|------|----------|--------|
| **#5** | `feature/task-dnd-ux` | 1 | `TaskOrganizationStore.ts`, `ClineProvider.ts`, `webviewMessageHandler.ts` | 🟡 중간 |

**선행 조건**: #1 (unified-shell) 이후 (Task.ts, ClineProvider.ts 겹침)

---

## Recommended Merge Order

```
Phase 1 (병렬 가능):
  ├── #1  unified-shell-resolution
  ├── #2  error-interception-middleware (또는 #2a, #2b, #2c)
  ├── #4C local-usage-stats: task guard
  └── #4B local-usage-stats: provider totalCost

Phase 2 (#1, #2 의존):
  ├── #3  mimo-parallel-tool-call-policy (#2 이후)
  ├── #4A local-usage-stats: terminal fix (#1 이후)
  └── #5  task-dnd-ux (#1 이후)

Phase 3 (#4B 의존):
  └── #4D local-usage-stats: dashboard (#4B 이후)

Phase 4 (모든 PR 머지 후):
  └── 검증: 전체 빌드 + 테스트
```

## Total PR Count

| 그룹 | PR 수 |
|------|-------|
| Terminal/Shell | 1 |
| Error Interception | 1~3 (분할 여부 결정 필요) |
| MiMo Policy | 1 |
| Stats Dashboard | 4 (이미 분할됨) |
| Task DnD | 1 |
| **합계** | **8~10** |

## Risk Assessment

| 위험 | 설명 | 완화 |
|------|------|------|
| 🔴 `unified-shell` 규모 | 189 파일 변경 (upstream merge 포함) | 실제 feature diff만 추출하여 새 브랜치 생성 |
| 🔴 `error-interception` 커밋 수 | 18개 커밋, squash 또는 분할 필요 | 핵심 기능 squash + 테스트 분리 |
| 🟡 `mimo`가 error-interception 포함 | 고유 커밋 6개만 추출 필요 | `git rebase --onto`로 고유 커밋만 분리 |
| 🟡 `task-dnd-ux` 규모 | 203 파일 변경 (upstream merge 포함) | 실제 feature diff만 추출 |
| 🟢 `local-usage-stats` 분할 | 이미 완료 | CI 안정화 진행 중 |
