import { ChartCard } from './ChartCard';
import {
	BarChart,
	Bar,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	ResponsiveContainer,
} from 'recharts';

export interface RevenueDataPoint {
	month: string;
	revenue: number;
}

const CustomTooltip = ({
	active,
	payload,
	label,
}: {
	active?: boolean;
	payload?: Array<{ value: number; color: string }>;
	label?: string;
}) => {
	if (!active || !payload?.length) return null;
	return (
		<div className="rounded-lg border border-outline bg-surface-container px-3 py-2 shadow-lg">
			<p className="text-xs font-medium text-on-surface-variant mb-1">{label}</p>
			{payload.map((entry, i) => (
				<p key={i} className="text-sm font-semibold text-on-surface">
					{`₹${entry.value.toLocaleString('en-IN')}`}
				</p>
			))}
		</div>
	);
};

export function RevenueChart({ data = [] }: { data?: RevenueDataPoint[] }) {
	const total = data.reduce((sum, d) => sum + d.revenue, 0);

	return (
		<ChartCard
			title="Revenue Overview"
			subtitle="Monthly revenue trend"
			className="col-span-2"
		>
			{total === 0 && data.every((d) => d.revenue === 0) ? (
				<div className="h-[240px] flex items-center justify-center text-center text-on-surface-variant">
					<div>
						<p className="text-sm font-medium">No revenue recorded yet</p>
						<p className="text-xs text-on-surface-variant/70 mt-1">
							Finalized sales and payments will populate revenue charts
						</p>
					</div>
				</div>
			) : (
				<ResponsiveContainer width="100%" height={240}>
					<BarChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
						<CartesianGrid strokeDasharray="3 3" className="stroke-outline-variant" />
						<XAxis
							dataKey="month"
							tick={{ fontSize: 12 }}
							className="text-on-surface-variant"
							stroke="var(--md-outline-variant, #CAC4D0)"
						/>
						<YAxis
							tick={{ fontSize: 12 }}
							className="text-on-surface-variant"
							stroke="var(--md-outline-variant, #CAC4D0)"
							tickFormatter={(val: number) => `₹${(val / 1000).toFixed(0)}k`}
						/>
						<Tooltip content={<CustomTooltip />} />
						<Bar
							dataKey="revenue"
							fill="var(--md-secondary, #6750A4)"
							radius={[4, 4, 0, 0]}
							maxBarSize={36}
						/>
					</BarChart>
				</ResponsiveContainer>
			)}
		</ChartCard>
	);
}
