import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './auth-context';
import LoginForm from './LoginForm';

export default function Login() {
 const { user, isLoading } = useAuth();
 const navigate = useNavigate();

 useEffect(() => {
 if (user) {
 navigate('/dashboard', { replace: true });
}
}, [user, navigate]);

 if (isLoading) {
 return (
 <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-cyan-600 flex items-center justify-center">
 <div className="animate-spin rounded-full h-12 w-12 border-4 border-white/30 border-t-white" />
 </div>
);
}

 return (
 <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-cyan-600 flex items-center justify-center">
 <div className="w-full max-w-md px-6">
 {/* Logo */}
 <div className="text-center mb-8">
 <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 rounded-2xl mb-4 backdrop-blur-sm">
 <span className="material-symbols-outlined text-white" style={{ fontSize: '40px' }}>
 local_car_wash
 </span>
 </div>
 <h1 className="text-3xl font-bold text-white">CAR SPA MANAGEMENT</h1>
 <p className="text-blue-200 mt-2 text-sm">Sign in to your account</p>
 </div>

 {/* Login Card */}
 <div className="bg-white rounded-2xl p-8 shadow-2xl">
 <LoginForm />
 </div>

 {/* Footer */}
 <p className="text-center text-blue-300 text-xs mt-6">
 © 2025 Car SPA Management. All rights reserved.
 </p>
 </div>
 </div>
);
}
