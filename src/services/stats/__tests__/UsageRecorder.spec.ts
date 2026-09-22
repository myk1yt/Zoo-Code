// src/services/stats/__tests__/UsageRecorder.spec.ts
//
// Tests for UsageRecorder finalization/idempotency helpers.

import { describe, it, expect, vi } from "vitest"
import { providerIdentifiers } from "@roo-code/types"

import { UsageRecorder } from "../UsageRecorder"

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeContext(overrides: Partial<Parameters<UsageRecorder["finalizeUsageEvent"]>[2]> = {}) {
	return {
		taskId: "task-001",
		provider: providerIdentifiers.anthropic,
		model: "claude-sonnet-4-5",
		mode: "code",
		attempt: 1,
		inputTokens: 1000,
		outputTokens: 500,
		totalCost: 0.015,
		cacheReadInInput: "excluded" as const,
		cacheWriteInInput: "excluded" as const,
		reasoningInOutput: "excluded" as const,
		costSource: "provider" as const,
		tokenSource: "provider" as const,
		...overrides,
	}
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("UsageRecorder", () => {
	describe("_hasFinalized", () => {
		it("returns true after a request has been finalized", async () => {
			const sink = { append: vi.fn().mockResolvedValue(true) }
			const recorder = new UsageRecorder(sink)

			expect(recorder._hasFinalized("task-001:0:1", "completed")).toBe(false)

			await recorder.finalizeUsageEvent("task-001:0:1", "completed", makeContext())

			expect(recorder._hasFinalized("task-001:0:1", "completed")).toBe(true)
			expect(sink.append).toHaveBeenCalledTimes(1)
		})

		it("records duplicate finalize calls for the same requestKey:status only once", async () => {
			const sink = { append: vi.fn().mockResolvedValue(true) }
			const recorder = new UsageRecorder(sink)

			await recorder.finalizeUsageEvent("task-001:0:1", "completed", makeContext())
			await recorder.finalizeUsageEvent("task-001:0:1", "completed", makeContext())

			expect(sink.append).toHaveBeenCalledTimes(1)
			expect(recorder._hasFinalized("task-001:0:1", "completed")).toBe(true)
			// A different terminal status for the same request is a separate event.
			expect(recorder._hasFinalized("task-001:0:1", "failed")).toBe(false)
		})

		it("marks the key finalized and swallows the error when the store append fails", async () => {
			const sink = { append: vi.fn().mockRejectedValue(new Error("disk full")) }
			const recorder = new UsageRecorder(sink)

			// Store failure must not propagate to the task.
			await expect(recorder.finalizeUsageEvent("task-001:0:1", "completed", makeContext())).resolves.toBeUndefined()

			// The finalize is still considered done: a failing store must not
			// cause unbounded retry loops on the same terminal boundary.
			expect(recorder._hasFinalized("task-001:0:1", "completed")).toBe(true)
			expect(sink.append).toHaveBeenCalledTimes(1)
		})
	})
})
