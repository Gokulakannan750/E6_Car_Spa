import {
 ChartCard,
} from './ChartCard';
import {
 BarChart,
 Bar,
 XAxis,
 YAxis,
 CartesianGrid,
 Tooltip,
 ResponsiveContainer,
} from 'recharts';

const data = [
 { month: 'Sep', revenue: 85000 },
 { month: 'Oct', revenue: 92000 },
 { month: 'Nov', revenue: 78000 },
 { month: 'Dec', revenue: 105000 },
 { month: 'Jan', revenue: 98000 },
 { month: 'Feb', revenue: 112000 },
 { month: 'Mar', revenue: 125000 },
 { month: 'Apr', revenue: 108000 },
 { month: 'May', revenue: 135000 },
 { month: 'Jun', revenue: 118000 },
 { month: 'Jul', revenue: 142000 },
 { month: 'Aug', revenue: 124500 },
];

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

export function RevenueChart() {
 return (
 <ChartCard
 title="Revenue Overview"
 subtitle="Monthly revenue (last 12 months)"
 className="col-span-2"
 >
 <ResponsiveContainer width="100%" height={240}>
 <BarChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
 <CartesianGrid strokeDasharray="3 3" className="stroke-outline-variant" />
 <XAxis
 dataKey="month"
 axisLine={false}
 tickLine={false}
 tick={{ fontSize: 12, fill: 'var(--md-on-surface-variant, #79747e)' }}
 dy={8}
 />
 <YAxis
 axisLine={false}
 tickLine={false}
 tick={{ fontSize: 12, fill: 'var(--md-on-surface-variant, #79747e)' }}
 tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`}
 dx={-4}
 />
 <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--md-surface-container-low, #f3edf7)', radius: 4 }} />
 <Bar dataKey="revenue" fill="var(--md-secondary, #6750A4)" radius={[4, 4, 0, 0]} barSize={32} />
 </BarChart>
 </ResponsiveContainer>
 </ChartCard>
 );
}
