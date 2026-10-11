import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TokenStorage, type SafeStorageLike, type FsLike } from './tokenStorage';

describe('TokenStorage', () => {
	const mockFilePath = 'C:\\mock\\userData\\session.enc';
	let mockSafeStorage: SafeStorageLike;
	let mockFs: FsLike;
	let existingFiles: Map<string, Buffer>;

	beforeEach(() => {
		existingFiles = new Map();

		mockSafeStorage = {
			isEncryptionAvailable: vi.fn().mockReturnValue(true),
			encryptString: vi.fn((plain: string) => Buffer.from(`enc_${plain}`)),
			decryptString: vi.fn((buf: Buffer) => {
				const str = buf.toString('utf8');
				if (str.startsWith('enc_')) {
					return str.replace('enc_', '');
				}
				throw new Error('Decryption failed: invalid format');
			}),
		};

		mockFs = {
			existsSync: vi.fn((path: string) => existingFiles.has(path)),
			readFileSync: vi.fn((path: string) => {
				const data = existingFiles.get(path);
				if (!data) throw new Error(`ENOENT: no such file or directory, open '${path}'`);
				return data;
			}),
			writeFileSync: vi.fn((path: string, data: Buffer) => {
				existingFiles.set(path, data);
			}),
			unlinkSync: vi.fn((path: string) => {
				if (!existingFiles.has(path)) {
					throw new Error(`ENOENT: no such file or directory, unlink '${path}'`);
				}
				existingFiles.delete(path);
			}),
		};
	});

	describe('when safeStorage is available', () => {
		it('returns null token when no token file exists', async () => {
			const storage = new TokenStorage(mockSafeStorage, mockFs, mockFilePath);
			const result = await storage.getToken();

			expect(result).toEqual({ token: null });
			expect(mockFs.existsSync).toHaveBeenCalledWith(mockFilePath);
			expect(mockFs.readFileSync).not.toHaveBeenCalled();
		});

		it('saves encrypted token and reads it back successfully', async () => {
			const storage = new TokenStorage(mockSafeStorage, mockFs, mockFilePath);
			const setResult = await storage.setToken('valid-jwt-token');

			expect(setResult).toEqual({ success: true });
			expect(mockSafeStorage.encryptString).toHaveBeenCalledWith('valid-jwt-token');
			expect(mockFs.writeFileSync).toHaveBeenCalledWith(mockFilePath, Buffer.from('enc_valid-jwt-token'));

			const getResult = await storage.getToken();
			expect(getResult).toEqual({ token: 'valid-jwt-token' });
			expect(mockSafeStorage.decryptString).toHaveBeenCalled();
		});

		it('never writes plaintext bytes to disk', async () => {
			const storage = new TokenStorage(mockSafeStorage, mockFs, mockFilePath);
			const secretToken = 'super-secret-plain-token';

			await storage.setToken(secretToken);

			const writtenBuffer = existingFiles.get(mockFilePath);
			expect(writtenBuffer).toBeDefined();
			// Ensure raw plaintext is not written as is
			expect(writtenBuffer!.toString('utf8')).not.toBe(secretToken);
			expect(writtenBuffer!.toString('utf8')).toBe('enc_super-secret-plain-token');
		});

		it('removes existing token file on logout (setToken(null))', async () => {
			existingFiles.set(mockFilePath, Buffer.from('enc_existing-token'));

			const storage = new TokenStorage(mockSafeStorage, mockFs, mockFilePath);
			const result = await storage.setToken(null);

			expect(result).toEqual({ success: true });
			expect(mockFs.unlinkSync).toHaveBeenCalledWith(mockFilePath);
			expect(existingFiles.has(mockFilePath)).toBe(false);
		});

		it('succeeds on logout even if no file existed', async () => {
			const storage = new TokenStorage(mockSafeStorage, mockFs, mockFilePath);
			const result = await storage.setToken(null);

			expect(result).toEqual({ success: true });
			expect(mockFs.unlinkSync).not.toHaveBeenCalled();
		});

		it('deletes file and returns no token when decryption fails (legacy plaintext or corrupt data)', async () => {
			// Legacy plaintext or corrupt bytes stored in session.enc
			existingFiles.set(mockFilePath, Buffer.from('legacy_plaintext_unencrypted_credentials'));

			const storage = new TokenStorage(mockSafeStorage, mockFs, mockFilePath);
			const result = await storage.getToken();

			expect(result.token).toBeNull();
			expect(result.error).toBe('Failed to decrypt credentials. Session cleared.');
			expect(mockFs.unlinkSync).toHaveBeenCalledWith(mockFilePath);
			expect(existingFiles.has(mockFilePath)).toBe(false);
		});
	});

	describe('when safeStorage is unavailable', () => {
		beforeEach(() => {
			vi.mocked(mockSafeStorage.isEncryptionAvailable).mockReturnValue(false);
		});

		it('fails closed on getToken, deleting existing file and returning sanitized security error', async () => {
			existingFiles.set(mockFilePath, Buffer.from('stale-token-bytes'));

			const storage = new TokenStorage(mockSafeStorage, mockFs, mockFilePath);
			const result = await storage.getToken();

			expect(result.token).toBeNull();
			expect(result.error).toBe('Secure storage is unavailable on this system.');
			expect(mockFs.unlinkSync).toHaveBeenCalledWith(mockFilePath);
			expect(existingFiles.has(mockFilePath)).toBe(false);
		});

		it('fails closed on setToken(token) writing nothing to disk', async () => {
			const storage = new TokenStorage(mockSafeStorage, mockFs, mockFilePath);
			const result = await storage.setToken('session-token-to-save');

			expect(result).toEqual({
				success: false,
				error: 'Secure storage is unavailable on this system.',
			});
			expect(mockFs.writeFileSync).not.toHaveBeenCalled();
			expect(existingFiles.has(mockFilePath)).toBe(false);
		});

		it('still deletes existing file on logout (setToken(null)) when safeStorage is unavailable', async () => {
			existingFiles.set(mockFilePath, Buffer.from('leftover-file'));

			const storage = new TokenStorage(mockSafeStorage, mockFs, mockFilePath);
			const result = await storage.setToken(null);

			expect(result).toEqual({ success: true });
			expect(mockFs.unlinkSync).toHaveBeenCalledWith(mockFilePath);
			expect(existingFiles.has(mockFilePath)).toBe(false);
		});
	});

	describe('sanitized error indicator guarantees', () => {
		it('ensures errors never contain file paths or secret bytes', async () => {
			// 1. Unavailable error
			vi.mocked(mockSafeStorage.isEncryptionAvailable).mockReturnValue(false);
			const storage1 = new TokenStorage(mockSafeStorage, mockFs, mockFilePath);
			const res1 = await storage1.getToken();
			expect(res1.error).toBeDefined();
			expect(res1.error).not.toContain(mockFilePath);
			expect(res1.error).not.toContain('session.enc');

			const res2 = await storage1.setToken('my-secret-token');
			expect(res2.error).toBeDefined();
			expect(res2.error).not.toContain(mockFilePath);
			expect(res2.error).not.toContain('my-secret-token');

			// 2. Decrypt failure error
			vi.mocked(mockSafeStorage.isEncryptionAvailable).mockReturnValue(true);
			existingFiles.set(mockFilePath, Buffer.from('corrupt_bytes_12345'));
			const storage2 = new TokenStorage(mockSafeStorage, mockFs, mockFilePath);
			const res3 = await storage2.getToken();
			expect(res3.error).toBeDefined();
			expect(res3.error).not.toContain(mockFilePath);
			expect(res3.error).not.toContain('corrupt_bytes');
		});
	});
});
