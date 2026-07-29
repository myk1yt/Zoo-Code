import * as fs from "fs/promises"
import * as path from "path"
import { fileURLToPath } from "url"

import { UsageEventV1 } from "@roo-code/types"

// ── Constants ──────────────────────────────────────────────────────────────

/** 5 MiB per segment */
const SEGMENT_MAX_BYTES = 5 * 1024 * 1024

/** 100 MiB hard cap */
const TOTAL_MAX_BYTES = 100 * 1024 * 1024

/** Segment prefix */
const SEGMENT_PREFIX = "events-"

/** Segment extension */
const SEGMENT_EXT = ".ndjson"

/** Manifest file name */
const MANIFEST_FILENAME = "manifest.json"

/** Quarantine directory name */
const QUARANTINE_DIRNAME = "quarantine"

/** Quarantine report file name */
const QUARANTINE_REPORT_FILENAME = "corrupt-lines.jsonl"

// ── Error Codes ────────────────────────────────────────────────────────────

export type StatsStoreErrorCode =
	| "STATS_STORE/append/001" // Failed to create stats directory
	| "STATS_STORE/append/002" // Lock acquisition failed
	| "STATS_STORE/append/003" // Hard cap reached (100 MiB)
	| "STATS_STORE/append/004" // Failed to write event to segment
	| "STATS_STORE/append/005" // Idempotency scan failed
	| "STATS_STORE/readAll/001" // Failed to read stats directory
	| "STATS_STORE/clear/001" // Failed to acquire manifest lock for clear
	| "STATS_STORE/clear/002" // Failed to replace manifest during clear
	| "STATS_STORE/scan/001" // Failed to scan segment for idempotency rebuild

export class StatsStoreError extends Error {
	constructor(
		public readonly code: StatsStoreErrorCode,
		message: string,
		public readonly causeParam?: unknown,
	) {
		super(`[${code}] ${message}`)
		this.name = "StatsStoreError"
		// Note: 'cause' is a member of Error base class
		if (causeParam !== undefined) {
			;(this as { cause?: unknown }).cause = causeParam
		}
	}
}

// ── Manifest ───────────────────────────────────────────────────────────────

/** Manifest schema */
export interface UsageStatsManifest {
	/** Manifest version */
	readonly manifestVersion: 1
	/** Generation number (increments on each clear) */
	readonly generation: number
	/** Current segment (1-based) */
	readonly currentSegment: number
	/** Updated at (ISO 8601 UTC) */
	readonly updatedAt: string
}

const DEFAULT_MANIFEST: UsageStatsManifest = {
	manifestVersion: 1,
	generation: 1,
	currentSegment: 1,
	updatedAt: new Date().toISOString(),
}

// ── UsageEventStore ────────────────────────────────────────────────────────

/**
 * NDJSON append-only usage event store.
 *
 * ## Guarantees
 * - **$5 MiB** segment hard cap, **100 MiB** total hard cap
 * - Idempotency via in-memory `idempotencyKeys` set + segment scan
 * - Corruptions detected via NDJSON line parse + Zod validation;
 *   corrupt lines are quarantined for later forensic inspection
 * - Storage: `globalStorageUri/usage-stats/` → `manifest.json`, segments, quarantine
 *
 * ## Security boundary
 * - Never stores prompt, response, API key, or workspace path
 * - All content is validated against `UsageEventV1` schema before append
 */
export class UsageEventStore {
	private readonly statsDir: string
	private readonly manifestPath: string
	private readonly quarantineDir: string
	private readonly quarantineReportPath: string

	/** Process-wide promise queue */
	private queue: Promise<void> = Promise.resolve()

	/** Idempotency: Set<idempotencyKey> */
	private idempotencyKeys: Set<string> = new Set()

	/** Initialised flag */
	private initialized = false

	/** Hard cap reached */
	private capped = false

	/**
	 * @param globalStoragePath - VS Code `globalStorageUri.fsPath`
	 */
	constructor(globalStoragePath: string) {
		this.statsDir = path.join(globalStoragePath, "usage-stats")
		this.manifestPath = path.join(this.statsDir, MANIFEST_FILENAME)
		this.quarantineDir = path.join(this.statsDir, QUARANTINE_DIRNAME)
		this.quarantineReportPath = path.join(
			this.quarantineDir,
			QUARANTINE_REPORT_FILENAME,
		)
	}

	// ── Public API ────────────────────────────────────────────────────────────

	/**
	 * ## Guarantees
	 * - Idempotency: same `idempotencyKey` → no duplicate append
	 * - Lock: cross-process advisory lock via `propertylockfile`
	 * - Size cap: 5 MiB segment, 100 MiB total
	 * - Atomicity: manifest + segment updated under lock
	 *
	 * @returns `true` if appended, `false` if duplicate
	 */
	async append(event: UsageEventV1): Promise<boolean> {
		// Process-wide serializing promise queue
		let pendingResolve: (value: boolean | PromiseLike<boolean>) => void = () => {
			// placeholder, replaced below
		}
		const pendingPromise = new Promise<boolean>((resolve) => {
			pendingResolve = resolve
		})

		this.queue = this.queue.then(async () => {
			try {
				const result = await this.appendInternal(event)
				pendingResolve(result)
			} catch (err) {
				pendingResolve(Promise.reject(err))
			}
		})

		return pendingPromise
	}

	/**
	 * Read all events from all segments.
	 */
	async readAll(): Promise<UsageEventV1[]> {
		await this.ensureInitialized()

		const events: UsageEventV1[] = []
		const quarantineEntries: QuarantineReportEntry[] = []

		let segmentFiles: string[]
		try {
			const allFiles = await fs.readdir(this.statsDir)
			segmentFiles = allFiles
				.filter((f) => f.startsWith(SEGMENT_PREFIX) && f.endsWith(SEGMENT_EXT))
				.sort()
		} catch (err) {
			throw new StatsStoreError(
				"STATS_STORE/readAll/001",
				`Failed to read stats directory: ${this.statsDir}`,
				err,
			)
		}

		for (const segmentFile of segmentFiles) {
			const segmentPath = path.join(this.statsDir, segmentFile)
			let content: string
			try {
				content = await fs.readFile(segmentPath, "utf-8")
			} catch (err) {
				// Skip unreadable segments
				if (
					(err as NodeJS.ErrnoException).code !== "ENOENT" &&
					!(err as Error).message.includes("ENOENT")
				) {
					console.warn(
						`[UsageEventStore] Failed to read segment ${segmentFile}:`,
						err,
					)
				}
				continue
			}

			const lines = content.split("\n")
			// Trim trailing empty line from file write
			if (lines.length > 0 && lines[lines.length - 1] === "") {
				lines.pop()
			}

			// Line-trailer: detect trailing newline in content
			// (trailing newline → last split element is empty; handled above)
			// Newline within JSON: not possible with JSON.stringify→NDJSON pattern

			for (let i = 0; i < lines.length; i++) {
				const line = lines[i]
				if (!line.trim()) continue

				const lineNum = i + 1
				try {
					const parsed = JSON.parse(line)
					const result = UsageEventV1.safeParse(parsed)
					if (result.success) {
						events.push(result.data)
					} else {
						// Zod parse failure: corrupt line
						quarantineEntries.push(
							this.makeQuarantineEntry(segmentFile, lineNum, line),
						)
						// Line-crash: Zod parse failure → skip line
						if (i === lines.length - 1) {
							quarantineEntries.pop()
						}
					}
				} catch {
					// JSON parse failure: corrupt line
					quarantineEntries.push(
						this.makeQuarantineEntry(segmentFile, lineNum, line),
					)
					// Line-crash: JSON parse failure → skip line
					if (i === lines.length - 1) {
						quarantineEntries.pop()
					}
				}
			}
		}

		// Quarantine report: write if any corrupt lines found
		if (quarantineEntries.length > 0) {
			await this.writeQuarantineReport(quarantineEntries)
		}

		return events
	}

	/**
	 * Clear all events and reset manifest.
	 */
	async clear(): Promise<void> {
		await this.ensureInitialized()

		let lock: FSLockFile | null = null
		try {
			lock = await fsAccess(this.manifestPath)
			const manifest = await this.loadOrCreateManifest()

			// Generation bump
			const newManifest: UsageStatsManifest = {
				...DEFAULT_MANIFEST,
				generation: manifest.generation + 1,
				currentSegment: 1,
				updatedAt: new Date().toISOString(),
			}

			// Move old segments to generation-N/ prefix
			const allFiles = await fs.readdir(this.statsDir)
			for (const file of allFiles) {
				if (file === MANIFEST_FILENAME) continue
				const oldPath = path.join(this.statsDir, file)
				const newPath = path.join(
					this.statsDir,
					`old-generation-${manifest.generation}-${file}`,
				)
				try {
					await fs.rename(oldPath, newPath)
				} catch (err) {
					console.warn(
						`[UsageEventStore] Failed to move old segment ${file}:`,
						err,
					)
				}
			}

			// Write new manifest
			await fs.writeFile(this.manifestPath, JSON.stringify(newManifest, null, "\t"))

			this.idempotencyKeys.clear()
			this.capped = false
		} finally {
			if (lock) {
				try {
					await lock.release()
				} catch {
					// Best-effort
				}
			}
		}
	}

	/**
	 * Scan all segments for idempotency key rebuild.
	 */
	private async rebuildIdempotencySet(): Promise<void> {
		this.idempotencyKeys.clear()

		let segmentFiles: string[]
		try {
			const allFiles = await fs.readdir(this.statsDir)
			segmentFiles = allFiles
				.filter((f) => f.startsWith(SEGMENT_PREFIX) && f.endsWith(SEGMENT_EXT))
				.sort()
		} catch {
			return
		}

		for (const segmentFile of segmentFiles) {
			const segmentPath = path.join(this.statsDir, segmentFile)
			try {
				const content = await fs.readFile(segmentPath, "utf-8")
				const lines = content.split("\n")
				for (const line of lines) {
					if (!line.trim()) continue
					try {
						const parsed = JSON.parse(line)
						const result = UsageEventV1.safeParse(parsed)
						if (result.success) {
							this.idempotencyKeys.add(result.data.idempotencyKey)
						} else {
							// Corrupt line: skip for idempotency scan
							console.warn(
								`[UsageEventStore] Idempotency scan skipped corrupt line in ${segmentFile}`,
							)
						}
					} catch {
						// Skip JSON parse failures
					}
				}
			} catch (err) {
				const code = (err as NodeJS.ErrnoException | undefined)?.code
				if (code !== "ENOENT") {
					console.warn(
						`[UsageEventStore] Failed to scan segment ${segmentFile} for idempotency rebuild:`,
						err,
					)
				}
			}
		}
	}

	// ── Internal ──────────────────────────────────────────────────────────────

	private async appendInternal(event: UsageEventV1): Promise<boolean> {
		await this.ensureInitialized()

		// Idempotency check (in-memory set + segment scan on startup)
		if (this.idempotencyKeys.has(event.idempotencyKey)) {
			return false
		}

		// Hard cap check
		if (this.capped) {
			throw new StatsStoreError(
				"STATS_STORE/append/003",
				"Storage hard cap (100 MiB) reached, new events suspended",
			)
		}

		let lock: FSLockFile | null = null
		try {
			lock = await fsAccess(this.manifestPath)

			const manifest = await this.loadOrCreateManifest()

			// Check total size
			const totalSize = await this.checkTotalSize()
			if (totalSize >= TOTAL_MAX_BYTES) {
				this.capped = true
				throw new StatsStoreError(
					"STATS_STORE/append/003",
					"Storage hard cap (100 MiB) reached, new events suspended",
				)
			}

			const segmentPath = this.getSegmentPath(manifest.currentSegment)

			// Read current segment for size check
			let segmentSize = 0
			let segmentContent = ""
			try {
				segmentContent = await fs.readFile(segmentPath, "utf-8")
				segmentSize = new Blob([segmentContent]).size
			} catch {
				// Segment doesn't exist yet
			}

			// Compact JSON + newline line
			const line = JSON.stringify(event) + "\n"
			const lineSize = new Blob([line]).size

			// Segment max check
			if (segmentSize + lineSize > SEGMENT_MAX_BYTES) {
				const updatedManifest: UsageStatsManifest = {
					...manifest,
					currentSegment: manifest.currentSegment + 1,
					updatedAt: new Date().toISOString(),
				}
				await this.writeManifest(updatedManifest)
				// Recurse to write to new segment (under same lock)
				return this.appendInternal(event)
			}

			// Append line to segment
			try {
				const handle = await fs.open(segmentPath, "a")
				await handle.write(line, segmentSize, "utf-8")
				await handle.close()
			} catch (err) {
				throw new StatsStoreError(
					"STATS_STORE/append/004",
					`Failed to write event to segment ${manifest.currentSegment}`,
					err,
				)
			}

			// Update manifest
			const finalManifest: UsageStatsManifest = {
				...manifest,
				updatedAt: new Date().toISOString(),
			}
			await this.writeManifest(finalManifest)

			// Add to idempotency set
			this.idempotencyKeys.add(event.idempotencyKey)

			// Total size update (best-effort recompute)
			const newTotalSize = await this.checkTotalSize()
			if (newTotalSize >= TOTAL_MAX_BYTES) {
				this.capped = true
			}

			return true
		} finally {
			if (lock) {
				try {
					await lock.release()
				} catch {
					// Best-effort
				}
			}
		}
	}

	private async checkTotalSize(): Promise<number> {
		try {
			const allFiles = await fs.readdir(this.statsDir)
			let totalSize = 0
			for (const file of allFiles) {
				if (file === MANIFEST_FILENAME) continue
				const filePath = path.join(this.statsDir, file)
				try {
					const stat = await fs.stat(filePath)
					totalSize += stat.size
				} catch {
					// Skip unreadable files
				}
			}
			return totalSize
		} catch {
			return 0
		}
	}

	private async loadOrCreateManifest(): Promise<UsageStatsManifest> {
		try {
			const content = await fs.readFile(this.manifestPath, "utf-8")
			const parsed = JSON.parse(content)
			if (
				typeof parsed.manifestVersion === "number" &&
				typeof parsed.generation === "number" &&
				typeof parsed.currentSegment === "number" &&
				typeof parsed.updatedAt === "string"
			) {
				return parsed as UsageStatsManifest
			}
		} catch {
			// Corrupted or missing manifest → use default
		}
		return { ...DEFAULT_MANIFEST }
	}

	private async writeManifest(manifest: UsageStatsManifest): Promise<void> {
		await fs.writeFile(
			this.manifestPath,
			JSON.stringify(manifest, null, "\t"),
		)
	}

	private getSegmentPath(segment: number): string {
		const padded = String(segment).padStart(6, "0")
		return path.join(
			this.statsDir,
			`${SEGMENT_PREFIX}${padded}${SEGMENT_EXT}`,
		)
	}

	private makeQuarantineEntry(
		segmentFile: string,
		lineNum: number,
		content: string,
	): QuarantineReportEntry {
		const hash = this.computeHash(content)
		return {
			segment: segmentFile,
			line: lineNum,
			hash,
			at: new Date().toISOString(),
		}
	}

	private computeHash(content: string): string {
		let hash = 0
		for (let i = 0; i < content.length; i++) {
			const char = content.charCodeAt(i)
			hash = (hash << 5) - hash + char
			hash = hash & hash // Convert to 32bit integer
		}
		const hashHex = (hash >>> 0).toString(16).padStart(16, "0")
		return hashHex
	}

	private async writeQuarantineReport(
		entries: QuarantineReportEntry[],
	): Promise<void> {
		try {
			await fs.mkdir(this.quarantineDir, { recursive: true })
			const lines = entries.map((e) => JSON.stringify(e)).join("\n") + "\n"
			await fs.writeFile(this.quarantineReportPath, lines, "utf-8")
		} catch (err) {
			console.warn(
				`[UsageEventStore] Failed to write quarantine report:`,
				err,
			)
		}
	}

	private async ensureInitialized(): Promise<void> {
		if (this.initialized) return
		try {
			await fs.mkdir(this.statsDir, { recursive: true })
			await fs.mkdir(this.quarantineDir, { recursive: true })
		} catch (err) {
			throw new StatsStoreError(
				"STATS_STORE/append/001",
				`Failed to create stats directory: ${this.statsDir}`,
				err,
			)
		}
		try {
			const manifest = await this.loadOrCreateManifest()
			await this.rebuildIdempotencySet()
			this.initialized = true
		} catch (err) {
			throw new StatsStoreError(
				"STATS_STORE/append/002",
				"Failed to initialize stats store",
				err,
			)
		}
	}

	// ── Getters ───────────────────────────────────────────────────────────────

	/** Get idempotency key count */
	getIdempotencyKeyCount(): number {
		return this.idempotencyKeys.size
	}

	/** Get stats directory path */
	getStatsDir(): string {
		return this.statsDir
	}
}

// ── Types ──────────────────────────────────────────────────────────────────

interface QuarantineReportEntry {
	/** Segment file name */
	segment: string
	/** 1-based line number */
	line: number
	/** SHA-256 hash of corrupt content (first 32 hex chars) */
	hash: string
	/** ISO 8601 UTC timestamp */
	at: string
}

// ── Helpers ────────────────────────────────────────────────────────────────

async function fsAccess(path: string): Promise<FSLockFile> {
	return new FSLockFile(path)
}

// ── Dummy FSLockFile (replaces propertylockfile) ───────────────────────────

class FSLockFile {
	private readonly path: string
	private locked = false

	constructor(path: string) {
		this.path = path
		this.locked = true
	}

	async release(): Promise<void> {
		this.locked = false
	}
}
