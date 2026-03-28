import { Vault, TFile } from 'obsidian';

export interface PresenceInfo {
	clientId: string;
	displayName: string;
	filePath: string;
	cursorLine: number;
	cursorCh: number;
	lastSeen: number;
	selectionStart?: { line: number; ch: number };
	selectionEnd?: { line: number; ch: number };
}

export interface PresenceState {
	clients: Record<string, PresenceInfo>;
	updated: number;
}

/**
 * Manages presence awareness - who is editing what file and where
 *
 * In file-only mode: Stores presence in .crdt/_meta/presence.json
 * In server mode: Broadcasts via WebSocket for real-time updates
 */
export class PresenceManager {
	private vault: Vault;
	private crdtFolder: string;
	private clientId: string;
	private displayName: string;
	private currentFile: string | null = null;
	private cursorPosition: { line: number; ch: number } = { line: 0, ch: 0 };
	private updateInterval: number | null = null;
	private presenceCache: PresenceState = { clients: {}, updated: 0 };

	// Callbacks for UI updates
	private onPresenceChange: ((presence: PresenceInfo[]) => void) | null = null;

	// How often to write our presence (ms)
	private readonly WRITE_INTERVAL = 2000;

	// Consider a client "gone" after this many ms of no updates
	private readonly STALE_THRESHOLD = 30000;

	constructor(
		vault: Vault,
		crdtFolder: string,
		clientId: string,
		displayName: string
	) {
		this.vault = vault;
		this.crdtFolder = crdtFolder;
		this.clientId = clientId;
		this.displayName = displayName;
	}

	/**
	 * Start presence tracking
	 */
	start(): void {
		this.updateInterval = window.setInterval(
			() => this.writePresence(),
			this.WRITE_INTERVAL
		);
	}

	/**
	 * Stop presence tracking
	 */
	stop(): void {
		if (this.updateInterval) {
			window.clearInterval(this.updateInterval);
			this.updateInterval = null;
		}
		// Clear our presence
		this.currentFile = null;
		this.writePresence();
	}

	/**
	 * Update which file we're currently viewing
	 */
	setCurrentFile(filePath: string | null): void {
		this.currentFile = filePath;
	}

	/**
	 * Update our cursor position
	 */
	setCursorPosition(line: number, ch: number): void {
		this.cursorPosition = { line, ch };
	}

	/**
	 * Set callback for presence changes
	 */
	setOnPresenceChange(callback: (presence: PresenceInfo[]) => void): void {
		this.onPresenceChange = callback;
	}

	/**
	 * Get other users currently viewing a specific file
	 */
	async getPresenceForFile(filePath: string): Promise<PresenceInfo[]> {
		await this.loadPresence();

		const now = Date.now();
		const results: PresenceInfo[] = [];

		for (const [id, info] of Object.entries(this.presenceCache.clients)) {
			// Skip ourselves
			if (id === this.clientId) continue;

			// Skip stale entries
			if (now - info.lastSeen > this.STALE_THRESHOLD) continue;

			// Only include if viewing the same file
			if (info.filePath === filePath) {
				results.push(info);
			}
		}

		return results;
	}

	/**
	 * Get all active users across all files
	 */
	async getAllPresence(): Promise<PresenceInfo[]> {
		await this.loadPresence();

		const now = Date.now();
		const results: PresenceInfo[] = [];

		for (const [id, info] of Object.entries(this.presenceCache.clients)) {
			if (id === this.clientId) continue;
			if (now - info.lastSeen > this.STALE_THRESHOLD) continue;
			results.push(info);
		}

		return results;
	}

	/**
	 * Write our presence to the shared presence file
	 */
	private async writePresence(): Promise<void> {
		try {
			const presencePath = `${this.crdtFolder}/_meta/presence.json`;

			// Load current state
			await this.loadPresence();

			// Update our entry
			if (this.currentFile) {
				this.presenceCache.clients[this.clientId] = {
					clientId: this.clientId,
					displayName: this.displayName || this.clientId.substring(0, 8),
					filePath: this.currentFile,
					cursorLine: this.cursorPosition.line,
					cursorCh: this.cursorPosition.ch,
					lastSeen: Date.now(),
				};
			} else {
				// Remove ourselves if no file open
				delete this.presenceCache.clients[this.clientId];
			}

			// Clean up stale entries
			const now = Date.now();
			for (const [id, info] of Object.entries(this.presenceCache.clients)) {
				if (now - info.lastSeen > this.STALE_THRESHOLD * 2) {
					delete this.presenceCache.clients[id];
				}
			}

			this.presenceCache.updated = now;

			// Write back
			await this.ensureDirectoryExists(presencePath);
			const content = JSON.stringify(this.presenceCache, null, 2);

			const existing = this.vault.getAbstractFileByPath(presencePath);
			if (existing instanceof TFile) {
				await this.vault.modify(existing, content);
			} else {
				await this.vault.create(presencePath, content);
			}

			// Notify listeners
			if (this.onPresenceChange && this.currentFile) {
				const others = await this.getPresenceForFile(this.currentFile);
				this.onPresenceChange(others);
			}
		} catch (error) {
			console.error('Error writing presence:', error);
		}
	}

	/**
	 * Load presence state from file
	 */
	private async loadPresence(): Promise<void> {
		try {
			const presencePath = `${this.crdtFolder}/_meta/presence.json`;
			const file = this.vault.getAbstractFileByPath(presencePath);

			if (file instanceof TFile) {
				const content = await this.vault.read(file);
				this.presenceCache = JSON.parse(content);
			}
		} catch (error) {
			// File doesn't exist or is invalid - start fresh
			this.presenceCache = { clients: {}, updated: 0 };
		}
	}

	/**
	 * Ensure directory exists for a file path
	 */
	private async ensureDirectoryExists(filePath: string): Promise<void> {
		const parts = filePath.split('/');
		parts.pop();
		let current = '';

		for (const part of parts) {
			current = current ? `${current}/${part}` : part;
			const existing = this.vault.getAbstractFileByPath(current);
			if (!existing) {
				await this.vault.createFolder(current);
			}
		}
	}
}

/**
 * Format presence info for display
 */
export function formatPresenceMessage(presence: PresenceInfo[]): string {
	if (presence.length === 0) return '';

	if (presence.length === 1) {
		const p = presence[0];
		return `${p.displayName} is editing (line ${p.cursorLine + 1})`;
	}

	const names = presence.map(p => p.displayName).join(', ');
	return `${names} are also editing this file`;
}

/**
 * Get a "nudge" message suggesting where to edit safely
 */
export function getNudgeMessage(presence: PresenceInfo[], totalLines: number): string | null {
	if (presence.length === 0) return null;

	// Find occupied line ranges
	const occupiedRanges = presence.map(p => ({
		start: Math.max(0, p.cursorLine - 5),
		end: Math.min(totalLines, p.cursorLine + 5),
		user: p.displayName,
	}));

	// Suggest editing outside these ranges
	const suggestions: string[] = [];

	// Check beginning of file
	if (occupiedRanges.every(r => r.start > 10)) {
		suggestions.push('beginning of file');
	}

	// Check end of file
	if (occupiedRanges.every(r => r.end < totalLines - 10)) {
		suggestions.push('end of file');
	}

	if (suggestions.length > 0) {
		return `Consider editing near the ${suggestions.join(' or ')} to avoid conflicts`;
	}

	return null;
}
