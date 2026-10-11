export interface SafeStorageLike {
	isEncryptionAvailable: () => boolean;
	encryptString: (plainText: string) => Buffer;
	decryptString: (encrypted: Buffer) => string;
}

export interface FsLike {
	existsSync: (path: string) => boolean;
	readFileSync: (path: string) => Buffer;
	writeFileSync: (path: string, data: Buffer) => void;
	unlinkSync: (path: string) => void;
}

export interface GetTokenResult {
	token: string | null;
	error?: string;
}

export interface SetTokenResult {
	success: boolean;
	error?: string;
}

export class TokenStorage {
	constructor(
		private readonly safeStorage: SafeStorageLike,
		private readonly fs: FsLike,
		private readonly filePath: string
	) {}

	async getToken(): Promise<GetTokenResult> {
		try {
			if (!this.safeStorage.isEncryptionAvailable()) {
				try {
					if (this.fs.existsSync(this.filePath)) {
						this.fs.unlinkSync(this.filePath);
					}
				} catch {}
				return {
					token: null,
					error: 'Secure storage is unavailable on this system.',
				};
			}

			if (!this.fs.existsSync(this.filePath)) {
				return { token: null };
			}

			const buffer = this.fs.readFileSync(this.filePath);
			try {
				const decrypted = this.safeStorage.decryptString(buffer);
				return { token: decrypted };
			} catch {
				try {
					if (this.fs.existsSync(this.filePath)) {
						this.fs.unlinkSync(this.filePath);
					}
				} catch {
					// Ignore unlink errors
				}
				return {
					token: null,
					error: 'Failed to decrypt credentials. Session cleared.',
				};
			}
		} catch {
			return {
				token: null,
				error: 'Failed to access credential storage.',
			};
		}
	}

	async setToken(token: string | null): Promise<SetTokenResult> {
		try {
			if (!token) {
				try {
					if (this.fs.existsSync(this.filePath)) {
						this.fs.unlinkSync(this.filePath);
					}
				} catch {
					return {
						success: false,
						error: 'Failed to remove credentials on logout.',
					};
				}
				return { success: true };
			}

			if (!this.safeStorage.isEncryptionAvailable()) {
				return {
					success: false,
					error: 'Secure storage is unavailable on this system.',
				};
			}

			const encrypted = this.safeStorage.encryptString(token);
			this.fs.writeFileSync(this.filePath, encrypted);
			return { success: true };
		} catch {
			return {
				success: false,
				error: 'Failed to save credential to secure storage.',
			};
		}
	}
}
