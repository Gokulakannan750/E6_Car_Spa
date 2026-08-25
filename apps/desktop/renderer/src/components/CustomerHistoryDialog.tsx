import { useQuery } from '@tanstack/react-query';
import { getJobCardsByCustomer, getVehiclesByCustomer, type VehicleDto } from '../lib/api';

const STATUS_MAP: Record<number, { bg: string; text: string; border: string }> = {
	0: { bg: '#fef3c7', text: '#92400e', border: '#fde047' },
	1: { bg: '#dbeafe', text: '#1e40af', border: '#bfdbfe' },
	2: { bg: '#fef9c3', text: '#854d0e', border: '#fef08a' },
	3: { bg: '#d1fae5', text: '#065f46', border: '#bbf7d0' },
	4: { bg: '#e0e7ff', text: '#3730a3', border: '#c7d2fe' },
	5: { bg: '#d1fae5', text: '#065f46', border: '#a7f3d0' },
	6: { bg: '#f0fdf4', text: '#166534', border: '#bbf7d0' },
};

interface CustomerHistoryDialogProps {
	customerId: string;
	customerName: string;
	open: boolean;
	onClose: () => void;
}

export function CustomerHistoryDialog({ customerId, customerName, open, onClose }: CustomerHistoryDialogProps) {
	const { data: vehiclesData } = useQuery({
		queryKey: ['vehicles', customerId],
		queryFn: () => getVehiclesByCustomer(customerId),
		enabled: open,
	});

	const { data: jobCardsData } = useQuery({
		queryKey: ['job-cards-by-customer', customerId],
		queryFn: async () => {
			const result = await getJobCardsByCustomer(customerId, { page: 1, pageSize: 100 });
			return result.items ?? [];
		},
		enabled: open,
	});

	if (!open) return null;

	const vehicles: VehicleDto[] = vehiclesData ?? [];
	const jobCards: any[] = (jobCardsData as any) ?? [];

	return (
		<div style={overlayStyle} onClick={onClose}>
			<div style={dialogStyle} onClick={(e) => e.stopPropagation()}>
				{/* Header */}
				<div style={headerStyle}>
					<h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#111827' }}>
						{customerName} — History
					</h3>
					<button onClick={onClose} style={closeButtonStyle}>
						&times;
					</button>
				</div>

				<div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
					{/* Vehicles Section */}
					{vehicles.length > 0 && (
						<div style={{ marginBottom: '20px' }}>
							<h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600, color: '#374151' }}>
								Vehicles ({vehicles.length})
							</h4>
							<table style={tableStyle}>
								<thead>
									<tr>
										{['Registration', 'Make / Model', 'Color', 'Added'].map((h) => (
											<th key={h} style={thStyle}>{h}</th>
										))}
									</tr>
								</thead>
								<tbody>
									{vehicles.map((v) => (
										<tr key={v.id} style={trStyle}>
											<td style={tdStyle}><code style={codeStyle}>{v.registrationNumber}</code></td>
											<td style={tdStyle}>{v.make} {v.model}</td>
											<td style={tdStyle}>{v.color ?? '—'}</td>
											<td style={tdStyle}>{new Date(v.createdAt).toLocaleDateString()}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}

					{/* Job Cards Section */}
					{jobCards.length > 0 && (
						<div>
							<h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600, color: '#374151' }}>
								Job Cards ({jobCards.length})
							</h4>
							<table style={tableStyle}>
								<thead>
									<tr>
										{['Job Card', 'Services', 'Amount', 'Status', 'Date'].map((h) => (
											<th key={h} style={thStyle}>{h}</th>
										))}
									</tr>
								</thead>
								<tbody>
									{jobCards.map((jc: any) => {
										const colors = STATUS_MAP[jc.status] || { bg: '#f3f4f6', text: '#374151', border: '#e5e7eb' };
										return (
											<tr key={jc.id} style={trStyle}>
												<td style={tdStyle}><strong style={codeStyle}>{jc.jobCardNumber}</strong></td>
												<td style={tdStyle}>—</td>
												<td style={tdStyle}>₹{jc.totalAmount.toLocaleString()}</td>
												<td style={tdStyle}>
													<span
														style={{
															display: 'inline-flex',
															alignItems: 'center',
															padding: '2px 8px',
															borderRadius: '9999px',
															fontSize: '12px',
															fontWeight: 500,
															backgroundColor: colors.bg,
															color: colors.text,
															border: `1px solid ${colors.border}`,
														}}
													>
														{String(jc.status).replace(/([A-Z])/g, ' $1').trim()}
													</span>
												</td>
												<td style={tdStyle}>{new Date(jc.createdAt).toLocaleDateString()}</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Inline styles
// ---------------------------------------------------------------------------

const overlayStyle: React.CSSProperties = {
	position: 'fixed',
	inset: 0,
	backgroundColor: 'rgba(0,0,0,0.4)',
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'center',
	zIndex: 1000,
};

const dialogStyle: React.CSSProperties = {
	backgroundColor: '#fff',
	borderRadius: '8px',
	boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
	width: '90%',
	maxWidth: '900px',
	maxHeight: '85vh',
	overflow: 'hidden',
	display: 'flex',
	flexDirection: 'column',
};

const headerStyle: React.CSSProperties = {
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'space-between',
	padding: '16px 20px',
	borderBottom: '1px solid #e5e7eb',
};

const closeButtonStyle: React.CSSProperties = {
	background: 'none',
	border: 'none',
	fontSize: '18px',
	cursor: 'pointer',
	color: '#6b7280',
	padding: '4px 8px',
	borderRadius: '4px',
};

const tableStyle: React.CSSProperties = {
	width: '100%',
	borderCollapse: 'collapse',
	fontSize: '13px',
};

const thStyle: React.CSSProperties = {
	textAlign: 'left',
	padding: '8px 12px',
	fontSize: '11px',
	fontWeight: 600,
	textTransform: 'uppercase',
	letterSpacing: '0.05em',
	color: '#6b7280',
	borderBottom: '1px solid #e5e7eb',
	backgroundColor: '#f9fafb',
};

const trStyle: React.CSSProperties = {
	borderBottom: '1px solid #f3f4f6',
};

const tdStyle: React.CSSProperties = {
	padding: '8px 12px',
	color: '#374151',
	whiteSpace: 'nowrap',
};

const codeStyle: React.CSSProperties = {
	fontFamily: 'ui-monospace, monospace',
	fontSize: '13px',
	color: '#6366f1',
};
