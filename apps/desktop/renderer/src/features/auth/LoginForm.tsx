import { useState } from 'react';
import { useAuth } from './auth-context';

export default function LoginForm() {
 const [email, setEmail] = useState('demo@carspa.com');
 const [password, setPassword] = useState('password');
 const [error, setError] = useState('');
 const [isSubmitting, setIsSubmitting] = useState(false);
 const { login } = useAuth();

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 setError('');
 setIsSubmitting(true);

 // Simulate API call
 await new Promise(resolve => setTimeout(resolve, 800));

 // Demo validation
 if (email === 'demo@carspa.com' && password === 'password') {
 login({
 id: '1',
 name: 'Demo User',
 email: 'demo@carspa.com',
 role: 'Owner',
 roleLabel: 'Owner',
 avatar: undefined,
 loginTime: new Date().toISOString(),
});
} else {
 setError('Invalid credentials. Use demo@carspa.com / password');
}

 setIsSubmitting(false);
};

 return (
 <form onSubmit={handleSubmit} className="space-y-5">
 {error && (
 <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
 {error}
 </div>
)}

 <div>
 <label className="block text-sm font-medium text-gray-700 mb-1.5">
 Email Address
 </label>
 <input
 type="email"
 value={email}
 onChange={e => setEmail(e.target.value)}
 className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm
 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none
 transition-all"
 placeholder="Enter your email"
 required
/>
 </div>

 <div>
 <label className="block text-sm font-medium text-gray-700 mb-1.5">
 Password
 </label>
 <input
 type="password"
 value={password}
 onChange={e => setPassword(e.target.value)}
 className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm
 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none
 transition-all"
 placeholder="Enter your password"
 required
/>
 </div>

 <div className="flex items-center justify-between">
 <label className="flex items-center">
 <input type="checkbox" className="rounded border-gray-300 text-blue-600
 focus:ring-blue-500" />
 <span className="ml-2 text-sm text-gray-600">Remember me</span>
 </label>
 <a href="#" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
 Forgot password?
 </a>
 </div>

 <button
 type="submit"
 disabled={isSubmitting}
 className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold
 py-2.5 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed
 flex items-center justify-center gap-2"
>
 {isSubmitting ? (
 <>
 <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
 <circle className="opacity-25" cx="12" cy="12" r="10"
 stroke="currentColor" strokeWidth="4" fill="none" />
 <path className="opacity-75" fill="currentColor"
 d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
 </svg>
 Signing in...
 </>
 ) : (
 'Sign In'
 )}
 </button>

 <div className="text-center">
 <p className="text-sm text-gray-500">
 Demo: <span className="font-mono text-gray-700">demo@carspa.com</span> /
 <span className="font-mono text-gray-700">password</span>
 </p>
 </div>
 </form>
);
}
