import { z } from "zod"

import type { UsageEventV1, StatsBucket, StatsQuery } from "@roo-code/types"

// ── Helpers ────────────────────────────────────────────────────────────────

function parseISO(iso: string | undefined): Date | null {
	if (!iso) return null
	const d = new Date(iso)
	return isNaN(d.getTime()) ? null : d
}

function toUTC(d: Date): string {
	return d.toISOString()
}

function dayStartUTC(d: Date): Date {
	const y = d.getUTCFullYear()
	const m = d.getUTCMonth()
	const day = d.getUTCDate()
	return new Date(Date.UTC(y, m, day))
}

function monthStartUTC(d: Date): Date {
	const y = d.getUTCFullYear()
	const m = d.getUTCMonth()
	return new Date(Date.UTC(y, m, 1))
}

function yearStartUTC(d: Date): Date {
	return new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
}

function weekStartUTC(d: Date): Date {
	const day = d.getUTCDay()
	const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1) // Monday start
	const monday = new Date(d.setUTCDate(diff))
	monday.setUTCHours(0, 0, 0, 0)
	return monday
}

function bucketKey(
	query: StatsQuery,
	event: UsageEventV1,
	timezone: string,
): Record<string, string> {
	const keys: Record<string, string> = {}

	for (const dimension of query.groupBy) {
		switch (dimension) {
			case "day": {
				const eventDate = parseISO(event.occurredAt)
				if (!eventDate) {
					keys.day = "unknown"
					break
				}
				// Convert to target timezone for day calculation
				const offsetMs = getTimezoneOffsetMs(timezone)
				const localDate = new Date(eventDate.getTime() + offsetMs)
				keys.day = localDate.toISOString().slice(0, 10)
				break
			}
			case "week": {
				const eventDate = parseISO(event.occurredAt)
				if (!eventDate) {
					keys.week = "unknown"
					break
				}
				const offsetMs = getTimezoneOffsetMs(timezone)
				const localDate = new Date(eventDate.getTime() + offsetMs)
				const weekStart = weekStartUTC(localDate)
				keys.week = weekStart.toISOString().slice(0, 10)
				break
			}
			case "month": {
				const eventDate = parseISO(event.occurredAt)
				if (!eventDate) {
					keys.month = "unknown"
					break
				}
				const offsetMs = getTimezoneOffsetMs(timezone)
				const localDate = new Date(eventDate.getTime() + offsetMs)
				keys.month = localDate.toISOString().slice(0, 7) // YYYY-MM
				break
			}
			case "provider":
				keys.provider = event.provider
				break
			case "model":
				keys.model = event.model
				break
			case "mode":
				keys.mode = event.mode
				break
			case "status":
				keys.status = event.status
				break
			case "source": {
				// Determine primary source from usage values
				const usage = event.usage
				const sources = new Set<string>()
				if (usage.inputTokens?.source) sources.add(usage.inputTokens.source)
				if (usage.outputTokens?.source) sources.add(usage.outputTokens.source)
				if (usage.totalTokens?.source) sources.add(usage.totalTokens.source)
				keys.source = sources.size > 0 ? Array.from(sources).join(",") : "unknown"
				break
			}
		}
	}

	return keys
}

function getTimezoneOffsetMs(timezone: string): number {
	try {
		// Get offset for a reference date in the target timezone
		const now = new Date()
		const formatter = new Intl.DateTimeFormat("en-US", {
			timeZone: timezone,
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
			hour12: false,
		})
		const parts = formatter.formatToParts(now)
		const get = (type: string) => parseInt(parts.find((p) => p.type === type)?.value || "0", 10)

		const localYear = get("year")
		const localMonth = get("month")
		const localDay = get("day")
		const localHour = get("hour")
		const localMinute = get("minute")
		const localSecond = get("second")

		const localDate = new Date(Date.UTC(localYear, localMonth - 1, localDay, localHour, localMinute, localSecond))
		return localDate.getTime() - now.getTime()
	} catch {
		return 0
	}
}

function resolvePreset(preset?: string): { from: string; to: string } | null {
	const now = new Date()
	const to = toUTC(now)

	switch (preset) {
		case "today": {
			const from = toUTC(dayStartUTC(now))
			return { from, to }
		}
		case "7d": {
			const from = toUTC(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000))
			return { from, to }
		}
		case "30d": {
			const from = toUTC(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000))
			return { from, to }
		}
		case "all":
		default:
			return null
	}
}

function resolveTimeRange(
	query: StatsQuery,
): { from: Date | null; to: Date | null } {
	const presetRange = resolvePreset(query.preset)
	if (presetRange) {
		return {
			from: parseISO(presetRange.from),
			to: parseISO(presetRange.to),
		}
	}

	return {
		from: query.from ? parseISO(query.from) : null,
		to: query.to ? parseISO(query.to) : null,
	}
}

function safeNumber(val?: number | null): number {
	return val ?? 0
}

function sumSourcedNumbers(
	events: UsageEventV1[],
	field: keyof NonNullable<UsageEventV1["usage"]>,
): number {
	return events.reduce((sum, event) => {
		const usage = event.usage
		const sourced = usage?.[field]
		if (sourced) {
			return sum + safeNumber(sourced.value)
		}
		return sum
	}, 0)
}

// ── Aggregate ──────────────────────────────────────────────────────────────

export function aggregateEvents(events: UsageEventV1[], query: StatsQuery): {
	buckets: StatsBucket[]
	totals: StatsBucket
	coverage: {
		firstEventAt: string | undefined
		lastEventAt: string | undefined
		recordingPaused: boolean
		backfilledEventCount: number
	}
} {
	const { from, to } = resolveTimeRange(query)

	// Filter events by time range
	const filteredEvents = events.filter((event) => {
		const eventDate = parseISO(event.occurredAt)
		if (!eventDate) return false
		if (from && eventDate < from) return false
		if (to && eventDate > to) return false
		return true
	})

	// Filter cancelled events if not included
	const consideredEvents = query.includeCancelled
		? filteredEvents
		: filteredEvents.filter((e) => e.status !== "cancelled")

	// Build buckets
	const bucketMap = new Map<string, UsageEventV1[]>()

	for (const event of consideredEvents) {
		const key = JSON.stringify(bucketKey(query, event, query.timezone))
		const existing = bucketMap.get(key) ?? []
		existing.push(event)
		bucketMap.set(key, existing)
	}

	// Aggregate each bucket
	const buckets: StatsBucket[] = []
	let totalInputTokens = 0
	let totalOutputTokens = 0
	let totalCacheReadTokens = 0
	let totalCacheWriteTokens = 0
	let totalReasoningTokens = 0
	let totalTokens = 0
	let totalCostUsd = 0
	let totalEvents = 0
	let totalCompleted = 0
	let totalFailed = 0
	let totalCancelled = 0
	let totalUnknownEvents = 0
	let firstEventAt: string | undefined
	let lastEventAt: string | undefined
	let backfilledCount = 0

	for (const [keyJson, bucketEvents] of bucketMap) {
		const key = JSON.parse(keyJson) as Record<string, string>

		const inputTokens = sumSourcedNumbers(bucketEvents, "inputTokens")
		const outputTokens = sumSourcedNumbers(bucketEvents, "outputTokens")
		const cacheReadTokens = sumSourcedNumbers(bucketEvents, "cacheReadTokens")
		const cacheWriteTokens = sumSourcedNumbers(bucketEvents, "cacheWriteTokens")
		const reasoningTokens = sumSourcedNumbers(bucketEvents, "reasoningTokens")
		const totalBucketTokens = sumSourcedNumbers(bucketEvents, "totalTokens")
		const costUsd = sumSourcedNumbers(bucketEvents, "costUsd")

		const completedCalls = bucketEvents.filter((e) => e.status === "completed")
			.length
		const failedCalls = bucketEvents.filter((e) => e.status === "failed").length
		const cancelledCalls = bucketEvents.filter((e) => e.status === "cancelled")
			.length

		buckets.push({
			key,
			events: bucketEvents.length,
			completedCalls,
			failedCalls,
			cancelledCalls,
			inputTokens,
			outputTokens,
			cacheReadTokens,
			cacheWriteTokens,
			reasoningTokens,
			totalTokens: totalBucketTokens,
			costUsd,
			unknownEventCount: 0,
		})

		// Accumulate totals
		totalInputTokens += inputTokens
		totalOutputTokens += outputTokens
		totalCacheReadTokens += cacheReadTokens
		totalCacheWriteTokens += cacheWriteTokens
		totalReasoningTokens += reasoningTokens
		totalTokens += totalBucketTokens
		totalCostUsd += costUsd
		totalEvents += bucketEvents.length
		totalCompleted += completedCalls
		totalFailed += failedCalls
		totalCancelled += cancelledCalls

		// Track time range
		for (const event of bucketEvents) {
			const eventDate = parseISO(event.occurredAt)
			if (eventDate) {
				const eventTime = eventDate.getTime()
				if (!firstEventAt || eventTime < parseISO(firstEventAt)?.getTime()) {
					firstEventAt = event.occurredAt
				}
				if (!lastEventAt || eventTime > parseISO(lastEventAt)?.getTime()) {
					lastEventAt = event.occurredAt
				}
			}
			if (event.provenance === "history-backfill") {
				backfilledCount++
			}
		}
	}

	// Count events that couldn't be bucketed (e.g., invalid data)
	totalUnknownEvents = filteredEvents.length - totalEvents

	const totals: StatsBucket = {
		key: {},
		events: totalEvents,
		completedCalls: totalCompleted,
		failedCalls: totalFailed,
		cancelledCalls: totalCancelled,
		inputTokens: totalInputTokens,
		outputTokens: totalOutputTokens,
		cacheReadTokens: totalCacheReadTokens,
		cacheWriteTokens: totalCacheWriteTokens,
		reasoningTokens: totalReasoningTokens,
		totalTokens,
		costUsd: totalCostUsd,
		unknownEventCount: totalUnknownEvents,
	}

	const coverage = {
		firstEventAt,
		lastEventAt,
		recordingPaused: false,
		backfilledEventCount: backfilledCount,
	}

	return { buckets, totals, coverage }
}

// ── StatsService ───────────────────────────────────────────────────────────

export class UsageAggregator {
	private events: UsageEventV1[] = []

	/** Track if events have been recorded */
	private hasEvents = false

	/** Recording paused state */
	private paused = false

	/** Add an event */
	addEvent(event: UsageEventV1): void {
		this.events.push(event)
		this.hasEvents = true
	}

	/** Add multiple events */
	addEvents(events: UsageEventV1[]): void {
		this.events.push(...events)
		if (events.length > 0) {
			this.hasEvents = true
		}
	}

	/** Clear all events */
	clear(): void {
		this.events = []
		this.hasEvents = false
	}

	/** Get all events */
	getEvents(): readonly UsageEventV1[] {
		return this.events
	}

	/** Check if any events have been recorded */
	hasRecordedEvents(): boolean {
		return this.hasEvents
	}

	/** Set recording paused state */
	setPaused(paused: boolean): void {
		this.paused = paused
	}

	/** Check if recording is paused */
	isPaused(): boolean {
		return this.paused
	}

	/** Get event count */
	getEventCount(): number {
		return this.events.length
	}

	/**
	 * Query events with aggregation.
	 */
	query(query: StatsQuery): {
		buckets: StatsBucket[]
		totals: StatsBucket
		coverage: {
			firstEventAt: string | undefined
			lastEventAt: string | undefined
			recordingPaused: boolean
			backfilledEventCount: number
		}
	} {
		return aggregateEvents(this.events, query)
	}
}
