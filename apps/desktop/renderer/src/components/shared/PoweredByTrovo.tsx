export interface PoweredByTrovoProps {
	className?: string;
}

/**
 * Reusable subtle company attribution component: "Powered by Trovo Tech Solutions".
 */
export function PoweredByTrovo({ className = '' }: PoweredByTrovoProps) {
	return (
		<p className={`text-xs text-slate-400 font-medium tracking-normal select-none ${className}`}>
			Powered by Trovo Tech Solutions
		</p>
	);
}

export default PoweredByTrovo;
