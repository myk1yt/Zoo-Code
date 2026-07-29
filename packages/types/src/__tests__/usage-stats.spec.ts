import { describe, it, expect } from "vitest"

import {
	UsageEventStatus,
	UsageValueSource,
	InclusionRule,
	SourcedNumber,
	UsageEventV1,
	StatsQuery,
	StatsBucket,
	StatsSnapshot,
} from "../usage-stats.js"

describe("UsageStats", () => {
	describe("UsageEventStatus", () => {
		it("should define completed, failed, cancelled", () => {
			expect(UsageEventStatus.parse("completed")).toBe("completed")
			expect(UsageEventStatus.parse("failed")).toBe("failed")
			expect(UsageEventStatus.parse("cancelled")).toBe("cancelled")
		})

		it("should reject invalid values", () => {
			expect(() => UsageEventStatus.parse("invalid" as string)).toThrow()
		})
	})

	describe("UsageValueSource", () => {
		it("should define provider, estimated, backfilled", () => {
			expect(UsageValueSource.parse("provider")).toBe("provider")
			expect(UsageValueSource.parse("estimated")).toBe("estimated")
			expect(UsageValueSource.parse("backfilled")).toBe("backfilled")
		})

		it("should reject invalid values", () => {
			expect(() => UsageValueSource.parse("invalid" as string)).toThrow()
		})
	})

	describe("InclusionRule", () => {
		it("should define included, excluded, unknown", () => {
			expect(InclusionRule.parse("included")).toBe("included")
			expect(InclusionRule.parse("excluded")).toBe("excluded")
			expect(InclusionRule.parse("unknown")).toBe("unknown")
		})

		it("should reject invalid values", () => {
			expect(() => InclusionRule.parse("invalid" as string)).toThrow()
		})
	})

	describe("SourcedNumber", () => {
		it("should parse valid sourced number", () => {
			const result = SourcedNumber.parse({ value: 100, source: "provider" })
			expect(result.value).toBe(100)
			expect(result.source).toBe("provider")
		})

		it("should reject invalid source", () => {
			expect(() =>
				SourcedNumber.parse({ value: 100, source: "invalid" as string }),
			).toThrow()
		})
	})

	describe("UsageEventV1", () => {
		const baseEvent = {
			schemaVersion: 1,
			eventId: "evt-123",
			idempotencyKey: "idem-456",
			occurredAt: "2024-01-01T00:00:00Z",
			timezoneOffsetMinutes: 0,
			status: "completed" as const,
			attempt: 1,
			taskId: "task-789",
			provider: "openai",
			model: "gpt-4",
			mode: "code",
			usage: {
				inputTokens: { value: 100, source: "provider" },
				outputTokens: { value: 50, source: "provider" },
				cacheWriteTokens: { value: 20, source: "provider" },
				cacheReadTokens: { value: 30, source: "provider" },
				reasoningTokens: { value: 10, source: "provider" },
				totalTokens: { value: 210, source: "estimated" },
				costUsd: { value: 0.05, source: "estimated" },
			},
			semantics: {
				cacheReadInInput: "included",
				cacheWriteInInput: "included",
				reasoningInOutput: "included",
			},
			provenance: "live",
		}

		it("should parse a valid usage event", () => {
			const result = UsageEventV1.parse(baseEvent)
			expect(result.eventId).toBe("evt-123")
			expect(result.provider).toBe("openai")
			expect(result.status).toBe("completed")
		})

		it("should reject missing required fields", () => {
			expect(() => UsageEventV1.parse({})).toThrow()
		})

		it("should reject invalid schema version", () => {
			expect(() =>
				UsageEventV1.parse({ ...baseEvent, schemaVersion: 2 }),
			).toThrow()
		})

		it("should accept optional parentTaskId", () => {
			const result = UsageEventV1.parse({ ...baseEvent, parentTaskId: "parent-123" })
			expect(result.parentTaskId).toBe("parent-123")
		})

		it("should accept optional usage fields", () => {
			const result = UsageEventV1.parse({
				...baseEvent,
				usage: {},
			})
			expect(result.usage.inputTokens).toBeUndefined()
		})

		it("should enforce provenance enum", () => {
			expect(() =>
				UsageEventV1.parse({ ...baseEvent, provenance: "invalid" as string }),
			).toThrow()
		})
	})

	describe("StatsQuery", () => {
		it("should parse valid query", () => {
			const result = StatsQuery.parse({
				from: "2024-01-01T00:00:00Z",
				to: "2024-01-31T23:59:59Z",
				preset: "30d",
				timezone: "UTC",
				groupBy: ["day", "provider"],
				includeCancelled: true,
			})
			expect(result.timezone).toBe("UTC")
			expect(result.groupBy).toContain("day")
		})

		it("should reject groupBy with more than 3 items", () => {
			expect(() =>
				StatsQuery.parse({
					timezone: "UTC",
					groupBy: ["day", "week", "month", "provider"] as string[],
				}),
			).toThrow()
		})

		it("should accept optional fields", () => {
			const result = StatsQuery.parse({ timezone: "UTC" })
			expect(result.from).toBeUndefined()
			expect(result.includeCancelled).toBe(false)
		})
	})

	describe("StatsBucket", () => {
		it("should parse valid bucket", () => {
			const result = StatsBucket.parse({
				key: { provider: "openai", model: "gpt-4" },
				events: 100,
				completedCalls: 90,
				failedCalls: 5,
				cancelledCalls: 5,
				inputTokens: 10000,
				outputTokens: 5000,
				cacheReadTokens: 2000,
				cacheWriteTokens: 1000,
				reasoningTokens: 500,
				totalTokens: 18500,
				costUsd: 0.5,
				unknownEventCount: 0,
			})
			expect(result.events).toBe(100)
			expect(result.key.provider).toBe("openai")
		})
	})

	describe("StatsSnapshot", () => {
		it("should parse valid snapshot", () => {
			const result = StatsSnapshot.parse({
				query: { timezone: "UTC" },
				generatedAt: "2024-01-15T12:00:00Z",
				buckets: [
					{
						key: { provider: "openai" },
						events: 100,
						completedCalls: 90,
						failedCalls: 5,
						cancelledCalls: 5,
						inputTokens: 10000,
						outputTokens: 5000,
						cacheReadTokens: 2000,
						cacheWriteTokens: 1000,
						reasoningTokens: 500,
						totalTokens: 18500,
						costUsd: 0.5,
						unknownEventCount: 0,
					},
				],
				totals: {
					key: {},
					events: 100,
					completedCalls: 90,
					failedCalls: 5,
					cancelledCalls: 5,
					inputTokens: 10000,
					outputTokens: 5000,
					cacheReadTokens: 2000,
					cacheWriteTokens: 1000,
					reasoningTokens: 500,
					totalTokens: 18500,
					costUsd: 0.5,
					unknownEventCount: 0,
				},
				coverage: {
					firstEventAt: "2024-01-01T00:00:00Z",
					lastEventAt: "2024-01-31T23:59:59Z",
					recordingPaused: false,
					backfilledEventCount: 0,
				},
			})
			expect(result.buckets.length).toBe(1)
			expect(result.coverage.recordingPaused).toBe(false)
		})

		it("should allow optional coverage fields", () => {
			const result = StatsSnapshot.parse({
				query: { timezone: "UTC" },
				generatedAt: "2024-01-15T12:00:00Z",
				buckets: [],
				totals: {
					key: {},
					events: 0,
					completedCalls: 0,
					failedCalls: 0,
					cancelledCalls: 0,
					inputTokens: 0,
					outputTokens: 0,
					cacheReadTokens: 0,
					cacheWriteTokens: 0,
					reasoningTokens: 0,
					totalTokens: 0,
					costUsd: 0,
					unknownEventCount: 0,
				},
				coverage: {
					recordingPaused: true,
					backfilledEventCount: 10,
				},
			})
			expect(result.coverage.firstEventAt).toBeUndefined()
		})
	})
})
