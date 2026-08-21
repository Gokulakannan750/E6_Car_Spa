import { forwardRef } from 'react';
import { cn } from '../../utils/cn';
import { Search } from 'lucide-react';

interface SearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
 onSearch?: (value: string) => void;
 onClear?: () => void;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
 ({ onSearch, onClear, className, ...props }, ref) => {
 return (
 <div className="relative">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
 <input ref={ref} className={cn('form-input pl-9 pr-8', className)} {...props} />
 {(props.value && onClear) && (
 <button type="button" onClick={onClear} className="absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface">
 &times;
 </button>
 )}
 </div>
 );
 }
);
SearchInput.displayName = 'SearchInput';
