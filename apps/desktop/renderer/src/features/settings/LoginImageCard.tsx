import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, ImageIcon, Loader2, Trash2, Upload } from 'lucide-react';
import { removeLoginImage, resolveLogoUrl, uploadLoginImage } from '../../lib/api';
import { BUSINESS_PROFILE_QUERY_KEY, useBusinessProfile } from './hooks/useBusinessProfile';

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ['image/png', 'image/jpeg', 'image/webp'];

/** System Preferences card where a company uploads its own picture for the login page. */
export function LoginImageCard({ canEdit }: { canEdit: boolean }) {
	const queryClient = useQueryClient();
	const { profile } = useBusinessProfile();
	const inputRef = useRef<HTMLInputElement>(null);
	const [busy, setBusy] = useState(false);
	const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

	const imageUrl = resolveLogoUrl(profile?.loginImagePath, profile?.updatedAt);
	const hasImage = Boolean(profile?.loginImagePath?.trim());

	async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		if (inputRef.current) inputRef.current.value = '';
		if (!file) return;

		if (!TYPES.includes(file.type)) {
			setMessage({ kind: 'error', text: 'Please choose a PNG, JPEG or WebP picture.' });
			return;
		}
		if (file.size > MAX_BYTES) {
			setMessage({ kind: 'error', text: 'The picture cannot be larger than 5 MB.' });
			return;
		}

		setBusy(true);
		setMessage(null);
		try {
			const res = await uploadLoginImage(file);
			queryClient.setQueryData(BUSINESS_PROFILE_QUERY_KEY, res.profile);
			setMessage({ kind: 'ok', text: 'Login page picture updated.' });
		} catch (err) {
			setMessage({ kind: 'error', text: err instanceof Error ? err.message : 'Failed to upload the picture' });
		} finally {
			setBusy(false);
		}
	}

	async function handleRemove() {
		setBusy(true);
		setMessage(null);
		try {
			const updated = await removeLoginImage();
			queryClient.setQueryData(BUSINESS_PROFILE_QUERY_KEY, updated);
			setMessage({ kind: 'ok', text: 'Login page picture removed.' });
		} catch (err) {
			setMessage({ kind: 'error', text: err instanceof Error ? err.message : 'Failed to remove the picture' });
		} finally {
			setBusy(false);
		}
	}

	return (
		<div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
			<div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-100">
				<div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
					<ImageIcon className="w-4 h-4" />
				</div>
				<div>
					<h3 className="text-sm font-bold text-slate-800">Login page picture</h3>
					<p className="text-[11px] text-slate-500">
						Shown behind the sign-in screen. Without one, the page uses your sidebar and login colour.
					</p>
				</div>
			</div>

			<div className="flex flex-col sm:flex-row items-start gap-4">
				<div
					className="w-48 h-28 rounded-xl border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0"
					data-testid="login-image-preview"
				>
					{hasImage ? (
						<img src={imageUrl} alt="Login page" className="w-full h-full object-cover" />
					) : (
						<span className="text-[11px] font-semibold uppercase text-slate-400">No picture</span>
					)}
				</div>

				<div className="space-y-2 min-w-0">
					<p className="text-[11px] text-slate-500 leading-relaxed">
						A wide, landscape picture works best. PNG, JPEG or WebP, up to 5 MB.
					</p>
					{canEdit ? (
						<div className="flex items-center gap-2 flex-wrap">
							<input
								ref={inputRef}
								type="file"
								aria-label="Choose login page picture"
								accept="image/png,image/jpeg,image/webp"
								onChange={handleFile}
								className="hidden"
							/>
							<button
								type="button"
								disabled={busy}
								onClick={() => inputRef.current?.click()}
								className="flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-2 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
							>
								{busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
								{hasImage ? 'Change picture' : 'Upload picture'}
							</button>
							{hasImage && (
								<button
									type="button"
									disabled={busy}
									onClick={handleRemove}
									className="flex items-center gap-1.5 text-rose-600 hover:bg-rose-50 text-xs font-semibold px-3 py-2 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
								>
									<Trash2 className="w-3.5 h-3.5" />
									Remove
								</button>
							)}
						</div>
					) : (
						<p className="text-[11px] text-slate-400">Only an owner or administrator can change the login page picture.</p>
					)}
				</div>
			</div>

			{message && (
				<div
					role="status"
					className={`mt-4 flex items-start gap-2 rounded-xl border px-3 py-2 text-xs ${
						message.kind === 'ok'
							? 'bg-emerald-50 border-emerald-200 text-emerald-800'
							: 'bg-rose-50 border-rose-200 text-rose-800'
					}`}
				>
					{message.kind === 'ok' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
					<span>{message.text}</span>
				</div>
			)}
		</div>
	);
}
