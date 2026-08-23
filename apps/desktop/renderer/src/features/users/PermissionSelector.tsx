import { CheckSquare, Square } from 'lucide-react';
import type { PermissionGroupDetailDto } from '../../lib/api';

interface PermissionSelectorProps {
	groups: PermissionGroupDetailDto[];
	selected: string[];
	onChange: (selected: string[]) => void;
	disabled?: boolean;
}

export function PermissionSelector({ groups, selected, onChange, disabled = false }: PermissionSelectorProps) {
	const handleTogglePermission = (code: string) => {
		if (disabled) return;
		if (selected.includes(code)) {
			onChange(selected.filter((c) => c !== code));
		} else {
			onChange([...selected, code]);
		}
	};

	const handleSelectAllModule = (modulePermissions: { code: string }[]) => {
		if (disabled) return;
		const moduleCodes = modulePermissions.map((p) => p.code);
		const newSelected = Array.from(new Set([...selected, ...moduleCodes]));
		onChange(newSelected);
	};

	const handleClearAllModule = (modulePermissions: { code: string }[]) => {
		if (disabled) return;
		const moduleCodes = new Set(modulePermissions.map((p) => p.code));
		onChange(selected.filter((c) => !moduleCodes.has(c)));
	};

	return (
		<div className="space-y-6">
			{groups.map((group) => {
				return (
					<div
						key={group.module}
						className="border border-slate-200 rounded-xl bg-slate-50/50 p-4 transition-colors"
					>
						{/* Module Header */}
						<div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200">
							<div className="flex items-center gap-2">
								<span className="font-bold text-xs uppercase tracking-wider text-slate-700">
									{group.module}
								</span>
								<span className="text-xs text-slate-400">
									({group.permissions.filter((p) => selected.includes(p.code)).length}/{group.permissions.length})
								</span>
							</div>

							{!disabled && (
								<div className="flex items-center gap-2">
									<button
										type="button"
										onClick={() => handleSelectAllModule(group.permissions)}
										className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
									>
										Select All
									</button>
									<span className="text-slate-300">|</span>
									<button
										type="button"
										onClick={() => handleClearAllModule(group.permissions)}
										className="text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors"
									>
										Clear All
									</button>
								</div>
							)}
						</div>

						{/* Permissions Grid */}
						<div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
							{group.permissions.map((perm) => {
								const isChecked = selected.includes(perm.code);
								return (
									<label
										key={perm.code}
										className={`flex items-start gap-2.5 p-2 rounded-lg cursor-pointer transition-all ${
											isChecked
												? 'bg-blue-50/80 border border-blue-200 text-blue-900'
												: 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100/70'
										} ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
									>
										<div className="mt-0.5 flex-shrink-0">
											{isChecked ? (
												<CheckSquare className="w-4 h-4 text-blue-600" />
											) : (
												<Square className="w-4 h-4 text-slate-400" />
											)}
										</div>
										<input
											type="checkbox"
											className="sr-only"
											checked={isChecked}
											disabled={disabled}
											onChange={() => handleTogglePermission(perm.code)}
										/>
										<div className="min-w-0 flex-1">
											<p className="text-xs font-semibold leading-tight">{perm.name}</p>
											{perm.description && (
												<p className="text-[11px] text-slate-500 truncate mt-0.5">
													{perm.description}
												</p>
											)}
										</div>
									</label>
								);
							})}
						</div>
					</div>
				);
			})}
		</div>
	);
}
