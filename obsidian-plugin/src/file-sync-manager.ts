import { CrdtStateManager } from './crdt-state-manager';

/**
 * Manages file sync operations with debouncing
 */
export class FileSyncManager {
	private stateManager: CrdtStateManager;
	private debounceDelay: number;
	private pendingSyncs: Map<string, NodeJS.Timeout> = new Map();

	constructor(stateManager: CrdtStateManager, debounceDelay: number) {
		this.stateManager = stateManager;
		this.debounceDelay = debounceDelay;
	}

	/**
	 * Schedule a sync operation for a file, debouncing rapid changes
	 */
	scheduleSync(filePath: string, syncFn: () => Promise<void>): void {
		// Clear any existing pending sync
		const existing = this.pendingSyncs.get(filePath);
		if (existing) {
			clearTimeout(existing);
		}

		// Schedule new sync
		const timeout = setTimeout(async () => {
			this.pendingSyncs.delete(filePath);
			try {
				await syncFn();
			} catch (error) {
				console.error(`Sync error for ${filePath}:`, error);
			}
		}, this.debounceDelay);

		this.pendingSyncs.set(filePath, timeout);
	}

	/**
	 * Cancel all pending syncs (e.g., on plugin unload)
	 */
	cancelAll(): void {
		for (const timeout of this.pendingSyncs.values()) {
			clearTimeout(timeout);
		}
		this.pendingSyncs.clear();
	}

	/**
	 * Force immediate sync for a file
	 */
	async forceSync(filePath: string, syncFn: () => Promise<void>): Promise<void> {
		// Cancel any pending debounced sync
		const existing = this.pendingSyncs.get(filePath);
		if (existing) {
			clearTimeout(existing);
			this.pendingSyncs.delete(filePath);
		}

		// Execute immediately
		await syncFn();
	}
}
