/**
 * Generate a unique client ID for this Obsidian instance
 */
export function generateClientId(): string {
	// Use crypto.randomUUID if available (modern browsers/Electron)
	if (typeof crypto !== 'undefined' && crypto.randomUUID) {
		return crypto.randomUUID();
	}

	// Fallback: generate UUID v4 manually
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
		const r = (Math.random() * 16) | 0;
		const v = c === 'x' ? r : (r & 0x3) | 0x8;
		return v.toString(16);
	});
}

/**
 * Get a short display name from client ID
 */
export function getDisplayName(clientId: string): string {
	// Return first 8 characters as a short identifier
	return clientId.substring(0, 8);
}

/**
 * Generate a deterministic client ID from machine-specific data
 * (Optional - for cases where same ID is wanted across reinstalls)
 */
export async function generateMachineId(): Promise<string> {
	// This would use machine-specific identifiers
	// In Electron/Obsidian context, could use:
	// - Hardware ID
	// - Obsidian installation ID
	// - User-provided email hash

	// For now, just return a random ID
	return generateClientId();
}

/**
 * Hash a string (e.g., email) to create a consistent client ID
 */
export async function hashToClientId(input: string): Promise<string> {
	const encoder = new TextEncoder();
	const data = encoder.encode(input);

	if (typeof crypto !== 'undefined' && crypto.subtle) {
		const hashBuffer = await crypto.subtle.digest('SHA-256', data);
		const hashArray = Array.from(new Uint8Array(hashBuffer));
		const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

		// Format as UUID-like string
		return [
			hashHex.substring(0, 8),
			hashHex.substring(8, 12),
			hashHex.substring(12, 16),
			hashHex.substring(16, 20),
			hashHex.substring(20, 32),
		].join('-');
	}

	// Fallback: simple hash (not cryptographically secure)
	let hash = 0;
	for (let i = 0; i < input.length; i++) {
		const char = input.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash = hash & hash;
	}
	return `hash-${Math.abs(hash).toString(16).padStart(8, '0')}-${generateClientId().substring(9)}`;
}
