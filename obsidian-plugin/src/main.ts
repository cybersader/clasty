import { App, Notice, Plugin, PluginSettingTab, Setting, TFile, TFolder, MarkdownView } from 'obsidian';
import * as Y from 'yjs';
import { CrdtStateManager } from './crdt-state-manager';
import { FileSyncManager } from './file-sync-manager';
import { PresenceManager, PresenceInfo, formatPresenceMessage, getNudgeMessage } from './presence-manager';
import { generateClientId, getDisplayName } from './identity';

interface CrdtSyncSettings {
	clientId: string;
	displayName: string;

	// Sync modes - progressive adoption
	syncMode: 'file-only' | 'hybrid' | 'server-only';
	serverUrl: string;

	// File-based sync settings
	backgroundCheckInterval: number;
	debounceDelay: number;
	crdtFolderName: string;

	// Presence awareness
	showPresence: boolean;
	showPresenceNudge: boolean;

	// UI
	showSyncStatus: boolean;
	showConflictNotifications: boolean;
}

const DEFAULT_SETTINGS: CrdtSyncSettings = {
	clientId: '',
	displayName: '',
	syncMode: 'hybrid',  // Default to hybrid - works both ways
	serverUrl: '',
	backgroundCheckInterval: 3000,  // 3 seconds for better responsiveness
	debounceDelay: 500,
	crdtFolderName: '.crdt',
	showPresence: true,
	showPresenceNudge: true,
	showSyncStatus: true,
	showConflictNotifications: true,
};

export default class CrdtSyncPlugin extends Plugin {
	settings: CrdtSyncSettings;
	private stateManager: CrdtStateManager;
	private fileSyncManager: FileSyncManager;
	private presenceManager: PresenceManager;
	private activeDocs: Map<string, Y.Doc> = new Map();
	private backgroundCheckTimer: number | null = null;
	private statusBarItem: HTMLElement | null = null;
	private presenceStatusItem: HTMLElement | null = null;

	// Server mode (optional)
	private wsConnection: WebSocket | null = null;
	private serverConnected: boolean = false;

	async onload() {
		await this.loadSettings();

		// Ensure client ID exists
		if (!this.settings.clientId) {
			this.settings.clientId = generateClientId();
			await this.saveSettings();
		}

		// Initialize managers
		this.stateManager = new CrdtStateManager(
			this.app.vault,
			this.settings.crdtFolderName,
			this.settings.clientId
		);
		this.fileSyncManager = new FileSyncManager(
			this.stateManager,
			this.settings.debounceDelay
		);
		this.presenceManager = new PresenceManager(
			this.app.vault,
			this.settings.crdtFolderName,
			this.settings.clientId,
			this.settings.displayName
		);

		// Register event handlers
		this.registerEvent(
			this.app.workspace.on('file-open', this.onFileOpen.bind(this))
		);

		this.registerEvent(
			this.app.vault.on('modify', this.onFileModify.bind(this))
		);

		// Track cursor position for presence
		this.registerEvent(
			this.app.workspace.on('active-leaf-change', () => this.updatePresenceFromCursor())
		);

		// Add status bar items
		if (this.settings.showSyncStatus) {
			this.statusBarItem = this.addStatusBarItem();
			this.updateStatusBar('idle');
		}

		if (this.settings.showPresence) {
			this.presenceStatusItem = this.addStatusBarItem();
			this.presenceStatusItem.setText('');
		}

		// Start background merge checking (file-based sync)
		if (this.settings.syncMode !== 'server-only') {
			this.startBackgroundCheck();
		}

		// Start presence tracking
		if (this.settings.showPresence) {
			this.presenceManager.start();
			this.presenceManager.setOnPresenceChange((presence) => {
				this.updatePresenceDisplay(presence);
			});
		}

		// Connect to server if configured
		if (this.settings.syncMode !== 'file-only' && this.settings.serverUrl) {
			this.connectToServer();
		}

		// Add settings tab
		this.addSettingTab(new CrdtSyncSettingTab(this.app, this));

		// Add commands
		this.addCommand({
			id: 'force-sync',
			name: 'Force sync current file',
			callback: () => this.forceSyncCurrentFile(),
		});

		this.addCommand({
			id: 'show-sync-status',
			name: 'Show sync status',
			callback: () => this.showSyncStatus(),
		});

		console.log('CRDT Sync plugin loaded');
		console.log(`Client ID: ${this.settings.clientId}`);
	}

	onunload() {
		if (this.backgroundCheckTimer) {
			window.clearInterval(this.backgroundCheckTimer);
		}
		if (this.presenceManager) {
			this.presenceManager.stop();
		}
		if (this.wsConnection) {
			this.wsConnection.close();
		}
		console.log('CRDT Sync plugin unloaded');
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	private async onFileOpen(file: TFile | null) {
		if (!file || file.extension !== 'md') return;

		// Skip .crdt folder files
		if (file.path.startsWith(this.settings.crdtFolderName)) return;

		const path = file.path;

		try {
			this.updateStatusBar('syncing');

			// Update presence - we're now viewing this file
			this.presenceManager.setCurrentFile(path);

			// Get or create Y.Doc for this file
			let doc = this.activeDocs.get(path);
			if (!doc) {
				doc = new Y.Doc();
				this.activeDocs.set(path, doc);
			}

			// Load and merge all remote states (file-based sync)
			if (this.settings.syncMode !== 'server-only') {
				const remoteStates = await this.stateManager.loadAllStates(path);

				for (const state of remoteStates) {
					if (state.clientId !== this.settings.clientId) {
						Y.applyUpdate(doc, state.update);
					}
				}
			}

			// Get current file content
			const currentContent = await this.app.vault.read(file);
			const ytext = doc.getText('content');
			const crdtContent = ytext.toString();

			if (crdtContent && crdtContent !== currentContent) {
				// Remote changes exist - update file
				await this.app.vault.modify(file, crdtContent);
				if (this.settings.showConflictNotifications) {
					new Notice(`${file.basename} updated with remote changes`);
				}
			} else if (!crdtContent && currentContent) {
				// First time - initialize CRDT from file
				doc.transact(() => {
					ytext.insert(0, currentContent);
				}, this.settings.clientId);

				// Save our initial state
				await this.stateManager.saveState(path, doc);
			}

			// Check for other users viewing this file
			if (this.settings.showPresence) {
				const presence = await this.presenceManager.getPresenceForFile(path);
				this.updatePresenceDisplay(presence);

				if (presence.length > 0 && this.settings.showPresenceNudge) {
					const lineCount = currentContent.split('\n').length;
					const nudge = getNudgeMessage(presence, lineCount);
					if (nudge) {
						new Notice(nudge, 5000);
					}
				}
			}

			this.updateStatusBar('idle');
		} catch (error) {
			console.error('Error on file open:', error);
			this.updateStatusBar('error');
		}
	}

	private async onFileModify(file: TFile) {
		if (file.extension !== 'md') return;

		const path = file.path;
		const doc = this.activeDocs.get(path);

		if (!doc) {
			// File not tracked yet - will be handled on open
			return;
		}

		// Debounce saves
		this.fileSyncManager.scheduleSync(path, async () => {
			try {
				this.updateStatusBar('syncing');

				const content = await this.app.vault.read(file);
				const ytext = doc.getText('content');
				const crdtContent = ytext.toString();

				if (content !== crdtContent) {
					// Apply diff to CRDT
					doc.transact(() => {
						// Simple approach: replace all content
						// TODO: Use diff-match-patch for efficient updates
						ytext.delete(0, ytext.length);
						ytext.insert(0, content);
					}, this.settings.clientId);
				}

				// Save our state
				await this.stateManager.saveState(path, doc);

				this.updateStatusBar('idle');
			} catch (error) {
				console.error('Error on file modify:', error);
				this.updateStatusBar('error');
			}
		});
	}

	private startBackgroundCheck() {
		this.backgroundCheckTimer = window.setInterval(
			() => this.backgroundMergeCheck(),
			this.settings.backgroundCheckInterval
		);
	}

	private async backgroundMergeCheck() {
		for (const [path, doc] of this.activeDocs) {
			try {
				const remoteStates = await this.stateManager.loadAllStates(path);

				let hasNewChanges = false;
				for (const state of remoteStates) {
					if (state.clientId === this.settings.clientId) continue;

					// Check if this state is newer than what we've merged
					if (this.stateManager.isStateNewer(path, state)) {
						Y.applyUpdate(doc, state.update);
						this.stateManager.markStateMerged(path, state);
						hasNewChanges = true;
					}
				}

				if (hasNewChanges) {
					// Update file with merged content
					const file = this.app.vault.getAbstractFileByPath(path);
					if (file instanceof TFile) {
						const currentContent = await this.app.vault.read(file);
						const mergedContent = doc.getText('content').toString();

						if (mergedContent !== currentContent) {
							await this.app.vault.modify(file, mergedContent);
							if (this.settings.showConflictNotifications) {
								new Notice(`${file.basename} updated with remote changes`);
							}
						}
					}
				}
			} catch (error) {
				console.error(`Error checking ${path}:`, error);
			}
		}
	}

	private updateStatusBar(status: 'idle' | 'syncing' | 'error') {
		if (!this.statusBarItem) return;

		switch (status) {
			case 'idle':
				this.statusBarItem.setText('CRDT: Synced');
				break;
			case 'syncing':
				this.statusBarItem.setText('CRDT: Syncing...');
				break;
			case 'error':
				this.statusBarItem.setText('CRDT: Error');
				break;
		}
	}

	private async forceSyncCurrentFile() {
		const file = this.app.workspace.getActiveFile();
		if (!file || file.extension !== 'md') {
			new Notice('No markdown file active');
			return;
		}

		await this.onFileOpen(file);
		new Notice(`Synced ${file.basename}`);
	}

	private showSyncStatus() {
		const activeCount = this.activeDocs.size;
		const clientId = this.settings.clientId.substring(0, 8);
		const mode = this.settings.syncMode;
		const serverStatus = this.serverConnected ? 'Connected' : 'Disconnected';

		let status = `CRDT Sync Status\nClient: ${clientId}\nMode: ${mode}\nTracking: ${activeCount} files`;
		if (mode !== 'file-only') {
			status += `\nServer: ${serverStatus}`;
		}
		new Notice(status);
	}

	/**
	 * Update presence display in status bar
	 */
	private updatePresenceDisplay(presence: PresenceInfo[]) {
		if (!this.presenceStatusItem) return;

		if (presence.length === 0) {
			this.presenceStatusItem.setText('');
			this.presenceStatusItem.title = '';
		} else {
			const message = formatPresenceMessage(presence);
			this.presenceStatusItem.setText(`👥 ${presence.length}`);
			this.presenceStatusItem.title = message;
		}
	}

	/**
	 * Update presence from current cursor position
	 */
	private updatePresenceFromCursor() {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view) return;

		const editor = view.editor;
		const cursor = editor.getCursor();
		this.presenceManager.setCursorPosition(cursor.line, cursor.ch);
	}

	/**
	 * Connect to WebSocket server for real-time sync
	 */
	private connectToServer() {
		if (!this.settings.serverUrl) return;

		try {
			this.wsConnection = new WebSocket(this.settings.serverUrl);

			this.wsConnection.onopen = () => {
				console.log('Connected to CRDT sync server');
				this.serverConnected = true;
				this.updateStatusBar('idle');

				// Send our client info
				this.wsConnection?.send(JSON.stringify({
					type: 'hello',
					clientId: this.settings.clientId,
					displayName: this.settings.displayName,
				}));
			};

			this.wsConnection.onclose = () => {
				console.log('Disconnected from CRDT sync server');
				this.serverConnected = false;

				// Retry connection after delay
				if (this.settings.syncMode !== 'file-only') {
					setTimeout(() => this.connectToServer(), 5000);
				}
			};

			this.wsConnection.onerror = (error) => {
				console.error('WebSocket error:', error);
				this.serverConnected = false;
			};

			this.wsConnection.onmessage = (event) => {
				this.handleServerMessage(event.data);
			};
		} catch (error) {
			console.error('Failed to connect to server:', error);
			this.serverConnected = false;
		}
	}

	/**
	 * Handle incoming message from server
	 */
	private async handleServerMessage(data: string) {
		try {
			const message = JSON.parse(data);

			switch (message.type) {
				case 'update':
					// Remote CRDT update
					const doc = this.activeDocs.get(message.path);
					if (doc) {
						const update = new Uint8Array(message.update);
						Y.applyUpdate(doc, update);

						// Update file
						const file = this.app.vault.getAbstractFileByPath(message.path);
						if (file instanceof TFile) {
							const mergedContent = doc.getText('content').toString();
							await this.app.vault.modify(file, mergedContent);
						}
					}
					break;

				case 'presence':
					// Remote presence update
					if (this.settings.showPresence) {
						this.updatePresenceDisplay(message.presence);
					}
					break;
			}
		} catch (error) {
			console.error('Error handling server message:', error);
		}
	}

	/**
	 * Send CRDT update to server
	 */
	private sendUpdateToServer(path: string, doc: Y.Doc) {
		if (!this.wsConnection || !this.serverConnected) return;

		const update = Y.encodeStateAsUpdate(doc);

		this.wsConnection.send(JSON.stringify({
			type: 'update',
			path: path,
			clientId: this.settings.clientId,
			update: Array.from(update),
		}));
	}
}

class CrdtSyncSettingTab extends PluginSettingTab {
	plugin: CrdtSyncPlugin;

	constructor(app: App, plugin: CrdtSyncPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: 'CRDT Sync Settings' });

		// Identity section
		containerEl.createEl('h3', { text: 'Identity' });

		new Setting(containerEl)
			.setName('Client ID')
			.setDesc('Unique identifier for this Obsidian instance (auto-generated)')
			.addText(text => text
				.setValue(this.plugin.settings.clientId)
				.setDisabled(true));

		new Setting(containerEl)
			.setName('Display Name')
			.setDesc('Your name shown to other users')
			.addText(text => text
				.setPlaceholder('Enter your name')
				.setValue(this.plugin.settings.displayName)
				.onChange(async (value) => {
					this.plugin.settings.displayName = value;
					await this.plugin.saveSettings();
				}));

		// Sync section
		containerEl.createEl('h3', { text: 'Sync Mode' });

		containerEl.createEl('p', {
			text: 'Choose how to sync changes. Start with file-only for SMB/cloud sync, add server for real-time collaboration.',
			cls: 'setting-item-description'
		});

		new Setting(containerEl)
			.setName('Sync Mode')
			.setDesc('Progressive adoption: start file-only, add server when ready')
			.addDropdown(dropdown => dropdown
				.addOption('file-only', 'File-only (SMB/Dropbox/Syncthing)')
				.addOption('hybrid', 'Hybrid (server + file fallback)')
				.addOption('server-only', 'Server-only (real-time required)')
				.setValue(this.plugin.settings.syncMode)
				.onChange(async (value: 'file-only' | 'hybrid' | 'server-only') => {
					this.plugin.settings.syncMode = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Server URL')
			.setDesc('WebSocket server for real-time sync (leave empty for file-only)')
			.addText(text => text
				.setPlaceholder('ws://your-server:1234')
				.setValue(this.plugin.settings.serverUrl)
				.onChange(async (value) => {
					this.plugin.settings.serverUrl = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Background check interval')
			.setDesc('How often to check for remote file changes (ms). Lower = faster sync, higher = less CPU.')
			.addText(text => text
				.setValue(String(this.plugin.settings.backgroundCheckInterval))
				.onChange(async (value) => {
					const num = parseInt(value, 10);
					if (!isNaN(num) && num >= 1000) {
						this.plugin.settings.backgroundCheckInterval = num;
						await this.plugin.saveSettings();
					}
				}));

		// Presence section
		containerEl.createEl('h3', { text: 'Presence Awareness' });

		new Setting(containerEl)
			.setName('Show presence')
			.setDesc('Show when other users are viewing the same file')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showPresence)
				.onChange(async (value) => {
					this.plugin.settings.showPresence = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Show editing nudge')
			.setDesc('Suggest editing in a different section when others are editing nearby')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showPresenceNudge)
				.onChange(async (value) => {
					this.plugin.settings.showPresenceNudge = value;
					await this.plugin.saveSettings();
				}));

		// Storage section
		containerEl.createEl('h3', { text: 'Storage' });

		new Setting(containerEl)
			.setName('CRDT folder name')
			.setDesc('Hidden folder for storing sync state')
			.addText(text => text
				.setValue(this.plugin.settings.crdtFolderName)
				.onChange(async (value) => {
					this.plugin.settings.crdtFolderName = value;
					await this.plugin.saveSettings();
				}));

		// UI section
		containerEl.createEl('h3', { text: 'Interface' });

		new Setting(containerEl)
			.setName('Show sync status')
			.setDesc('Show sync status in status bar')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showSyncStatus)
				.onChange(async (value) => {
					this.plugin.settings.showSyncStatus = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Show conflict notifications')
			.setDesc('Notify when files are updated with remote changes')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showConflictNotifications)
				.onChange(async (value) => {
					this.plugin.settings.showConflictNotifications = value;
					await this.plugin.saveSettings();
				}));
	}
}
