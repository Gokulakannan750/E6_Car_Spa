import { useNavigate } from 'react-router-dom';

export default function StaffAdvances() {
	const navigate = useNavigate();

	return (
		<div className="flex flex-col h-full">
			<div className="px-6 py-4 border-b border-outline-variant">
				<h1 className="font-headline-md">Staff Advances</h1>
				<p className="text-sm text-on-surface-variant mt-1">Placeholder — implementation pending</p>
			</div>
			<div className="flex-1 flex items-center justify-center">
				<div className="text-center">
					<span className="material-symbols-outlined text-5xl text-outline-variant">payments</span>
					<p className="mt-4 text-on-surface-variant">This page will be implemented in a future phase.</p>
					<button onClick={() => navigate('/')} className="mt-4 btn-primary">
						Back to Dashboard
					</button>
				</div>
			</div>
		</div>
	);
}
