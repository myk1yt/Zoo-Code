import { randomUUID } from "crypto"

import { UsageEventV1, StatsQuery } from "@roo-code/types"
import type { StatsSnapshot } from "@roo-code/types"
import type { z } from "zod"

import { UsageEventStore } from "./UsageEventStore"
import { UsageAggregator } from "./UsageAggregator"

// ── UsageStatsService ──────────────────────────────────────────────────────

/**
 * Service that coordinates the append-only event store and aggregator.
 *
 * ## Architecture
 * - **UsageEventStore**: NDJSON append-only durable store (disk)
 * - **UsageAggregator**: In-memory event buffer + aggregation engine
 * - **UsageStatsService**: Orchestrator that wires both together
 *
 * ## Flow
 * 1. `record()` → append to store (disk) + add to aggregator (memory)
 * 2. `query()` → read all from store → aggregate → return snapshot
 * 3. `clear()` → clear store + clear aggregator
 */
export class UsageStatsService {
	private readonly store: UsageEventStore
	private readonly aggregator: UsageAggregator

	constructor(globalStoragePath: string) {
		this.store = new UsageEventStore(globalStoragePath)
		this.aggregator = new UsageAggregator()
	}

	// ── Recording ─────────────────────────────────────────────────────────────

	/**
	 * Record a usage event.
	 *
	 * ## Flow
	 * 1. Validate event against schema
	 * 2. Generate idempotency key if not provided
	 * 3. Append to durable store
	 * 4. Add to in-memory aggregator
	 *
	 * @returns `{ success, duplicate, error }`
	 */
	async record(event: z.input<typeof UsageEventV1>): Promise<{
		success: boolean
		duplicate: boolean
		error?: string
	}> {
		try {
			// Validate event schema
			const parsed = UsageEventV1.safeParse(event)
			if (!parsed.success) {
				return {
					success: false,
					duplicate: false,
					error: `Invalid event schema: ${parsed.error.message}`,
				}
			}

			const validEvent = parsed.data

			// Generate idempotency key if not present
			const eventWithKey: UsageEventV1 = {
				...validEvent,
				idempotencyKey: validEvent.idempotencyKey ?? randomUUID(),
			}

			// Append to store
			const appended = await this.store.append(eventWithKey)
			if (!appended) {
				return { success: true, duplicate: true }
			}

			// Add to aggregator
			this.aggregator.addEvent(eventWithKey)

			return { success: true, duplicate: false }
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err)
			return {
				success: false,
				duplicate: false,
				error: message,
			}
		}
	}

	/**
	 * Record multiple events in batch.
	 */
	async recordBatch(events: z.input<typeof UsageEventV1>[]): Promise<{
		success: boolean
		duplicates: number
		errors: string[]
	}> {
		const errors: string[] = []
		let duplicates = 0
		let success = true

		for (const event of events) {
			const result = await this.record(event)
			if (!result.success) {
				success = false
				errors.push(result.error ?? "Unknown error")
			} else if (result.duplicate) {
				duplicates++
			}
		}

		return { success, duplicates, errors }
	}

	// ── Querying ──────────────────────────────────────────────────────────────

	/**
	 * Query usage statistics.
	 *
	 * ## Flow
	 * 1. Read all events from durable store
	 * 2. Aggregate by query parameters
	 * 3. Return snapshot
	 */
	async query(queryInput: z.input<typeof StatsQuery>): Promise<StatsSnapshot> {
		const query = StatsQuery.parse(queryInput)
		const events = await this.store.readAll()

		// Also include in-memory events that might not be flushed yet
		const memoryEvents = this.aggregator.getEvents()
		const allEvents = [...events, ...memoryEvents]

		const { buckets, totals, coverage } =
			this.aggregator.query(query)

		const now = new Date().toISOString()

		return {
			query,
			generatedAt: now,
			buckets,
			totals,
			coverage: {
				...coverage,
				recordingPaused: this.aggregator.isPaused(),
			},
		}
	}

	/**
	 * Get event count from store.
	 */
	async getEventCount(): Promise<number> {
		const events = await this.store.readAll()
		return events.length + this.aggregator.getEventCount()
	}

	/**
	 * Check if events exist.
	 */
	async hasEvents(): Promise<boolean> {
		const storeHasEvents = (await this.store.readAll()).length > 0
		return storeHasEvents || this.aggregator.hasRecordedEvents()
	}

	// ── Management ────────────────────────────────────────────────────────────

	/**
	 * Clear all usage data.
	 */
	async clear(): Promise<void> {
		await this.store.clear()
		this.aggregator.clear()
	}

	/**
	 * Export all events to a JSON array.
	 */
	async export(): Promise<UsageEventV1[]> {
		const storeEvents = await this.store.readAll()
		const memoryEvents = this.aggregator.getEvents()
		return [...storeEvents, ...memoryEvents]
	}

	/**
	 * Get store statistics.
	 */
	async getStats(): Promise<{
		totalEvents: number
		idempotencyKeys: number
		storeDir: string
	}> {
		const events = await this.store.readAll()
		return {
			totalEvents: events.length + this.aggregator.getEventCount(),
			idempotencyKeys: this.store.getIdempotencyKeyCount(),
			storeDir: this.store.getStatsDir(),
		}
	}

	/**
	 * Pause event recording (soft fail - events still accepted but flagged).
	 */
	pauseRecording(): void {
		this.aggregator.setPaused(true)
	}

	/**
	 * Resume event recording.
	 */
	resumeRecording(): void {
		this.aggregator.setPaused(false)
	}

	/**
	 * Check if recording is paused.
	 */
	isRecordingPaused(): boolean {
		return this.aggregator.isPaused()
	}
}
