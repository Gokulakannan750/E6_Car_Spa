import { createHmac } from 'node:crypto';
const base = process.env.PLATFORM_E2E_API_URL ?? 'http://localhost:5321';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Local throwaway API required');
async function post(path, body, token) {
	const response = await fetch(`${base}/api/platform/auth/${path}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
		body: JSON.stringify(body),
	});
	if (!response.ok) throw new Error(`${path}: ${response.status} ${await response.text()}`);
	return response.json();
}
const email = process.env.PLATFORM_E2E_OWNER_EMAIL;
const password = process.env.PLATFORM_E2E_BOOTSTRAP_PASSWORD;
const newPassword = process.env.PLATFORM_E2E_OWNER_PASSWORD;
if (!email || !password || !newPassword) throw new Error('Supply owner email, bootstrap password and final password in process environment');
const challenge = await post('login', { email, password });
const secret = challenge.totpSecret;
if (!secret) throw new Error('Expected a fresh throwaway owner');
const left = 30000 - (Date.now() % 30000);
if (left < 5000) await new Promise((r) => setTimeout(r, left + 500));
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const bits = [...secret].map((c) => alphabet.indexOf(c).toString(2).padStart(5, '0')).join('');
const key = Buffer.from(bits.match(/.{8}/g).map((b) => parseInt(b, 2)));
const counter = Buffer.alloc(8);
counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
const hash = createHmac('sha1', key).update(counter).digest();
const offset = hash.at(-1) & 15;
const code = ((hash.readUInt32BE(offset) & 0x7fffffff) % 1000000).toString().padStart(6, '0');
const session = await post('verify', { challengeToken: challenge.challengeToken, code });
const changed = await post('change-password', { currentPassword: password, newPassword, confirmPassword: newPassword }, session.token);
if (changed.admin.mustChangePassword) throw new Error('Password change not completed');
// Caller captures this in memory for the live suite; never writes credentials to a file.
process.stdout.write(JSON.stringify({ email, totpSecret: secret }));
