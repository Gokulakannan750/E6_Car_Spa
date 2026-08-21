import { useState } from 'react';
import { Download, Calendar, TrendingUp, TrendingDown, DollarSign, Users, Wrench, FileText } from 'lucide-react';
import { mockCustomers } from '../../mock/data/customers';
import { mockJobCards } from '../../mock/data/jobCards';
import { mockInvoices } from '../../mock/data/invoices';
import { mockServices } from '../../mock/data/services';
import { Button } from '../../components/ui/Button';

export function ReportsPage() {
 const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('30d');

 const totalRevenue = mockInvoices.reduce((s, i) => s + i.totalAmount, 0);
 const totalPaid = mockInvoices.reduce((s, i) => s + i.paidAmount, 0);
 const totalOutstanding = mockInvoices.reduce((s, i) => s + i.balance, 0);
 const activeJobs = mockJobCards.filter(jc => jc.status === 'in-progress').length;

 return (
 <div className="space-y-5 animate-fade-in">
 <div className="flex items-center justify-between">
 <div>
 <h1 className="text-2xl font-semibold tracking-tight text-headline-lg font-semibold text-on-surface tracking-tight">Reports &amp; Analytics</h1>
 <p className="text-sm text-on-surface-variant mt-1">Business insights and analytics</p>
 </div>
 <div className="flex gap-2">
 {['7d', '30d', '90d'].map(r => (
 <button key={r} onClick={() => setDateRange(r)} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${dateRange === r ? 'bg-secondary text-white' : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'}`}>
 {r === '7d' ? '7 Days' : r === '30d' ? '30 Days' : '90 Days'}
 </button>
 ))}
 <Button variant="secondary" icon={<Download className="w-4 h-4" />}>Export</Button>
 </div>
 </div>

 {/* KPI Cards */}
 <div className="grid grid-cols-4 gap-4">
 {[
 { label: 'Total Revenue', value: `₹${totalRevenue.toLocaleString()}`, change: '+12.5%', up: true, Icon: DollarSign, color: 'text-success' },
 { label: 'Total Collected', value: `₹${totalPaid.toLocaleString()}`, change: '+8.2%', up: true, Icon: TrendingUp, color: 'text-info' },
 { label: 'Outstanding', value: `₹${totalOutstanding.toLocaleString()}`, change: '-3.1%', up: false, Icon: TrendingDown, color: 'text-warning' },
 { label: 'Active Jobs', value: activeJobs.toString(), change: 'In progress', Icon: Wrench, color: 'text-secondary' },
 ].map(kpi => {
 const IconComp = kpi.Icon;
 return (
 <div key={kpi.label} className="app-card p-5">
 <div className="flex items-center justify-between">
 <p className="text-sm text-on-surface-variant font-medium">{kpi.label}</p>
 <IconComp className={`w-5 h-5 ${kpi.color}`} />
 </div>
 <p className="text-xl font-semibold text-headline-md text-on-surface font-semibold mt-2">{kpi.value}</p>
 <p className={`text-sm mt-1 ${kpi.up ? 'text-success' : 'text-error'}`}>{kpi.change}</p>
 </div>
 );
 })}
 </div>

 {/* Charts + Tables */}
 <div className="grid grid-cols-3 gap-5">
 {/* Revenue Chart Placeholder */}
 <div className="col-span-2 app-card p-5">
 <h3 className="text-lg font-semibold text-headline-sm text-on-surface mb-4">Revenue Trend</h3>
 <div className="h-[200px] bg-surface-container-low rounded-lg flex items-center justify-center border border-outline-variant/50">
 <div className="text-center">
 <TrendingUp className="w-8 h-8 text-on-surface-variant mx-auto mb-2" />
 <p className="text-sm text-on-surface-variant">Chart area — integrate Recharts</p>
 </div>
 </div>
 </div>

 {/* Job Status */}
 <div className="app-card p-5">
 <h3 className="text-lg font-semibold text-headline-sm text-on-surface mb-4">Job Status Breakdown</h3>
 <div className="h-[200px] bg-surface-container-low rounded-lg flex items-center justify-center border border-outline-variant/50">
 <div className="text-center">
 <Wrench className="w-8 h-8 text-on-surface-variant mx-auto mb-2" />
 <p className="text-sm text-on-surface-variant">Chart area — integrate Recharts</p>
 </div>
 </div>
 </div>
 </div>

 {/* Top Services Table */}
 <div className="app-card p-5">
 <h3 className="text-lg font-semibold text-headline-sm text-on-surface mb-4">Top Services</h3>
 <table className="app-table">
 <thead>
 <tr>
 <th>Service</th>
 <th>Count</th>
 <th>Revenue</th>
 </tr>
 </thead>
 <tbody>
 {(() => {
 const counts: Record<string, number> = {};
 mockJobCards.flatMap(jc => jc.services).forEach(s => { counts[s.name] = (counts[s.name] || 0) + 1; });
 return Object.entries(counts)
 .filter(([name]) => name !== '')
 .sort((a, b) => b[1] - a[1])
 .slice(0, 5)
 .map(([name, count]) => {
 const svc = mockServices.find(s => s.name === name);
 return (
 <tr key={name}>
 <td className="font-medium text-sm text-on-surface">{name}</td>
 <td className="text-sm">{count}</td>
 <td className="text-sm">₹{svc ? (count * svc.basePrice).toLocaleString() : '—'}</td>
 </tr>
 );
 });
 })()}
 </tbody>
 </table>
 </div>
 </div>
 );
}
