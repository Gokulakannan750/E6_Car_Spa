import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
	Copy,
	Check,
	ExternalLink,
	RefreshCw,
	ShieldAlert,
	QrCode as QrCodeIcon,
	X,
	CheckCircle2,
	AlertTriangle,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import {
	createPublicInvoiceLink,
	getPublicInvoiceLinkStatus,
	revokePublicInvoiceLink,
	rotatePublicInvoiceLink,
	type InvoicePublicLinkStatusResponse,
} from '../../lib/api';

interface ShareInvoiceModalProps {
	isOpen: boolean;
	onClose: () => void;
	invoiceId: string;
	invoiceNumber: string | null;
}

export function ShareInvoiceModal({
	isOpen,
	onClose,
	invoiceId,
	invoiceNumber,
}: ShareInvoiceModalProps) {
	const [loading, setLoading] = useState(false);
	const [activeUrl, setActiveUrl] = useState<string | null>(null);
	const [statusInfo, setStatusInfo] = useState<InvoicePublicLinkStatusResponse | null>(null);
	const [copied, setCopied] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [successMsg, setSuccessMsg] = useState<string | null>(null);
	const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);
	const [showRotateConfirm, setShowRotateConfirm] = useState(false);

	useEffect(() => {
		if (isOpen) {
			loadStatusAndInitialize();
		} else {
			setActiveUrl(null);
			setStatusInfo(null);
			setCopied(false);
			setError(null);
			setSuccessMsg(null);
			setShowRevokeConfirm(false);
			setShowRotateConfirm(false);
		}
	}, [isOpen, invoiceId]);

	const loadStatusAndInitialize = async () => {
		setLoading(true);
		setError(null);
		try {
			const status = await getPublicInvoiceLinkStatus(invoiceId);
			setStatusInfo(status);
			if (!status.hasActiveLink) {
				// Automatically generate the initial public link if none exists
				const generated = await createPublicInvoiceLink(invoiceId);
				setActiveUrl(generated.url);
				setStatusInfo({
					hasActiveLink: true,
					createdAtUtc: generated.createdAtUtc,
					accessCount: 0,
					lastAccessedAtUtc: null,
				});
				setSuccessMsg('Public invoice link generated successfully.');
			}
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : 'Failed to load link status';
			setError(msg);
		} finally {
			setLoading(false);
		}
	};

	const handleGenerateNew = async () => {
		setLoading(true);
		setError(null);
		setShowRotateConfirm(false);
		try {
			const rotated = await rotatePublicInvoiceLink(invoiceId);
			setActiveUrl(rotated.url);
			setStatusInfo({
				hasActiveLink: true,
				createdAtUtc: rotated.createdAtUtc,
				accessCount: 0,
				lastAccessedAtUtc: null,
			});
			setSuccessMsg('New invoice link generated. Previous link has been revoked.');
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : 'Failed to rotate link';
			setError(msg);
		} finally {
			setLoading(false);
		}
	};

	const handleRevoke = async () => {
		setLoading(true);
		setError(null);
		setShowRevokeConfirm(false);
		try {
			await revokePublicInvoiceLink(invoiceId);
			setActiveUrl(null);
			setStatusInfo({
				hasActiveLink: false,
				createdAtUtc: null,
				accessCount: 0,
				lastAccessedAtUtc: null,
			});
			setSuccessMsg('Public access revoked. The link will now return 404.');
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : 'Failed to revoke link';
			setError(msg);
		} finally {
			setLoading(false);
		}
	};

	const handleCopy = async () => {
		if (!activeUrl) return;
		try {
			await navigator.clipboard.writeText(activeUrl);
			setCopied(true);
			setTimeout(() => setCopied(false), 3000);
		} catch {
			// Fallback copy
			const textArea = document.createElement('textarea');
			textArea.value = activeUrl;
			document.body.appendChild(textArea);
			textArea.select();
			document.execCommand('copy');
			document.body.removeChild(textArea);
			setCopied(true);
			setTimeout(() => setCopied(false), 3000);
		}
	};

	const handleOpen = () => {
		if (activeUrl) {
			window.open(activeUrl, '_blank', 'noopener,noreferrer');
		}
	};

	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
			<div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl max-w-lg w-full overflow-hidden text-slate-100 flex flex-col max-h-[90vh]">
				{/* Header */}
				<div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
					<div className="flex items-center gap-2.5">
						<div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
							<QrCodeIcon className="h-5 w-5" />
						</div>
						<div>
							<h3 className="text-base font-bold text-white">Share Customer Invoice</h3>
							<p className="text-xs text-slate-400">
								{invoiceNumber || 'Finalized Invoice'} &bull; Read-only portal link
							</p>
						</div>
					</div>
					<button
						onClick={onClose}
						className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition-colors"
					>
						<X className="h-5 w-5" />
					</button>
				</div>

				{/* Body */}
				<div className="p-6 space-y-5 overflow-y-auto">
					{/* Status feedback */}
					{successMsg && (
						<div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-lg flex items-center gap-2.5 text-xs text-emerald-300">
							<CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
							<span>{successMsg}</span>
						</div>
					)}

					{error && (
						<div className="p-3 bg-red-950/40 border border-red-800/60 rounded-lg flex items-center gap-2.5 text-xs text-red-300">
							<AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
							<span>{error}</span>
						</div>
					)}

					{loading && !activeUrl && !statusInfo && (
						<div className="flex flex-col items-center justify-center py-10 space-y-3">
							<RefreshCw className="h-8 w-8 animate-spin text-emerald-400" />
							<p className="text-sm text-slate-400">Generating secure invoice link...</p>
						</div>
					)}

					{/* Active Link View */}
					{activeUrl && (
						<div className="space-y-4">
							<div>
								<label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
									Secure Customer URL
								</label>
								<div className="flex items-center gap-2">
									<input
										type="text"
										readOnly
										value={activeUrl}
										className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-emerald-400 focus:outline-hidden select-all"
									/>
									<Button
										onClick={handleCopy}
										variant="secondary"
										size="sm"
										className="shrink-0 flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-white"
									>
										{copied ? (
											<>
												<Check className="h-3.5 w-3.5 text-emerald-400" />
												<span>Copied!</span>
											</>
										) : (
											<>
												<Copy className="h-3.5 w-3.5" />
												<span>Copy</span>
											</>
										)}
									</Button>
									<Button
										onClick={handleOpen}
										variant="secondary"
										size="sm"
										className="shrink-0 flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-white"
										title="Open in new tab"
									>
										<ExternalLink className="h-3.5 w-3.5" />
										<span>Open</span>
									</Button>
								</div>
								{copied && (
									<p className="text-xs text-emerald-400 mt-1 font-medium">Invoice link copied.</p>
								)}
							</div>

							{/* QR Code Section */}
							<div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl flex flex-col sm:flex-row items-center gap-5">
								<div className="bg-white p-2.5 rounded-lg shrink-0 shadow-md">
									<QRCodeSVG
										value={activeUrl}
										size={120}
										level="M"
										includeMargin={false}
									/>
								</div>
								<div className="space-y-1.5 text-center sm:text-left">
									<h4 className="text-sm font-semibold text-white">Customer QR Code</h4>
									<p className="text-xs text-slate-400 leading-relaxed">
										Customer can scan directly with mobile phone camera to view and download their invoice immediately.
									</p>
									<div className="text-[11px] text-slate-500 pt-1">
										Access count: <span className="font-semibold text-slate-300">{statusInfo?.accessCount ?? 0}</span>
										{statusInfo?.lastAccessedAtUtc && (
											<span> &bull; Last accessed: {new Date(statusInfo.lastAccessedAtUtc).toLocaleString('en-IN')}</span>
										)}
									</div>
								</div>
							</div>
						</div>
					)}

					{/* Active Link Status Panel (when link exists in DB but raw token not yet loaded into activeUrl) */}
					{!loading && !activeUrl && statusInfo && statusInfo.hasActiveLink && (
						<div className="py-6 px-5 bg-slate-950/60 border border-slate-800 rounded-xl space-y-4">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2">
									<span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
									<span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
										Public Access Active
									</span>
								</div>
								<span className="text-xs text-slate-400 font-mono">
									Accessed: {statusInfo.accessCount} time{statusInfo.accessCount !== 1 ? 's' : ''}
								</span>
							</div>

							<div className="p-3.5 bg-slate-900/90 rounded-lg border border-slate-800 text-xs text-slate-300 space-y-1.5">
								<div className="flex justify-between">
									<span className="text-slate-400">Created:</span>
									<span className="font-medium text-slate-200">
										{statusInfo.createdAtUtc ? new Date(statusInfo.createdAtUtc).toLocaleString('en-IN') : '—'}
									</span>
								</div>
								{statusInfo.lastAccessedAtUtc && (
									<div className="flex justify-between">
										<span className="text-slate-400">Last Accessed:</span>
										<span className="font-medium text-slate-200">
											{new Date(statusInfo.lastAccessedAtUtc).toLocaleString('en-IN')}
										</span>
									</div>
								)}
							</div>

							<p className="text-xs text-slate-400 text-center">
								A public invoice link is active. For security, raw tokens are not stored at rest. Click below to copy a fresh link token or display the QR code.
							</p>

							<div className="flex items-center justify-center gap-3 pt-1">
								<Button
									onClick={handleGenerateNew}
									disabled={loading}
									className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center gap-1.5"
								>
									<RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
									<span>Generate Link Token &amp; QR</span>
								</Button>
								<Button
									variant="secondary"
									onClick={() => setShowRevokeConfirm(true)}
									disabled={loading}
									className="text-xs bg-red-950/40 hover:bg-red-900/50 text-red-300 border border-red-800/40"
								>
									<ShieldAlert className="h-3.5 w-3.5 mr-1" />
									<span>Revoke</span>
								</Button>
							</div>
						</div>
					)}

					{/* No Active Link / Revoked State */}
					{!loading && !activeUrl && statusInfo && !statusInfo.hasActiveLink && (
						<div className="py-6 px-4 bg-slate-950/40 border border-slate-800 rounded-xl text-center space-y-3">
							<div className="inline-flex p-3 rounded-full bg-slate-800 text-slate-400">
								<ShieldAlert className="h-6 w-6" />
							</div>
							<div>
								<h4 className="text-sm font-semibold text-white">No Active Public Link</h4>
								<p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
									This invoice currently has no active shareable link or the previous link was revoked.
								</p>
							</div>
							<Button
								onClick={handleGenerateNew}
								disabled={loading}
								className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs"
							>
								<RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
								Generate Secure Link
							</Button>
						</div>
					)}

					{/* Confirmation dialogs for Revoke / Rotate */}
					{showRevokeConfirm && (
						<div className="p-4 bg-red-950/30 border border-red-800/80 rounded-xl space-y-3">
							<div className="flex items-start gap-2.5">
								<AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
								<div>
									<h5 className="text-xs font-bold text-red-300 uppercase tracking-wider">
										Confirm Link Revocation
									</h5>
									<p className="text-xs text-slate-300 mt-1">
										Revoking this link will permanently disable public access. The existing URL will return 404.
									</p>
								</div>
							</div>
							<div className="flex items-center justify-end gap-2 pt-2">
								<Button
									size="sm"
									variant="secondary"
									onClick={() => setShowRevokeConfirm(false)}
									className="text-xs bg-slate-800 hover:bg-slate-700"
								>
									Cancel
								</Button>
								<Button
									size="sm"
									onClick={handleRevoke}
									disabled={loading}
									className="text-xs bg-red-600 hover:bg-red-500 text-white"
								>
									Yes, Revoke Public Access
								</Button>
							</div>
						</div>
					)}

					{showRotateConfirm && (
						<div className="p-4 bg-amber-950/30 border border-amber-800/80 rounded-xl space-y-3">
							<div className="flex items-start gap-2.5">
								<RefreshCw className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
								<div>
									<h5 className="text-xs font-bold text-amber-300 uppercase tracking-wider">
										Generate New Link (Rotate Token)
									</h5>
									<p className="text-xs text-slate-300 mt-1">
										This will revoke the previous public URL and create a brand new cryptographically secure token.
									</p>
								</div>
							</div>
							<div className="flex items-center justify-end gap-2 pt-2">
								<Button
									size="sm"
									variant="secondary"
									onClick={() => setShowRotateConfirm(false)}
									className="text-xs bg-slate-800 hover:bg-slate-700"
								>
									Cancel
								</Button>
								<Button
									size="sm"
									onClick={handleGenerateNew}
									disabled={loading}
									className="text-xs bg-amber-600 hover:bg-amber-500 text-white"
								>
									Rotate &amp; Generate New Link
								</Button>
							</div>
						</div>
					)}
				</div>

				{/* Footer Controls */}
				<div className="px-6 py-4 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between gap-3">
					<div className="flex items-center gap-2">
						{activeUrl && !showRevokeConfirm && !showRotateConfirm && (
							<>
								<Button
									onClick={() => setShowRotateConfirm(true)}
									variant="secondary"
									size="sm"
									disabled={loading}
									className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200"
								>
									<RefreshCw className="h-3.5 w-3.5 mr-1" />
									Generate New Link
								</Button>
								<Button
									onClick={() => setShowRevokeConfirm(true)}
									variant="secondary"
									size="sm"
									disabled={loading}
									className="text-xs bg-red-950/40 hover:bg-red-900/50 text-red-300 border border-red-800/40"
								>
									<ShieldAlert className="h-3.5 w-3.5 mr-1" />
									Revoke
								</Button>
							</>
						)}
					</div>
					<Button
						onClick={onClose}
						size="sm"
						variant="secondary"
						className="text-xs bg-slate-800 hover:bg-slate-700 text-white"
					>
						Close
					</Button>
				</div>
			</div>
		</div>
	);
}
