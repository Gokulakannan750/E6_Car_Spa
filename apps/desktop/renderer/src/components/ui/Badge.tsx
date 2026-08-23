import { cn } from '../../utils/cn';

const colorMap: Record<string, { bg: string; text: string; dot: string }> = {
 completed: { bg: 'bg-success-container', text: 'text-success', dot: 'bg-success' },
 active: { bg: 'bg-info-container', text: 'text-info', dot: 'bg-info' },
 pending: { bg: 'bg-warning-container', text: 'text-warning', dot: 'bg-warning' },
 draft: { bg: 'bg-surface-container', text: 'text-on-surface-variant', dot: 'bg-on-surface-variant' },
 cancelled: { bg: 'bg-error-container', text: 'text-error', dot: 'bg-error' },
 inactive: { bg: 'bg-surface-container', text: 'text-on-surface-variant', dot: 'bg-on-surface-variant' },
 'in-progress': { bg: 'bg-secondary-container', text: 'text-secondary', dot: 'bg-secondary' },
 'partially-paid': { bg: 'bg-warning-container', text: 'text-warning', dot: 'bg-warning' },
 paid: { bg: 'bg-success-container', text: 'text-success', dot: 'bg-success' },
 unpaid: { bg: 'bg-error-container', text: 'text-error', dot: 'bg-error' },
 sent: { bg: 'bg-info-container', text: 'text-info', dot: 'bg-info' },
 accepted: { bg: 'bg-success-container', text: 'text-success', dot: 'bg-success' },
 rejected: { bg: 'bg-error-container', text: 'text-error', dot: 'bg-error' },
 expired: { bg: 'bg-surface-container', text: 'text-on-surface-variant', dot: 'bg-on-surface-variant' },
 ready: { bg: 'bg-success-container', text: 'text-success', dot: 'bg-success' },
 'ready-for-delivery': { bg: 'bg-info-container', text: 'text-info', dot: 'bg-info' },
 'quality-check': { bg: 'bg-warning-container', text: 'text-warning', dot: 'bg-warning' },
 invoiced: { bg: 'bg-info-container', text: 'text-info', dot: 'bg-info' },
 delivered: { bg: 'bg-success-container', text: 'text-success', dot: 'bg-success' },
 overdue: { bg: 'bg-error-container', text: 'text-error', dot: 'bg-error' },
};

const labelMap: Record<string, string> = {
 completed: 'Completed',
 active: 'Active',
 inactive: 'Inactive',
 pending: 'Pending',
 draft: 'Draft',
 cancelled: 'Cancelled',
 'in-progress': 'In Progress',
 'partially-paid': 'Partially Paid',
 paid: 'Paid',
 unpaid: 'Unpaid',
 sent: 'Sent',
 accepted: 'Accepted',
 rejected: 'Rejected',
 expired: 'Expired',
 ready: 'Ready',
 'ready-for-delivery': 'Ready for Delivery',
 'quality-check': 'Quality Check',
 invoiced: 'Invoiced',
 delivered: 'Delivered',
 overdue: 'Overdue',
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
 const normalized = status.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
 const colors = colorMap[normalized] || { bg: 'bg-surface-container', text: 'text-on-surface-variant', dot: 'bg-outline' };
 const label = labelMap[normalized] || status;

 return (
 <span className={cn('status-badge', colors.bg, colors.text, className)}>
 <span className={cn('w-1.5 h-1.5 rounded-full', colors.dot)} />
 {label}
 </span>
 );
}
