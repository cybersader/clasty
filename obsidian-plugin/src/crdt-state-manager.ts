import { Vault, TFile, TFolder } from 'obsidian';
import * as Y from 'yjs';

export interface CrdtState {
	clientId: string;
	update: Uint8Array;
	lastModified: number;
	sequenceNumber: number;
}

export class CrdtStateManager {
	private vault: Vault;
	private crdtFolder: string;
	private clientId: string;
	private mergedVersions: Map<string, Map<string, number>> = new Map();

	constructor(vault: Vault, crdtFolder: string, clientId: string) {
		this.vault = vault;
		this.crdtFolder = crdtFolder;
		this.clientId = clientId;
	}

	/**
	 * Get the path for a CRDT state file
	 */
	private getStatePath(filePath: string, clientId: string): string {
		// Convert notes/project.md -> .crdt/notes/project.md.{clientId}.yjs
		return `${this.crdtFolder}/${filePath}.${clientId}.yjs`;
	}

	/**
	 * Ensure the directory structure exists for a file path
	 */
	private async ensureDirectoryExists(filePath: string): Promise<void> {
		const parts = filePath.split('/');
		parts.pop(); // Remove filename
		let current = '';

		for (const part of parts) {
			current = current ? `${current}/${part}` : part;
			const existing = this.vault.getAbstractFileByPath(current);
			if (!existing) {
				await this.vault.createFolder(current);
			}
		}
	}

	/**
	 * Save CRDT state for a file
	 */
	async saveState(filePath: string, doc: Y.Doc): Promise<void> {
		const statePath = this.getStatePath(filePath, this.clientId);

		// Ensure directory exists
		await this.ensureDirectoryExists(statePath);

		// Encode state
		const update = Y.encodeStateAsUpdate(doc);

		// Create metadata header
		const metadata = {
			version: 1,
			clientId: this.clientId,
			lastModified: Date.now(),
			sequenceNumber: this.getSequenceNumber(doc),
		};

		// Combine metadata and state
		const metadataBytes = new TextEncoder().encode(JSON.stringify(metadata));
		const headerSize = 256;
		const header = new Uint8Array(headerSize);
		header.set(metadataBytes.slice(0, Math.min(metadataBytes.length, headerSize - 1)));

		const combined = new Uint8Array(headerSize + update.length);
		combined.set(header);
		combined.set(update, headerSize);

		// Write to vault
		const existing = this.vault.getAbstractFileByPath(statePath);
		if (existing instanceof TFile) {
			await this.vault.modifyBinary(existing, combined.buffer);
		} else {
			await this.vault.createBinary(statePath, combined.buffer);
		}
	}

	/**
	 * Load all CRDT states for a file (from all clients)
	 */
	async loadAllStates(filePath: string): Promise<CrdtState[]> {
		const states: CrdtState[] = [];
		const stateDir = `${this.crdtFolder}/${this.getDirectoryPath(filePath)}`;
		const fileName = this.getFileName(filePath);

		const folder = this.vault.getAbstractFileByPath(stateDir);
		if (!(folder instanceof TFolder)) {
			return states;
		}

		for (const file of folder.children) {
			if (!(file instanceof TFile)) continue;
			if (!file.name.startsWith(fileName + '.') || !file.name.endsWith('.yjs')) continue;

			try {
				const data = await this.vault.readBinary(file);
				const bytes = new Uint8Array(data);

				// Parse header
				const headerBytes = bytes.slice(0, 256);
				const headerStr = new TextDecoder().decode(headerBytes).replace(/\0+$/, '');
				const metadata = JSON.parse(headerStr);

				// Extract update
				const update = bytes.slice(256);

				states.push({
					clientId: metadata.clientId,
					update: update,
					lastModified: metadata.lastModified,
					sequenceNumber: metadata.sequenceNumber,
				});
			} catch (error) {
				console.error(`Error loading state file ${file.path}:`, error);
			}
		}

		return states;
	}

	/**
	 * Check if a state is newer than what we've already merged
	 */
	isStateNewer(filePath: string, state: CrdtState): boolean {
		const fileVersions = this.mergedVersions.get(filePath);
		if (!fileVersions) return true;

		const lastMerged = fileVersions.get(state.clientId);
		if (!lastMerged) return true;

		return state.lastModified > lastMerged;
	}

	/**
	 * Mark a state as merged
	 */
	markStateMerged(filePath: string, state: CrdtState): void {
		let fileVersions = this.mergedVersions.get(filePath);
		if (!fileVersions) {
			fileVersions = new Map();
			this.mergedVersions.set(filePath, fileVersions);
		}
		fileVersions.set(state.clientId, state.lastModified);
	}

	/**
	 * Get current sequence number from Y.Doc
	 */
	private getSequenceNumber(doc: Y.Doc): number {
		const stateVector = Y.encodeStateVector(doc);
		// Sum of all client clocks
		let total = 0;
		const view = new DataView(stateVector.buffer);
		// Simple heuristic: use array length as proxy
		return stateVector.length;
	}

	/**
	 * Get directory path from file path
	 */
	private getDirectoryPath(filePath: string): string {
		const parts = filePath.split('/');
		parts.pop();
		return parts.join('/');
	}

	/**
	 * Get filename from file path
	 */
	private getFileName(filePath: string): string {
		return filePath.split('/').pop() || filePath;
	}
}
