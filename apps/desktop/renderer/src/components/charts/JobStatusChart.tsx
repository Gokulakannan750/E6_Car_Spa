import { ChartCard } from './ChartCard';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

export interface JobStatusDataPoint {
	name: string;
	value: number;
	color: string;
}

const RADIAN = Math.PI / 180;
const innerR = 60;
const outerR = 80;

const CustomTooltip = ({
	active,
	payload,
}: {
	active?: boolean;
	payload?: Array<{ name: string; value: number; color: string }>;
}) => {
	if (!active || !payload?.length) return null;
	return (
		<div className="rounded-lg border border-outline bg-surface-container px-3 py-2 shadow-lg">
			<p className="text-xs font-medium text-on-surface-variant mb-1">{payload[0].name}</p>
			<p className="text-sm font-semibold text-on-surface">{payload[0].value} jobs</p>
		</div>
	);
};

const renderCustomLabel = (props: {
	cx: number;
	cy: number;
	midAngle: number;
	innerRadius: number;
	outerRadius: number;
	percent: number;
	name: string;
	value: number;
}) => {
	const { cx: lcx, cy: lcy, midAngle, outerRadius } = props;
	const radius = outerRadius + 16;
	const x = lcx + radius * Math.cos(-midAngle * RADIAN);
	const y = lcy + radius * Math.sin(-midAngle * RADIAN);

	return (
		<text
			x={x}
			y={y}
			textAnchor={x > lcx ? 'start' : 'end'}
			dominantBaseline="central"
			className="text-[11px] fill-on-surface-variant"
		>
			{props.name}
		</text>
	);
};

export function JobStatusChart({ data = [] }: { data?: JobStatusDataPoint[] }) {
	const total = data.reduce((sum, d) => sum + d.value, 0);

	return (
		<ChartCard title="Job Status" subtitle="Distribution by status" className="col-span-1">
			{total === 0 ? (
				<div className="h-[240px] flex items-center justify-center text-center text-on-surface-variant">
					<div>
						<p className="text-sm font-medium">No job cards yet</p>
						<p className="text-xs text-on-surface-variant/70 mt-1">Status distribution will appear here</p>
					</div>
				</div>
			) : (
				<ResponsiveContainer width="100%" height={240}>
					<PieChart>
						<Pie
							data={data}
							cx="50%"
							cy="50%"
							innerRadius={innerR}
							outerRadius={outerR}
							dataKey="value"
							stroke="none"
							label={renderCustomLabel}
							labelLine={{ stroke: 'var(--md-outline-variant, #CAC4D0)', strokeWidth: 1 }}
						>
							{data.map((entry, index) => (
								<Cell key={index} fill={entry.color} />
							))}
						</Pie>
						<Tooltip content={<CustomTooltip />} />
					</PieChart>
				</ResponsiveContainer>
			)}
		</ChartCard>
	);
}
