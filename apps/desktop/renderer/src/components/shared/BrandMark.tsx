import { Car } from 'lucide-react';
import { businessInitial } from '../../lib/documentBranding';

/** What the app calls itself until a company has saved its own name in Company Settings. */
export const DEFAULT_APP_NAME = 'Car Spa Management';

/** The company's name, or the neutral product name when none is saved yet. */
export function displayName(businessName?: string | null): string {
	const trimmed = businessName?.trim();
	return trimmed ? trimmed : DEFAULT_APP_NAME;
}

/**
 * Content for the small square badge shown where a logo would go: the first letter of the company name, or a
 * neutral car icon while no name has been saved.
 */
export function BrandMark({ name, iconClassName = 'h-4 w-4' }: { name?: string | null; iconClassName?: string }) {
	return name?.trim() ? <>{businessInitial(name)}</> : <Car className={iconClassName} aria-hidden />;
}
