// Stub for UsageEventStore - dependency on b13
export class StatsStoreError extends Error {
	constructor(message: string) {
		super(message)
		this.name = "StatsStoreError"
	}
}

export class UsageEventStore {
	async initialize(): Promise<void> {}
	async recordEvent(): Promise<void> {}
	async getEvents(): Promise<unknown[]> {
		return []
	}
	async append(): Promise<void> {}
	async readAll(): Promise<unknown[]> {
		return []
	}
}
