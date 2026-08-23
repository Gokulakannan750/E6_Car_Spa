import { Navigate } from 'react-router-dom';
import { useAuth } from './auth-context';
import LoginForm from './LoginForm';

export default function LoginPage() {
	const { isAuthenticated, isInitialized, isLoading } = useAuth();

	if (isLoading) {
		return (
			<div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center">
				<div className="h-8 w-8 animate-spin rounded-full border-3 border-blue-400 border-t-transparent" />
			</div>
		);
	}

	if (isInitialized === false) {
		return <Navigate to="/setup" replace />;
	}

	if (isAuthenticated) {
		return <Navigate to="/dashboard" replace />;
	}

	return (
		<div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-6">
			<div className="w-full max-w-md">
				{/* Brand / Logo */}
				<div className="text-center mb-8">
					<div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 shadow-lg shadow-blue-600/30 text-white font-black text-2xl mb-4">
						E6
					</div>
					<h1 className="text-2xl font-extrabold text-white tracking-tight">
						E6 CAR SPA
					</h1>
					<p className="text-sm text-blue-200/80 mt-1 font-medium">
						Management Suite — Sign In
					</p>
				</div>

				{/* Card */}
				<div className="bg-white/95 backdrop-blur-md rounded-2xl p-8 shadow-2xl border border-white/20">
					<LoginForm />
				</div>

				<p className="text-center text-slate-400 text-xs mt-6">
					© {new Date().getFullYear()} E6 Car Spa Management. All rights reserved.
				</p>
			</div>
		</div>
	);
}
