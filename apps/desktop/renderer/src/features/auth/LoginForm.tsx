import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './auth-context';
import { User, Lock, ArrowRight } from 'lucide-react';

export default function LoginForm() {
	const [username, setUsername] = useState('');
	const [password, setPassword] = useState('');
	const [error, setError] = useState('');
	const [isSubmitting, setIsSubmitting] = useState(false);
	const { login } = useAuth();
	const navigate = useNavigate();
	const location = useLocation();

	const from = (location.state as { from?: { pathname?: string } })?.from?.pathname || '/dashboard';

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
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
			// Security rule: generic error message, do not reveal whether user exists
			setError('Invalid username or password.');
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<form onSubmit={handleSubmit} className="space-y-4">
			{error && (
				<div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
					{error}
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
						onChange={(e) => setUsername(e.target.value)}
						className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
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
						onChange={(e) => setPassword(e.target.value)}
						className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
						placeholder="Enter your password"
						required
						autoComplete="current-password"
					/>
				</div>
			</div>

			<button
				type="submit"
				disabled={isSubmitting}
				className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm cursor-pointer"
			>
				{isSubmitting ? (
					<>
						<div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
						Signing in...
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
