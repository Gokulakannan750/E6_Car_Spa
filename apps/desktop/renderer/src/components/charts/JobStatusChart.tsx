import { ChartCard } from './ChartCard';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const data = [
 { name: 'Completed', value: 42, color: 'var(--md-tertiary, #625B71)' },
 { name: 'In Progress', value: 18, color: 'var(--md-secondary, #6750A4)' },
 { name: 'Draft', value: 7, color: 'var(--md-primary-container, #EADDFF)' },
 { name: 'Ready', value: 12, color: 'var(--md-tertiary-container, #F4DEDE)' },
];

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

export function JobStatusChart() {
 return (
 <ChartCard title="Job Status" subtitle="Distribution by status" className="col-span-1">
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
 </ChartCard>
 );
}
