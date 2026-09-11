import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './auth-context';
import LoginForm from './LoginForm';
import {
	getCachedBusinessProfile,
	getPublicBusinessProfile,
	resolveLogoUrl,
	type PublicBusinessProfileDto,
} from '../../lib/api';
import { PoweredByTrovo } from '../../components/shared/PoweredByTrovo';
import bannerImage from '../../assets/login-banner.jpg';


export default function LoginPage() {
	const { isAuthenticated, isInitialized, isLoading } = useAuth();
	const cachedProfile = getCachedBusinessProfile();
	const [publicProfile, setPublicProfile] = useState<PublicBusinessProfileDto | null>(() => {
		if (cachedProfile) {
			return {
				businessName: cachedProfile.businessName,
				logoPath: cachedProfile.logoPath,
				updatedAt: cachedProfile.updatedAt,
			};
		}
		return null;
	});
	const [imgError, setImgError] = useState(false);

	useEffect(() => {
		let isMounted = true;
		getPublicBusinessProfile()
			.then((profile) => {
				if (isMounted) {
					setPublicProfile(profile);
				}
			})
			.catch(() => {
				// Offline or server not ready - fallback gracefully to cachedProfile
			});
		return () => {
			isMounted = false;
		};
	}, []);

	const businessName = publicProfile?.businessName || cachedProfile?.businessName || 'E6 CAR SPA';
	const logoPath = publicProfile !== null ? publicProfile.logoPath : cachedProfile?.logoPath;
	const updatedAt = publicProfile !== null ? publicProfile.updatedAt : cachedProfile?.updatedAt;
	const hasCustomLogo = Boolean(logoPath && logoPath.trim().length > 0);
	const showImage = hasCustomLogo && !imgError;
	const logoUrl = resolveLogoUrl(logoPath, updatedAt);

	if (isLoading) {
		return (
			<div className="min-h-screen bg-gradient-to-br from-red-900 via-black to-red-950 flex items-center justify-center">
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
		<div className="min-h-screen w-full flex bg-[#090303] overflow-hidden">
			{/* Left Hero Banner (Desktop / Widescreen) */}
			<div className="hidden lg:flex lg:w-1/2 xl:w-7/12 relative overflow-hidden flex-col justify-between p-10 xl:p-14 select-none">
				{/* Background Image with Dark Vignette & Red Ambient Overlays */}
				<img
					src={bannerImage}
					alt="E6 Car Spa Luxury Studio"
					className="absolute inset-0 w-full h-full object-cover object-center scale-105"
				/>
				<div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-red-950/70" />
				<div className="absolute inset-0 bg-gradient-to-r from-black/40 via-transparent to-[#090303]" />

				{/* Top Branding Pill */}
				<div className="relative z-10 flex justify-center w-full">
					<div className="inline-flex items-center gap-4 px-6 py-3.5 rounded-2xl bg-black/65 border border-white/20 backdrop-blur-xl shadow-2xl shadow-black/60">
						<div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-red-600 to-red-900 text-white font-black text-lg shadow-lg shadow-red-950/60 ring-1 ring-white/20">
							E6
						</div>
						<div className="leading-tight text-left">
							<span className="font-extrabold text-xl xl:text-2xl tracking-wider uppercase text-white block">
								{businessName}
							</span>
							<span className="text-xs text-red-300 font-medium tracking-wide block mt-0.5">
								Automotive Spa & Detailing Suite
							</span>
						</div>
					</div>
				</div>

				{/* Center Content */}
				<div className="relative z-10 my-auto py-8 space-y-6 max-w-xl mx-auto text-center flex flex-col items-center">
					<div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-600/25 border border-red-500/40 text-red-200 text-xs font-semibold tracking-wider uppercase backdrop-blur-md">
						<span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
						Enterprise Studio Management
					</div>

					<h2 className="text-3xl xl:text-5xl font-black text-white tracking-tight leading-[1.15]">
						Precision Care. <br />
						<span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-red-200 to-white">
							Flawless Execution.
						</span>
					</h2>

					<p className="text-sm xl:text-base text-slate-200 leading-relaxed max-w-lg">
						Streamline customer intake, live job cards, custom service packages, multi-staff allocation, and instant WhatsApp invoicing in one unified management platform.
					</p>
				</div>

				{/* Bottom Banner Footer */}
				<div className="relative z-10 flex items-center justify-between pt-6 border-t border-white/10 text-xs text-slate-400">
					<span>© {new Date().getFullYear()} {businessName}. All rights reserved.</span>
					<span className="text-red-300/80 font-medium">Enterprise Suite</span>
				</div>
			</div>

			{/* Right Login Section */}
			<div className="w-full lg:w-1/2 xl:w-5/12 min-h-screen bg-gradient-to-br from-red-950 via-black to-red-950 flex items-center justify-center p-6 md:p-12 relative z-10">
				<div className="w-full max-w-md">
					{/* Brand / Logo */}
					<div className="text-center mb-8">
						{showImage ? (
							<div className="flex items-center justify-center mb-4">
								<img
									src={logoUrl}
									alt={businessName}
									className="h-16 max-h-16 w-auto max-w-[240px] object-contain drop-shadow-md"
									onError={() => setImgError(true)}
								/>
							</div>
						) : (
							<div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-red-600 to-red-900 shadow-lg shadow-red-900/40 text-white font-black text-2xl mb-4">
								E6
							</div>
						)}
						<h1 className="text-2xl font-extrabold text-white tracking-tight uppercase">
							{businessName}
						</h1>
						<p className="text-sm text-red-200/80 mt-1 font-medium">
							Management Suite — Sign In
						</p>
					</div>

					{/* Card */}
					<div className="bg-white/95 backdrop-blur-md rounded-2xl p-8 shadow-2xl border border-white/20">
						<LoginForm />
					</div>

					<div className="text-center mt-6 space-y-1.5">
						<p className="text-red-200/60 text-xs">
							Authorized staff and management personnel only
						</p>
						<PoweredByTrovo />
					</div>
				</div>
			</div>
		</div>
	);
}
