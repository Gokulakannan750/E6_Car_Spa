import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, Lock, Mail, ShieldCheck } from 'lucide-react';
import QRCode from 'qrcode';
import { Button, IconButton } from '@/components/Button';
import { TextField } from '@/components/Field';
import { InlineError } from '@/components/Surface';
import { api, ApiError } from '@/lib/api';
import type { LoginResponse, SessionResponse } from '@/lib/types';
import { AuthLayout } from './AuthLayout';
import { useAuth } from './AuthProvider';

type Step = { kind: 'password' } | { kind: 'totp'; challenge: LoginResponse };

function messageOf(error: unknown): string {
	if (error instanceof ApiError) {
		if (error.status === 429) return 'Too many attempts. Wait a minute and try again.';
		return error.message;
	}
	return 'Sign-in failed. Please try again.';
}

export function SignInPage() {
	const { session, signedIn, endReason } = useAuth();
	const location = useLocation();
	const [step, setStep] = useState<Step>({ kind: 'password' });

	if (session) {
		const from = (location.state as { from?: string } | null)?.from;
		return <Navigate to={session.admin.mustChangePassword ? '/change-password' : (from ?? '/dashboard')} replace />;
	}

	if (step.kind === 'totp') {
		return (
			<TotpStep
				challenge={step.challenge}
				onBack={() => setStep({ kind: 'password' })}
				onVerified={signedIn}
			/>
		);
	}
	return <PasswordStep notice={endReason} onContinue={(challenge) => setStep({ kind: 'totp', challenge })} />;
}

function PasswordStep({ notice, onContinue }: { notice: string | null; onContinue: (c: LoginResponse) => void }) {
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [show, setShow] = useState(false);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function submit(event: FormEvent) {
		event.preventDefault();
		if (!email.trim() || !password) {
			setError('Enter your email and password.');
			return;
		}
		setBusy(true);
		setError(null);
		try {
			onContinue(await api.login(email.trim(), password));
		} catch (e) {
			setError(messageOf(e));
			setPassword('');
		} finally {
			setBusy(false);
		}
	}

	return (
		<AuthLayout title="Trovo Platform" subtitle="Staff sign-in">
			<form onSubmit={submit} className="flex flex-col gap-4" noValidate>
				{notice && (
					<p role="status" className="rounded-md border border-border-subtle bg-surface-alt px-3 py-2 text-label text-text-secondary">
						{notice}
					</p>
				)}
				<TextField
					label="Staff email"
					type="email"
					autoComplete="username"
					autoFocus
					value={email}
					onChange={(e) => setEmail(e.target.value)}
					leading={<Mail className="size-4" />}
				/>
				<TextField
					label="Password"
					type={show ? 'text' : 'password'}
					autoComplete="current-password"
					value={password}
					onChange={(e) => setPassword(e.target.value)}
					leading={<Lock className="size-4" />}
					trailing={
						<IconButton label={show ? 'Hide password' : 'Show password'} onClick={() => setShow((s) => !s)}>
							{show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
						</IconButton>
					}
				/>
				<InlineError message={error} />
				<Button type="submit" variant="primary" loading={busy} className="mt-1 h-10 w-full">
					Continue <ArrowRight className="size-4" aria-hidden />
				</Button>
				<p className="text-center text-label text-text-muted">
					Forgot your password or lost your authenticator? Ask a Trovo owner to reset your account.
				</p>
			</form>
		</AuthLayout>
	);
}

function TotpStep({
	challenge,
	onBack,
	onVerified,
}: {
	challenge: LoginResponse;
	onBack: () => void;
	onVerified: (session: SessionResponse) => void;
}) {
	const setup = challenge.stage === 'totp-setup';
	const [code, setCode] = useState('');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [qr, setQr] = useState<string | null>(null);
	const input = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (!setup || !challenge.authenticatorUri) return;
		let cancelled = false;
		QRCode.toDataURL(challenge.authenticatorUri, { margin: 1, width: 176, color: { dark: '#09090B', light: '#FFFFFF' } })
			.then((url) => !cancelled && setQr(url))
			.catch(() => !cancelled && setQr(null));
		return () => {
			cancelled = true;
		};
	}, [setup, challenge.authenticatorUri]);

	async function submit(event: FormEvent) {
		event.preventDefault();
		const digits = code.replace(/\s/g, '');
		if (!/^\d{6}$/.test(digits)) {
			setError('Enter the 6-digit code from your authenticator app.');
			return;
		}
		setBusy(true);
		setError(null);
		try {
			onVerified(await api.verify(challenge.challengeToken, digits));
		} catch (e) {
			setError(messageOf(e));
			setCode('');
			input.current?.focus();
		} finally {
			setBusy(false);
		}
	}

	return (
		<AuthLayout
			title={setup ? 'Set up your authenticator' : 'Verify it’s you'}
			subtitle={
				setup
					? 'Scan the QR code with Google Authenticator, Microsoft Authenticator or a similar app, then enter the code it shows.'
					: 'Enter the 6-digit code from your authenticator app.'
			}
		>
			<form onSubmit={submit} className="flex flex-col gap-4" noValidate>
				{setup && (
					<div className="flex flex-col items-center gap-3">
						<div className="flex size-48 items-center justify-center rounded-md bg-white p-2">
							{qr ? <img src={qr} alt="Authenticator QR code" className="size-44" /> : <span className="text-label text-canvas">Preparing QR code…</span>}
						</div>
						{challenge.totpSecret && (
							<div className="w-full text-center">
								<p className="text-label text-text-muted">Can’t scan? Enter this key manually:</p>
								<code className="mt-1 block font-mono text-label tracking-wider break-all text-text-heading select-all">
									{challenge.totpSecret.replace(/(.{4})/g, '$1 ').trim()}
								</code>
							</div>
						)}
					</div>
				)}
				<TextField
					ref={input}
					label="Authentication code"
					inputMode="numeric"
					autoComplete="one-time-code"
					autoFocus
					maxLength={7}
					placeholder="000000"
					value={code}
					onChange={(e) => setCode(e.target.value.replace(/[^\d\s]/g, ''))}
					leading={<ShieldCheck className="size-4" />}
					className="tabular text-center font-mono text-title tracking-[0.4em]"
				/>
				<InlineError message={error} />
				<Button type="submit" variant="primary" loading={busy} className="h-10 w-full">
					{setup ? 'Confirm and sign in' : 'Verify'}
				</Button>
				<Button variant="ghost" onClick={onBack} className="w-full">
					Back to sign-in
				</Button>
			</form>
		</AuthLayout>
	);
}
