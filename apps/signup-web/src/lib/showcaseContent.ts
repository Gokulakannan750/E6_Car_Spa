import type { PublicCatalog } from './types';

export interface ShowcaseTab {
	id: string;
	label: string;
	iconName: 'clipboard' | 'receipt' | 'message-square' | 'users' | 'bar-chart' | 'network' | 'folder-kanban' | 'shield-check';
	title: string;
	subtitle: string;
	description: string;
	bullets: string[];
	imageSrc?: string;
	badge: string;
}

export interface ShowcaseContent {
	badge: string;
	headline: string;
	headlineAccent: string;
	subtitle: string;
	trustPoints: string[];
	metrics: { value: string; label: string; desc: string }[];
	tabs: ShowcaseTab[];
	faqs: { question: string; answer: string }[];
}

export function getShowcaseContent(catalog: PublicCatalog): ShowcaseContent {
	if (catalog.productKey === 'carspa') {
		return {
			badge: 'Automotive Business Suite · Free 7-Day Trial',
			headline: 'Your all-in-one suite for',
			headlineAccent: 'car spa success',
			subtitle:
				'Zoho-style unified platform purpose-built for detailing studios, car wash centers, and multi-bay operations. Connect your front desk intake, bay technicians, GST billing, and customer WhatsApp in one live system.',
			trustPoints: [
				'Instant 7-day full access trial',
				'Native Windows counter & Android floor apps',
				'Franchise network & multi-branch ready',
			],
			metrics: [
				{
					value: '40% Faster',
					label: 'Intake Turnaround',
					desc: 'Digital check-in with preloaded vehicle history and fuel/odometer tracking eliminates paper job card bottlenecks.',
				},
				{
					value: '100% Leak-Proof',
					label: 'GST & Cash Billing',
					desc: 'Itemized job cards convert straight to compliant invoices with flexible split payments (Cash, UPI, Card).',
				},
				{
					value: '5★ Delight',
					label: 'Customer Retention',
					desc: 'Automated WhatsApp service milestone alerts and digital inspection receipts sent directly to car owners.',
				},
			],
			tabs: [
				{
					id: 'job-cards',
					label: 'Job Cards',
					iconName: 'clipboard',
					badge: 'Core Workflow',
					title: 'Streamline vehicle check-in, bay allocation, and service stages',
					subtitle: 'From arrival to handover, maintain real-time visibility across every service bay.',
					description:
						'Say goodbye to lost paper job sheets. Floor staff use Android devices or counter terminals to record customer contact, vehicle registration, pre-existing scratches/dents, fuel level, and required service packages in under 60 seconds.',
					bullets: [
						'Digital vehicle intake with photo inspections & fuel/odometer logs',
						'Real-time bay progress indicators and stage completion timers',
						'Technician job allocation with individual checklists',
						'Instant customer approval on added detailing items',
					],
					imageSrc: '/previews/job-card.png',
				},
				{
					id: 'invoicing',
					label: 'GST Invoicing',
					iconName: 'receipt',
					badge: 'Financial Control',
					title: 'Instant tax-compliant billing and multi-mode payment collection',
					subtitle: 'Generate professional invoices, print thermal receipts, and eliminate cash leakage.',
					description:
						'Convert completed job cards directly into GST tax invoices or cash receipts with one tap. Supports split tender (e.g. ₹2,000 cash + ₹3,500 UPI), itemized discounts, custom SGST/CGST rates, and instant counter thermal prints.',
					bullets: [
						'Single-click invoice generation directly from finished job cards',
						'Dual receipt format support: 80mm/58mm thermal printers and full A4 GST invoices',
						'Dynamic counter UPI QR codes for swift scan & pay checkout',
						'Automatic daily sales totals, payment mode tallies, and cash drawer reconciliations',
					],
					imageSrc: '/previews/invoice.png',
				},
				{
					id: 'whatsapp',
					label: 'WhatsApp',
					iconName: 'message-square',
					badge: 'Customer Experience',
					title: 'Keep car owners informed at every step without lifting a finger',
					subtitle: 'Automated job status updates, vehicle inspection reports, and digital bills.',
					description:
						'Impress car owners with automated notifications delivered straight to their personal WhatsApp. Customers receive immediate confirmations when their vehicle arrives, live alerts when detailing begins, and a notification the moment their car is sparkling clean and ready for pickup.',
					bullets: [
						'Instant job-card intake summary with inspection photos sent to customer WhatsApp',
						'Automated "Vehicle Ready for Pickup" alert with digital payment link',
						'Direct PDF invoice delivery to WhatsApp after billing',
						'Automated service reminder follow-ups after 30, 60, and 90 days',
					],
					imageSrc: '/previews/subscription.png',
				},
				{
					id: 'staff',
					label: 'Staff & Payroll',
					iconName: 'users',
					badge: 'Team Management',
					title: 'Track technician commissions, advances, and payroll effortlessly',
					subtitle: 'Motivate your team with transparent commission calculation and simplified advance deductions.',
					description:
						'Eliminate tedious end-of-month commission math and paper advance registers. Baylior tracks which technician worked on each service item, calculates commissions automatically based on service rules, and deducts staff advances automatically at settlement.',
					bullets: [
						'Configurable commission percentages or flat amounts per detailing service',
						'Live log of staff advance requests, approvals, and balance deductions',
						'PIN-protected staff logins with role-based feature permissions',
						'Detailed technician productivity and earnings leaderboard',
					],
					imageSrc: '/previews/staff.png',
				},
				{
					id: 'reports',
					label: 'Reports & Insights',
					iconName: 'bar-chart',
					badge: 'Business Intelligence',
					title: 'Actionable business insights right at your fingertips',
					subtitle: 'Monitor revenue, high-margin detailing packages, and customer frequency in real-time.',
					description:
						'Know exactly how your studio is performing every single day. Track top-performing packages (ceramic coating vs basic wash), technician efficiency, peak rush hours, and repeat visit frequency with intuitive graphical dashboards.',
					bullets: [
						'Daily, weekly, and monthly revenue breakdowns with collection modes',
						'Package margin analysis and slow-moving service alerts',
						'One-click export for CA / accountant GST filing (GSTR-1 format)',
						'Executive summary delivered to the owner’s mobile every evening',
					],
					imageSrc: '/previews/reports.png',
				},
				{
					id: 'franchise',
					label: 'Franchise Network',
					iconName: 'network',
					badge: 'Multi-Location',
					title: 'Connect multiple branches or entire franchise brand networks',
					subtitle: 'Centralize service catalogues while maintaining strict tenant data security.',
					description:
						'Whether you operate two local detailing outlets or run a nationwide franchise network, Trovo gives you multi-location power. Franchisors can distribute standard service catalogues, inspect high-level turnover metrics, and onboard franchisees seamlessly.',
					bullets: [
						'Instant franchise code issuance and one-click branch linking',
						'Centralized brand catalogue updates pushed to franchise outlets',
						'Granular permission scopes for franchisor reporting visibility',
						'Isolated tenant databases for complete financial privacy',
					],
					imageSrc: '/previews/dashboard.png',
				},
			],
			faqs: [
				{
					question: 'How does the 7-day free trial work?',
					answer:
						'You get complete, unrestricted access to the Professional plan for 7 full days. There are no setup fees and no credit card is required. You can immediately configure your services, invite your team, and generate real job cards.',
				},
				{
					question: 'Can I use Baylior on both Windows PC and Android phones?',
					answer:
						'Yes! Baylior provides a native Windows desktop application for your billing desk and customer reception, as well as an Android mobile app for your floor managers and wash bay technicians.',
				},
				{
					question: 'What happens when the 7-day trial ends?',
					answer:
						'At the end of your trial, you can choose to activate either the Starter or Professional plan and pay seamlessly via UPI, card, or net banking. All your customers, vehicle history, and job cards created during the trial remain intact.',
				},
				{
					question: 'How does the franchise network code work?',
					answer:
						'If your car spa is part of an existing brand network, enter the franchise code provided by your franchisor during sign up. This links your outlet to their network catalogue while keeping your private financial data secure.',
				},
			],
		};
	}

	// Generic / Demo content
	return {
		badge: `${catalog.productName} · Free 7-Day Trial`,
		headline: 'Modern unified workspace for',
		headlineAccent: catalog.productName,
		subtitle:
			(catalog as any).publicDescription ||
			'A connected platform designed to streamline operations, enhance team collaboration, and deliver measurable results with ease.',
		trustPoints: [
			'Instant 7-day full access trial',
			'No credit card required to start',
			'Scalable architecture with enterprise security',
		],
		metrics: [
			{
				value: '100% Cloud',
				label: 'Connected Workspace',
				desc: 'Access your team environment securely from anywhere with instant synchronization.',
			},
			{
				value: 'Zero Friction',
				label: 'Rapid Onboarding',
				desc: 'Get your entire organization configured and productive in minutes.',
			},
			{
				value: 'Enterprise-Grade',
				label: 'Data Isolation',
				desc: 'Multi-tenant architecture ensuring your business records remain strictly confidential.',
			},
		],
		tabs: [
			{
				id: 'workspace',
				label: 'Project Workspace',
				iconName: 'folder-kanban',
				badge: 'Productivity',
				title: 'Organize tasks, projects, and milestones with ease',
				subtitle: 'Keep your team aligned on goals and deliverables.',
				description:
					'Coordinate cross-functional projects, manage backlog priorities, and track milestones with intuitive interactive boards and real-time updates.',
				bullets: [
					'Kanban boards with customizable stage workflows',
					'Task assignment, priorities, and deadline tracking',
					'Real-time activity audit trail and notifications',
					'Exportable summary reports and status overviews',
				],
				imageSrc: '/previews/dashboard.png',
			},
			{
				id: 'security',
				label: 'Security & Access',
				iconName: 'shield-check',
				badge: 'Governance',
				title: 'Role-based access control and tenant isolation',
				subtitle: 'Ensure granular control over data access and permissions.',
				description:
					'Protect critical business assets with role-based permission tiers, comprehensive audit logging, and isolated workspace configurations.',
				bullets: [
					'Role-based permissions for administrators and team members',
					'Comprehensive user audit logs and access tracking',
					'Single-tenant data boundaries with secure credentialing',
				],
				imageSrc: '/previews/subscription.png',
			},
		],
		faqs: [
			{
				question: `How does the 7-day ${catalog.productName} trial work?`,
				answer:
					'You get full unrestricted access to explore all product features for 7 days. No credit card is required. Once the trial ends, you can easily activate a plan.',
			},
			{
				question: 'How quickly can my team start using the platform?',
				answer:
					'Activation is instantaneous. As soon as you complete the quick sign-up, you receive your company code and one-time registration code.',
			},
		],
	};
}
