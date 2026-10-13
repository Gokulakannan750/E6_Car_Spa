import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { IconButton } from './Button';

interface ModalProps {
	open: boolean;
	title: ReactNode;
	description?: ReactNode;
	onClose: () => void;
	children: ReactNode;
	footer?: ReactNode;
	width?: 'sm' | 'md' | 'lg';
	/** Shown codes and passwords must not disappear on a stray click or Escape. */
	dismissable?: boolean;
}

const widths = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl' };

export function Modal({ open, title, description, onClose, children, footer, width = 'md', dismissable = true }: ModalProps) {
	const titleId = useId();
	const panel = useRef<HTMLDivElement>(null);
	const previousFocus = useRef<HTMLElement | null>(null);

	useEffect(() => {
		if (!open) return;
		previousFocus.current = document.activeElement as HTMLElement | null;
		const first = panel.current?.querySelector<HTMLElement>('input, select, textarea, button:not([data-close])');
		(first ?? panel.current)?.focus();

		const onKey = (event: KeyboardEvent) => {
			if (event.key === 'Escape' && dismissable) {
				event.stopPropagation();
				onClose();
			}
			if (event.key === 'Tab' && panel.current) {
				const focusable = Array.from(
					panel.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])'),
				);
				if (focusable.length === 0) return;
				const firstEl = focusable[0];
				const lastEl = focusable[focusable.length - 1];
				if (event.shiftKey && document.activeElement === firstEl) {
					event.preventDefault();
					lastEl.focus();
				} else if (!event.shiftKey && document.activeElement === lastEl) {
					event.preventDefault();
					firstEl.focus();
				}
			}
		};
		document.addEventListener('keydown', onKey);
		return () => {
			document.removeEventListener('keydown', onKey);
			previousFocus.current?.focus?.();
		};
	}, [open, dismissable, onClose]);

	if (!open) return null;

	return createPortal(
		<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
			<div
				className="fixed inset-0 bg-black/75 backdrop-blur-sm"
				aria-hidden
				onClick={dismissable ? onClose : undefined}
			/>
			<div
				ref={panel}
				role="dialog"
				aria-modal="true"
				aria-labelledby={titleId}
				tabIndex={-1}
				className={`relative flex max-h-[calc(100dvh-2rem)] w-full ${widths[width]} flex-col rounded-lg border border-border-strong bg-surface-card shadow-2xl shadow-black/60 focus:outline-none`}
			>
				<header className="flex shrink-0 items-start justify-between gap-4 border-b border-border-subtle px-5 py-4">
					<div className="min-w-0">
						<h2 id={titleId} className="text-title font-semibold text-text-heading">
							{title}
						</h2>
						{description && <p className="mt-1 text-label text-text-secondary">{description}</p>}
					</div>
					{dismissable && (
						<IconButton label="Close" data-close onClick={onClose}>
							<X className="size-4" />
						</IconButton>
					)}
				</header>
				{/* Only the body scrolls, so the title and the buttons stay in view on small screens. */}
				<div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
				{footer && <footer className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-border-subtle px-5 py-3">{footer}</footer>}
			</div>
		</div>,
		document.body,
	);
}
