import { describe, it, expect, beforeEach, afterEach } from "vitest"
import * as fs from "fs/promises"
import * as path from "path"
import { tmpdir } from "os"

import {
	UsageEventStatus,
	UsageValueSource,
	InclusionRule,
	UsageEventV1,
} from "@roo-code/types"
import { UsageEventStore, StatsStoreError } from "../UsageEventStore"

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

describe("UsageEventStore", () => {
	let testDir: string
	let store: UsageEventStore

	beforeEach(async () => {
		testDir = path.join(tmpdir(), `usage-store-test-${Date.now()}`)
		store = new UsageEventStore(testDir)
	})

	afterEach(async () => {
		try {
			await fs.rm(testDir, { recursive: true, force: true })
		} catch {
			// Ignore cleanup errors
		}
	})

	describe("append", () => {
		it("should append a valid event", async () => {
			const event = makeEvent()
			const result = await store.append(event)
			expect(result).toBe(true)
		})

		it("should reject duplicate idempotency key", async () => {
			const event = makeEvent()
			const result1 = await store.append(event)
			const result2 = await store.append(event)
			expect(result1).toBe(true)
			expect(result2).toBe(false)
		})

		it("should persist events to disk", async () => {
			const event = makeEvent({ eventId: "evt-persist" })
			await store.append(event)

			const events = await store.readAll()
			expect(events).toHaveLength(1)
			expect(events[0].eventId).toBe("evt-persist")
		})

		it("should create directory structure", async () => {
			const event = makeEvent()
			await store.append(event)

			const statsDir = store.getStatsDir()
			expect(statsDir).toBe(testDir)

			const manifestPath = path.join(statsDir, "manifest.json")
			const exists = await fs.access(manifestPath).then(() => true).catch(() => false)
			expect(exists).toBe(true)
		})

		it("should reject invalid event schema", async () => {
			const invalidEvent = {
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
			}

			await expect(store.append(invalidEvent as UsageEventV1)).rejects.toThrow()
		})
	})

	describe("readAll", () => {
		it("should return empty array for empty store", async () => {
			const events = await store.readAll()
			expect(events).toEqual([])
		})

		it("should read all appended events", async () => {
			await store.append(makeEvent({ eventId: "evt-1" }))
			await store.append(makeEvent({ eventId: "evt-2" }))
			await store.append(makeEvent({ eventId: "evt-3" }))

			const events = await store.readAll()
			expect(events).toHaveLength(3)
			expect(events.map((e) => e.eventId)).toEqual(["evt-1", "evt-2", "evt-3"])
		})

		it("should read events in order", async () => {
			const event1 = makeEvent({ eventId: "evt-1", occurredAt: "2024-01-01T00:00:00Z" })
			const event2 = makeEvent({ eventId: "evt-2", occurredAt: "2024-01-02T00:00:00Z" })
			const event3 = makeEvent({ eventId: "evt-3", occurredAt: "2024-01-03T00:00:00Z" })

			await store.append(event1)
			await store.append(event2)
			await store.append(event3)

			const events = await store.readAll()
			expect(events[0].eventId).toBe("evt-1")
			expect(events[1].eventId).toBe("evt-2")
			expect(events[2].eventId).toBe("evt-3")
		})

		it("should handle multiple segments", async () => {
			// Append enough events to potentially create multiple segments
			// (using small events so they fit in segments)
			for (let i = 0; i < 10; i++) {
				await store.append(makeEvent({ eventId: `evt-${i}` }))
			}

			const events = await store.readAll()
			expect(events).toHaveLength(10)
		})
	})

	describe("clear", () => {
		it("should clear all events", async () => {
			await store.append(makeEvent())
			await store.append(makeEvent())
			await store.clear()

			const events = await store.readAll()
			expect(events).toEqual([])
		})

		it("should reset idempotency tracking", async () => {
			const event = makeEvent()
			await store.append(event)
			await store.clear()

			// After clear, same event should be accepted
			const result = await store.append(event)
			expect(result).toBe(true)
		})

		it("should increment generation on clear", async () => {
			await store.append(makeEvent())
			await store.clear()

			// Re-read manifest should have new generation
			const manifestPath = path.join(testDir, "manifest.json")
			const content = await fs.readFile(manifestPath, "utf-8")
			const manifest = JSON.parse(content)
			expect(manifest.generation).toBe(2)
		})
	})

	describe("getIdempotencyKeyCount", () => {
		it("should track idempotency keys", async () => {
			expect(store.getIdempotencyKeyCount()).toBe(0)

			await store.append(makeEvent())
			expect(store.getIdempotencyKeyCount()).toBe(1)

			await store.append(makeEvent({ idempotencyKey: "idem-2" }))
			expect(store.getIdempotencyKeyCount()).toBe(2)

			// Duplicate should not increase count
			await store.append(makeEvent())
			expect(store.getIdempotencyKeyCount()).toBe(2)
		})
	})

	describe("getStatsDir", () => {
		it("should return the stats directory path", () => {
			const statsDir = store.getStatsDir()
			expect(statsDir).toBe(testDir)
		})
	})

	describe("Quarantine", () => {
		it("should quarantine corrupt lines", async () => {
			// Append valid event
			await store.append(makeEvent())

			// Manually corrupt a segment file
			const manifestPath = path.join(testDir, "manifest.json")
			const manifest = JSON.parse(await fs.readFile(manifestPath, "utf-8"))
			const segmentPath = path.join(
				testDir,
				`events-${String(manifest.currentSegment).padStart(6, "0")}.ndjson`,
			)

			// Append corrupt line
			const corruptLine = '{"invalid json'
			await fs.appendFile(segmentPath, corruptLine + "\n")

			// Read should still work and quarantine the corrupt line
			const events = await store.readAll()
			expect(events.length).toBeGreaterThanOrEqual(1)

			// Check quarantine report exists
			const quarantineReportPath = path.join(testDir, "quarantine", "corrupt-lines.jsonl")
			const reportExists = await fs.access(quarantineReportPath).then(() => true).catch(() => false)
			expect(reportExists).toBe(true)
		})
	})
})
