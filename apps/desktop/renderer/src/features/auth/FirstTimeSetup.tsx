import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { getAuthStatus, bootstrapOwner, ApiError } from '../../lib/api';
import { useAuth } from './auth-context';
import { ShieldCheck, UserCheck, Lock, User, CheckCircle2 } from 'lucide-react';

export default function FirstTimeSetup() {
	const [fullName, setFullName] = useState('');
	const [username, setUsername] = useState('');
	const [password, setPassword] = useState('');
	const [confirmPassword, setConfirmPassword] = useState('');
	const [error, setError] = useState('');
	const [successMsg, setSuccessMsg] = useState('');
	const [isSubmitting, setIsSubmitting] = useState(false);
	const { isInitialized, checkInitialization } = useAuth();
	const navigate = useNavigate();

	const isSubmittingRef = useRef(isSubmitting);
	isSubmittingRef.current = isSubmitting;

	// Cross-device synchronization:
	// Automatically redirect to /login if database is already initialized
	useEffect(() => {
		if (isInitialized === true) {
			navigate('/login', { replace: true });
		}
	}, [isInitialized, navigate]);

	// Periodically check GET /api/auth/status every 10s and when window regains focus
	useEffect(() => {
		if (isInitialized === true) return;

		let isMounted = true;

		const pollStatus = async () => {
			if (!isMounted || isSubmittingRef.current) return;
			try {
				const res = await getAuthStatus();
				if (res.initialized && isMounted) {
					await checkInitialization(false);
					navigate('/login', { replace: true });
				}
			} catch (err) {
				// Network error or backend temporarily unavailable:
				// Do NOT assume initialized = false.
				// Do NOT redirect or destroy the current setup screen.
				// Preserve existing setup state and retry on next interval.
				console.warn('Periodic auth status check failed, retrying on next cycle:', err);
			}
		};

		// 10-second polling interval (consistent with 10-12s cross-platform refresh strategy)
		const intervalId = setInterval(pollStatus, 10000);

		const handleFocus = () => {
			pollStatus();
		};

		const handleVisibilityChange = () => {
			if (document.visibilityState === 'visible') {
				pollStatus();
			}
		};

		window.addEventListener('focus', handleFocus);
		document.addEventListener('visibilitychange', handleVisibilityChange);

		return () => {
			isMounted = false;
			clearInterval(intervalId);
			window.removeEventListener('focus', handleFocus);
			document.removeEventListener('visibilitychange', handleVisibilityChange);
		};
	}, [isInitialized, checkInitialization, navigate]);

	if (isInitialized === true) {
		return <Navigate to="/login" replace />;
	}

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError('');
		setSuccessMsg('');

		if (!fullName.trim()) {
			setError('Full name is required.');
			return;
		}

		if (!username.trim()) {
			setError('Username is required.');
			return;
		}

		if (password.length < 8) {
			setError('Password must be at least 8 characters long.');
			return;
		}

		if (password !== confirmPassword) {
			setError('Passwords do not match.');
			return;
		}

		if (password.trim().toLowerCase() === username.trim().toLowerCase()) {
			setError('Password cannot be the same as the username.');
			return;
		}

		setIsSubmitting(true);

		try {
			await bootstrapOwner({
				fullName: fullName.trim(),
				username: username.trim().toLowerCase(),
				password,
				confirmPassword,
			});

			await checkInitialization();
			setSuccessMsg('Owner account created successfully. Redirecting to login...');

			setTimeout(() => {
				navigate('/login', { replace: true });
			}, 1500);
		} catch (err: unknown) {
			if (err instanceof ApiError) {
				setError(err.message || 'Failed to create Owner account.');
			} else if (err instanceof Error) {
				setError(err.message);
			} else {
				setError('An unexpected error occurred.');
			}
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-6">
			<div className="w-full max-w-md">
				{/* Brand / Logo */}
				<div className="text-center mb-8">
					<div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 shadow-lg shadow-blue-600/30 text-white font-black text-2xl mb-4">
						E6
					</div>
					<h1 className="text-2xl font-extrabold text-white tracking-tight">
						WELCOME TO E6 CAR SPA
					</h1>
					<p className="text-sm text-blue-200/80 mt-1 font-medium">
						First-Time Setup — Create Owner Account
					</p>
				</div>

				{/* Card */}
				<div className="bg-white/95 backdrop-blur-md rounded-2xl p-8 shadow-2xl border border-white/20">
					{error && (
						<div className="mb-5 p-3.5 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl">
							{error}
						</div>
					)}

					{successMsg && (
						<div className="mb-5 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-xl flex items-center gap-2">
							<CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
							<span>{successMsg}</span>
						</div>
					)}

					<div className="mb-6 p-3 bg-blue-50/80 border border-blue-100 rounded-xl flex items-start gap-2.5">
						<ShieldCheck className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
						<div className="text-xs text-blue-900 leading-relaxed">
							<span className="font-semibold block mb-0.5">Initial Setup</span>
							This account will have <strong>Owner</strong> privileges with unrestricted access to all current and future modules.
						</div>
					</div>

					<form onSubmit={handleSubmit} className="space-y-4">
						<div>
							<label htmlFor="fullName" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
								Full Name
							</label>
							<div className="relative">
								<User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
								<input
									id="fullName"
									type="text"
									value={fullName}
									onChange={(e) => setFullName(e.target.value)}
									placeholder="e.g. Gokulakannan"
									required
									className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
								/>
							</div>
						</div>

						<div>
							<label htmlFor="username" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
								Username
							</label>
							<div className="relative">
								<UserCheck className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
								<input
									id="username"
									type="text"
									value={username}
									onChange={(e) => setUsername(e.target.value)}
									placeholder="e.g. gokul"
									required
									className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
								/>
							</div>
						</div>

						<div>
							<label htmlFor="password" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
								Password
							</label>
							<div className="relative">
								<Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
								<input
									id="password"
									type="password"
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									placeholder="Minimum 8 characters"
									required
									minLength={8}
									className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
								/>
							</div>
						</div>

						<div>
							<label htmlFor="confirmPassword" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
								Confirm Password
							</label>
							<div className="relative">
								<Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
								<input
									id="confirmPassword"
									type="password"
									value={confirmPassword}
									onChange={(e) => setConfirmPassword(e.target.value)}
									placeholder="Re-enter password"
									required
									minLength={8}
									className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
								/>
							</div>
						</div>

						<button
							type="submit"
							disabled={isSubmitting || !!successMsg}
							className="w-full mt-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 text-sm cursor-pointer"
						>
							{isSubmitting ? (
								<>
									<div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
									Creating Owner Account...
								</>
							) : (
								'Create Owner Account'
							)}
						</button>
					</form>
				</div>

				<p className="text-center text-slate-400 text-xs mt-6">
					© {new Date().getFullYear()} E6 Car Spa Management. All rights reserved.
				</p>
			</div>
		</div>
	);
}
