import { describe, it, expect, beforeEach } from "vitest"

import {
	UsageEventStatus,
	UsageValueSource,
	InclusionRule,
	UsageEventV1,
} from "@roo-code/types"
import { UsageAggregator } from "../UsageAggregator"

function makeEvent(overrides: Partial<UsageEventV1> = {}): UsageEventV1 {
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

describe("UsageAggregator", () => {
	let aggregator: UsageAggregator

	beforeEach(() => {
		aggregator = new UsageAggregator()
	})

	describe("addEvent", () => {
		it("should add a single event", () => {
			const event = makeEvent()
			aggregator.addEvent(event)
			expect(aggregator.getEventCount()).toBe(1)
			expect(aggregator.hasRecordedEvents()).toBe(true)
		})

		it("should track multiple events", () => {
			aggregator.addEvent(makeEvent({ eventId: "evt-1" }))
			aggregator.addEvent(makeEvent({ eventId: "evt-2" }))
			aggregator.addEvent(makeEvent({ eventId: "evt-3" }))
			expect(aggregator.getEventCount()).toBe(3)
		})

		it("should preserve event data", () => {
			const event = makeEvent({ provider: "anthropic", model: "claude-3" })
			aggregator.addEvent(event)
			const events = aggregator.getEvents()
			expect(events[0].provider).toBe("anthropic")
			expect(events[0].model).toBe("claude-3")
		})
	})

	describe("addEvents", () => {
		it("should add multiple events at once", () => {
			const events = [
				makeEvent({ eventId: "evt-1" }),
				makeEvent({ eventId: "evt-2" }),
				makeEvent({ eventId: "evt-3" }),
			]
			aggregator.addEvents(events)
			expect(aggregator.getEventCount()).toBe(3)
		})

		it("should handle empty array", () => {
			aggregator.addEvents([])
			expect(aggregator.getEventCount()).toBe(0)
			expect(aggregator.hasRecordedEvents()).toBe(false)
		})
	})

	describe("clear", () => {
		it("should clear all events", () => {
			aggregator.addEvent(makeEvent())
			aggregator.clear()
			expect(aggregator.getEventCount()).toBe(0)
			expect(aggregator.hasRecordedEvents()).toBe(false)
		})
	})

	describe("getEvents", () => {
		it("should return all events", () => {
			const events = [
				makeEvent({ eventId: "evt-1" }),
				makeEvent({ eventId: "evt-2" }),
			]
			aggregator.addEvents(events)
			const retrieved = aggregator.getEvents()
			expect(retrieved).toHaveLength(2)
			expect(retrieved[0].eventId).toBe("evt-1")
			expect(retrieved[1].eventId).toBe("evt-2")
		})

		it("should return empty array when no events", () => {
			expect(aggregator.getEvents()).toEqual([])
		})
	})

	describe("hasRecordedEvents", () => {
		it("should return false initially", () => {
			expect(aggregator.hasRecordedEvents()).toBe(false)
		})

		it("should return true after adding events", () => {
			aggregator.addEvent(makeEvent())
			expect(aggregator.hasRecordedEvents()).toBe(true)
		})

		it("should return false after clear", () => {
			aggregator.addEvent(makeEvent())
			aggregator.clear()
			expect(aggregator.hasRecordedEvents()).toBe(false)
		})
	})

	describe("pause/resume", () => {
		it("should start as not paused", () => {
			expect(aggregator.isPaused()).toBe(false)
		})

		it("should pause recording", () => {
			aggregator.setPaused(true)
			expect(aggregator.isPaused()).toBe(true)
		})

		it("should resume recording", () => {
			aggregator.setPaused(true)
			aggregator.setPaused(false)
			expect(aggregator.isPaused()).toBe(false)
		})
	})

	describe("query", () => {
		it("should return empty results for no events", () => {
			const result = aggregator.query({
				timezone: "UTC",
				groupBy: [],
			})
			expect(result.buckets).toHaveLength(0)
			expect(result.totals.events).toBe(0)
			expect(result.coverage.recordingPaused).toBe(false)
		})

		it("should aggregate events by provider", () => {
			aggregator.addEvent(makeEvent())
			aggregator.addEvent(makeEvent({ eventId: "evt-2", provider: "anthropic" }))
			aggregator.addEvent(makeEvent({ eventId: "evt-3", provider: "openai" }))

			const result = aggregator.query({
				timezone: "UTC",
				groupBy: ["provider"],
			})

			expect(result.buckets).toHaveLength(2)
			const openaiBucket = result.buckets.find((b) => b.key.provider === "openai")
			expect(openaiBucket).toBeDefined()
			expect(openaiBucket!.events).toBe(2)
			expect(openaiBucket!.inputTokens).toBe(200)
			expect(openaiBucket!.outputTokens).toBe(100)
		})

		it("should aggregate events by model", () => {
			aggregator.addEvent(makeEvent())
			aggregator.addEvent(makeEvent({ eventId: "evt-2", model: "gpt-3.5" }))

			const result = aggregator.query({
				timezone: "UTC",
				groupBy: ["model"],
			})

			expect(result.buckets).toHaveLength(2)
		})

		it("should filter by time range", () => {
			aggregator.addEvent(makeEvent({ occurredAt: "2024-01-01T00:00:00Z" }))
			aggregator.addEvent(makeEvent({ eventId: "evt-2", occurredAt: "2024-02-01T00:00:00Z" }))

			const result = aggregator.query({
				timezone: "UTC",
				from: "2024-01-15T00:00:00Z",
				to: "2024-03-01T00:00:00Z",
				groupBy: [],
			})

			expect(result.buckets).toHaveLength(1)
			expect(result.totals.events).toBe(1)
		})

		it("should filter out cancelled events by default", () => {
			aggregator.addEvent(makeEvent())
			aggregator.addEvent(makeEvent({ eventId: "evt-2", status: "cancelled" as const }))

			const result = aggregator.query({
				timezone: "UTC",
				groupBy: [],
			})

			expect(result.totals.events).toBe(1)
		})

		it("should include cancelled events when requested", () => {
			aggregator.addEvent(makeEvent())
			aggregator.addEvent(makeEvent({ eventId: "evt-2", status: "cancelled" as const }))

			const result = aggregator.query({
				timezone: "UTC",
				groupBy: [],
				includeCancelled: true,
			})

			expect(result.totals.events).toBe(2)
		})

		it("should aggregate token counts correctly", () => {
			aggregator.addEvent(makeEvent())

			const result = aggregator.query({
				timezone: "UTC",
				groupBy: [],
			})

			expect(result.totals.inputTokens).toBe(100)
			expect(result.totals.outputTokens).toBe(50)
			expect(result.totals.cacheReadTokens).toBe(30)
			expect(result.totals.cacheWriteTokens).toBe(20)
			expect(result.totals.reasoningTokens).toBe(10)
			expect(result.totals.totalTokens).toBe(210)
			expect(result.totals.costUsd).toBeCloseTo(0.05, 2)
		})

		it("should track coverage information", () => {
			aggregator.addEvent(makeEvent({ occurredAt: "2024-01-01T00:00:00Z" }))
			aggregator.addEvent(makeEvent({ eventId: "evt-2", occurredAt: "2024-01-15T00:00:00Z" }))

			const result = aggregator.query({
				timezone: "UTC",
				groupBy: [],
			})

			expect(result.coverage.firstEventAt).toBe("2024-01-01T00:00:00Z")
			expect(result.coverage.lastEventAt).toBe("2024-01-15T00:00:00Z")
		})

		it("should count backfilled events", () => {
			aggregator.addEvent(makeEvent())
			aggregator.addEvent(makeEvent({ eventId: "evt-2", provenance: "history-backfill" as const }))

			const result = aggregator.query({
				timezone: "UTC",
				groupBy: [],
			})

			expect(result.coverage.backfilledEventCount).toBe(1)
		})

		it("should handle events with missing usage data", () => {
			aggregator.addEvent(makeEvent())
			aggregator.addEvent(makeEvent({ eventId: "evt-2", usage: {} }))

			const result = aggregator.query({
				timezone: "UTC",
				groupBy: [],
			})

			expect(result.totals.events).toBe(2)
			// One event has full usage, one has empty usage
			expect(result.totals.inputTokens).toBe(100)
		})
	})
})
