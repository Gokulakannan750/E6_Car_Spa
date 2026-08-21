import { forwardRef } from 'react';
import { cn } from '../../utils/cn';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
 label?: string;
 hint?: string;
 error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
 ({ label, hint, error, className, ...props }, ref) => {
 return (
 <div className="form-field">
 {label && <label htmlFor={props.id}>{label}{props.required && <span className="text-error ml-0.5">*</span>}</label>}
 <input ref={ref} id={props.id} className={cn('form-input', error && 'border-error focus:border-error focus:ring-error/20', className)} {...props} />
 {hint && !error && <p className="hint">{hint}</p>}
 {error && <p className="error">{error}</p>}
 </div>
 );
 }
);
Input.displayName = 'Input';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
 label?: string;
 hint?: string;
 error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
 ({ label, hint, error, className, ...props }, ref) => {
 return (
 <div className="form-field">
 {label && <label htmlFor={props.id}>{label}{props.required && <span className="text-error ml-0.5">*</span>}</label>}
 <textarea ref={ref} id={props.id} className={cn('form-input min-h-[80px] resize-y', error && 'border-error focus:border-error focus:ring-error/20', className)} {...props} />
 {hint && !error && <p className="hint">{hint}</p>}
 {error && <p className="error">{error}</p>}
 </div>
 );
 }
);
Textarea.displayName = 'Textarea';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
 label?: string;
 hint?: string;
 error?: string;
 options: { value: string; label: string }[];
}

export function Select({ label, hint, error, options, className, ...props }: SelectProps) {
 return (
 <div className="form-field">
 {label && <label htmlFor={props.id}>{label}{props.required && <span className="text-error ml-0.5">*</span>}</label>}
 <select id={props.id} className={cn('form-input pr-10 appearance-none bg-[url("data:image/svg+xml,%3csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3e%3cpath stroke=\'%2375777a\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'m6 8 4 4 4-4\'/%3e%3c/svg%3e")] bg-[length:1.5em_1.5em] bg-[right_0.75rem_center] bg-no-repeat', error && 'border-error focus:border-error focus:ring-error/20', className)} {...props}>
 {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
 </select>
 {hint && !error && <p className="hint">{hint}</p>}
 {error && <p className="error">{error}</p>}
 </div>
 );
}
