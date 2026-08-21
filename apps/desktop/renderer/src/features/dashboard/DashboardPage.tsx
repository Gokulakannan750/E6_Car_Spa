import { FileText, FileCheck, Clock, TrendingUp, DollarSign, Users } from 'lucide-react';
import { cn } from '../../utils/cn';

interface StatCardProps {
 title: string;
 value: string | number;
 change?: string;
 icon: typeof FileText;
 trend?: 'up' | 'down' | 'neutral';
}

function StatCard({ title, value, change, icon: Icon, trend = 'neutral' }: StatCardProps) {
 return (
 <div className="card p-6">
 <div className="flex items-start justify-between">
 <div>
 <p className="text-sm font-medium text-slate-500">{title}</p>
 <p className="text-2xl font-semibold text-slate-900 mt-1">{value}</p>
 {change && (
 <p
 className={cn(
 'text-sm mt-1',
 trend === 'up' && 'text-green-600',
 trend === 'down' && 'text-red-600',
 trend === 'neutral' && 'text-slate-500',
 )}
 >
 {change}
 </p>
 )}
 </div>
 <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center">
 <Icon className="h-5 w-5 text-blue-600" />
 </div>
 </div>
 </div>
 );
}

export function DashboardPage() {
 return (
 <div className="space-y-6">
 {/* Stats Grid */}
 <div className="grid grid-cols-4 gap-4">
 <StatCard title="Total Customers" value="248" change="+12% from last month" icon={Users} trend="up" />
 <StatCard title="Active Jobs" value="18" change="5 pending approval" icon={Clock} trend="neutral" />
 <StatCard title="Revenue (MTD)" value="₹1,24,500" change="+8% from last month" icon={DollarSign} trend="up" />
 <StatCard title="Completed (MTD)" value="42" change="+15% from last month" icon={TrendingUp} trend="up" />
 </div>

 {/* Charts and Recent Jobs */}
 <div className="grid grid-cols-3 gap-6">
 {/* Revenue Chart */}
 <div className="card col-span-2 p-6">
 <h2 className="text-lg font-semibold text-slate-900 mb-4">Revenue Overview</h2>
 <div className="h-64 flex items-center justify-center text-slate-400">
 <p>Revenue chart placeholder — integrate Recharts</p>
 </div>
 </div>

 {/* Job Status */}
 <div className="card p-6">
 <h2 className="text-lg font-semibold text-slate-900 mb-4">Job Status</h2>
 <div className="h-64 flex items-center justify-center text-slate-400">
 <p>Job status chart placeholder — integrate Recharts</p>
 </div>
 </div>
 </div>

 {/* Recent Activity */}
 <div className="card p-6">
 <h2 className="text-lg font-semibold text-slate-900 mb-4">Recent Activity</h2>
 <div className="space-y-3">
 {[
 { text: 'New job card created for Arjun Mehta (MH12AB1234)', time: '2 minutes ago' },
 { text: 'Quotation #QT-2026-001 sent to Priya Sharma', time: '15 minutes ago' },
 { text: 'Invoice #INV-2026-042 paid by Rahul Patel', time: '1 hour ago' },
 { text: 'New customer registered: Sneha Kapoor', time: '3 hours ago' },
 { text: 'Job card JC-2026-089 marked as ready', time: '5 hours ago' },
 ].map((activity, index) => (
 <div key={index} className="flex items-start gap-3 py-2 border-b border-slate-100 last:border-b-0">
 <div className="h-2 w-2 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
 <div className="flex-1 min-w-0">
 <p className="text-sm text-slate-700">{activity.text}</p>
 <p className="text-xs text-slate-400 mt-0.5">{activity.time}</p>
 </div>
 </div>
 ))}
 </div>
 </div>
 </div>
 );
}
