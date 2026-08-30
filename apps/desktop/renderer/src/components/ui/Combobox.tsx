import { useState, useRef, useEffect, useMemo, useId } from 'react';
import { ChevronDown, Check, Plus, X } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface ComboboxProps {
	id?: string;
	label?: string;
	labelClassName?: string;
	required?: boolean;
	value: string;
	onChange: (value: string) => void;
	options: string[];
	placeholder?: string;
	hint?: string;
	error?: string;
	allowCustom?: boolean;
	className?: string;
}

export function Combobox({
	id: externalId,
	label,
	labelClassName,
	required,
	value,
	onChange,
	options,
	placeholder = 'Select or type a category...',
	hint,
	error,
	allowCustom = true,
	className,
}: ComboboxProps) {
	const generatedId = useId();
	const id = externalId || generatedId;
	const [isOpen, setIsOpen] = useState(false);
	const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
	const containerRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	// Filter options based on user input
	const filteredOptions = useMemo(() => {
		const query = (value || '').trim().toLowerCase();
		if (!query) return options;
		return options.filter((opt) => opt.toLowerCase().includes(query));
	}, [options, value]);

	const hasExactMatch = useMemo(() => {
		const query = (value || '').trim().toLowerCase();
		if (!query) return false;
		return options.some((opt) => opt.toLowerCase() === query);
	}, [options, value]);

	const showCreateOption = allowCustom && !!value.trim() && !hasExactMatch;

	// Total interactive items in dropdown list
	const totalItems = filteredOptions.length + (showCreateOption ? 1 : 0);

	// Close on click outside
	useEffect(() => {
		function handleClickOutside(event: MouseEvent) {
			if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
				setIsOpen(false);
				setHighlightedIndex(-1);
			}
		}
		document.addEventListener('mousedown', handleClickOutside);
		return () => document.removeEventListener('mousedown', handleClickOutside);
	}, []);

	const handleSelect = (optionValue: string) => {
		onChange(optionValue);
		setIsOpen(false);
		setHighlightedIndex(-1);
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			if (!isOpen) {
				setIsOpen(true);
				setHighlightedIndex(0);
			} else {
				setHighlightedIndex((prev) => (prev + 1) % (totalItems || 1));
			}
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			if (!isOpen) {
				setIsOpen(true);
				setHighlightedIndex(Math.max(0, totalItems - 1));
			} else {
				setHighlightedIndex((prev) => (prev <= 0 ? totalItems - 1 : prev - 1));
			}
		} else if (e.key === 'Enter') {
			if (isOpen) {
				e.preventDefault();
				if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
					handleSelect(filteredOptions[highlightedIndex]);
				} else if (highlightedIndex === filteredOptions.length && showCreateOption) {
					handleSelect(value.trim());
				} else if (filteredOptions.length === 1) {
					handleSelect(filteredOptions[0]);
				} else if (allowCustom && value.trim()) {
					handleSelect(value.trim());
				} else {
					setIsOpen(false);
				}
			}
		} else if (e.key === 'Escape') {
			if (isOpen) {
				e.preventDefault();
				setIsOpen(false);
				setHighlightedIndex(-1);
			}
		}
	};

	return (
		<div className="form-field relative" ref={containerRef}>
			{label && (
				<label htmlFor={id} className={cn('block text-xs font-semibold text-on-surface mb-1', labelClassName)}>
					{label}
					{required && <span className="text-error ml-0.5">*</span>}
				</label>
			)}

			<div className="relative">
				<input
					ref={inputRef}
					id={id}
					type="text"
					required={required}
					value={value}
					onChange={(e) => {
						onChange(e.target.value);
						if (!isOpen) setIsOpen(true);
						setHighlightedIndex(-1);
					}}
					onFocus={() => setIsOpen(true)}
					onKeyDown={handleKeyDown}
					placeholder={placeholder}
					autoComplete="off"
					className={cn(
						'form-input w-full pr-14 text-sm py-1.5',
						error && 'border-error focus:border-error focus:ring-error/20',
						className
					)}
				/>

				<div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5 text-on-surface-variant">
					{value && (
						<button
							type="button"
							tabIndex={-1}
							onClick={(e) => {
								e.preventDefault();
								e.stopPropagation();
								onChange('');
								inputRef.current?.focus();
								setIsOpen(true);
							}}
							className="p-1 hover:text-on-surface hover:bg-surface-container rounded transition-colors"
							title="Clear"
						>
							<X className="w-3.5 h-3.5" />
						</button>
					)}
					<button
						type="button"
						tabIndex={-1}
						onClick={(e) => {
							e.preventDefault();
							e.stopPropagation();
							setIsOpen((prev) => !prev);
							inputRef.current?.focus();
						}}
						className="p-1 hover:text-on-surface hover:bg-surface-container rounded transition-colors"
						title={isOpen ? 'Close' : 'Open'}
					>
						<ChevronDown
							className={cn(
								'w-4 h-4 transition-transform duration-200 text-outline',
								isOpen && 'rotate-180 text-secondary'
							)}
						/>
					</button>
				</div>
			</div>

			{hint && !error && <p className="hint mt-1 text-xs text-on-surface-variant">{hint}</p>}
			{error && <p className="error mt-1 text-xs text-error">{error}</p>}

			{/* Dropdown Menu */}
			{isOpen && (
				<div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white border border-outline-variant rounded-lg shadow-elevation-2 p-1.5 max-h-60 overflow-y-auto animate-scale-in">
					{filteredOptions.length === 0 && !showCreateOption && (
						<div className="px-3 py-3 text-center text-xs text-on-surface-variant">
							No matching categories found
						</div>
					)}

					{filteredOptions.map((opt, index) => {
						const isSelected = opt.toLowerCase() === (value || '').trim().toLowerCase();
						const isHighlighted = highlightedIndex === index;

						return (
							<button
								key={opt}
								type="button"
								onClick={() => handleSelect(opt)}
								onMouseEnter={() => setHighlightedIndex(index)}
								className={cn(
									'w-full text-left px-3 py-2 text-sm rounded-md flex items-center justify-between transition-colors my-0.5',
									isSelected
										? 'bg-secondary/10 text-secondary font-semibold'
										: isHighlighted
										? 'bg-surface-container-low text-on-surface font-medium'
										: 'text-on-surface hover:bg-surface-container-low'
								)}
							>
								<span className="truncate">{opt}</span>
								{isSelected && <Check className="w-4 h-4 text-secondary shrink-0 ml-2" />}
							</button>
						);
					})}

					{/* Create new custom category option */}
					{showCreateOption && (
						<button
							type="button"
							onClick={() => handleSelect(value.trim())}
							onMouseEnter={() => setHighlightedIndex(filteredOptions.length)}
							className={cn(
								'w-full text-left px-3 py-2 text-sm rounded-md flex items-center gap-2 transition-colors mt-1 border-t border-outline-variant/50 pt-2',
								highlightedIndex === filteredOptions.length
									? 'bg-secondary/15 text-secondary font-semibold'
									: 'text-secondary hover:bg-secondary/10 font-medium'
							)}
						>
							<Plus className="w-4 h-4 shrink-0 text-secondary" />
							<span className="truncate">
								Use &ldquo;<span className="underline underline-offset-2">{value.trim()}</span>&rdquo; as category
							</span>
						</button>
					)}
				</div>
			)}
		</div>
	);
}
