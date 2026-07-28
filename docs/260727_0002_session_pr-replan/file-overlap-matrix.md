# File Overlap Matrix

## Metadata

| Key | Value |
|---|---|
| Baseline | `main@d27153a251d2051b6a8e73d305b06ffbc5ac6970` |
| Shell set | Merge-base-to-branch net files, 61 |
| Error set | Merge-base-to-branch net files, 26 |
| Mimo set | Six exclusive commits from `d17049f01` through `b7edba688`, 20 |
| Stats set | Merge-base-to-branch net files, 190 |
| DnD set | Merge-base-to-branch net files, 89 |
| Generated from | Stable refs verified before report creation |

## Count Matrix

| branch | shell | error | mimo-exclusive | stats | dnd |
|---|---:|---:|---:|---:|---:|
| shell | 61 | 0 | 3 | 4 | 3 |
| error | 0 | 26 | 5 | 1 | 0 |
| mimo-exclusive | 3 | 5 | 20 | 3 | 0 |
| stats | 4 | 1 | 3 | 190 | 11 |
| dnd | 3 | 0 | 0 | 11 | 89 |

## Pairwise Exact Paths

### shell x error, 0

No shared files.

### shell x mimo-exclusive, 3

| path |
|---|
| [src/core/prompts/tools/native-tools/execute_command.ts](../../src/core/prompts/tools/native-tools/execute_command.ts) |
| [src/core/task/Task.ts](../../src/core/task/Task.ts) |
| [src/core/tools/ExecuteCommandTool.ts](../../src/core/tools/ExecuteCommandTool.ts) |

### shell x stats, 4

| path |
|---|
| [packages/types/src/vscode-extension-host.ts](../../packages/types/src/vscode-extension-host.ts) |
| [src/core/task/Task.ts](../../src/core/task/Task.ts) |
| [src/core/webview/ClineProvider.ts](../../src/core/webview/ClineProvider.ts) |
| [src/core/webview/webviewMessageHandler.ts](../../src/core/webview/webviewMessageHandler.ts) |

### shell x dnd, 3

| path |
|---|
| [packages/types/src/vscode-extension-host.ts](../../packages/types/src/vscode-extension-host.ts) |
| [src/core/webview/ClineProvider.ts](../../src/core/webview/ClineProvider.ts) |
| [src/core/webview/webviewMessageHandler.ts](../../src/core/webview/webviewMessageHandler.ts) |

### error x mimo-exclusive, 5

| path |
|---|
| [src/core/assistant-message/NativeToolCallParser.ts](../../src/core/assistant-message/NativeToolCallParser.ts) |
| [src/core/assistant-message/presentAssistantMessage.ts](../../src/core/assistant-message/presentAssistantMessage.ts) |
| [src/core/assistant-message/__tests__/NativeToolCallParser.spec.ts](../../src/core/assistant-message/__tests__/NativeToolCallParser.spec.ts) |
| [src/core/assistant-message/__tests__/presentAssistantMessage-parser-dedup.integration.spec.ts](../../src/core/assistant-message/__tests__/presentAssistantMessage-parser-dedup.integration.spec.ts) |
| [src/core/tools/error-interception/StructuralValidator.ts](../../src/core/tools/error-interception/StructuralValidator.ts) |

### error x stats, 1

| path |
|---|
| [.gitignore](../../.gitignore) |

### error x dnd, 0

No shared files.

### mimo-exclusive x stats, 3

| path |
|---|
| [packages/types/src/providers/mimo.ts](../../packages/types/src/providers/mimo.ts) |
| [src/api/providers/__tests__/mimo.spec.ts](../../src/api/providers/__tests__/mimo.spec.ts) |
| [src/core/task/Task.ts](../../src/core/task/Task.ts) |

### mimo-exclusive x dnd, 0

No shared files.

### stats x dnd, 11

| path |
|---|
| [packages/types/src/index.ts](../../packages/types/src/index.ts) |
| [packages/types/src/task-organization.ts](../../packages/types/src/task-organization.ts) |
| [packages/types/src/vscode-extension-host.ts](../../packages/types/src/vscode-extension-host.ts) |
| [src/core/task-persistence/TaskOrganizationStore.ts](../../src/core/task-persistence/TaskOrganizationStore.ts) |
| [src/core/task-persistence/index.ts](../../src/core/task-persistence/index.ts) |
| [src/core/task-persistence/__tests__/TaskOrganizationStore.spec.ts](../../src/core/task-persistence/__tests__/TaskOrganizationStore.spec.ts) |
| [src/core/webview/ClineProvider.ts](../../src/core/webview/ClineProvider.ts) |
| [src/core/webview/taskOrganizationMessageHandler.ts](../../src/core/webview/taskOrganizationMessageHandler.ts) |
| [src/core/webview/webviewMessageHandler.ts](../../src/core/webview/webviewMessageHandler.ts) |
| [src/shared/globalFileNames.ts](../../src/shared/globalFileNames.ts) |
| [src/utils/safeWriteJson.ts](../../src/utils/safeWriteJson.ts) |

## Mimo Exclusive File Manifest, 20

| status | path |
|---|---|
| M | [packages/telemetry/src/TelemetryService.ts](../../packages/telemetry/src/TelemetryService.ts) |
| M | [packages/types/src/model.ts](../../packages/types/src/model.ts) |
| M | [packages/types/src/providers/mimo.ts](../../packages/types/src/providers/mimo.ts) |
| M | [packages/types/src/telemetry.ts](../../packages/types/src/telemetry.ts) |
| M | [src/api/index.ts](../../src/api/index.ts) |
| M | [src/api/providers/__tests__/mimo.spec.ts](../../src/api/providers/__tests__/mimo.spec.ts) |
| M | [src/api/providers/mimo.ts](../../src/api/providers/mimo.ts) |
| M | [src/core/assistant-message/NativeToolCallParser.ts](../../src/core/assistant-message/NativeToolCallParser.ts) |
| A | [src/core/assistant-message/ToolCallRetentionPolicy.ts](../../src/core/assistant-message/ToolCallRetentionPolicy.ts) |
| M | [src/core/assistant-message/__tests__/NativeToolCallParser.spec.ts](../../src/core/assistant-message/__tests__/NativeToolCallParser.spec.ts) |
| A | [src/core/assistant-message/__tests__/ToolCallRetentionPolicy-telemetry.spec.ts](../../src/core/assistant-message/__tests__/ToolCallRetentionPolicy-telemetry.spec.ts) |
| A | [src/core/assistant-message/__tests__/ToolCallRetentionPolicy.spec.ts](../../src/core/assistant-message/__tests__/ToolCallRetentionPolicy.spec.ts) |
| M | [src/core/assistant-message/__tests__/presentAssistantMessage-parser-dedup.integration.spec.ts](../../src/core/assistant-message/__tests__/presentAssistantMessage-parser-dedup.integration.spec.ts) |
| M | [src/core/assistant-message/presentAssistantMessage.ts](../../src/core/assistant-message/presentAssistantMessage.ts) |
| M | [src/core/prompts/tools/native-tools/execute_command.ts](../../src/core/prompts/tools/native-tools/execute_command.ts) |
| M | [src/core/task/Task.ts](../../src/core/task/Task.ts) |
| A | [src/core/task/__tests__/tool-call-policy.spec.ts](../../src/core/task/__tests__/tool-call-policy.spec.ts) |
| M | [src/core/tools/ExecuteCommandTool.ts](../../src/core/tools/ExecuteCommandTool.ts) |
| M | [src/core/tools/error-interception/StructuralValidator.ts](../../src/core/tools/error-interception/StructuralValidator.ts) |
| M | [src/shared/tools.ts](../../src/shared/tools.ts) |

## Shared Module Matrix

| module | shell | error | mimo-exclusive | stats | dnd |
|---|---:|---:|---:|---:|---:|
| [packages/types](../../packages/types/) | 1 | 0 | 1 | 1 | 1 |
| [src/api/providers](../../src/api/providers/) | 0 | 0 | 1 | 1 | 0 |
| [src/core/assistant-message](../../src/core/assistant-message/) | 0 | 1 | 1 | 0 | 0 |
| [src/core/prompts](../../src/core/prompts/) | 1 | 0 | 1 | 0 | 0 |
| [src/core/task](../../src/core/task/) | 1 | 0 | 1 | 1 | 0 |
| [src/core/task-persistence](../../src/core/task-persistence/) | 0 | 0 | 0 | 1 | 1 |
| [src/core/tools](../../src/core/tools/) | 1 | 1 | 1 | 0 | 0 |
| [src/core/webview](../../src/core/webview/) | 1 | 0 | 0 | 1 | 1 |
| [src/shared](../../src/shared/) | 0 | 0 | 1 | 1 | 1 |
| [src/utils](../../src/utils/) | 1 | 0 | 0 | 1 | 1 |
| [webview-ui/src/i18n](../../webview-ui/src/i18n/) | 1 | 0 | 0 | 1 | 1 |

## Independence Vector

| branch | zero-overlap-with-all-others |
|---|---:|
| shell | false |
| error | false |
| mimo-exclusive | false |
| stats | false |
| dnd | false |

## Combined-Only Path Manifest, 11

| status | path | insertions | deletions |
|---|---|---:|---:|
| M | [apps/vscode-e2e/src/fixtures/terminal-reuse-shell-race.ts](../../apps/vscode-e2e/src/fixtures/terminal-reuse-shell-race.ts) | 12 | 1 |
| A | [check-git-status.ps1](../../check-git-status.ps1) | 24 | 0 |
| A | [do-push.sh](../../do-push.sh) | 2 | 0 |
| A | [push.ps1](../../push.ps1) | 1 | 0 |
| A | [src/api/providers/__tests__/openai-compatible.spec.ts](../../src/api/providers/__tests__/openai-compatible.spec.ts) | 170 | 0 |
| M | [src/api/providers/bedrock.ts](../../src/api/providers/bedrock.ts) | 28 | 8 |
| M | [src/api/providers/deepseek.ts](../../src/api/providers/deepseek.ts) | 16 | 4 |
| M | [src/api/providers/openai-compatible.ts](../../src/api/providers/openai-compatible.ts) | 13 | 2 |
| M | [src/api/providers/poe.ts](../../src/api/providers/poe.ts) | 15 | 0 |
| M | [src/api/providers/qwen-code.ts](../../src/api/providers/qwen-code.ts) | 13 | 2 |
| M | [src/api/providers/xai.ts](../../src/api/providers/xai.ts) | 6 | 1 |

## Parsing Notes

- A cell value of `1` in the module matrix means the branch touches at least one path in that module; it is not a file count.
- Diagonal values in the count matrix are branch manifest sizes.
- Pairwise values use set intersection, so every listed path is unique within its pair.
- Mimo inheritance is intentionally removed. An ancestry-inclusive Error x Mimo comparison would show 24 shared files and would overstate the conflict surface of the six Mimo commits.
