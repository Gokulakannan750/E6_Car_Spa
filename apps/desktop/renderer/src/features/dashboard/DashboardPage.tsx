import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
	Car,
	Users,
	Store,
	BarChart3,
	Settings,
	ClipboardList,
	Receipt,
	CreditCard,
	CheckCircle2,
	Calendar,
	Wallet,
	Clock,
	CheckSquare,
	TrendingUp,
	BarChart2,
	IndianRupee,
	SlidersHorizontal,
	Building2,
	Percent,
	Shield,
	Sliders,
	ArrowRight,
} from 'lucide-react';
import { useAuth } from '../auth/auth-context';
import { useAppStore } from '../../stores/app';

interface SuiteAppConfig {
	id: string;
	name: string;
	description: string;
	accent: string;
	iconBg: string;
	iconColor: string;
	buttonBg: string;
	buttonHoverBg: string;
	buttonText: string;
	hoverClass: string;
	icon: React.ReactNode;
	features: { label: string; icon: React.ReactNode }[];
	route: string;
	shortcutKey: string;
	buttonLabel: string;
}

export function DashboardPage() {
	const navigate = useNavigate();
	const { user: authUser } = useAuth();
	const storeUser = useAppStore((s) => s.currentUser);
	const user = authUser || storeUser;

	// Dynamic time-based greeting calculation
	const greeting = useMemo(() => {
		const hour = new Date().getHours();
		let timeGreeting = 'Good Morning';
		if (hour >= 12 && hour < 17) {
			timeGreeting = 'Good Afternoon';
		} else if (hour >= 17) {
			timeGreeting = 'Good Evening';
		}

		const fullName = user?.fullName?.trim();
		if (fullName) {
			const firstName = fullName.split(' ')[0];
			return `${timeGreeting}, ${firstName}`;
		}
		return timeGreeting;
	}, [user?.fullName]);

	// Global Suite Launcher keyboard shortcuts (Alt + 1 to Alt + 5)
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (!e.altKey) return;
			switch (e.key) {
				case '1':
					e.preventDefault();
					navigate('/job-cards');
					break;
				case '2':
					e.preventDefault();
					navigate('/staff-advances');
					break;
				case '3':
					e.preventDefault();
					navigate('/showroom');
					break;
				case '4':
					e.preventDefault();
					navigate('/reports');
					break;
				case '5':
					e.preventDefault();
					navigate('/settings');
					break;
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [navigate]);

	const suiteApplications: SuiteAppConfig[] = [
		{
			id: 'billing',
			name: 'E6 Billing',
			description: 'Customers, job cards, invoices and payments',
			accent: '#2563EB',
			iconBg: 'bg-blue-50',
			iconColor: 'text-[#2563EB]',
			buttonBg: 'bg-blue-50',
			buttonHoverBg: 'hover:bg-blue-100',
			buttonText: 'text-[#2563EB]',
			hoverClass: 'launcher-card-billing',
			icon: <Car className="w-6 h-6" />,
			features: [
				{ label: 'Customers', icon: <Users className="w-4 h-4 text-slate-400 shrink-0" /> },
				{ label: 'Job Cards', icon: <ClipboardList className="w-4 h-4 text-slate-400 shrink-0" /> },
				{ label: 'Invoices', icon: <Receipt className="w-4 h-4 text-slate-400 shrink-0" /> },
				{ label: 'Payments', icon: <CreditCard className="w-4 h-4 text-slate-400 shrink-0" /> },
			],
			route: '/job-cards',
			shortcutKey: 'Alt + 1',
			buttonLabel: 'Open E6 Billing',
		},
		{
			id: 'staff',
			name: 'E6 Staff',
			description: 'Staff, attendance and salary management',
			accent: '#059669',
			iconBg: 'bg-emerald-50',
			iconColor: 'text-[#059669]',
			buttonBg: 'bg-emerald-50',
			buttonHoverBg: 'hover:bg-emerald-100',
			buttonText: 'text-[#059669]',
			hoverClass: 'launcher-card-staff',
			icon: <Users className="w-6 h-6" />,
			features: [
				{ label: 'Staff', icon: <Users className="w-4 h-4 text-slate-400 shrink-0" /> },
				{ label: 'Attendance', icon: <CheckCircle2 className="w-4 h-4 text-slate-400 shrink-0" /> },
				{ label: 'Salary', icon: <Calendar className="w-4 h-4 text-slate-400 shrink-0" /> },
				{ label: 'Advances', icon: <Wallet className="w-4 h-4 text-slate-400 shrink-0" /> },
			],
			route: '/staff',
			shortcutKey: 'Alt + 2',
			buttonLabel: 'Open E6 Staff',
		},
		{
			id: 'showroom',
			name: 'E6 Showroom',
			description: 'Showrooms, staff work and showroom billing',
			accent: '#D97706',
			iconBg: 'bg-amber-50',
			iconColor: 'text-[#D97706]',
			buttonBg: 'bg-amber-50',
			buttonHoverBg: 'hover:bg-amber-100',
			buttonText: 'text-[#D97706]',
			hoverClass: 'launcher-card-showroom',
			icon: <Store className="w-6 h-6" />,
			features: [
				{ label: 'Showrooms', icon: <Store className="w-4 h-4 text-slate-400 shrink-0" /> },
				{ label: 'Staff Requests', icon: <Clock className="w-4 h-4 text-slate-400 shrink-0" /> },
				{ label: 'Attendance', icon: <CheckSquare className="w-4 h-4 text-slate-400 shrink-0" /> },
				{ label: 'Billing', icon: <Receipt className="w-4 h-4 text-slate-400 shrink-0" /> },
			],
			route: '/showroom',
			shortcutKey: 'Alt + 3',
			buttonLabel: 'Open E6 Showroom',
		},
		{
			id: 'reports',
			name: 'E6 Reports',
			description: 'Business, billing, staff and showroom reports',
			accent: '#7C3AED',
			iconBg: 'bg-purple-50',
			iconColor: 'text-[#7C3AED]',
			buttonBg: 'bg-purple-50',
			buttonHoverBg: 'hover:bg-purple-100',
			buttonText: 'text-[#7C3AED]',
			hoverClass: 'launcher-card-reports',
			icon: <BarChart3 className="w-6 h-6" />,
			features: [
				{ label: 'Business Reports', icon: <TrendingUp className="w-4 h-4 text-slate-400 shrink-0" /> },
				{ label: 'Operational Reports', icon: <BarChart2 className="w-4 h-4 text-slate-400 shrink-0" /> },
				{ label: 'Financial Reports', icon: <IndianRupee className="w-4 h-4 text-slate-400 shrink-0" /> },
				{ label: 'Custom Reports', icon: <SlidersHorizontal className="w-4 h-4 text-slate-400 shrink-0" /> },
			],
			route: '/reports',
			shortcutKey: 'Alt + 4',
			buttonLabel: 'Open E6 Reports',
		},
		{
			id: 'settings',
			name: 'E6 Settings',
			description: 'Business configuration and system settings',
			accent: '#475569',
			iconBg: 'bg-slate-100',
			iconColor: 'text-[#475569]',
			buttonBg: 'bg-slate-100',
			buttonHoverBg: 'hover:bg-slate-200',
			buttonText: 'text-slate-700',
			hoverClass: 'launcher-card-settings',
			icon: <Settings className="w-6 h-6" />,
			features: [
				{ label: 'Business Profile', icon: <Building2 className="w-4 h-4 text-slate-400 shrink-0" /> },
				{ label: 'Tax Settings', icon: <Percent className="w-4 h-4 text-slate-400 shrink-0" /> },
				{ label: 'Users & Access', icon: <Shield className="w-4 h-4 text-slate-400 shrink-0" /> },
				{ label: 'System Preferences', icon: <Sliders className="w-4 h-4 text-slate-400 shrink-0" /> },
			],
			route: '/settings',
			shortcutKey: 'Alt + 5',
			buttonLabel: 'Open Settings',
		},
	];

	return (
		<div className="space-y-6 max-w-7xl mx-auto animate-fade-in select-none">
			{/* ── Welcome Area & Automotive Hero Banner ── */}
			<section
				className="relative overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-sm min-h-[160px] flex items-center justify-between"
				data-purpose="welcome-hero-banner"
			>
				{/* Left Greeting Text Content */}
				<div className="p-6 sm:p-8 z-10 max-w-xl">
					<p className="text-[11px] font-bold text-blue-600 tracking-wider uppercase mb-1">
						WELCOME TO E6 CAR SPA
					</p>
					<h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mb-1.5">
						{greeting}
					</h1>
					<p className="text-slate-500 text-sm font-normal">
						What would you like to manage today?
					</p>
				</div>

				{/* Right Visual Graphic: Car Silhouette + Slogan */}
				<div className="hidden md:flex absolute right-0 top-0 bottom-0 w-7/12 items-center justify-end overflow-hidden pointer-events-none">
					<div className="relative w-full h-full bg-gradient-to-r from-white via-[#0a0f1d] to-[#04060b] flex items-center justify-end pr-8">
						{/* Slogan Overlay Text */}
						<div className="absolute left-16 lg:left-24 z-10 text-left">
							<div className="text-slate-100 font-extrabold tracking-tight text-xs lg:text-sm leading-tight uppercase font-sans">
								CLEAN CARS<br />
								HAPPY PEOPLE<br />
								<span className="text-red-500 font-black">DRIVE BETTER</span>
							</div>
							<div className="w-10 h-0.5 bg-red-600 mt-2" />
						</div>

						{/* Luxury Car Silhouette SVG */}
						<div className="relative w-80 lg:w-96 h-full flex items-center">
							<svg
								className="w-full h-auto drop-shadow-2xl translate-y-2 opacity-95"
								fill="none"
								viewBox="0 0 600 240"
								xmlns="http://www.w3.org/2000/svg"
							>
								<defs>
									<linearGradient id="carBodyGrad" x1="0%" x2="100%" y1="0%" y2="50%">
										<stop offset="0%" stopColor="#1e293b" />
										<stop offset="40%" stopColor="#0f172a" />
										<stop offset="70%" stopColor="#020617" />
										<stop offset="100%" stopColor="#000000" />
									</linearGradient>
									<linearGradient id="glassGrad" x1="0%" x2="0%" y1="0%" y2="100%">
										<stop offset="0%" stopColor="#38bdf8" stopOpacity="0.5" />
										<stop offset="100%" stopColor="#0f172a" stopOpacity="0.9" />
									</linearGradient>
								</defs>
								{/* Ground Shadow */}
								<ellipse cx="320" cy="205" fill="#000000" opacity="0.6" rx="260" ry="14" />
								{/* Car Body Shell */}
								<path
									d="M50 170 C 90 170, 110 168, 145 140 C 200 95, 275 80, 420 86 C 460 88, 515 110, 560 145 C 575 158, 575 174, 560 178 C 530 185, 480 185, 470 185 C 450 150, 400 150, 380 185 L 210 185 C 195 150, 145 150, 130 185 Z"
									fill="url(#carBodyGrad)"
									stroke="#334155"
									strokeWidth="2"
								/>
								{/* Windshield & Windows */}
								<path
									d="M225 135 L 270 95 C 330 92, 385 93, 425 105 L 470 135 Z"
									fill="url(#glassGrad)"
								/>
								{/* Window Pillars */}
								<line stroke="#1e293b" strokeWidth="4" x1="330" x2="335" y1="92" y2="135" />
								<line stroke="#1e293b" strokeWidth="4" x1="415" x2="410" y1="102" y2="135" />
								{/* Front Headlight LED Glow */}
								<path d="M525 145 L 565 152 C 555 158, 535 158, 520 155 Z" fill="#60a5fa" />
								{/* Wheels */}
								<circle cx="425" cy="180" fill="#090d16" r="28" stroke="#475569" strokeWidth="4" />
								<circle cx="425" cy="180" fill="#1e293b" r="16" stroke="#94a3b8" strokeWidth="2" />
								<circle cx="170" cy="180" fill="#090d16" r="28" stroke="#475569" strokeWidth="4" />
								<circle cx="170" cy="180" fill="#1e293b" r="16" stroke="#94a3b8" strokeWidth="2" />
							</svg>
						</div>
					</div>
				</div>
			</section>

			{/* ── Applications Section ── */}
			<section id="applications" className="space-y-4" data-purpose="applications-launcher">
				{/* Section Header */}
				<div>
					<h2 className="text-lg font-bold text-slate-900 tracking-tight leading-tight">
						Applications
					</h2>
					<p className="text-xs text-slate-500 mt-0.5">
						Independent workspaces tailored for different areas of your business
					</p>
				</div>

				{/* Row 1: 3 Columns (E6 Billing, E6 Staff, E6 Showroom) */}
				<div className="grid grid-cols-1 md:grid-cols-3 gap-5">
					{suiteApplications.slice(0, 3).map((app) => (
						<article
							key={app.id}
							role="button"
							tabIndex={0}
							onClick={() => navigate(app.route)}
							onKeyDown={(e) => {
								if (e.key === 'Enter' || e.key === ' ') {
									e.preventDefault();
									navigate(app.route);
								}
							}}
							aria-label={`${app.name} workspace`}
							className={`launcher-card ${app.hoverClass} text-left focus:outline-none focus:ring-2 focus:ring-offset-2`}
						>
							<div>
								{/* Header with Icon & Title */}
								<div className="flex items-start gap-3.5 mb-4">
									<div
										className={`w-12 h-12 rounded-xl ${app.iconBg} ${app.iconColor} flex items-center justify-center shrink-0`}
									>
										{app.icon}
									</div>
									<div className="min-w-0 flex-1">
										<div className="flex items-center justify-between gap-2">
											<h3 className="text-base font-bold text-slate-900 leading-snug">
												{app.name}
											</h3>
											<span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">
												{app.shortcutKey}
											</span>
										</div>
										<p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
											{app.description}
										</p>
									</div>
								</div>

								{/* Feature Indicators */}
								<ul className="space-y-2.5 my-5 text-xs text-slate-600">
									{app.features.map((feat, idx) => (
										<li key={idx} className="flex items-center gap-2.5">
											{feat.icon}
											<span>{feat.label}</span>
										</li>
									))}
								</ul>
							</div>

							{/* Bottom Action Button */}
							<button
								type="button"
								tabIndex={-1}
								className={`w-full mt-2 py-2.5 ${app.buttonBg} ${app.buttonHoverBg} ${app.buttonText} rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer`}
							>
								<span>{app.buttonLabel}</span>
								<ArrowRight className="w-3.5 h-3.5" />
							</button>
						</article>
					))}
				</div>

				{/* Row 2: 2 Wider Columns (E6 Reports, E6 Settings) */}
				<div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-1">
					{suiteApplications.slice(3, 5).map((app) => (
						<article
							key={app.id}
							role="button"
							tabIndex={0}
							onClick={() => navigate(app.route)}
							onKeyDown={(e) => {
								if (e.key === 'Enter' || e.key === ' ') {
									e.preventDefault();
									navigate(app.route);
								}
							}}
							aria-label={`${app.name} workspace`}
							className={`launcher-card ${app.hoverClass} text-left focus:outline-none focus:ring-2 focus:ring-offset-2`}
						>
							<div>
								{/* Header with Icon & Title */}
								<div className="flex items-start gap-3.5 mb-4">
									<div
										className={`w-12 h-12 rounded-xl ${app.iconBg} ${app.iconColor} flex items-center justify-center shrink-0`}
									>
										{app.icon}
									</div>
									<div className="min-w-0 flex-1">
										<div className="flex items-center justify-between gap-2">
											<h3 className="text-base font-bold text-slate-900 leading-snug">
												{app.name}
											</h3>
											<span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">
												{app.shortcutKey}
											</span>
										</div>
										<p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
											{app.description}
										</p>
									</div>
								</div>

								{/* Feature Indicators */}
								<ul className="space-y-2.5 my-5 text-xs text-slate-600">
									{app.features.map((feat, idx) => (
										<li key={idx} className="flex items-center gap-2.5">
											{feat.icon}
											<span>{feat.label}</span>
										</li>
									))}
								</ul>
							</div>

							{/* Bottom Action Button */}
							<button
								type="button"
								tabIndex={-1}
								className={`w-full mt-2 py-2.5 ${app.buttonBg} ${app.buttonHoverBg} ${app.buttonText} rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer`}
							>
								<span>{app.buttonLabel}</span>
								<ArrowRight className="w-3.5 h-3.5" />
							</button>
						</article>
					))}
				</div>
			</section>
		</div>
	);
}

export default DashboardPage;
