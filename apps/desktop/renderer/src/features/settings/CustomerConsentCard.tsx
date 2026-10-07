import { UserCheck } from 'lucide-react';

interface CustomerConsentCardProps {
	checked: boolean;
	onChange: (checked: boolean) => void;
	canManage: boolean;
}

/** Switch for requiring recorded customer consent before automatic WhatsApp messages are sent. */
export function CustomerConsentCard({ checked, onChange, canManage }: CustomerConsentCardProps) {
	return (
		<div className="p-5 rounded-2xl border border-slate-200 bg-white space-y-4 shadow-xs">
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
				<div className="flex items-center gap-2.5">
					<div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-100">
						<UserCheck className="w-4 h-4" />
					</div>
					<div>
						<h4 className="text-xs font-bold text-slate-800">Customer consent</h4>
						<p className="text-[11px] text-slate-500">
							Send WhatsApp updates only to customers who have agreed to receive them.
						</p>
					</div>
				</div>

				<label className="flex items-center gap-2 cursor-pointer self-start sm:self-auto">
					<input
						type="checkbox"
						checked={checked}
						disabled={!canManage}
						onChange={(e) => onChange(e.target.checked)}
						className="w-4 h-4 rounded text-emerald-600 border-slate-300 focus:ring-emerald-500"
					/>
					<span className="text-xs font-semibold text-slate-700">Require customer consent</span>
				</label>
			</div>

			<div className="space-y-1.5 text-[11px] text-slate-600">
				<p>
					When this is on, invoice and payment messages are sent only to customers marked
					&quot;Customer agrees to receive WhatsApp updates&quot; in their profile. Other customers are skipped, and the
					reason is shown on the invoice.
				</p>
				<p className="text-slate-500">
					Existing customers have no consent recorded yet. Leave this off until your staff have asked customers and
					ticked the box, otherwise messages to them stop. Remember to save the settings after changing it.
				</p>
			</div>
		</div>
	);
}
