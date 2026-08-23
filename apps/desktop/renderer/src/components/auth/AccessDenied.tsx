import { useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

interface AccessDeniedProps {
	requiredPermission?: string;
}

export function AccessDenied({ requiredPermission }: AccessDeniedProps) {
	const navigate = useNavigate();

	return (
		<div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
			<div className="w-16 h-16 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center mb-4">
				<ShieldAlert className="w-8 h-8" />
			</div>
			<h2 className="text-2xl font-bold text-slate-800 mb-2">Access Denied</h2>
			<p className="text-sm text-slate-500 max-w-md mb-6">
				You do not have permission to access this page. Please contact your system administrator if you believe this is an error.
				{requiredPermission && (
					<span className="block mt-2 font-mono text-xs text-slate-400 bg-slate-100 px-2.5 py-1 rounded inline-block">
						Required: {requiredPermission}
					</span>
				)}
			</p>
			<button
				onClick={() => navigate('/dashboard')}
				className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors shadow-sm"
			>
				<ArrowLeft className="w-4 h-4" />
				Back to Dashboard
			</button>
		</div>
	);
}
