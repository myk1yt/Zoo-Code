import { serializeError } from "serialize-error"
import { Anthropic } from "@anthropic-ai/sdk"

import {
	createToolErrorInterceptor,
	getErrorTitleFromGuided,
	getTaskErrorState,
	validateCwdParameter,
	validateNestedParams,
} from "../tools/error-interception"

import type { ToolName, ClineAsk, ToolProgressStatus } from "@roo-code/types"
import { ConsecutiveMistakeError, TelemetryEventName } from "@roo-code/types"
import { TelemetryService } from "@roo-code/telemetry"
import { customToolRegistry } from "@roo-code/core"

import { t } from "../../i18n"

import { defaultModeSlug, getModeBySlug } from "../../shared/modes"
import type { ToolParamName, ToolResponse, ToolUse, McpToolUse } from "../../shared/tools"
import type { AssistantMessageContent } from "./types"

import { AskIgnoredError } from "../task/AskIgnoredError"
import { Task } from "../task/Task"
import { NativeToolCallParser, type NativeToolParseFailure } from "./NativeToolCallParser"
import { selectExecutableCall, emitMaxOneEnforcementTelemetry } from "./ToolCallRetentionPolicy"
import { resolveToolCallPolicy } from "../../api"

import { listFilesTool } from "../tools/ListFilesTool"
import { readFileTool } from "../tools/ReadFileTool"
import { readCommandOutputTool } from "../tools/ReadCommandOutputTool"
import { writeToFileTool } from "../tools/WriteToFileTool"
import { editTool } from "../tools/EditTool"
import { searchReplaceTool } from "../tools/SearchReplaceTool"
import { editFileTool } from "../tools/EditFileTool"
import { applyPatchTool } from "../tools/ApplyPatchTool"
import { searchFilesTool } from "../tools/SearchFilesTool"
import { executeCommandTool } from "../tools/ExecuteCommandTool"
import { useMcpToolTool } from "../tools/UseMcpToolTool"
import { accessMcpResourceTool } from "../tools/accessMcpResourceTool"
import { askFollowupQuestionTool } from "../tools/AskFollowupQuestionTool"
import { switchModeTool } from "../tools/SwitchModeTool"
import { attemptCompletionTool, AttemptCompletionCallbacks } from "../tools/AttemptCompletionTool"
import { newTaskTool } from "../tools/NewTaskTool"
import { updateTodoListTool } from "../tools/UpdateTodoListTool"
import { runSlashCommandTool } from "../tools/RunSlashCommandTool"
import { skillTool } from "../tools/SkillTool"
import { generateImageTool } from "../tools/GenerateImageTool"
import { applyDiffTool as applyDiffToolClass } from "../tools/ApplyDiffTool"
import { isValidToolName, validateToolUse } from "../tools/validateToolUse"
import { codebaseSearchTool } from "../tools/CodebaseSearchTool"

import { formatResponse } from "../prompts/responses"
import { sanitizeToolUseId } from "../../utils/tool-id"

/**
 * Module-scoped interceptor singleton. A single shared instance keeps the
 * per-task WeakMap alive across content blocks within the same Task, so
 * occurrence counters and circuit breakers persist between tool blocks.
 * Recreating one per block would reset all per-task counters to empty.
 */
const toolErrorInterceptor = createToolErrorInterceptor()

/**
 * Processes and presents assistant message content to the user interface.
 *
 * This function is the core message handling system that:
 * - Sequentially processes content blocks from the assistant's response.
 * - Displays text content to the user.
 * - Executes tool use requests with appropriate user approval.
 * - Manages the flow of conversation by determining when to proceed to the next content block.
 * - Coordinates file system checkpointing for modified files.
 * - Controls the conversation state to determine when to continue to the next request.
 *
 * The function uses a locking mechanism to prevent concurrent execution and handles
 * partial content blocks during streaming. It's designed to work with the streaming
 * API response pattern, where content arrives incrementally and needs to be processed
 * as it becomes available.
 */

export async function presentAssistantMessage(cline: Task) {
	if (cline.abort) {
		return
	}

	if (cline.presentAssistantMessageLocked) {
		cline.presentAssistantMessageHasPendingUpdates = true
		return
	}

	cline.presentAssistantMessageLocked = true
	cline.presentAssistantMessageHasPendingUpdates = false

	if (cline.currentStreamingContentIndex >= cline.assistantMessageContent.length) {
		// This may happen if the last content block was completed before
		// streaming could finish. If streaming is finished, and we're out of
		// bounds then this means we already  presented/executed the last
		// content block and are ready to continue to next request.
		if (cline.didCompleteReadingStream) {
			cline.userMessageContentReady = true
		}

		cline.presentAssistantMessageLocked = false
		return
	}

	let block: AssistantMessageContent | undefined
	try {
		// Performance optimization: Use shallow copy instead of deep clone.
		// The block is used read-only throughout this function - we never mutate its properties.
		// We only need to protect against the reference changing during streaming, not nested mutations.
		// This provides 80-90% reduction in cloning overhead (5-100ms saved per block).
		block = { ...cline.assistantMessageContent[cline.currentStreamingContentIndex] }
	} catch (error) {
		console.error(`ERROR cloning block:`, error)
		console.error(
			`Block content:`,
			JSON.stringify(cline.assistantMessageContent[cline.currentStreamingContentIndex], null, 2),
		)
		cline.presentAssistantMessageLocked = false
		return
	}

	if (!block) {
		cline.presentAssistantMessageLocked = false
		return
	}

	switch (block.type) {
		case "mcp_tool_use": {
			// Handle native MCP tool calls (from mcp_serverName_toolName dynamic tools)
			// These are converted to the same execution path as use_mcp_tool but preserve
			// their original name in API history
			const mcpBlock = block as McpToolUse
			const interceptor = toolErrorInterceptor

			if (cline.didRejectTool) {
				// For native protocol, we must send a tool_result for every tool_use to avoid API errors
				const toolCallId = mcpBlock.id
				const errorMessage = !mcpBlock.partial
					? `Skipping MCP tool ${mcpBlock.name} due to user rejecting a previous tool.`
					: `MCP tool ${mcpBlock.name} was interrupted and not executed due to user rejecting a previous tool.`

				if (toolCallId) {
					// Consume any pending native protocol guide so it cannot leak
					// into later turns when this early tool_result path is taken.
					const rejectedMcpGuide = getTaskErrorState(cline).consumePendingNativeProtocolGuide()
					cline.pushToolResultToUserContent({
						type: "tool_result",
						tool_use_id: sanitizeToolUseId(toolCallId),
						content: rejectedMcpGuide ? `${errorMessage}\n\n${rejectedMcpGuide}` : errorMessage,
						is_error: true,
					})
				}
				break
			}

			// Track if we've already pushed a tool result
			let hasToolResult = false
			const toolCallId = mcpBlock.id

			// Store approval feedback to merge into tool result (GitHub #10465)
			let approvalFeedback: { text: string; images?: string[] } | undefined

			const rawPushToolResult = (content: ToolResponse, feedbackImages?: string[]) => {
				if (hasToolResult) {
					console.warn(
						`[presentAssistantMessage] Skipping duplicate tool_result for mcp_tool_use: ${toolCallId}`,
					)
					return
				}

				let resultContent: string
				let imageBlocks: Anthropic.ImageBlockParam[] = []

				if (typeof content === "string") {
					resultContent = content || "(tool did not return anything)"
				} else {
					const textBlocks = content.filter((item) => item.type === "text")
					imageBlocks = content.filter((item) => item.type === "image") as Anthropic.ImageBlockParam[]
					resultContent =
						textBlocks.map((item) => (item as Anthropic.TextBlockParam).text).join("\n") ||
						"(tool did not return anything)"
				}

				// Merge approval feedback into tool result (GitHub #10465)
				if (approvalFeedback) {
					const feedbackText = formatResponse.toolApprovedWithFeedback(approvalFeedback.text)
					resultContent = `${feedbackText}\n\n${resultContent}`

					// Add feedback images to the image blocks
					if (approvalFeedback.images) {
						const feedbackImageBlocks = formatResponse.imageBlocks(approvalFeedback.images)
						imageBlocks = [...feedbackImageBlocks, ...imageBlocks]
					}
				}

				if (toolCallId) {
					// Merge any pending XML_NATIVE_DUAL_PROTOCOL guide into this
					// tool_result and clear it so it cannot leak into later turns.
					const mcpPendingGuide = getTaskErrorState(cline).consumePendingNativeProtocolGuide()
					if (mcpPendingGuide) {
						resultContent = `${resultContent}\n\n${mcpPendingGuide}`
					}
					cline.pushToolResultToUserContent({
						type: "tool_result",
						tool_use_id: sanitizeToolUseId(toolCallId),
						content: resultContent,
					})

					if (imageBlocks.length > 0) {
						cline.userMessageContent.push(...imageBlocks)
					}
				}

				hasToolResult = true
			}

			const toolDescription = () => `[mcp_tool: ${mcpBlock.serverName}/${mcpBlock.toolName}]`

			const askApproval = async (
				type: ClineAsk,
				partialMessage?: string,
				progressStatus?: ToolProgressStatus,
				isProtected?: boolean,
			) => {
				const { response, text, images } = await cline.ask(
					type,
					partialMessage,
					false,
					progressStatus,
					isProtected || false,
				)

				if (response !== "yesButtonClicked") {
					if (text) {
						await cline.say("user_feedback", text, images)
						pushToolResult(formatResponse.toolResult(formatResponse.toolDeniedWithFeedback(text), images))
					} else {
						pushToolResult(formatResponse.toolDenied())
					}
					cline.didRejectTool = true
					return false
				}

				// Store approval feedback to be merged into tool result (GitHub #10465)
				// Don't push it as a separate tool_result here - that would create duplicates.
				// The tool will call pushToolResult, which will merge the feedback into the actual result.
				if (text) {
					await cline.say("user_feedback", text, images)
					approvalFeedback = { text, images }
				}

				return true
			}

			const rawHandleError = async (action: string, error: Error) => {
				// Silently ignore AskIgnoredError - this is an internal control flow
				// signal, not an actual error. It occurs when a newer ask supersedes an older one.
				if (error instanceof AskIgnoredError) {
					return
				}
				const errorString = `Error ${action}: ${JSON.stringify(serializeError(error))}`
				await cline.say(
					"error",
					`Error ${action}:\n${error.message ?? JSON.stringify(serializeError(error), null, 2)}`,
				)
				rawPushToolResult(formatResponse.toolError(errorString))
			}

			const { decoratedHandleError: handleError, decoratedPushToolResult: pushToolResult } =
				interceptor.createInterceptor(
					cline,
					{ handleError: rawHandleError, pushToolResult: rawPushToolResult },
					{
						taskId: cline.taskId,
						toolCallId,
						toolName: mcpBlock.name,
						source: "tool_result",
						stage: "result",
						metadata: {
							server: mcpBlock.serverName,
							tool: mcpBlock.toolName,
						},
					},
				)

			if (!mcpBlock.partial) {
				cline.recordToolUsage("use_mcp_tool") // Record as use_mcp_tool for analytics
				TelemetryService.instance.captureToolUsage(cline.taskId, "use_mcp_tool")
			}

			// Resolve sanitized server name back to original server name
			// The serverName from parsing is sanitized (e.g., "my_server" from "my server")
			// We need the original name to find the actual MCP connection
			const mcpHub = cline.providerRef.deref()?.getMcpHub()
			let resolvedServerName = mcpBlock.serverName
			if (mcpHub) {
				const originalName = mcpHub.findServerNameBySanitizedName(mcpBlock.serverName)
				if (originalName) {
					resolvedServerName = originalName
				}
			}

			// Execute the MCP tool using the same handler as use_mcp_tool
			// Create a synthetic ToolUse block that the useMcpToolTool can handle
			const syntheticToolUse: ToolUse<"use_mcp_tool"> = {
				type: "tool_use",
				id: mcpBlock.id,
				name: "use_mcp_tool",
				params: {
					server_name: resolvedServerName,
					tool_name: mcpBlock.toolName,
					arguments: JSON.stringify(mcpBlock.arguments),
				},
				partial: mcpBlock.partial,
				nativeArgs: {
					server_name: resolvedServerName,
					tool_name: mcpBlock.toolName,
					arguments: mcpBlock.arguments,
				},
			}

			await useMcpToolTool.handle(cline, syntheticToolUse, {
				askApproval,
				handleError,
				pushToolResult,
			})
			break
		}
		case "text": {
			if (cline.didRejectTool || cline.didAlreadyUseTool) {
				break
			}

			let content = block.content

			if (content) {
				// Have to do this for partial and complete since sending
				// content in thinking tags to markdown renderer will
				// automatically be removed.
				// Strip any streamed <thinking> tags from text output.
				content = content.replace(/<thinking>\s?/g, "")
				content = content.replace(/\s?<\/thinking>/g, "")
			}

			// XML_NATIVE_DUAL_PROTOCOL detection: only on complete text blocks.
			// If this text contains executable XML tool markup AND the same
			// assistant turn also contains a native tool_use block, strip only
			// the markup segment from the rendered text and queue one bounded
			// protocol guide to merge into the native tool's result.
			if (content && !block.partial && content.length <= 10_000) {
				// Length cap (4000 chars) on each XML segment prevents catastrophic
				// backtracking when the input contains malformed/unterminated tags.
				const XML_TOOL_MARKUP =
					/<tool_call>[\s\S]{0,4000}?(<\/tool_call>|$)|<invoke>[\s\S]{0,4000}?(<\/invoke>|$)|<function=[^>]+>[\s\S]{0,4000}?(<\/function>|$)|<parameter=[^>]+>[\s\S]{0,4000}?(<\/parameter>|$)/g
				const hasXmlMarkup = /<(tool_call|invoke|function=[^>]+|parameter=[^>]+)>/.test(content)
				if (hasXmlMarkup) {
					const nativeToolPresent = cline.assistantMessageContent.some(
						(b: AssistantMessageContent) =>
							(b.type === "tool_use" || b.type === "mcp_tool_use") &&
							!b.partial &&
							(b.id !== undefined || b.type === "mcp_tool_use"),
					)
					if (nativeToolPresent) {
						// Strip the XML markup from the user-visible text.
						content = content.replace(XML_TOOL_MARKUP, "").trim()
						// Queue one protocol guide on the Task-scoped error state so
						// the next native tool_result carries the warning.
						const taskErrorState = getTaskErrorState(cline)
						const occurrence = taskErrorState.incrementOccurrence("INVALID_TOOL_PROTOCOL")
						taskErrorState.setFingerprint(
							"INVALID_TOOL_PROTOCOL",
							"INVALID_TOOL_PROTOCOL|XML_NATIVE_DUAL_PROTOCOL|text-block",
						)
						taskErrorState.setPendingNativeProtocolGuide(
							`[XML_NATIVE_DUAL_PROTOCOL occurrence=${occurrence}] XML tool calls are not supported. ` +
								`Use native tool_use only. The XML markup was removed from the visible text; only the native tool call was executed.`,
						)
					}
				}
			}

			await cline.say("text", content, undefined, block.partial)
			break
		}
		case "tool_use": {
			// Native tool calling is the only supported tool calling mechanism.
			// A tool_use block without an id is invalid and cannot be executed.
			const interceptor = toolErrorInterceptor
			const toolCallId = block.id
			if (!toolCallId) {
				const errorMessage =
					"Invalid tool call: missing tool_use.id. XML tool calls are no longer supported. Remove any XML tool markup (e.g. <read_file>...</read_file>) and use native tool calling instead."
				// Record a tool error for visibility/telemetry. Use the reported tool name if present.
				try {
					if (typeof cline.recordToolError === "function" && typeof block.name === "string") {
						cline.recordToolError(block.name, errorMessage)
					}
				} catch (recordErr) {
					console.warn(
						"[ErrorInterception] Failed to record tool error:",
						recordErr instanceof Error ? recordErr.message : recordErr,
					)
				}
				cline.consecutiveMistakeCount++
				const guided = interceptor.transformError(cline, {
					source: "parser",
					stage: "parse",
					taskId: cline.taskId,
					metadata: { missingToolCallId: true },
				})
				const errorTitle = getErrorTitleFromGuided(guided)
				await cline.say("error", `${errorTitle}\n\n${guided ?? errorMessage}`)
				cline.userMessageContent.push({ type: "text", text: guided ?? errorMessage })
				cline.didAlreadyUseTool = true
				break
			}

			// Fetch state early so it's available for toolDescription and validation
			const state = await cline.providerRef.deref()?.getState()
			const { mode, customModes, experiments: stateExperiments, disabledTools } = state ?? {}

			const toolDescription = (): string => {
				switch (block.name) {
					case "execute_command":
						return `[${block.name} for '${block.params.command}']`
					case "read_file":
						// Prefer native typed args when available; fall back to legacy params
						// Check if nativeArgs exists (native protocol)
						if (block.nativeArgs) {
							return readFileTool.getReadFileToolDescription(
								block.name,
								block.nativeArgs as { path?: string },
							)
						}
						return readFileTool.getReadFileToolDescription(block.name, block.params)
					case "write_to_file":
						return `[${block.name} for '${block.params.path}']`
					case "apply_diff":
						// Native-only: tool args are structured (no XML payloads).
						return block.params?.path ? `[${block.name} for '${block.params.path}']` : `[${block.name}]`
					case "search_files":
						return `[${block.name} for '${block.params.regex}'${
							block.params.file_pattern ? ` in '${block.params.file_pattern}'` : ""
						}]`
					case "edit":
					case "search_and_replace":
						return `[${block.name} for '${block.params.file_path}']`
					case "search_replace":
						return `[${block.name} for '${block.params.file_path}']`
					case "edit_file":
						return `[${block.name} for '${block.params.file_path}']`
					case "apply_patch":
						return `[${block.name}]`
					case "list_files":
						return `[${block.name} for '${block.params.path}']`
					case "use_mcp_tool":
						return `[${block.name} for '${block.params.server_name}']`
					case "access_mcp_resource":
						return `[${block.name} for '${block.params.server_name}']`
					case "ask_followup_question":
						return `[${block.name} for '${block.params.question}']`
					case "attempt_completion":
						return `[${block.name}]`
					case "switch_mode":
						return `[${block.name} to '${block.params.mode_slug}'${block.params.reason ? ` because: ${block.params.reason}` : ""}]`
					case "codebase_search":
						return `[${block.name} for '${block.params.query}']`
					case "read_command_output":
						return `[${block.name} for '${block.params.artifact_id}']`
					case "update_todo_list":
						return `[${block.name}]`
					case "new_task": {
						const mode = block.params.mode ?? defaultModeSlug
						const message = block.params.message ?? "(no message)"
						const modeName = getModeBySlug(mode, customModes)?.name ?? mode
						return `[${block.name} in ${modeName} mode: '${message}']`
					}
					case "run_slash_command":
						return `[${block.name} for '${block.params.command}'${block.params.args ? ` with args: ${block.params.args}` : ""}]`
					case "skill":
						return `[${block.name} for '${block.params.skill}'${block.params.args ? ` with args: ${block.params.args}` : ""}]`
					case "generate_image":
						return `[${block.name} for '${block.params.path}']`
					default:
						return `[${block.name}]`
				}
			}

			if (cline.didRejectTool) {
				// Ignore any tool content after user has rejected tool once.
				// For native tool calling, we must send a tool_result for every tool_use to avoid API errors
				const errorMessage = !block.partial
					? `Skipping tool ${toolDescription()} due to user rejecting a previous tool.`
					: `Tool ${toolDescription()} was interrupted and not executed due to user rejecting a previous tool.`

				// Consume any pending native protocol guide so it cannot leak
				// into later turns when this early tool_result path is taken.
				const rejectedGuide = getTaskErrorState(cline).consumePendingNativeProtocolGuide()
				cline.pushToolResultToUserContent({
					type: "tool_result",
					tool_use_id: sanitizeToolUseId(toolCallId),
					content: rejectedGuide ? `${errorMessage}\n\n${rejectedGuide}` : errorMessage,
					is_error: true,
				})

				break
			}

			// Track if we've already pushed a tool result for this tool call (native tool calling only)
			let hasToolResult = false

			// If this is a native tool call but the parser couldn't construct nativeArgs
			// (e.g., malformed/unfinished JSON in a streaming tool call), we must NOT attempt to
			// execute the tool. Instead, emit exactly one structured tool_result so the provider
			// receives a matching tool_result for the tool_use_id.
			//
			// This avoids executing an invalid tool_use block and prevents duplicate/fragmented
			// error reporting.
			if (!block.partial) {
				const customTool = stateExperiments?.customTools ? customToolRegistry.get(block.name) : undefined
				const isKnownTool = isValidToolName(String(block.name), stateExperiments)
				if (isKnownTool && !block.nativeArgs && !customTool) {
					// Consume the typed parser failure descriptor. This provides a
					// precise failure kind (json_syntax, missing_required_arguments,
					// or invalid_argument_shape) instead of relying on raw error
					// strings. The legacy consumeParseError() string is still
					// consumed for backward-compatible diagnostics.
					const parseFailure: NativeToolParseFailure | undefined =
						NativeToolCallParser.consumeParseFailure(toolCallId)
					// Also consume the legacy string for human-readable diagnostics.
					NativeToolCallParser.consumeParseError(toolCallId)

					// Derive safe sibling facts: inspect same-turn tool_use blocks
					// with distinct call identifiers. If a valid sibling exists
					// alongside this malformed sibling, set validSiblingPresent.
					// Do NOT forward sibling identifiers or argument values.
					const validSiblingPresent = cline.assistantMessageContent.some(
						(sibling: AssistantMessageContent) =>
							sibling.type === "tool_use" &&
							sibling.id !== toolCallId &&
							!sibling.partial &&
							sibling.nativeArgs !== undefined,
					)

					// Route based on the typed failure kind. Each kind maps to a
					// dedicated error-interception pattern:
					//   json_syntax → PARSER_FAILURE_JSON_SYNTAX
					//   missing_required_arguments → PARSER_FAILURE_MISSING_ARGS
					//   invalid_argument_shape → PARSER_FAILURE_INVALID_SHAPE
					// When no typed failure is recorded (e.g. the parser never
					// ran), fall back to the legacy missingNativeArgs signal which
					// routes to PARAM_MISSING.
					const parseFailureKind = parseFailure?.kind
					const metadata: Record<string, unknown> = parseFailureKind
						? {
								parseFailureKind,
								emptyArguments: parseFailure?.emptyArguments ?? false,
								missingRequiredParameters: parseFailure?.missingParameters ?? [],
								validSiblingPresent,
							}
						: { missingNativeArgs: true, validSiblingPresent }

					// Build a concise, user-visible error message based on the
					// failure kind. The user sees a clear tool name, failure kind,
					// and concise reason.
					const failureDescription = parseFailure
						? parseFailure.kind === "json_syntax"
							? `arguments could not be parsed as JSON (syntax error).`
							: parseFailure.kind === "missing_required_arguments"
								? `missing required arguments: ${(parseFailure.missingParameters ?? []).join(", ") || "unknown"}.`
								: `arguments had an invalid structural shape.`
						: `missing nativeArgs. The model streamed invalid or incomplete arguments and the call could not be finalized.`

					const errorMessage = `Invalid tool call for '${block.name}': ${failureDescription}`

					cline.consecutiveMistakeCount++
					try {
						cline.recordToolError(block.name as ToolName, errorMessage)
					} catch (recordErr) {
						console.warn(
							"[ErrorInterception] Failed to record tool error:",
							recordErr instanceof Error ? recordErr.message : recordErr,
						)
					}

					// Convert the parser failure into a structured guided payload.
					// The interceptor classifies the signal using the parseFailureKind
					// metadata and routes to the appropriate PARSER_FAILURE_* pattern.
					const guided = interceptor.transformError(cline, {
						source: "parser",
						stage: "parse",
						taskId: cline.taskId,
						toolCallId,
						toolName: block.name,
						metadata,
					})

					// Push tool_result directly without setting didAlreadyUseTool so streaming can
					// continue gracefully. The existing pushToolResultToUserContent()
					// dedups by tool_use_id, ensuring exactly one error result per
					// failed identifier.
					const missingArgsGuide = getTaskErrorState(cline).consumePendingNativeProtocolGuide()
					const missingArgsBase = guided ?? formatResponse.toolError(errorMessage)
					// Show the invalid/missing args error to the user in the UI chat.
					// The AI receives the guided payload below; the user must also
					// see what went wrong (design principle: both must happen).
					const missingArgsUserMessage = guided
						? `${getErrorTitleFromGuided(guided)}\n\n${guided}`
						: `Invalid tool call: ${errorMessage}`
					await cline.say("error", missingArgsUserMessage)
					cline.pushToolResultToUserContent({
						type: "tool_result",
						tool_use_id: sanitizeToolUseId(toolCallId),
						content: missingArgsGuide ? `${missingArgsBase}\n\n${missingArgsGuide}` : missingArgsBase,
						is_error: true,
					})

					break
				}
			}

			// Max-one enforcement: under a single-call policy, at most one
			// structurally valid call may execute per assistant turn. If two
			// or more valid side-effecting calls arrive, neither auto-executes
			// — both receive error results instructing the model to resubmit
			// one call. This prevents ambiguous side-effect ordering when a
			// provider violates the single-call contract.
			//
			// This gate runs AFTER the malformed-call check above (which
			// handles calls without nativeArgs). Only calls that passed
			// structural validation reach this point.
			if (!block.partial) {
				const resolvedPolicy = resolveToolCallPolicy(
					cline.api.getModel().info,
					cline.apiConfiguration?.apiProvider,
				)

				if (resolvedPolicy.maxCallsPerTurn === 1) {
					// Collect all tool_use blocks in this assistant turn to
					// evaluate how many valid candidates exist.
					const allCalls = cline.assistantMessageContent
						.filter(
							(b: AssistantMessageContent): b is ToolUse =>
								b.type === "tool_use",
						)
						.map((b: ToolUse) => ({
							callId: b.id ?? "",
							toolName: b.name,
							hasNativeArgs: b.nativeArgs !== undefined,
							isPartial: b.partial,
						}))

					const selection = selectExecutableCall({
						calls: allCalls,
						maxCallsPerTurn: 1,
					})

					// If this call is in the rejected list (multiple valid
					// candidates under single policy), emit an error result
					// instead of executing.
					if (selection.rejectedCallIds.includes(toolCallId)) {
						const maxOneErrorMessage =
							`Multiple valid tool calls were emitted in a single turn under a single-call policy. ` +
							`This call was not executed to prevent ambiguous side-effect ordering. ` +
							`Please resubmit only one tool call per turn. ` +
							`[POLICY/max-one-enforcement/001]`
	
						// Emit telemetry for the max-one enforcement rejection.
						// Only counts and metadata are sent — no call ID, tool
						// name, argument values, or command strings.
						emitMaxOneEnforcementTelemetry({
							taskId: cline.taskId,
							provider: cline.apiConfiguration?.apiProvider ?? "unknown",
							model: cline.api.getModel().id,
							policySource: resolvedPolicy.source,
							maxCallsPerTurn: resolvedPolicy.maxCallsPerTurn,
							enforcement: resolvedPolicy.enforcement,
							callCount: allCalls.length,
							ghostDroppedCount: 0,
							errorResultCount: selection.rejectedCallIds.length,
							parallelToolCallsRequested: resolvedPolicy.generation === "parallel",
						})
	
						cline.consecutiveMistakeCount++
						try {
							cline.recordToolError(block.name as ToolName, maxOneErrorMessage)
						} catch (recordErr) {
							console.warn(
								"[ErrorInterception] Failed to record tool error:",
								recordErr instanceof Error ? recordErr.message : recordErr,
							)
						}

						const maxOneGuided = interceptor.transformError(cline, {
							source: "parser",
							stage: "parse",
							taskId: cline.taskId,
							toolCallId,
							toolName: block.name,
							metadata: {
								maxOneEnforcement: true,
								reason: selection.reason,
								rejectedCallCount: selection.rejectedCallIds.length,
							},
						})

						const maxOneBase = maxOneGuided ?? formatResponse.toolError(maxOneErrorMessage)
						const maxOneUserMessage = maxOneGuided
							? `${getErrorTitleFromGuided(maxOneGuided)}\n\n${maxOneGuided}`
							: maxOneErrorMessage
						await cline.say("error", maxOneUserMessage)
						cline.pushToolResultToUserContent({
							type: "tool_result",
							tool_use_id: sanitizeToolUseId(toolCallId),
							content: maxOneBase,
							is_error: true,
						})

						break
					}

					// If a different call was selected as the executable one,
					// this call should not execute. However, since execution is
					// serial and each call is processed in order, the selected
					// call will execute when its own block is processed. If
					// this is NOT the selected call but is valid, it means
					// another valid call exists — but selectExecutableCall
					// would have put both in rejectedCallIds. So if we reach
					// here with an executableCallId that is not ours, it's a
					// single-candidate scenario where we are that candidate.
				}
			}

			// Store approval feedback to merge into tool result (GitHub #10465)
			let approvalFeedback: { text: string; images?: string[] } | undefined

			const rawPushToolResult = (content: ToolResponse) => {
				// Native tool calling: only allow ONE tool_result per tool call
				if (hasToolResult) {
					console.warn(
						`[presentAssistantMessage] Skipping duplicate tool_result for tool_use_id: ${toolCallId}`,
					)
					return
				}

				let resultContent: string
				let imageBlocks: Anthropic.ImageBlockParam[] = []

				if (typeof content === "string") {
					resultContent = content || "(tool did not return anything)"
				} else {
					const textBlocks = content.filter((item) => item.type === "text")
					imageBlocks = content.filter((item) => item.type === "image") as Anthropic.ImageBlockParam[]
					resultContent =
						textBlocks.map((item) => (item as Anthropic.TextBlockParam).text).join("\n") ||
						"(tool did not return anything)"
				}

				// Merge any pending XML_NATIVE_DUAL_PROTOCOL guide into this native
				// tool's result. The native result remains primary; the warning is
				// appended once and then cleared so it cannot leak into later turns.
				const pendingGuide = getTaskErrorState(cline).consumePendingNativeProtocolGuide()
				if (pendingGuide) {
					resultContent = `${resultContent}\n\n${pendingGuide}`
				}

				// Merge approval feedback into tool result (GitHub #10465)
				if (approvalFeedback) {
					const feedbackText = formatResponse.toolApprovedWithFeedback(approvalFeedback.text)
					resultContent = `${feedbackText}\n\n${resultContent}`
					if (approvalFeedback.images) {
						const feedbackImageBlocks = formatResponse.imageBlocks(approvalFeedback.images)
						imageBlocks = [...feedbackImageBlocks, ...imageBlocks]
					}
				}

				cline.pushToolResultToUserContent({
					type: "tool_result",
					tool_use_id: sanitizeToolUseId(toolCallId),
					content: resultContent,
				})

				if (imageBlocks.length > 0) {
					cline.userMessageContent.push(...imageBlocks)
				}

				hasToolResult = true
			}

			const askApproval = async (
				type: ClineAsk,
				partialMessage?: string,
				progressStatus?: ToolProgressStatus,
				isProtected?: boolean,
			) => {
				const { response, text, images } = await cline.ask(
					type,
					partialMessage,
					false,
					progressStatus,
					isProtected || false,
				)

				if (response !== "yesButtonClicked") {
					// Handle both messageResponse and noButtonClicked with text.
					if (text) {
						await cline.say("user_feedback", text, images)
						pushToolResult(formatResponse.toolResult(formatResponse.toolDeniedWithFeedback(text), images))
					} else {
						pushToolResult(formatResponse.toolDenied())
					}
					cline.didRejectTool = true
					return false
				}

				// Store approval feedback to be merged into tool result (GitHub #10465)
				// Don't push it as a separate tool_result here - that would create duplicates.
				// The tool will call pushToolResult, which will merge the feedback into the actual result.
				if (text) {
					await cline.say("user_feedback", text, images)
					approvalFeedback = { text, images }
				}

				return true
			}

			const askFinishSubTaskApproval = async () => {
				// Ask the user to approve this task has completed, and he has
				// reviewed it, and we can declare task is finished and return
				// control to the parent task to continue running the rest of
				// the sub-tasks.
				const toolMessage = JSON.stringify({ tool: "finishTask" })
				return await askApproval("tool", toolMessage)
			}

			const rawHandleError = async (action: string, error: Error) => {
				// Silently ignore AskIgnoredError - this is an internal control flow
				// signal, not an actual error. It occurs when a newer ask supersedes an older one.
				if (error instanceof AskIgnoredError) {
					return
				}
				const errorString = `Error ${action}: ${JSON.stringify(serializeError(error))}`

				await cline.say(
					"error",
					`Error ${action}:\n${error.message ?? JSON.stringify(serializeError(error), null, 2)}`,
				)

				rawPushToolResult(formatResponse.toolError(errorString))
			}

			const { decoratedHandleError: handleError, decoratedPushToolResult: pushToolResult } =
				interceptor.createInterceptor(
					cline,
					{ handleError: rawHandleError, pushToolResult: rawPushToolResult },
					{
						taskId: cline.taskId,
						toolCallId,
						toolName: block.name,
						source: "tool_result",
						stage: "result",
						metadata: { toolName: block.name },
					},
				)

			if (!block.partial) {
				// Check if this is a custom tool - if so, record as "custom_tool" (like MCP tools)
				const isCustomTool = stateExperiments?.customTools && customToolRegistry.has(block.name)
				const recordName = isCustomTool ? "custom_tool" : block.name
				cline.recordToolUsage(recordName)
				TelemetryService.instance.captureToolUsage(cline.taskId, recordName)

				// Track legacy format usage for read_file tool (for migration monitoring)
				if (block.name === "read_file" && block.usedLegacyFormat) {
					const modelInfo = cline.api.getModel()
					TelemetryService.instance.captureEvent(TelemetryEventName.READ_FILE_LEGACY_FORMAT_USED, {
						taskId: cline.taskId,
						model: modelInfo?.id,
					})
				}
			}

			// Structural preflight: detect malformed native tool arguments before
			// approval or execution. CWD_OBJECT_MISUSE and NESTED_PARAM_OVERFLOW
			// signals block the malformed call and return exactly one guided
			// tool_result. Partial blocks are never inspected.
			if (!block.partial && block.nativeArgs) {
				const taskErrorState = getTaskErrorState(cline)
				const structuralSignals = [
					...(block.name === "execute_command"
						? [validateCwdParameter(block.nativeArgs as Record<string, unknown>, String(block.name))]
						: []),
					validateNestedParams(block.nativeArgs as Record<string, unknown>, String(block.name)),
				].filter((s): s is NonNullable<typeof s> => s != null)

				if (structuralSignals.length > 0) {
					const signal = structuralSignals[0]
					const variant = (signal.metadata?.variant as string | undefined) ?? "STRUCTURAL_MISUSE"
					const fingerprint = `PARAM_TYPE_MISMATCH|${variant}|${String(block.name)}|${(signal.metadata?.parameter as string | undefined) ?? ""}`
					// If the structural failure shape changed (different tool, variant, or
					// parameter), reset the circuit so the new shape gets fresh guidance
					// instead of inheriting MODEL_STUCK_LOOP from an unrelated pattern.
					if (taskErrorState.getFingerprint("PARAM_TYPE_MISMATCH") !== fingerprint) {
						taskErrorState.reset("PARAM_TYPE_MISMATCH")
						// Also reset the interceptor's per-task occurrence counter
						// so both display channels restart at 1. The coordinated
						// reset API ensures the interceptor's WeakMap state and
						// the TaskErrorState singleton stay in sync.
						interceptor.resetTaskState(cline, "PARAM_TYPE_MISMATCH")
					}
					taskErrorState.setFingerprint("PARAM_TYPE_MISMATCH", fingerprint)
					const occurrence = taskErrorState.incrementOccurrence("PARAM_TYPE_MISMATCH")
					const circuitOpen = taskErrorState.isOpen("PARAM_TYPE_MISMATCH")

					const parameter = (signal.metadata?.parameter as string | undefined) ?? "unknown"
					const errorMessage = circuitOpen
						? `[MODEL_STUCK_LOOP] The malformed '${String(block.name)}' call has failed ${occurrence} times with the same structural pattern (${variant} on parameter '${parameter}'). Stop retrying this invocation shape. Continue with a different tool or strategy.`
						: occurrence === 2
							? `[STRUCTURAL_MISUSE_REPEAT occurrence=2] This is the second time '${String(block.name)}' was called with the same structural problem (${variant} on parameter '${parameter}'). Re-read the tool schema now: '${parameter}' must be a plain scalar value, not an object. Correct the parameter type and submit exactly one native call.`
							: variant === "CWD_OBJECT_MISUSE"
								? `[CWD_OBJECT_MISUSE] execute_command.cwd must be a single directory string (or omitted). A non-string value (type: ${String(signal.metadata?.actualType)}) was provided, likely because another tool-call object was nested inside it. Submit exactly one native execute_command with 'command' at the top level and 'cwd' as a workspace path string or omitted.`
								: `[NESTED_PARAM_OVERFLOW] The '${String(block.name)}' parameter '${parameter}' contains a nested tool invocation object (${String(signal.metadata?.signature ?? "unknown-signature")}). Issue each intended tool as a separate native tool call with only its own top-level parameters.`

					cline.consecutiveMistakeCount++
					try {
						cline.recordToolError(String(block.name) as ToolName, errorMessage)
					} catch (recordErr) {
						console.warn(
							"[ErrorInterception] Failed to record tool error:",
							recordErr instanceof Error ? recordErr.message : recordErr,
						)
					}

					const guided = interceptor.transformError(cline, {
						source: "validation",
						stage: "preflight",
						taskId: cline.taskId,
						toolCallId,
						toolName: String(block.name),
						metadata: { ...signal.metadata, structuralPreflight: true, occurrence, circuitOpen },
					})

					const structuralGuide = taskErrorState.consumePendingNativeProtocolGuide()
					const structuralBase = guided ?? formatResponse.toolError(errorMessage)
					// Show the structural error to the user in the UI chat.
					// The AI receives the guided payload below; the user must also
					// see what went wrong (design principle: both must happen).
					const structuralUserMessage = guided
						? `${getErrorTitleFromGuided(guided)}\n\n${guided}`
						: `[${variant}] ${errorMessage}`
					await cline.say("error", structuralUserMessage)
					cline.pushToolResultToUserContent({
						type: "tool_result",
						tool_use_id: sanitizeToolUseId(toolCallId),
						content: structuralGuide ? `${structuralBase}\n\n${structuralGuide}` : structuralBase,
						is_error: true,
					})

					break
				}
			}

			// Validate tool use before execution - ONLY for complete (non-partial) blocks.
			// Validating partial blocks would cause validation errors to be thrown repeatedly
			// during streaming, pushing multiple tool_results for the same tool_use_id and
			// potentially causing the stream to appear frozen.
			if (!block.partial) {
				const modelInfo = cline.api.getModel()
				// Resolve aliases in includedTools before validation
				// e.g., "edit_file" should resolve to "apply_diff"
				const rawIncludedTools = modelInfo?.info?.includedTools
				const { resolveToolAlias } = await import("../prompts/tools/filter-tools-for-mode")
				const includedTools = rawIncludedTools?.map((tool) => resolveToolAlias(tool))

				try {
					const toolRequirements =
						disabledTools?.reduce(
							(acc: Record<string, boolean>, tool: string) => {
								acc[tool] = false
								const resolvedToolName = resolveToolAlias(tool)
								acc[resolvedToolName] = false
								return acc
							},
							{} as Record<string, boolean>,
						) ?? {}

					validateToolUse(
						block.name as ToolName,
						mode ?? defaultModeSlug,
						customModes ?? [],
						toolRequirements,
						block.params,
						stateExperiments,
						includedTools,
					)
				} catch (error) {
					cline.consecutiveMistakeCount++
					// For validation errors (unknown tool, tool not allowed for mode), we need to:
					// 1. Send a tool_result with the error (required for native tool calling)
					// 2. NOT set didAlreadyUseTool = true (the tool was never executed, just failed validation)
					// This prevents the stream from being interrupted with "Response interrupted by tool use result"
					// which would cause the extension to appear to hang
					const errorMessage = error instanceof Error ? error.message : String(error)
					// Classify the validation failure so the interceptor does not
					// misreport every validation error as a parameter type mismatch.
					let validationMetadata: Record<string, unknown>
					if (errorMessage.includes("not allowed in")) {
						validationMetadata = { modeRestriction: true }
					} else if (errorMessage.includes("Unknown tool")) {
						validationMetadata = { unknownTool: true }
					} else if (errorMessage.includes("File restriction") || errorMessage.includes("FileRestriction")) {
						validationMetadata = { fileRestriction: true }
					} else {
						validationMetadata = { typeMismatch: true } // generic fallback only for actual type issues
					}
					const guided = interceptor.transformError(cline, {
						source: "validation",
						stage: "preflight",
						taskId: cline.taskId,
						toolCallId,
						toolName: block.name,
						metadata: validationMetadata,
					})
					// Push tool_result directly without setting didAlreadyUseTool
					const validationGuide = getTaskErrorState(cline).consumePendingNativeProtocolGuide()
					const validationBase = guided ? `${guided}\n\n${errorMessage}` : errorMessage
					// Show the validation error to the user in the UI chat.
					// The AI receives the guided payload below; the user must also
					// see what went wrong (design principle: both must happen).
					const validationUserMessage = guided
						? `${getErrorTitleFromGuided(guided)}\n\n${guided}`
						: `Validation error: ${errorMessage}`
					await cline.say("error", validationUserMessage)
					cline.pushToolResultToUserContent({
						type: "tool_result",
						tool_use_id: sanitizeToolUseId(toolCallId),
						content: validationGuide ? `${validationBase}\n\n${validationGuide}` : validationBase,
						is_error: true,
					})

					break
				}
			}

			// Check for identical consecutive tool calls.
			if (!block.partial) {
				// Use the detector to check for repetition, passing the ToolUse
				// block directly.
				const repetitionCheck = cline.toolRepetitionDetector.check(block)

				// If execution is not allowed, notify user and break.
				if (!repetitionCheck.allowExecution && repetitionCheck.askUser) {
					// Forward the deterministic duplicate signal before the user prompt
					// so the model-facing guidance is emitted as part of this tool turn.
					const signalMetadata: Record<string, unknown> = { blocked: true }

					const guided = interceptor.transformError(cline, {
						source: "repetition",
						stage: "result",
						taskId: cline.taskId,
						toolCallId,
						toolName: block.name,
						metadata: signalMetadata,
					})

					if (guided) {
						pushToolResult(guided)
					}

					// Handle repetition similar to mistake_limit_reached pattern.
					const { response, text, images } = await cline.ask(
						repetitionCheck.askUser.messageKey as ClineAsk,
						repetitionCheck.askUser.messageDetail.replace("{toolName}", block.name),
					)

					if (response === "messageResponse") {
						// Add user feedback to userContent.
						cline.userMessageContent.push(
							{
								type: "text" as const,
								text: `Tool repetition limit reached. User feedback: ${text}`,
							},
							...formatResponse.imageBlocks(images),
						)

						// Add user feedback to chat.
						await cline.say("user_feedback", text, images)
					}

					// Track tool repetition in telemetry via PostHog exception tracking and event.
					TelemetryService.instance.captureConsecutiveMistakeError(cline.taskId)
					TelemetryService.instance.captureException(
						new ConsecutiveMistakeError(
							`Tool repetition limit reached for ${block.name}`,
							cline.taskId,
							cline.consecutiveMistakeCount,
							cline.consecutiveMistakeLimit,
							"tool_repetition",
							cline.apiConfiguration.apiProvider,
							cline.api.getModel().id,
						),
					)

					// The transformed result was already emitted before the user prompt to
					// preserve exactly-once behavior; additional user feedback is added as
					// text content above.
					break
				}
			}

			switch (block.name) {
				case "write_to_file":
					await checkpointSaveAndMark(cline)
					await writeToFileTool.handle(cline, block as ToolUse<"write_to_file">, {
						askApproval,
						handleError,
						pushToolResult,
					})
					break
				case "update_todo_list":
					await updateTodoListTool.handle(cline, block as ToolUse<"update_todo_list">, {
						askApproval,
						handleError,
						pushToolResult,
					})
					break
				case "apply_diff":
					await checkpointSaveAndMark(cline)
					await applyDiffToolClass.handle(cline, block as ToolUse<"apply_diff">, {
						askApproval,
						handleError,
						pushToolResult,
					})
					break
				case "edit":
				case "search_and_replace":
					await checkpointSaveAndMark(cline)
					await editTool.handle(cline, block as ToolUse<"edit">, {
						askApproval,
						handleError,
						pushToolResult,
					})
					break
				case "search_replace":
					await checkpointSaveAndMark(cline)
					await searchReplaceTool.handle(cline, block as ToolUse<"search_replace">, {
						askApproval,
						handleError,
						pushToolResult,
					})
					break
				case "edit_file":
					await checkpointSaveAndMark(cline)
					await editFileTool.handle(cline, block as ToolUse<"edit_file">, {
						askApproval,
						handleError,
						pushToolResult,
					})
					break
				case "apply_patch":
					await checkpointSaveAndMark(cline)
					await applyPatchTool.handle(cline, block as ToolUse<"apply_patch">, {
						askApproval,
						handleError,
						pushToolResult,
					})
					break
				case "read_file":
					// Type assertion is safe here because we're in the "read_file" case
					await readFileTool.handle(cline, block as ToolUse<"read_file">, {
						askApproval,
						handleError,
						pushToolResult,
					})
					break
				case "list_files":
					await listFilesTool.handle(cline, block as ToolUse<"list_files">, {
						askApproval,
						handleError,
						pushToolResult,
					})
					break
				case "codebase_search":
					await codebaseSearchTool.handle(cline, block as ToolUse<"codebase_search">, {
						askApproval,
						handleError,
						pushToolResult,
					})
					break
				case "search_files":
					await searchFilesTool.handle(cline, block as ToolUse<"search_files">, {
						askApproval,
						handleError,
						pushToolResult,
					})
					break
				case "execute_command":
					await executeCommandTool.handle(cline, block as ToolUse<"execute_command">, {
						askApproval,
						handleError,
						pushToolResult,
					})
					break
				case "read_command_output":
					await readCommandOutputTool.handle(cline, block as ToolUse<"read_command_output">, {
						askApproval,
						handleError,
						pushToolResult,
					})
					break
				case "use_mcp_tool":
					await useMcpToolTool.handle(cline, block as ToolUse<"use_mcp_tool">, {
						askApproval,
						handleError,
						pushToolResult,
					})
					break
				case "access_mcp_resource":
					await accessMcpResourceTool.handle(cline, block as ToolUse<"access_mcp_resource">, {
						askApproval,
						handleError,
						pushToolResult,
					})
					break
				case "ask_followup_question":
					await askFollowupQuestionTool.handle(cline, block as ToolUse<"ask_followup_question">, {
						askApproval,
						handleError,
						pushToolResult,
					})
					break
				case "switch_mode":
					await switchModeTool.handle(cline, block as ToolUse<"switch_mode">, {
						askApproval,
						handleError,
						pushToolResult,
					})
					break
				case "new_task":
					await checkpointSaveAndMark(cline)
					await newTaskTool.handle(cline, block as ToolUse<"new_task">, {
						askApproval,
						handleError,
						pushToolResult,
						toolCallId: block.id,
					})
					break
				case "attempt_completion": {
					const completionCallbacks: AttemptCompletionCallbacks = {
						askApproval,
						handleError,
						pushToolResult,
						askFinishSubTaskApproval,
						toolDescription,
					}
					await attemptCompletionTool.handle(
						cline,
						block as ToolUse<"attempt_completion">,
						completionCallbacks,
					)
					break
				}
				case "run_slash_command":
					await runSlashCommandTool.handle(cline, block as ToolUse<"run_slash_command">, {
						askApproval,
						handleError,
						pushToolResult,
					})
					break
				case "skill":
					await skillTool.handle(cline, block as ToolUse<"skill">, {
						askApproval,
						handleError,
						pushToolResult,
					})
					break
				case "generate_image":
					await checkpointSaveAndMark(cline)
					await generateImageTool.handle(cline, block as ToolUse<"generate_image">, {
						askApproval,
						handleError,
						pushToolResult,
					})
					break
				default: {
					// Handle unknown/invalid tool names OR custom tools
					// This is critical for native tool calling where every tool_use MUST have a tool_result

					// CRITICAL: Don't process partial blocks for unknown tools - just let them stream in.
					// If we try to show errors for partial blocks, we'd show the error on every streaming chunk,
					// creating a loop that appears to freeze the extension. Only handle complete blocks.
					if (block.partial) {
						break
					}

					const customTool = stateExperiments?.customTools ? customToolRegistry.get(block.name) : undefined

					if (customTool) {
						try {
							let customToolArgs

							if (customTool.parameters) {
								try {
									customToolArgs = customTool.parameters.parse(block.nativeArgs || block.params || {})
								} catch (parseParamsError) {
									const message = `Custom tool "${block.name}" argument validation failed: ${parseParamsError.message}`
									console.error(message)
									cline.consecutiveMistakeCount++
									const guided = interceptor.transformError(cline, {
										source: "validation",
										stage: "preflight",
										taskId: cline.taskId,
										toolCallId,
										toolName: block.name,
										metadata: { typeMismatch: true },
									})
									await cline.say(
										"error",
										guided ? `${getErrorTitleFromGuided(guided)}\n\n${guided}` : message,
									)
									pushToolResult(guided ?? formatResponse.toolError(message))
									break
								}
							}

							const result = await customTool.execute(customToolArgs, {
								mode: mode ?? defaultModeSlug,
								task: cline,
							})

							console.log(
								`${customTool.name}.execute(): ${JSON.stringify(customToolArgs)} -> ${JSON.stringify(result)}`,
							)

							pushToolResult(result)
							cline.consecutiveMistakeCount = 0
						} catch (executionError: unknown) {
							cline.consecutiveMistakeCount++
							// Record custom tool error with static name
							const errorMsg =
								executionError instanceof Error ? executionError.message : String(executionError)
							cline.recordToolError("custom_tool", errorMsg)
							const wrappedError =
								executionError instanceof Error ? executionError : new Error(String(executionError))
							await handleError(`executing custom tool "${block.name}"`, wrappedError)
						}

						break
					}

					// Not a custom tool - handle as unknown tool error
					const errorMessage = `Unknown tool "${block.name}". This tool does not exist. Please use one of the available tools.`
					cline.consecutiveMistakeCount++
					cline.recordToolError(block.name as ToolName, errorMessage)
					// Push tool_result directly WITHOUT setting didAlreadyUseTool
					// This prevents the stream from being interrupted with "Response interrupted by tool use result"
					const guided = interceptor.transformError(cline, {
						source: "validation",
						stage: "preflight",
						taskId: cline.taskId,
						toolCallId,
						toolName: block.name,
						metadata: { unknownTool: true },
					})
					await cline.say(
						"error",
						guided
							? `${getErrorTitleFromGuided(guided)}\n\n${guided}`
							: t("tools:unknownToolError", { toolName: block.name }),
					)
					const unknownToolGuide = getTaskErrorState(cline).consumePendingNativeProtocolGuide()
					const unknownToolBase = guided ?? formatResponse.toolError(errorMessage)
					cline.pushToolResultToUserContent({
						type: "tool_result",
						tool_use_id: sanitizeToolUseId(toolCallId),
						content: unknownToolGuide ? `${unknownToolBase}\n\n${unknownToolGuide}` : unknownToolBase,
						is_error: true,
					})
					break
				}
			}

			break
		}
	}

	// Seeing out of bounds is fine, it means that the next too call is being
	// built up and ready to add to assistantMessageContent to present.
	// When you see the UI inactive during this, it means that a tool is
	// breaking without presenting any UI. For example the write_to_file tool
	// was breaking when relpath was undefined, and for invalid relpath it never
	// presented UI.
	// This needs to be placed here, if not then calling
	// cline.presentAssistantMessage below would fail (sometimes) since it's
	// locked.
	cline.presentAssistantMessageLocked = false

	// NOTE: When tool is rejected, iterator stream is interrupted and it waits
	// for `userMessageContentReady` to be true. Future calls to present will
	// skip execution since `didRejectTool` and iterate until `contentIndex` is
	// set to message length and it sets userMessageContentReady to true itself
	// (instead of preemptively doing it in iterator).
	if (!block.partial || cline.didRejectTool || cline.didAlreadyUseTool) {
		// Block is finished streaming and executing.
		if (cline.currentStreamingContentIndex === cline.assistantMessageContent.length - 1) {
			// It's okay that we increment if !didCompleteReadingStream, it'll
			// just return because out of bounds and as streaming continues it
			// will call `presentAssitantMessage` if a new block is ready. If
			// streaming is finished then we set `userMessageContentReady` to
			// true when out of bounds. This gracefully allows the stream to
			// continue on and all potential content blocks be presented.
			// Last block is complete and it is finished executing
			cline.userMessageContentReady = true // Will allow `pWaitFor` to continue.
		}

		// Call next block if it exists (if not then read stream will call it
		// when it's ready).
		// Need to increment regardless, so when read stream calls this function
		// again it will be streaming the next block.
		cline.currentStreamingContentIndex++

		if (cline.currentStreamingContentIndex < cline.assistantMessageContent.length) {
			// There are already more content blocks to stream, so we'll call
			// this function ourselves.
			return presentAssistantMessage(cline)
		} else {
			// CRITICAL FIX: If we're out of bounds and the stream is complete, set userMessageContentReady
			// This handles the case where assistantMessageContent is empty or becomes empty after processing
			if (cline.didCompleteReadingStream) {
				cline.userMessageContentReady = true
			}
		}
	}

	// Block is partial, but the read stream may have finished.
	if (cline.presentAssistantMessageHasPendingUpdates) {
		return presentAssistantMessage(cline)
	}
}

/**
 * save checkpoint and mark done in the current streaming task.
 * @param task The Task instance to checkpoint save and mark.
 * @returns
 */
async function checkpointSaveAndMark(task: Task) {
	if (task.currentStreamingDidCheckpoint) {
		return
	}
	try {
		await task.checkpointSave(true)
		task.currentStreamingDidCheckpoint = true
	} catch (error) {
		console.error(`[Task#presentAssistantMessage] Error saving checkpoint: ${error.message}`, error)
	}
}
