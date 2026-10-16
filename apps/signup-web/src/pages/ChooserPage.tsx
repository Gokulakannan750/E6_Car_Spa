import { Link } from 'react-router-dom';
import { moneyShort, perInterval } from '@/lib/format';
import type { PublicProduct } from '@/lib/types';

export function ChooserPage({ products }: { products: PublicProduct[] }) {
	const allHaveTrials = products.length > 0 && products.every((p) => p.hasTrial !== false);
	const introText = allHaveTrials
		? 'Pick the software you want to try. Every product starts with a free trial.'
		: 'Pick the software you want to try.';

	return (
		<div className="mx-auto max-w-[1040px]">
			<header className="text-center sm:text-left">
				<h1 className="text-display font-semibold text-text-heading">Choose your product</h1>
				<p className="mt-2 text-title text-text-secondary">{introText}</p>
			</header>

			<div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
				{products.map((p) => (
					<article
						key={p.key}
						className="flex flex-col justify-between rounded-xl border border-border-subtle bg-surface-card p-6 shadow-sm transition hover:border-border-strong hover:bg-surface-raised"
					>
						<div>
							<h2 className="text-headline font-semibold text-text-heading">{p.name}</h2>
							{p.publicTagline && <p className="mt-1 text-label font-medium text-cyan">{p.publicTagline}</p>}
							{p.publicDescription && <p className="mt-3 text-body text-text-secondary leading-relaxed">{p.publicDescription}</p>}
							{p.startingPrice && (
								<div className="mt-5 text-title font-semibold text-text-heading">
									from {moneyShort(p.startingPrice.amountMinor, p.startingPrice.currency)}
									<span className="text-label font-normal text-text-muted">
										{perInterval(p.startingPrice.interval)}
										{p.startingPrice.perSeat ? ' / user' : ''}
									</span>
								</div>
							)}
						</div>

						<div className="mt-6 flex flex-col gap-3">
							<Link
								to={`/signup/${p.key}`}
								className="inline-flex min-h-11 items-center justify-center rounded-md bg-brand px-5 text-body font-semibold text-white shadow-[0_8px_24px_rgba(45,107,255,0.3)] transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-action"
							>
								<span className="sr-only">{p.name} </span>
								{p.hasTrial !== false ? 'Start free trial' : 'Sign up'}
							</Link>
							<Link
								to={`/pricing/${p.key}`}
								className="inline-flex min-h-11 items-center justify-center rounded-md border border-border-subtle bg-surface-card px-5 text-body font-semibold text-text-heading transition hover:bg-surface-raised focus:outline-none focus:ring-2 focus:ring-action"
							>
								<span className="sr-only">{p.name} </span>View plans
							</Link>
							{p.learnMoreUrl && (
								<a
									href={p.learnMoreUrl}
									target="_blank"
									rel="noopener noreferrer"
									className="inline-flex items-center justify-center gap-1.5 pt-1 text-label font-medium text-action hover:underline focus:outline-none focus:ring-2 focus:ring-action rounded"
								>
									<span className="sr-only">{p.name} </span>Learn more <span aria-hidden="true">&rarr;</span>
								</a>
							)}
						</div>
					</article>
				))}
			</div>
		</div>
	);
}
