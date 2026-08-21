import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth, type User } from './auth-context';

export default function LoginPage() {
 const [email, setEmail] = useState('');
 const [password, setPassword] = useState('');
 const [error, setError] = useState('');
 const [isLoading, setIsLoading] = useState(false);
 const { login, user } = useAuth();
 const navigate = useNavigate();

 if (user) {
 return <Navigate to="/dashboard" replace />;
 }

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 setError('');
 setIsLoading(true);

 try {
 const demoUser = { id: '1', name: 'Admin User', email: email || 'admin@carspapro.com', role: 'Owner', roleLabel: 'Owner', loginTime: new Date().toISOString() } as User;
 await login(demoUser);
 navigate('/dashboard', { replace: true });
 } catch {
 setError('Invalid email or password');
 }
 setIsLoading(false);
 };

 return (
 <div className="min-h-screen flex items-center justify-center bg-gray-50">
 <div className="w-full max-w-sm">
 {/* Logo */}
 <div className="text-center mb-6">
 <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-xl
 flex items-center justify-center mx-auto mb-3 shadow-lg">
 <span className="material-symbols-outlined text-white" style={{ fontSize: '32px' }}>
 local_car_wash
 </span>
 </div>
 <h1 className="text-2xl font-bold text-gray-900">Car Spa Pro</h1>
 <p className="text-sm text-gray-500 mt-1">Sign in to your management dashboard</p>
 </div>

 {/* Login form */}
 <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
 <form onSubmit={handleSubmit} className="space-y-4">
 {error && (
 <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
 {error}
 </div>
 )}

 <div>
 <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
 <input
 type="email"
 value={email}
 onChange={e => setEmail(e.target.value)}
 required
 placeholder="you@example.com"
 className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-lg
 text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500
 focus:border-transparent outline-none"
 />
 </div>

 <div>
 <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
 <input
 type="password"
 value={password}
 onChange={e => setPassword(e.target.value)}
 required
 placeholder="Enter your password"
 className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-lg
 text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500
 focus:border-transparent outline-none"
 />
 </div>

 <div className="flex items-center justify-between">
 <label className="flex items-center gap-2 cursor-pointer">
 <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
 <span className="text-sm text-gray-600">Remember me</span>
 </label>
 <button type="button" className="text-sm text-blue-600 hover:underline">
 Forgot password?
 </button>
 </div>

 <button
 type="submit"
 disabled={isLoading}
 className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400
 text-white font-semibold rounded-lg transition-colors flex items-center
 justify-center gap-2 text-sm"
 >
 {isLoading ? (
 <>
 <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor"
 strokeWidth="4" fill="none" />
 <path className="opacity-75" fill="currentColor"
 d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
 </svg>
 Signing in...
 </>
 ) : (
 'Sign In'
 )}
 </button>
 </form>

 <div className="mt-5 pt-4 border-t border-gray-100">
 <p className="text-xs text-center text-gray-400">
 Demo: use any email and password to sign in
 </p>
 </div>
 </div>
 </div>
 </div>
 );
}
