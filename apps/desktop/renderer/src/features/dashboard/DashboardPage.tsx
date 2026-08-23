import { FileText, Clock, TrendingUp, DollarSign, Users } from 'lucide-react';
import { RevenueChart } from '../../components/charts/RevenueChart';
import { JobStatusChart } from '../../components/charts/JobStatusChart';

interface StatCardProps {
 title: string;
 value: string | number;
 change?: string;
 icon: typeof FileText;
 trend?: 'up' | 'down' | 'neutral';
}

function StatCard({ title, value, change, icon: Icon, trend = 'neutral' }: StatCardProps) {
 return (
 <div className="app-card p-5">
 <div className="flex items-start justify-between">
 <div>
 <p className="text-sm font-medium text-on-surface-variant">{title}</p>
 <p className="text-2xl font-semibold text-on-surface mt-1">{value}</p>
 {change && (
 <p
 className={
 'text-xs mt-1 ' +
 (trend === 'up' && 'text-[#2E7D32]') +
 (trend === 'down' && 'text-[#C62828]') +
 (trend === 'neutral' && 'text-on-surface-variant')
 }
 >
 {change}
 </p>
 )}
 </div>
 <div className="h-10 w-10 rounded-lg bg-secondary/10 flex items-center justify-center flex-shrink-0">
 <Icon className="h-5 w-5 text-secondary" />
 </div>
 </div>
 </div>
 );
}

export function DashboardPage() {
 return (
 <div className="space-y-5 animate-fade-in">
 {/* Stats Grid */}
 <div className="grid grid-cols-4 gap-4">
 <StatCard title="Total Customers" value="248" change="+12% from last month" icon={Users} trend="up" />
 <StatCard title="Active Jobs" value="18" change="5 pending approval" icon={Clock} trend="neutral" />
 <StatCard title="Revenue (MTD)" value="₹1,24,500" change="+8% from last month" icon={DollarSign} trend="up" />
 <StatCard title="Completed (MTD)" value="42" change="+15% from last month" icon={TrendingUp} trend="up" />
 </div>

 {/* Charts Row */}
 <div className="grid grid-cols-3 gap-4">
 <RevenueChart />
 <JobStatusChart />
 </div>

 {/* Recent Activity */}
 <div className="app-card p-5">
 <h2 className="text-[15px] font-semibold text-on-surface mb-4">Recent Activity</h2>
 <div className="space-y-3">
 {[
 { text: 'New job card created for Arjun Mehta (MH12AB1234)', time: '2 minutes ago' },
 { text: 'Invoice #INV-2026-042 paid by Rahul Patel', time: '1 hour ago' },
 { text: 'New customer registered: Sneha Kapoor', time: '3 hours ago' },
 { text: 'Job card JC-2026-089 marked as ready', time: '5 hours ago' },
 ].map((activity, index) => (
 <div key={index} className="flex items-start gap-3 py-2 border-b border-outline-variant last:border-b-0">
 <div className="h-2 w-2 rounded-full bg-secondary mt-2 flex-shrink-0" />
 <div className="flex-1 min-w-0">
 <p className="text-sm text-on-surface">{activity.text}</p>
 <p className="text-xs text-on-surface-variant mt-0.5">{activity.time}</p>
 </div>
 </div>
 ))}
 </div>
 </div>
 </div>
 );
}
