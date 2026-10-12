import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from './Button';

/** Copies a value (registration code, one-time password) to the clipboard and confirms briefly. */
export function CopyButton({ value, label = 'Copy' }: { value: string; label?: string }) {
	const [copied, setCopied] = useState(false);
	const [failed, setFailed] = useState(false);

	async function copy() {
		try {
			await navigator.clipboard.writeText(value);
			setCopied(true);
			setFailed(false);
			window.setTimeout(() => setCopied(false), 2000);
		} catch {
			setFailed(true);
		}
	}

	return (
		<Button size="sm" onClick={copy} icon={copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}>
			{copied ? 'Copied' : failed ? 'Select and copy' : label}
		</Button>
	);
}

/** A secret shown once: large monospace value with a copy button. */
export function OneTimeValue({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-md border border-border-subtle bg-surface-alt p-3">
			<div className="mb-1 text-micro font-medium tracking-wide text-text-muted uppercase">{label}</div>
			<div className="flex items-center justify-between gap-3">
				<code className="tabular font-mono text-title tracking-wider break-all text-text-heading select-all">{value}</code>
				<CopyButton value={value} />
			</div>
		</div>
	);
}
