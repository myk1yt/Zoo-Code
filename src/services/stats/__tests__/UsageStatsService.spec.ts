import { describe, it, expect, beforeEach, afterEach } from "vitest"
import * as fs from "fs/promises"
import * as path from "path"
import { tmpdir } from "os"

import {
	UsageEventStatus,
	UsageValueSource,
	InclusionRule,
	StatsQuery,
	StatsBucket,
} from "@roo-code/types"
import { UsageStatsService } from "../UsageStatsService"

function makeEvent(overrides: Record<string, any> = {}): any {
	return {
		schemaVersion: 1,
		eventId: "evt-123",
		idempotencyKey: "idem-456",
		occurredAt: "2024-01-01T00:00:00Z",
		timezoneOffsetMinutes: 0,
		status: UsageEventStatus.parse("completed"),
		attempt: 1,
		taskId: "task-789",
		provider: "openai",
		model: "gpt-4",
		mode: "code",
		usage: {
			inputTokens: { value: 100, source: UsageValueSource.parse("provider") },
			outputTokens: { value: 50, source: UsageValueSource.parse("provider") },
			cacheWriteTokens: { value: 20, source: UsageValueSource.parse("provider") },
			cacheReadTokens: { value: 30, source: UsageValueSource.parse("provider") },
			reasoningTokens: { value: 10, source: UsageValueSource.parse("provider") },
			totalTokens: { value: 210, source: UsageValueSource.parse("estimated") },
			costUsd: { value: 0.05, source: UsageValueSource.parse("estimated") },
		},
		semantics: {
			cacheReadInInput: InclusionRule.parse("included"),
			cacheWriteInInput: InclusionRule.parse("included"),
			reasoningInOutput: InclusionRule.parse("included"),
		},
		provenance: "live",
		...overrides,
	}
}

describe("UsageStatsService", () => {
	let testDir: string
	let service: UsageStatsService

	beforeEach(async () => {
		testDir = path.join(tmpdir(), `usage-stats-service-test-${Date.now()}`)
		service = new UsageStatsService(testDir)
	})

	afterEach(async () => {
		try {
			await fs.rm(testDir, { recursive: true, force: true })
		} catch {
			// Ignore cleanup errors
		}
	})

	describe("record", () => {
		it("should record a valid event", async () => {
			const result = await service.record(makeEvent())
			expect(result.success).toBe(true)
			expect(result.duplicate).toBe(false)
		})

		it("should reject duplicate events", async () => {
			const event = makeEvent()
			const result1 = await service.record(event)
			const result2 = await service.record(event)
			expect(result1.success).toBe(true)
			expect(result1.duplicate).toBe(false)
			expect(result2.success).toBe(true)
			expect(result2.duplicate).toBe(true)
		})

		it("should reject invalid event schema", async () => {
			const result = await service.record({
				schemaVersion: 999,
				eventId: "evt-invalid",
				idempotencyKey: "idem-invalid",
				occurredAt: "2024-01-01T00:00:00Z",
				timezoneOffsetMinutes: 0,
				status: "completed" as UsageEventStatus,
				attempt: 1,
				taskId: "task-789",
				provider: "openai",
				model: "gpt-4",
				mode: "code",
				usage: {},
				semantics: {
					cacheReadInInput: "included" as InclusionRule,
					cacheWriteInInput: "included" as InclusionRule,
					reasoningInOutput: "included" as InclusionRule,
				},
				provenance: "live" as const,
			})
			expect(result.success).toBe(false)
			expect(result.error).toBeDefined()
		})

		it("should persist events to disk", async () => {
			await service.record(makeEvent({ eventId: "evt-persist" }))

			const snapshot = await service.query({ timezone: "UTC", groupBy: [] })
			expect(snapshot.totals.events).toBe(1)
		})
	})

	describe("recordBatch", () => {
		it("should record multiple events", async () => {
			const events = [
				makeEvent({ eventId: "evt-1" }),
				makeEvent({ eventId: "evt-2" }),
				makeEvent({ eventId: "evt-3" }),
			]
			const result = await service.recordBatch(events)
			expect(result.success).toBe(true)
			expect(result.duplicates).toBe(0)
			expect(result.errors).toHaveLength(0)
		})

		it("should handle duplicates in batch", async () => {
			const event = makeEvent()
			const events = [event, event, makeEvent({ eventId: "evt-unique" })]
			const result = await service.recordBatch(events)
			expect(result.success).toBe(true)
			expect(result.duplicates).toBe(1)
			expect(result.errors).toHaveLength(0)
		})
	})

	describe("query", () => {
		it("should return empty snapshot for no events", async () => {
			const snapshot = await service.query({ timezone: "UTC", groupBy: [] })
			expect(snapshot.buckets).toHaveLength(0)
			expect(snapshot.totals.events).toBe(0)
		})

		it("should aggregate events by provider", async () => {
			await service.record(makeEvent())
			await service.record(makeEvent({ eventId: "evt-2", provider: "anthropic" }))
			await service.record(makeEvent({ eventId: "evt-3", provider: "openai" }))

			const snapshot = await service.query({
				timezone: "UTC",
				groupBy: ["provider"],
			})

			expect(snapshot.buckets).toHaveLength(2)
			const openaiBucket = snapshot.buckets.find((b) => b.key.provider === "openai")
			expect(openaiBucket).toBeDefined()
			expect(openaiBucket!.events).toBe(2)
		})

		it("should filter by time range", async () => {
			await service.record(makeEvent({ occurredAt: "2024-01-01T00:00:00Z" }))
			await service.record(makeEvent({ eventId: "evt-2", occurredAt: "2024-02-01T00:00:00Z" }))

			const snapshot = await service.query({
				timezone: "UTC",
				from: "2024-01-15T00:00:00Z",
				to: "2024-03-01T00:00:00Z",
				groupBy: [],
			})

			expect(snapshot.totals.events).toBe(1)
		})

		it("should filter out cancelled events by default", async () => {
			await service.record(makeEvent())
			await service.record(makeEvent({ eventId: "evt-2", status: "cancelled" as UsageEventStatus }))

			const snapshot = await service.query({
				timezone: "UTC",
				groupBy: [],
			})

			expect(snapshot.totals.events).toBe(1)
		})

		it("should compute token totals correctly", async () => {
			await service.record(makeEvent())

			const snapshot = await service.query({
				timezone: "UTC",
				groupBy: [],
			})

			expect(snapshot.totals.inputTokens).toBe(100)
			expect(snapshot.totals.outputTokens).toBe(50)
			expect(snapshot.totals.cacheReadTokens).toBe(30)
			expect(snapshot.totals.cacheWriteTokens).toBe(20)
			expect(snapshot.totals.reasoningTokens).toBe(10)
			expect(snapshot.totals.totalTokens).toBe(210)
			expect(snapshot.totals.costUsd).toBeCloseTo(0.05, 2)
		})

		it("should track coverage information", async () => {
			await service.record(makeEvent({ occurredAt: "2024-01-01T00:00:00Z" }))
			await service.record(makeEvent({ eventId: "evt-2", occurredAt: "2024-01-15T00:00:00Z" }))

			const snapshot = await service.query({
				timezone: "UTC",
				groupBy: [],
			})

			expect(snapshot.coverage.firstEventAt).toBe("2024-01-01T00:00:00Z")
			expect(snapshot.coverage.lastEventAt).toBe("2024-01-15T00:00:00Z")
		})
	})

	describe("clear", () => {
		it("should clear all events", async () => {
			await service.record(makeEvent())
			await service.record(makeEvent())

			await service.clear()

			const snapshot = await service.query({ timezone: "UTC", groupBy: [] })
			expect(snapshot.totals.events).toBe(0)
		})
	})

	describe("export", () => {
		it("should export all events", async () => {
			await service.record(makeEvent({ eventId: "evt-1" }))
			await service.record(makeEvent({ eventId: "evt-2" }))

			const events = await service.export()
			expect(events).toHaveLength(2)
			expect(events[0].eventId).toBe("evt-1")
			expect(events[1].eventId).toBe("evt-2")
		})

		it("should export empty array when no events", async () => {
			const events = await service.export()
			expect(events).toEqual([])
		})
	})

	describe("getEventCount", () => {
		it("should return correct event count", async () => {
			expect(await service.getEventCount()).toBe(0)

			await service.record(makeEvent())
			expect(await service.getEventCount()).toBe(1)

			await service.record(makeEvent({ eventId: "evt-2" }))
			expect(await service.getEventCount()).toBe(2)
		})
	})

	describe("hasEvents", () => {
		it("should return false when no events", async () => {
			expect(await service.hasEvents()).toBe(false)
		})

		it("should return true when events exist", async () => {
			await service.record(makeEvent())
			expect(await service.hasEvents()).toBe(true)
		})
	})

	describe("pause/resume recording", () => {
		it("should start with recording not paused", () => {
			expect(service.isRecordingPaused()).toBe(false)
		})

		it("should pause recording", () => {
			service.pauseRecording()
			expect(service.isRecordingPaused()).toBe(true)
		})

		it("should resume recording", () => {
			service.pauseRecording()
			service.resumeRecording()
			expect(service.isRecordingPaused()).toBe(false)
		})

		it("should reflect pause state in query coverage", async () => {
			service.pauseRecording()

			const snapshot = await service.query({
				timezone: "UTC",
				groupBy: [],
			})

			expect(snapshot.coverage.recordingPaused).toBe(true)
		})
	})

	describe("getStats", () => {
		it("should return store statistics", async () => {
			await service.record(makeEvent())
			await service.record(makeEvent({ idempotencyKey: "idem-2" }))

			const stats = await service.getStats()
			expect(stats.totalEvents).toBe(2)
			expect(stats.idempotencyKeys).toBe(2)
			expect(stats.storeDir).toContain("usage-stats")
		})
	})
})
