import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './auth-context';
import { User, Lock, ArrowRight, Clock } from 'lucide-react';

export default function LoginForm() {
	const [username, setUsername] = useState('');
	const [password, setPassword] = useState('');
	const [error, setError] = useState('');
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [lockoutSeconds, setLockoutSeconds] = useState(0);
	const { login } = useAuth();
	const navigate = useNavigate();
	const location = useLocation();

	const from = (location.state as { from?: { pathname?: string } })?.from?.pathname || '/dashboard';

	useEffect(() => {
		if (lockoutSeconds <= 0) return;
		const timer = setInterval(() => {
			setLockoutSeconds((prev) => {
				if (prev <= 1) {
					clearInterval(timer);
					setError('');
					return 0;
				}
				return prev - 1;
			});
		}, 1000);
		return () => clearInterval(timer);
	}, [lockoutSeconds]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (lockoutSeconds > 0) return;

		setError('');

		if (!username.trim() || !password) {
			setError('Please enter both username and password.');
			return;
		}

		setIsSubmitting(true);

		try {
			await login(username.trim(), password);
			navigate(from, { replace: true });
		} catch (err: unknown) {
			if (err && typeof err === 'object' && ('code' in err || 'status' in err)) {
				const apiErr = err as { code?: string; status?: number; remainingLockoutSeconds?: number; message?: string };
				if (apiErr.code === 'ACCOUNT_LOCKED' || apiErr.status === 423) {
					const remaining = apiErr.remainingLockoutSeconds || 300;
					setLockoutSeconds(remaining);
					setError(apiErr.message || 'Too many failed login attempts. Please try again later.');
					return;
				}
			}
			// Security rule: generic error message, do not reveal whether user exists
			setError('Invalid username or password.');
		} finally {
			setIsSubmitting(false);
		}
	};

	const isLocked = lockoutSeconds > 0;

	return (
		<form onSubmit={handleSubmit} className="space-y-4">
			{error && (
				<div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 flex items-start gap-2.5">
					<Lock className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
					<div className="flex-1">
						<div>{error}</div>
						{lockoutSeconds > 0 && (
							<div className="text-xs font-semibold text-red-600 mt-1 flex items-center gap-1.5">
								<Clock className="w-3.5 h-3.5" />
								Try again in {Math.floor(lockoutSeconds / 60)}m {String(lockoutSeconds % 60).padStart(2, '0')}s
							</div>
						)}
					</div>
				</div>
			)}

			<div>
				<label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
					Username
				</label>
				<div className="relative">
					<User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
					<input
						type="text"
						value={username}
						onChange={(e) => {
							setUsername(e.target.value);
							if (!isLocked && error) setError('');
						}}
						disabled={isSubmitting || isLocked}
						className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all disabled:opacity-60 disabled:cursor-not-allowed"
						placeholder="Enter your username"
						required
						autoComplete="username"
						autoFocus
					/>
				</div>
			</div>

			<div>
				<label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
					Password
				</label>
				<div className="relative">
					<Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
					<input
						type="password"
						value={password}
						onChange={(e) => {
							setPassword(e.target.value);
							if (!isLocked && error) setError('');
						}}
						disabled={isSubmitting || isLocked}
						className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all disabled:opacity-60 disabled:cursor-not-allowed"
						placeholder="Enter your password"
						required
						autoComplete="current-password"
					/>
				</div>
			</div>

			<button
				type="submit"
				disabled={isSubmitting || isLocked}
				className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm cursor-pointer"
			>
				{isSubmitting ? (
					<>
						<div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
						Signing in...
					</>
				) : isLocked ? (
					<>
						<Lock className="w-4 h-4" />
						Account Locked ({Math.floor(lockoutSeconds / 60)}m {String(lockoutSeconds % 60).padStart(2, '0')}s)
					</>
				) : (
					<>
						Sign In
						<ArrowRight className="w-4 h-4" />
					</>
				)}
			</button>
		</form>
	);
}
