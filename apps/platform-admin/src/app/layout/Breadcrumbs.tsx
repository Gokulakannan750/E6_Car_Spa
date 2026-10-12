import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export interface Crumb {
	label: string;
	to?: string;
}

const BreadcrumbContext = createContext<{ crumbs: Crumb[]; setCrumbs: (c: Crumb[]) => void } | null>(null);

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
	const [crumbs, setCrumbs] = useState<Crumb[]>([]);
	return <BreadcrumbContext.Provider value={{ crumbs, setCrumbs }}>{children}</BreadcrumbContext.Provider>;
}

export function useCrumbs(): Crumb[] {
	return useContext(BreadcrumbContext)?.crumbs ?? [];
}

/** Pages declare where they are; the top bar shows it and the browser tab title follows. */
export function useBreadcrumbs(...crumbs: Crumb[]): void {
	const ctx = useContext(BreadcrumbContext);
	const key = JSON.stringify(crumbs);
	useEffect(() => {
		const parsed = JSON.parse(key) as Crumb[];
		ctx?.setCrumbs(parsed);
		const last = parsed[parsed.length - 1];
		document.title = last ? `${last.label} · Trovo Platform` : 'Trovo Platform';
	}, [key]);
}
