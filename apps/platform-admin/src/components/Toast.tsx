import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { CheckCircle2, AlertTriangle, X } from 'lucide-react';

type ToastTone = 'success' | 'error';
interface ToastItem {
	id: number;
	tone: ToastTone;
	message: string;
}

interface ToastApi {
	success: (message: string) => void;
	error: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);
let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
	const [items, setItems] = useState<ToastItem[]>([]);

	const dismiss = useCallback((id: number) => setItems((all) => all.filter((t) => t.id !== id)), []);
	const push = useCallback(
		(tone: ToastTone, message: string) => {
			const id = nextId++;
			setItems((all) => [...all, { id, tone, message }]);
			window.setTimeout(() => dismiss(id), tone === 'error' ? 8000 : 4000);
		},
		[dismiss],
	);
	const api = useMemo<ToastApi>(() => ({ success: (m) => push('success', m), error: (m) => push('error', m) }), [push]);

	return (
		<ToastContext.Provider value={api}>
			{children}
			<div aria-live="polite" className="pointer-events-none fixed right-4 bottom-4 z-[60] flex w-80 flex-col gap-2">
				{items.map((t) => (
					<div
						key={t.id}
						role={t.tone === 'error' ? 'alert' : 'status'}
						className="pointer-events-auto flex items-start gap-2 rounded-md border border-border-strong bg-surface-raised px-3 py-2.5 text-label text-text-primary shadow-xl shadow-black/50"
					>
						{t.tone === 'success' ? (
							<CheckCircle2 className="mt-px size-4 shrink-0 text-active" aria-hidden />
						) : (
							<AlertTriangle className="mt-px size-4 shrink-0 text-danger" aria-hidden />
						)}
						<span className="flex-1">{t.message}</span>
						<button type="button" aria-label="Dismiss" onClick={() => dismiss(t.id)} className="text-text-muted hover:text-text-heading">
							<X className="size-3.5" />
						</button>
					</div>
				))}
			</div>
		</ToastContext.Provider>
	);
}

export function useToast(): ToastApi {
	const ctx = useContext(ToastContext);
	if (!ctx) throw new Error('useToast must be used inside ToastProvider');
	return ctx;
}
