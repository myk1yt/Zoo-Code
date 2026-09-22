// src/services/stats/statsQueryRange.ts
//
// Shared resolution of a StatsQuery time range into epoch-millisecond bounds.
//
// The main dashboard stats and the Dashboard "Tasks" list must agree on range
// bounds exactly, so this module is the single source of truth for:
//   preset → local-day bounds in the query timezone (via startOfDayInTimezone)
//   custom → explicit query.from/to ISO instants
// Inclusion is half-open: fromMs <= t < toMs. An absent bound is unbounded,
// and a fully unbounded range (preset "all" or no bounds at all) means no
// filtering.

import type { StatsQuery } from "@roo-code/types"

import { startOfDayInTimezone } from "./UsageAggregator"

/** Half-open [fromMs, toMs) epoch-millisecond bounds. An absent bound is unbounded. */
export interface StatsQueryRangeMs {
	fromMs?: number
	toMs?: number
}

/**
 * Resolves a StatsQuery time range to half-open epoch-millisecond bounds.
 * - preset: local-day bounds in the query timezone, evaluated at `now`
 * - otherwise: explicit query.from/to ISO instants
 * - preset "all" (or a query without any bounds): unbounded ({})
 */
export function resolveStatsQueryRangeMs(query: StatsQuery, now: Date = new Date()): StatsQueryRangeMs {
	if (query.preset) {
		const { from, to } = resolvePresetRange(query.preset, query.timezone, now)
		return { fromMs: from?.getTime(), toMs: to?.getTime() }
	}

	return {
		fromMs: parseExplicitBound(query.from),
		toMs: parseExplicitBound(query.to),
	}
}

/**
 * Parses an explicit from/to bound. Unparseable values are DROPPED (treated
 * as unbounded) rather than becoming NaN, which would silently exclude every
 * event in the half-open inclusion test. The StatsQuery schema already
 * rejects such values at the boundary; this is the defense-in-depth layer
 * for programmatically constructed queries.
 */
function parseExplicitBound(value: string | undefined): number | undefined {
	if (!value) return undefined
	const ms = new Date(value).getTime()
	return Number.isNaN(ms) ? undefined : ms
}

/** Returns true when at least one side of the range is bounded (i.e. filtering applies). */
export function isStatsQueryRangeBounded(range: StatsQueryRangeMs | undefined): boolean {
	return range?.fromMs !== undefined || range?.toMs !== undefined
}

/**
 * Half-open inclusion test: fromMs <= timeMs < toMs.
 * An undefined or fully unbounded range includes every timestamp.
 */
export function isWithinStatsQueryRange(range: StatsQueryRangeMs | undefined, timeMs: number): boolean {
	if (range?.fromMs !== undefined && timeMs < range.fromMs) return false
	if (range?.toMs !== undefined && timeMs >= range.toMs) return false
	return true
}

/**
 * Computes the local-day time range from a preset.
 * "all" is intentionally unbounded.
 *
 * Day shifting uses pure UTC millisecond arithmetic: the bounds are UTC
 * instants of timezone midnights, so +1 day is exact and identical in every
 * timezone (matching UsageAggregator.resolveTimeRange).
 */
function resolvePresetRange(
	preset: NonNullable<StatsQuery["preset"]>,
	timezone: string,
	now: Date,
): { from?: Date; to?: Date } {
	const tzNow = startOfDayInTimezone(now, timezone)
	const DAY_MS = 24 * 60 * 60 * 1000

	switch (preset) {
		case "today": {
			const from = new Date(tzNow)
			return { from, to: new Date(from.getTime() + DAY_MS) }
		}
		case "7d": {
			const to = new Date(tzNow.getTime() + DAY_MS)
			return { from: new Date(to.getTime() - 7 * DAY_MS), to }
		}
		case "30d": {
			const to = new Date(tzNow.getTime() + DAY_MS)
			return { from: new Date(to.getTime() - 30 * DAY_MS), to }
		}
		case "all":
			return {}
	}
}
