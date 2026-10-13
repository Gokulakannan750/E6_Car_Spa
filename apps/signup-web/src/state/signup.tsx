import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Business, PlanChoice, SignupResult } from '@/lib/types';

// What the customer has entered so far. Kept in this browser tab only (sessionStorage), so a reload does not lose it
// and closing the tab forgets it. The order token and the codes are needed to pay and to show the result.

const STORAGE_KEY = 'trovo.signup';

export const EMPTY_BUSINESS: Business = { name: '', ownerName: '', mobile: '', email: '', city: '', state: '', gstin: '' };
export const DEFAULT_CHOICE: PlanChoice = {
	planCode: 'professional',
	interval: 'Year',
	licences: { android: 0, windows: 0, both: 1 },
	addOns: {},
};

interface SignupState {
	business: Business;
	choice: PlanChoice;
	/** A paid order waiting for payment (its price is fixed). */
	order: SignupResult | null;
	/** The finished sign-up: codes and what was bought. */
	result: SignupResult | null;
}

interface SignupContextValue extends SignupState {
	setBusiness: (b: Business) => void;
	setChoice: (c: PlanChoice) => void;
	setOrder: (o: SignupResult | null) => void;
	setResult: (r: SignupResult | null) => void;
	reset: () => void;
}

const SignupContext = createContext<SignupContextValue | null>(null);

function load(): SignupState {
	try {
		const raw = window.sessionStorage.getItem(STORAGE_KEY);
		if (raw) {
			const saved = JSON.parse(raw) as Partial<SignupState>;
			return {
				business: { ...EMPTY_BUSINESS, ...saved.business },
				choice: { ...DEFAULT_CHOICE, ...saved.choice },
				order: saved.order ?? null,
				result: saved.result ?? null,
			};
		}
	} catch {
		// Storage unavailable or damaged: start fresh.
	}
	return { business: EMPTY_BUSINESS, choice: DEFAULT_CHOICE, order: null, result: null };
}

function save(state: SignupState) {
	try {
		window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
	} catch {
		// Private mode: the in-memory state still works.
	}
}

export function SignupProvider({ children }: { children: ReactNode }) {
	const [state, setState] = useState<SignupState>(load);

	const update = useCallback((patch: Partial<SignupState>) => {
		setState((s) => {
			const next = { ...s, ...patch };
			save(next);
			return next;
		});
	}, []);

	const value = useMemo<SignupContextValue>(
		() => ({
			...state,
			setBusiness: (business) => update({ business }),
			// Changing the choice after an order was placed starts a new order (the old price no longer applies).
			setChoice: (choice) => update({ choice, order: null }),
			setOrder: (order) => update({ order }),
			setResult: (result) => update({ result, order: null }),
			reset: () => {
				const fresh = { business: EMPTY_BUSINESS, choice: DEFAULT_CHOICE, order: null, result: null };
				save(fresh);
				setState(fresh);
			},
		}),
		[state, update],
	);
	return <SignupContext.Provider value={value}>{children}</SignupContext.Provider>;
}

export function useSignup(): SignupContextValue {
	const ctx = useContext(SignupContext);
	if (!ctx) throw new Error('useSignup must be used inside SignupProvider');
	return ctx;
}
