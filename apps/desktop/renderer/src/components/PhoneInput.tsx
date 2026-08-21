import { forwardRef, useCallback } from 'react';

interface PhoneInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
 value: string;
 onChange: (value: string) => void;
 label?: string;
 error?: string;
 required?: boolean;
}

const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(
 ({ value, onChange, label, error, required, className = '', ...props }, ref) => {
 const handleChange = useCallback(
 (e: React.ChangeEvent<HTMLInputElement>) => {
 const raw = e.target.value.replace(/\D/g, '');
 if (raw.length <= 10) {
 onChange(raw);
 }
 },
 [onChange],
 );

 const displayValue = value.length > 10 ? value.slice(0, 10) : value;

 return (
 <div className="flex flex-col gap-1">
 {label && (
 <label className="font-label-md text-label-md text-on-surface-variant uppercase">
 {label}
 {required && <span className="text-error ml-0.5">*</span>}
 </label>
 )}
 <input
 ref={ref}
 type="tel"
 inputMode="numeric"
 value={displayValue}
 onChange={handleChange}
 maxLength={10}
 placeholder="Enter 10-digit phone number"
 className={`
 w-full bg-surface-container-lowest border rounded-lg
 py-2.5 px-3 text-body-md
 focus:outline-none focus:ring-2 focus:ring-secondary
 transition-colors
 ${error ? 'border-error focus:border-error' : 'border-outline-variant'}
 ${className}
 `}
 {...props}
 />
 {error && <span className="font-body-sm text-body-sm text-error">{error}</span>}
 </div>
 );
},
);

PhoneInput.displayName = 'PhoneInput';

export { PhoneInput };
export default PhoneInput;
