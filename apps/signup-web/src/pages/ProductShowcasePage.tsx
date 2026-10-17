import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
	ArrowRight,
	BarChart3,
	Check,
	CheckCircle2,
	ChevronDown,
	ChevronUp,
	ClipboardList,
	FolderKanban,
	Layers,
	MessageSquare,
	Network,
	Receipt,
	ShieldCheck,
	Sparkles,
	Users,
	Zap,
	AlertCircle,
} from 'lucide-react';
import { Page } from '@/components/Frame';
import { Button, Card, TextField } from '@/components/ui';
import { getShowcaseContent, type ShowcaseTab } from '@/lib/showcaseContent';
import { featureName } from '@/lib/featureNames';
import { moneyShort } from '@/lib/format';
import { freeMonthsLabel, per, pricesFor, yearlyFreeMonths, validateBusiness } from '@/lib/rules';
import type { Business, Interval, Joining } from '@/lib/types';
import { useSignup } from '@/state/signup';
import { useProduct, usePaths } from '@/state/product';

export function ProductShowcasePage() {
	const { catalog, api, brand } = useProduct();
	const paths = usePaths();
	const navigate = useNavigate();
	const { business, setBusiness, joining, setJoining, setResult, setChoice, choice } = useSignup();

	const content = getShowcaseContent(catalog);
	const [activeTabId, setActiveTabId] = useState<string>(content.tabs[0]?.id ?? '');
	const [interval, setInterval] = useState<Interval>('Month');
	const freeMonths = yearlyFreeMonths(catalog);

	// Quick Hero Sign-up Form State
	const [form, setForm] = useState<Business>({
		name: business.name || '',
		ownerName: business.ownerName || '',
		email: business.email || '',
		mobile: business.mobile || '',
		city: business.city || 'Erode',
		state: business.state || 'Tamil Nadu',
		gstin: business.gstin || '',
	});
	const [franchiseCode, setFranchiseCode] = useState<string>(joining.code || '');
	const [showFranchiseField, setShowFranchiseField] = useState<boolean>(joining.kind === 'franchise');
	const [formErrors, setFormErrors] = useState<Partial<Record<keyof Business, string>>>({});
	const [franchiseError, setFranchiseError] = useState<string | null>(null);
	const [apiError, setApiError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState<boolean>(false);

	// FAQ Accordion open states
	const [openFaq, setOpenFaq] = useState<Record<number, boolean>>({ 0: true });

	useEffect(() => {
		document.title = `${brand.name} · Complete Business Suite & Free Trial`;
	}, [brand.name]);

	const activeTab = content.tabs.find((t) => t.id === activeTabId) ?? content.tabs[0];

	function getTabIcon(iconName: ShowcaseTab['iconName']) {
		switch (iconName) {
			case 'clipboard':
				return <ClipboardList className="size-4 shrink-0" />;
			case 'receipt':
				return <Receipt className="size-4 shrink-0" />;
			case 'message-square':
				return <MessageSquare className="size-4 shrink-0" />;
			case 'users':
				return <Users className="size-4 shrink-0" />;
			case 'bar-chart':
				return <BarChart3 className="size-4 shrink-0" />;
			case 'network':
				return <Network className="size-4 shrink-0" />;
			case 'folder-kanban':
				return <FolderKanban className="size-4 shrink-0" />;
			case 'shield-check':
				return <ShieldCheck className="size-4 shrink-0" />;
			default:
				return <Layers className="size-4 shrink-0" />;
		}
	}

	function scrollToSignup() {
		const el = document.getElementById('hero-signup-box');
		if (el) {
			el.scrollIntoView({ behavior: 'smooth' });
			const input = el.querySelector<HTMLInputElement>('input');
			if (input) input.focus();
		}
	}

	async function handleQuickTrialSubmit(e: FormEvent) {
		e.preventDefault();
		setApiError(null);
		setFranchiseError(null);

		const errors = validateBusiness(form);
		setFormErrors(errors);
		if (Object.keys(errors).length > 0) {
			const firstInvalid = document.querySelector<HTMLElement>('[aria-invalid="true"]');
			if (firstInvalid) firstInvalid.focus();
			return;
		}

		let finalJoining: Joining = { kind: 'own', code: '', check: null, consent: false };
		if (showFranchiseField && franchiseCode.trim()) {
			try {
				const check = await api.checkFranchiseCode(franchiseCode.trim());
				finalJoining = { kind: 'franchise', code: franchiseCode.trim(), check, consent: true };
			} catch (err: any) {
				setFranchiseError(err?.message || 'This franchise code is invalid.');
				return;
			}
		}

		setSubmitting(true);
		try {
			const cleanBusiness: Business = {
				...form,
				email: form.email.trim(),
				mobile: form.mobile.trim(),
				gstin: form.gstin.trim().toUpperCase(),
			};

			const result = await api.startTrial(cleanBusiness, finalJoining);
			setBusiness(cleanBusiness);
			setJoining(finalJoining);
			setResult(result);
			navigate(paths.step('done'));
		} catch (err: any) {
			setApiError(err?.message || 'Something went wrong while activating your trial. Please try again.');
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<Page>
			{/* Anchor Navigation Sub-Bar */}
			<div className="sticky top-0 z-20 -mt-6 mb-8 border-b border-border-hairline bg-canvas/90 backdrop-blur-md py-3">
				<div className="mx-auto flex max-w-[1120px] items-center justify-between px-2 text-label">
					<div className="flex items-center gap-6 overflow-x-auto">
						<span className="font-semibold text-text-heading whitespace-nowrap">{catalog.productName}</span>
						<nav className="flex items-center gap-4 text-text-secondary">
							<a href="#overview" className="transition hover:text-text-heading">
								Overview
							</a>
							<a href="#features" className="transition hover:text-text-heading">
								Features
							</a>
							<a href="#pricing" className="transition hover:text-text-heading">
								Pricing
							</a>
							<a href="#faq" className="transition hover:text-text-heading">
								FAQ
							</a>
						</nav>
					</div>
					<div className="flex items-center gap-3">
						<Link
							to={paths.pricing}
							className="hidden sm:inline-flex text-text-secondary hover:text-text-heading font-medium"
						>
							View plan matrix →
						</Link>
						<button
							type="button"
							onClick={scrollToSignup}
							className="rounded-full bg-brand px-4 py-1.5 font-semibold text-white shadow-sm transition hover:brightness-110"
						>
							Start Free Trial
						</button>
					</div>
				</div>
			</div>

			{/* HERO SECTION */}
			<section id="overview" className="scroll-mt-20">
				<div className="grid gap-12 lg:grid-cols-12 lg:items-center">
					{/* Left: Product Headline & Pitch */}
					<div className="lg:col-span-7">
						<div className="inline-flex items-center gap-2 rounded-full border border-cyan/40 bg-cyan/10 px-3.5 py-1 text-micro font-semibold uppercase tracking-wide text-cyan">
							<Sparkles className="size-3.5" aria-hidden />
							<span>{content.badge}</span>
						</div>

						<h1 className="mt-5 text-[36px] font-bold tracking-tight text-text-heading sm:text-[46px] sm:leading-[1.15]">
							{content.headline} <span className="text-brand-gradient">{content.headlineAccent}</span>
						</h1>

						<p className="mt-5 text-title leading-relaxed text-text-secondary sm:text-[18px]">
							{content.subtitle}
						</p>

						{/* Quick feature badges */}
						<div className="mt-8 flex flex-col gap-3">
							{content.trustPoints.map((point) => (
								<div key={point} className="flex items-center gap-3 text-body text-text-primary">
									<div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-active-bg text-active">
										<Check className="size-3.5 stroke-[2.5]" aria-hidden />
									</div>
									<span>{point}</span>
								</div>
							))}
						</div>

						<div className="mt-8 flex flex-wrap items-center gap-4">
							<button
								type="button"
								onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
								className="inline-flex h-11 items-center gap-2 rounded-md border border-border-strong bg-surface-raised px-5 text-body font-semibold text-text-heading transition hover:bg-surface-container"
							>
								Explore in-depth features
							</button>
							<button
								type="button"
								onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}
								className="inline-flex h-11 items-center gap-2 rounded-md px-4 text-body font-medium text-text-secondary transition hover:text-text-heading"
							>
								Compare plans & pricing ↓
							</button>
						</div>
					</div>

					{/* Right: Inline Sign-Up Box */}
					<div id="hero-signup-box" className="lg:col-span-5 scroll-mt-24">
						<Card className="relative overflow-hidden border-2 border-action/40 bg-surface-card p-6 shadow-[0_20px_50px_rgba(45,107,255,0.18)] sm:p-8">
							<div className="absolute top-0 right-0 h-32 w-32 bg-cyan/10 blur-3xl" aria-hidden />
							<div className="relative">
								<div className="flex items-center justify-between">
									<span className="inline-flex items-center gap-1.5 rounded-full bg-brand/20 px-3 py-1 text-micro font-semibold text-cyan">
										<Zap className="size-3" aria-hidden /> Instant Activation
									</span>
									<span className="text-label text-text-muted">Takes 1 minute</span>
								</div>

								<h2 className="mt-3 text-headline font-bold text-text-heading">
									Get started with your free trial
								</h2>
								<p className="mt-1 text-label text-text-secondary">
									Full access for 7 days. No credit card required.
								</p>

								{apiError && (
									<div
										role="alert"
										className="mt-4 flex items-start gap-2.5 rounded-md border border-danger/40 bg-danger/10 p-3 text-label text-danger"
									>
										<AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
										<span>{apiError}</span>
									</div>
								)}

								<form onSubmit={handleQuickTrialSubmit} noValidate className="mt-6 flex flex-col gap-4">
									<TextField
										label="Business name"
										required
										placeholder="e.g. SpeedX Car Spa"
										value={form.name}
										onChange={(e) => {
											setForm((f) => ({ ...f, name: e.target.value }));
											if (formErrors.name) setFormErrors((x) => ({ ...x, name: undefined }));
										}}
										error={formErrors.name}
									/>

									<TextField
										label="Your name"
										required
										placeholder="e.g. Arun Kumar"
										value={form.ownerName}
										onChange={(e) => {
											setForm((f) => ({ ...f, ownerName: e.target.value }));
											if (formErrors.ownerName) setFormErrors((x) => ({ ...x, ownerName: undefined }));
										}}
										error={formErrors.ownerName}
									/>

									<div className="grid gap-4 sm:grid-cols-2">
										<TextField
											label="Mobile number"
											required
											type="tel"
											prefix="+91"
											placeholder="98765 43210"
											value={form.mobile}
											onChange={(e) => {
												setForm((f) => ({ ...f, mobile: e.target.value }));
												if (formErrors.mobile) setFormErrors((x) => ({ ...x, mobile: undefined }));
											}}
											error={formErrors.mobile}
										/>

										<TextField
											label="Email address"
											required
											type="email"
											placeholder="you@company.com"
											value={form.email}
											onChange={(e) => {
												setForm((f) => ({ ...f, email: e.target.value }));
												if (formErrors.email) setFormErrors((x) => ({ ...x, email: undefined }));
											}}
											error={formErrors.email}
										/>
									</div>

									{catalog.capabilities.includes('franchise') && (
										<div className="rounded-lg border border-border-subtle bg-surface-alt/70 p-3">
											<button
												type="button"
												onClick={() => setShowFranchiseField(!showFranchiseField)}
												className="flex w-full items-center justify-between text-label font-medium text-text-secondary hover:text-text-heading"
											>
												<span className="flex items-center gap-1.5">
													<Network className="size-3.5 text-action" aria-hidden />
													Joining a franchise network? (Optional)
												</span>
												{showFranchiseField ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
											</button>
											{showFranchiseField && (
												<div className="mt-3">
													<TextField
														label="Franchise invitation code"
														placeholder="FRAN-4COD-E7XY"
														value={franchiseCode}
														onChange={(e) => {
															setFranchiseCode(e.target.value.toUpperCase());
															setFranchiseError(null);
														}}
														error={franchiseError ?? undefined}
														hint="Ask your franchisor for their 12-character invitation code."
													/>
												</div>
											)}
										</div>
									)}

									<p className="text-micro text-text-muted">
										By signing up, you agree to the{' '}
										<a href={brand.terms} className="text-action hover:underline">
											Terms of Service
										</a>{' '}
										and{' '}
										<a href={brand.privacy} className="text-action hover:underline">
											Privacy Policy
										</a>
										.
									</p>

									<Button
										type="submit"
										variant="primary"
										loading={submitting}
										className="h-12 w-full text-[15px] font-bold tracking-wide"
										icon={<ArrowRight className="size-4" />}
									>
										START 7-DAY FREE TRIAL
									</Button>

									<div className="flex flex-wrap items-center justify-center gap-4 text-micro text-text-muted pt-1">
										<span className="flex items-center gap-1">
											<Check className="size-3 text-active" /> 7 days full access
										</span>
										<span className="flex items-center gap-1">
											<Check className="size-3 text-active" /> No credit card
										</span>
										<span className="flex items-center gap-1">
											<Check className="size-3 text-active" /> Instant registration codes
										</span>
									</div>
								</form>
							</div>
						</Card>
					</div>
				</div>
			</section>

			{/* METRIC / BUSINESS VALUE STRIP */}
			<section className="mt-20 border-y border-border-hairline bg-surface-alt/40 py-10">
				<div className="grid gap-8 sm:grid-cols-3">
					{content.metrics.map((m) => (
						<div key={m.label} className="flex flex-col border-border-subtle sm:border-r sm:last:border-r-0 sm:pr-6">
							<span className="text-[32px] font-bold text-cyan">{m.value}</span>
							<span className="mt-1 text-title font-semibold text-text-heading">{m.label}</span>
							<p className="mt-2 text-body text-text-secondary leading-relaxed">{m.desc}</p>
						</div>
					))}
				</div>
			</section>

			{/* INTERACTIVE FEATURE DEEP-DIVE TABS (ZOHO SERVICEPLUS STYLE) */}
			<section id="features" className="mt-24 scroll-mt-20">
				<div className="text-center">
					<span className="text-label font-semibold tracking-wider uppercase text-cyan">In-Depth Modules</span>
					<h2 className="mt-2 text-headline font-bold text-text-heading sm:text-display">
						Everything you need to run your operations
					</h2>
					<p className="mx-auto mt-3 max-w-[680px] text-body text-text-secondary">
						Click through the core applications below to see how {catalog.productName} unifies customer intake, floor bays,
						billing, and team management.
					</p>
				</div>

				{/* Tab Header Bar */}
				<div className="mt-10 border-b border-border-subtle pb-4">
					<div role="tablist" aria-label="Product Features" className="flex flex-wrap justify-center gap-2 sm:gap-3">
						{content.tabs.map((tab) => {
							const isActive = tab.id === activeTab.id;
							return (
								<button
									key={tab.id}
									role="tab"
									aria-selected={isActive}
									onClick={() => setActiveTabId(tab.id)}
									className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-body sm:text-title font-semibold transition ${
										isActive
											? 'bg-action text-white shadow-md'
											: 'bg-surface-card text-text-secondary border border-border-subtle hover:bg-surface-raised hover:text-text-primary'
									}`}
								>
									{getTabIcon(tab.iconName)}
									<span>{tab.label}</span>
								</button>
							);
						})}
					</div>
				</div>

				{/* Active Tab Showcase Display */}
				<div className="mt-8 rounded-2xl border border-border-subtle bg-surface-card p-6 sm:p-10 shadow-lg">
					<div className="grid gap-10 lg:grid-cols-12 lg:items-center">
						{/* Left: Tab Text, Description & Checklist */}
						<div className="lg:col-span-5">
							<span className="inline-block rounded bg-action/20 px-2.5 py-1 text-micro font-semibold uppercase tracking-wider text-action">
								{activeTab.badge}
							</span>
							<h3 className="mt-3 text-[24px] font-bold leading-tight text-text-heading sm:text-[28px]">
								{activeTab.title}
							</h3>
							<p className="mt-2 text-label font-medium text-cyan">{activeTab.subtitle}</p>
							<p className="mt-4 text-body text-text-secondary leading-relaxed">{activeTab.description}</p>

							<div className="mt-6 flex flex-col gap-3">
								{activeTab.bullets.map((b) => (
									<div key={b} className="flex items-start gap-2.5 text-body text-text-primary">
										<CheckCircle2 className="mt-0.5 size-4 shrink-0 text-active" aria-hidden />
										<span>{b}</span>
									</div>
								))}
							</div>

							<div className="mt-8">
								<button
									type="button"
									onClick={scrollToSignup}
									className="inline-flex items-center gap-2 rounded-md bg-action px-5 py-2.5 text-body font-semibold text-white shadow transition hover:bg-action-hover"
								>
									Try this in your free trial <ArrowRight className="size-4" />
								</button>
							</div>
						</div>

						{/* Right: Window Mockup with Screenshot */}
						<div className="lg:col-span-7">
							<div className="overflow-hidden rounded-xl border border-border-strong bg-surface-alt shadow-2xl">
								{/* Realistic Window Chrome */}
								<div className="flex h-9 items-center justify-between border-b border-border-subtle bg-surface-raised px-4">
									<div className="flex items-center gap-1.5">
										<span className="size-2.5 rounded-full bg-danger/80" />
										<span className="size-2.5 rounded-full bg-pastdue/80" />
										<span className="size-2.5 rounded-full bg-active/80" />
									</div>
									<span className="text-micro font-mono text-text-muted truncate max-w-[240px]">
										{brand.name} — {activeTab.label}
									</span>
									<span className="w-10" />
								</div>
								{/* Screenshot display */}
								<div className="relative aspect-[16/10] bg-canvas p-2 sm:p-4 flex items-center justify-center overflow-hidden">
									{activeTab.imageSrc ? (
										<img
											src={activeTab.imageSrc}
											alt={`${brand.name} ${activeTab.label} interface`}
											className="h-full w-full object-contain rounded transition duration-300 hover:scale-[1.02]"
										/>
									) : (
										<div className="flex flex-col items-center justify-center text-text-muted p-8 text-center">
											<Layers className="size-16 mb-4 text-action/40" />
											<span className="text-title font-semibold text-text-heading">{activeTab.label} Preview</span>
											<p className="mt-1 text-label max-w-sm">{activeTab.subtitle}</p>
										</div>
									)}
								</div>
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* PRICING & PLANS SECTION */}
			<section id="pricing" className="mt-24 scroll-mt-20">
				<div className="text-center">
					<span className="text-label font-semibold tracking-wider uppercase text-cyan">Transparent Pricing</span>
					<h2 className="mt-2 text-headline font-bold text-text-heading sm:text-display">
						Flexible plans that scale with your studio
					</h2>
					<p className="mx-auto mt-3 max-w-[640px] text-body text-text-secondary">
						Start with your 7-day free trial. Choose the license interval and seat structure that fits your operations best.
					</p>

					{/* Monthly / Yearly Toggle */}
					<div
						role="radiogroup"
						aria-label="Billing interval"
						className="mx-auto mt-8 flex w-fit rounded-full border border-border-subtle bg-surface-card p-1 shadow-inner"
					>
						{(['Month', 'Year'] as const).map((i) => (
							<button
								key={i}
								type="button"
								role="radio"
								aria-checked={interval === i}
								onClick={() => setInterval(i)}
								className={`h-10 rounded-full px-5 text-label font-semibold transition ${
									interval === i ? 'bg-action text-white shadow' : 'text-text-secondary hover:text-text-heading'
								}`}
							>
								{i === 'Year' ? 'Yearly billing' : 'Monthly billing'}
								{i === 'Year' && freeMonths > 0 && (
									<span className="ml-2 rounded-full bg-active-bg px-2 py-0.5 text-micro font-bold text-active">
										{freeMonthsLabel(freeMonths)}
									</span>
								)}
							</button>
						))}
					</div>
				</div>

				{/* Plan Cards */}
				<div className="mt-10 grid gap-6 md:grid-cols-2">
					{catalog.plans
						.filter((p) => pricesFor(p, interval))
						.map((plan) => {
							const prices = pricesFor(plan, interval)!;
							const isProfessional = plan.code === 'professional' || plan.code === catalog.trialPlanCode;
							return (
								<Card
									key={plan.code}
									className={`flex flex-col p-6 sm:p-8 transition ${
										isProfessional
											? 'border-2 border-action shadow-[0_8px_30px_rgba(45,107,255,0.2)] bg-surface-card'
											: 'border border-border-subtle bg-surface-card hover:border-border-strong'
									}`}
								>
									<div className="flex items-start justify-between">
										<div>
											<h3 className="text-headline font-bold text-text-heading">{plan.name}</h3>
											<p className="mt-1 text-label text-text-secondary">
												{isProfessional ? 'Full power suite for growing operations.' : 'Essentials for single-bay stations.'}
											</p>
										</div>
										{isProfessional && (
											<span className="rounded-full bg-brand px-3 py-1 text-micro font-bold text-white shadow-sm">
												RECOMMENDED
											</span>
										)}
									</div>

									{/* Pricing Breakdown */}
									<div className="mt-6 border-t border-border-subtle pt-6">
										{catalog.seatModel === 'None' ? (
											<div className="flex items-baseline gap-1">
												<span className="text-[32px] font-bold text-text-heading">{moneyShort(prices.companyFeeMinor)}</span>
												<span className="text-label text-text-secondary">{per(interval)} per company</span>
											</div>
										) : (
											<div>
												<span className="text-micro font-semibold uppercase tracking-wider text-text-muted">
													Seat Pricing {per(interval)}
												</span>
												<div className="mt-3 flex flex-col gap-2">
													{catalog.seatTypes.map((type) => {
														const seatPrice = prices.seats.find((s) => s.code === type.code)?.priceMinor ?? 0;
														return (
															<div key={type.code} className="flex items-center justify-between text-body">
																<span className="text-text-primary">{type.name}</span>
																<span className="font-semibold text-text-heading">
																	{moneyShort(seatPrice)}
																	<span className="text-label font-normal text-text-muted"> / user{per(interval)}</span>
																</span>
															</div>
														);
													})}
												</div>
											</div>
										)}
									</div>

									{/* Included Modules Checklist */}
									<div className="mt-6 flex-1 border-t border-border-subtle pt-6">
										<span className="text-micro font-semibold uppercase tracking-wider text-text-muted">
											Included Capabilities
										</span>
										<ul className="mt-3 flex flex-col gap-2.5 text-body text-text-primary">
											<li className="flex items-start gap-2">
												<Check className="mt-0.5 size-4 shrink-0 text-active" aria-hidden />
												<span>Digital vehicle intake and job cards</span>
											</li>
											<li className="flex items-start gap-2">
												<Check className="mt-0.5 size-4 shrink-0 text-active" aria-hidden />
												<span>GST tax & cash invoicing with thermal printing</span>
											</li>
											{plan.modules.map((key) => (
												<li key={key} className="flex items-start gap-2">
													<Check className="mt-0.5 size-4 shrink-0 text-active" aria-hidden />
													<span>{featureName(catalog, key)}</span>
												</li>
											))}
										</ul>
									</div>

									<div className="mt-8">
										<Button
											variant={isProfessional ? 'primary' : 'secondary'}
											onClick={() => {
												setChoice({ ...choice, planCode: plan.code, interval });
												scrollToSignup();
											}}
											className="w-full h-11 text-body font-semibold"
										>
											{isProfessional ? 'Start 7-Day Free Trial' : `Select ${plan.name} Trial`}
										</Button>
									</div>
								</Card>
							);
						})}
				</div>

				{/* Add-ons List if available */}
				{catalog.addOns.length > 0 && (
					<div className="mt-12 rounded-xl border border-border-subtle bg-surface-alt/60 p-6 sm:p-8">
						<h3 className="text-title font-semibold text-text-heading">Optional Add-On Modules</h3>
						<p className="mt-1 text-label text-text-secondary">Expand your suite with specialized enterprise extensions.</p>

						<div className="mt-6 grid gap-4 sm:grid-cols-3">
							{catalog.addOns.map((addon) => {
								const addonPrice = interval === 'Year' ? addon.yearlyPriceMinor : addon.monthlyPriceMinor;
								return (
									<div key={addon.code} className="flex flex-col justify-between rounded-lg border border-border-subtle bg-surface-card p-4">
										<div>
											<h4 className="text-body font-semibold text-text-heading">{addon.name}</h4>
											<p className="mt-1 text-label text-cyan">
												{addon.code === 'showroom'
													? 'Fleet and corporate car billing'
													: addon.code === 'outside_jobs'
														? 'Third-party vendor job coordination'
														: 'Automated WhatsApp customer alerts'}
											</p>
										</div>
										<div className="mt-4 pt-3 border-t border-border-subtle text-title font-semibold text-text-heading">
											{moneyShort(addonPrice)}
											<span className="text-label font-normal text-text-muted">{per(interval)}</span>
										</div>
									</div>
								);
							})}
						</div>
					</div>
				)}
			</section>

			{/* FREQUENTLY ASKED QUESTIONS */}
			<section id="faq" className="mt-24 scroll-mt-20">
				<div className="text-center">
					<span className="text-label font-semibold tracking-wider uppercase text-cyan">Got Questions?</span>
					<h2 className="mt-2 text-headline font-bold text-text-heading sm:text-display">Frequently Asked Questions</h2>
				</div>

				<div className="mx-auto mt-10 max-w-[800px] flex flex-col gap-3">
					{content.faqs.map((faq, idx) => {
						const isOpen = !!openFaq[idx];
						return (
							<div
								key={faq.question}
								className="rounded-xl border border-border-subtle bg-surface-card overflow-hidden transition"
							>
								<button
									type="button"
									onClick={() => setOpenFaq((prev) => ({ ...prev, [idx]: !prev[idx] }))}
									className="flex w-full items-center justify-between p-5 text-left text-title font-semibold text-text-heading hover:bg-surface-raised/40 transition"
								>
									<span>{faq.question}</span>
									{isOpen ? <ChevronUp className="size-4 shrink-0 text-action" /> : <ChevronDown className="size-4 shrink-0 text-text-secondary" />}
								</button>
								{isOpen && (
									<div className="border-t border-border-subtle/60 px-5 pb-5 pt-3 text-body text-text-secondary leading-relaxed">
										{faq.answer}
									</div>
								)}
							</div>
						);
					})}
				</div>
			</section>

			{/* BOTTOM CALL TO ACTION BANNER */}
			<section className="mt-24 rounded-2xl border border-action/40 bg-gradient-to-r from-surface-card via-surface-raised to-surface-card p-8 sm:p-12 text-center shadow-2xl relative overflow-hidden">
				<div className="absolute inset-0 bg-brand/5 pointer-events-none" aria-hidden />
				<h2 className="text-[28px] font-bold text-text-heading sm:text-[36px]">
					Ready to transform your {catalog.productName} operations?
				</h2>
				<p className="mx-auto mt-3 max-w-[580px] text-body text-text-secondary">
					Join car spas and studios delivering faster service, leak-free billing, and delighted car owners.
				</p>
				<div className="mt-8 flex justify-center">
					<Button
						variant="primary"
						onClick={scrollToSignup}
						className="h-12 px-8 text-title font-bold shadow-[0_10px_30px_rgba(45,107,255,0.4)]"
						icon={<ArrowRight className="size-4" />}
					>
						START 7-DAY FREE TRIAL NOW
					</Button>
				</div>
			</section>
		</Page>
	);
}
