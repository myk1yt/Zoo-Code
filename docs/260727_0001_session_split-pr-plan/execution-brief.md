# 📋 Zoo Code — 5-Branch Split PR Execution Brief

> **새 세션에서 이 문서를 첫 번째로 읽으세요.**

---

## Mission

5개 feature 브랜치를 리뷰 가능한 크기(8~14개)의 **상호 배타적 PR**로 분할하고,
순차적으로 fork(`myk1yt/Zoo-Code`)에서 CI를 통과시킨 뒤, 전부 통과하면
upstream(`Zoo-Code-Org/Zoo-Code`)에 순차적으로 PR을 엽니다.

**핵심 목표**: 5개 브랜치를 전부 통합했을 때 어떤 버그도 발생하지 않아야 함.

---

## 1. 브랜치 인벤토리

| # | 브랜치 | 고유 커밋 | 핵심 영역 |
|---|--------|----------|----------|
| 1 | `feature/unified-shell-resolution` | 3 | 셸/터미널 통합 해석 |
| 2 | `feat/error-interception-middleware` | 18 | 에러 차단 미들웨어 |
| 3 | `fix/mimo-parallel-tool-call-policy` | 6 (고유) | MiMo 도구 호출 정책 |
| 4 | `feature/local-usage-stats` | 41 | 사용량 통계 대시보드 |
| 5 | `feature/task-dnd-ux` | 1 | 태스크 폴더 DnD UX |

> ⚠️ 브랜치 3은 브랜치 2의 커밋을 포함. 고유 커밋 6개만 추출 필요.

---

## 2. 의존성 그래프 (반드시 이 순서를 지킬 것)

```
Phase 1 (병렬 가능, 독립적):
  ├── #1  unified-shell-resolution
  ├── #2  error-interception-middleware
  ├── #4C local-usage-stats: task guard (이미 CI 통과)
  └── #4B local-usage-stats: provider totalCost

Phase 2 (#1, #2 의존):
  ├── #3  mimo-parallel-tool-call-policy (#2 이후)
  ├── #4A local-usage-stats: terminal fix (#1 이후)
  └── #5  task-dnd-ux (#1 이후)

Phase 3 (이전 전부 의존):
  └── #4D local-usage-stats: dashboard (#4B 이후)
```

---

## 3. PR 분할 상세

### Phase 1 (독립적, 병렬 가능)

| PR | 브랜치 소스 | 커밋 | 핵심 파일 | 복잡도 |
|----|-----------|------|----------|--------|
| **#1** | `feature/unified-shell-resolution` | 3 | `TerminalProcess.ts`, `BaseTerminal.ts`, `Shell.ts`, `CommandScheduler.ts` | 🟡 |
| **#2** | `feat/error-interception-middleware` | 18 | `src/core/tools/error-interception/`, `presentAssistantMessage.ts` | 🔴 |
| **#4C** | `fix/task-guard-abandoned-tasks` | 1 | `Task.ts` | 🟢 |
| **#4B** | `fix/providers-total-cost` | 3 | 11 provider files | 🟢 |

### Phase 2 (Phase 1 의존)

| PR | 브랜치 소스 | 커밋 | 핵심 파일 | 복잡도 | 선행 조건 |
|----|-----------|------|----------|--------|----------|
| **#3** | `fix/mimo-parallel-tool-call-policy` (고유 커밋만) | 6 | `ToolCallRetentionPolicy.ts`, `mimo.ts`, `TelemetryService.ts` | 🟡 | #2 |
| **#4A** | `fix/terminal-execa-retry` | 4 | `ExecuteCommandTool.ts`, `TerminalProcess.ts` | 🟢 | #1 |
| **#5** | `feature/task-dnd-ux` | 1 | `TaskOrganizationStore.ts`, `ClineProvider.ts` | 🟡 | #1 |

### Phase 3 (이전 전부 의존)

| PR | 브랜치 소스 | 커밋 | 핵심 파일 | 복잡도 | 선행 조건 |
|----|-----------|------|----------|--------|----------|
| **#4D** | `feature/local-usage-stats` (A/B/C/D 제외) | 40 | `services/stats/`, dashboard, i18n | 🔴 | #4B |

---

## 4. 각 PR별 알려진 문제 & 해결 방법

### PR #1 (unified-shell-resolution)
- 189 파일 변경 (upstream merge 포함). 실제 feature diff만 추출하여 새 브랜치 생성 필요.
- `ExecuteCommandTool.ts`를 656줄 변경 → #4A, #5가 이 변경에 의존.

### PR #2 (error-interception-middleware)
- 18개 커밋. squash하거나 2~3개 PR로 더 쪼갤 수 있음.
- `presentAssistantMessage.ts`를 668줄 변경 → #3이 이 위에 785줄 추가.

### PR #3 (mimo-parallel-tool-call-policy)
- ⚠️ 브랜치 2의 커밋 15개를 포함. 고유 커밋 6개만 추출 필요:
  - `d17049f01` feat: add model-level tool-call capability and policy resolution
  - `5c8b3ce58` feat: wire MiMo provider controls
  - `9d87f7fc5` feat: add ghost quarantine and max-one tool call enforcement
  - `6e8d4744b` feat: add tool-call policy telemetry events
  - `b7edba688` fix: preserve parallel behavior for known providers
  - `7d1034529` fix: resolve no-explicit-any lint errors
- `git rebase --onto` 또는 `git cherry-pick`로 고유 커밋만 분리.

### PR #4A (terminal fix)
- `RooTerminalCallbacks` 타입이 upstream에 없음 → #1(unified-shell) 이후에 올려야 함.
- `eslint-suppressions.json` stale suppressions → `--prune-suppressions` 필요.

### PR #4B (provider totalCost)
- `moonshot.ts`에서 `OpenAiCompatibleHandler` import 에러 → `OpenAiHandler`로 복원.
- 테스트 assertions에 `totalCost` 필드 추가 필요.

### PR #4D (dashboard)
- TaskOrganizationStore 테스트 timestamp drift, future-schema 수정 필요.
- provider streams에 totalCost 계산 로직 추가 필요 (5개 provider).
- `eslint-suppressions.json` prune 필요.

### PR #5 (task-dnd-ux)
- 203 파일 변경 (upstream merge 포함). 실제 feature diff만 추출 필요.

---

## 5. 실행 순서 (상세)

```
[VP 세션 시작]
  │
  ├─ Step 0: Crow Memory에서 user preferences + project context 로드
  ├─ Step 0.5: `upstream/main` fetch, fork main 동기화
  │
  ├─ Phase 1 (병렬):
  │   ├─ PR #1: unified-shell 브랜치에서 feature diff 추출 → 새 브랜치 → push → CI 확인
  │   ├─ PR #2: error-interception 브랜치에서 squash/분할 → 새 브랜치 → push → CI 확인
  │   ├─ PR #4C: 이미 CI 통과 → upstream에 PR 열기
  │   └─ PR #4B: CI 확인 + 수정 → push
  │
  ├─ Phase 1 완료 조건: #1, #2, #4C, #4B 전부 CI 통과
  │
  ├─ Phase 2:
  │   ├─ fork main 동기화 (upstream에 머지된 PR 반영)
  │   ├─ PR #3: mimo 고유 커밋 6개 추출 → #2 위에 rebase → push → CI 확인
  │   ├─ PR #4A: #1 위에 rebase → push → CI 확인
  │   └─ PR #5: #1 위에 rebase → push → CI 확인
  │
  ├─ Phase 2 완료 조건: #3, #4A, #5 전부 CI 통과
  │
  ├─ Phase 3:
  │   ├─ fork main 동기화
  │   └─ PR #4D: #4B 위에 rebase → push → CI 확인 + 수정
  │
  ├─ Phase 3 완료 조건: #4D CI 통과
  │
  └─ 최종: 전부 CI 통과 확인 → upstream에 순차적으로 PR 열기
```

---

## 6. CI 통과 기준

모든 PR이 다음 jobs을 통과해야 함:
- ✅ compile (lint + types)
- ✅ dependency-review
- ✅ platform-unit-test (ubuntu + windows)
- ✅ knip
- ✅ check-translations
- ✅ invisible-chars

---

## 7. Crow Memory에서 로드할 것

- User Preferences: VP가 직접 코드 수정 금지, delegation only
- Project Context: Zoo Code는 VS Code extension (pnpm monorepo)
- Past Decisions: local-usage-stats A/B/C/D 분할 결정, merge 순서 결정

---

## 8. 참고 문서

- 5-branch split plan: `docs/260727_0001_session_split-pr-plan/full-5branch-split-plan.md`
- Original split plan (local-usage-stats): `docs/260727_0001_session_split-pr-plan/split-pr-plan.md`
- Session reports: `docs/260727_0001_session_split-pr-plan/`

---

## 9. 위험 요소

| 위험 | 설명 | 완화 |
|------|------|------|
| 🔴 unified-shell 규모 | upstream merge 포함 189 파일 | feature diff만 추출 |
| 🔴 error-interception 커밋 수 | 18개 커밋 | squash 또는 분할 |
| 🟡 mimo가 error-interception 포함 | 고유 커밋 6개 추출 필요 | cherry-pick |
| 🟡 task-dnd-ux 규모 | upstream merge 포함 203 파일 | feature diff만 추출 |
| 🟢 local-usage-stats | 이미 분할 완료, CI 수정 진행 중 | 기존 작업 재활용 |
