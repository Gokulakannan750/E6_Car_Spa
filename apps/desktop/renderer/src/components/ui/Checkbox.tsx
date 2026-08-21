import { forwardRef, useState, useEffect, useRef } from 'react';
import { cn } from '../../utils/cn';

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
 label?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
 ({ label, className, ...props }, ref) => {
 return (
 <label className={cn('inline-flex items-center gap-2 cursor-pointer select-none', className)}>
 <input ref={ref} type="checkbox" className="w-4 h-4 rounded border-outline-variant text-secondary focus:ring-secondary/20 cursor-pointer" {...props} />
 {label && <span className="text-sm text-on-surface">{label}</span>}
 </label>
 );
 }
);
Checkbox.displayName = 'Checkbox';

interface SwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
 label?: string;
}

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(
 ({ label, className, ...props }, ref) => {
 return (
 <label className={cn('inline-flex items-center gap-2 cursor-pointer select-none', className)}>
 <div className="relative">
 <input ref={ref} type="checkbox" className="sr-only peer" {...props} />
 <div className="w-9 h-5 bg-outline-variant rounded-full peer-checked:bg-secondary transition-colors" />
 <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow-sm peer-checked:translate-x-4 transition-transform" />
 </div>
 {label && <span className="text-sm text-on-surface">{label}</span>}
 </label>
 );
 }
);
Switch.displayName = 'Switch';
