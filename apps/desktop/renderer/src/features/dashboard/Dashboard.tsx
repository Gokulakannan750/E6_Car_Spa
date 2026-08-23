import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getJobCards, getJobCardStatusLabel, type JobCardListDto } from '../../lib/api';

function EmptyState({ icon, title, description, actionLabel, actionTo }: { icon: string; title: string; description: string; actionLabel?: string; actionTo?: string }) {
 return (
 <div className="bg-surface rounded-xl border border-outline-variant shadow-sm p-6 text-center">
 <span className="material-symbols-outlined text-4xl text-outline-variant block mb-2">{icon}</span>
 <p className="text-lg font-semibold text-headline-sm text-on-surface mb-1">{title}</p>
 <p className="text-sm text-sm text-on-surface-variant mb-3">{description}</p>
 {actionLabel && actionTo && (
 <Link to={actionTo} className="btn-primary inline-flex">
 <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>assignment_add</span>
 {actionLabel}
 </Link>
 )}
 </div>
 );
}

export default function Dashboard() {
 const navigate = useNavigate();
 const [chartRange, setChartRange] = useState('30 Days');

 const { data: recentJobCards } = useQuery({
 	queryKey: ['job-cards-recent'],
 	queryFn: async () => getJobCards({ page: 1, pageSize: 5 }),
 });

 return (
 <div className="space-y-6">
 {/* Page Title */}
 <div>
 <h1 className="text-display-lg md:text-headline-lg font-bold text-on-surface md:hidden uppercase tracking-tight">Dashboard</h1>
 <h1 className="text-display-lg md:text-headline-lg font-bold text-on-surface hidden md:block uppercase tracking-tight">Dashboard</h1>
 <p className="font-medium text-sm text-on-surface-variant">Overview of today's business activity</p>
 </div>

 {/* KPI Bento Grid */}
 <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
 {[
 { label: "Today's Sales", icon: 'currency_rupee', iconBg: 'secondary-fixed', iconColor: 'on-secondary-fixed', link: '/reports' },
 { label: "Today's Collection", icon: 'save_as', iconBg: 'tertiary-fixed', iconColor: 'on-tertiary-fixed', link: '/reports' },
 { label: 'Outstanding', icon: 'payments', iconBg: 'error-container', iconColor: 'on-error-container', link: '/reports' },
 { label: 'Jobs Today', icon: 'car_repair', iconBg: 'surface-container-high', iconColor: 'on-surface', link: '/job-cards' },
 { label: 'In Workshop', icon: 'garage', iconBg: '#fff7ed', iconColor: '#c2410c', link: '/job-cards' },
 { label: 'Ready for Delivery', icon: 'check_circle', iconBg: '#ecfdf5', iconColor: '#047857', link: '/job-cards' },
 ].map(kpi => (
 <div key={kpi.label} className="kpi-card flex flex-col justify-between cursor-pointer hover:elevated-shadow transition-shadow" onClick={() => navigate(kpi.link)}>
 <div className="flex justify-between items-start mb-3">
 <span className="font-semibold text-xs uppercase tracking-wider text-label-md text-on-surface-variant uppercase tracking-wider">{kpi.label}</span>
 <div
 className="w-8 h-8 rounded flex items-center justify-center"
 style={{ backgroundColor: kpi.iconBg }}
 >
 <span className="material-symbols-outlined" style={{ fontSize: '20px', color: kpi.iconColor }}>
 {kpi.icon}
 </span>
 </div>
 </div>
 <div>
 <div className="text-2xl font-semibold tracking-tight text-headline-lg text-on-surface mb-1">—</div>
 <div className="flex items-center gap-1 text-[13px] font-medium text-on-surface-variant">
 <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>info</span>
 <span>Awaiting data</span>
 </div>
 </div>
 </div>
 ))}
 </section>

 {/* Sales Chart */}
 <section className="data-card p-6">
 <div className="flex justify-between items-center border-b border-outline-variant pb-3 mb-4">
 <h2 className="text-lg font-semibold text-headline-sm text-on-surface">Sales Trends</h2>
 <div className="flex bg-surface-container-low rounded border border-outline-variant p-1">
 {['7 Days', '30 Days', '90 Days'].map(range => (
 <button
 key={range}
 onClick={() => setChartRange(range)}
 className={`px-3 py-1 font-semibold text-xs uppercase tracking-wider text-label-md rounded-sm transition-colors ${
 chartRange === range
 ? 'bg-surface text-on-surface shadow-sm border border-outline-variant border-opacity-50'
 : 'text-on-surface-variant hover:text-on-surface'
 }`}
 >
 {range}
 </button>
 ))}
 </div>
 </div>
 <EmptyState
 icon="show_chart"
 title="No sales data available yet"
 description="Sales analytics will appear here once job cards are created and invoiced."
 />
 </section>

 {/* Today's Job Cards */}
 <section className="data-card flex flex-col">
 <div className="flex justify-between items-center p-4 border-b border-outline-variant">
 <h2 className="text-lg font-semibold text-headline-sm text-on-surface">Recent Job Cards</h2>
 <Link to="/job-cards" className="text-secondary font-semibold text-xs uppercase tracking-wider text-label-md uppercase hover:underline">View All</Link>
 </div>
 {recentJobCards && recentJobCards.items && recentJobCards.items.length > 0 ? (
 <>
 						<div className="overflow-x-auto">
							<table className="app-table" style={{ minWidth: '800px' }}>
								<thead>
									<tr>
										<th>Job Card No.</th>
										<th>Customer</th>
										<th>Vehicle</th>
										<th>Amount</th>
										<th>Status</th>
										<th>Created</th>
									</tr>
								</thead>
								<tbody>
									{(recentJobCards.items as JobCardListDto[]).map((row) => (
										<tr
											key={row.id}
											className="cursor-pointer"
											onClick={() => navigate(`/job-cards/${row.id}`)}
										>
											<td className="font-mono font-bold text-secondary">{row.jobCardNumber}</td>
											<td className="font-medium text-on-surface">{row.customerName}</td>
											<td className="text-on-surface-variant">
												<span className="bg-surface-container px-1.5 py-0.5 rounded font-mono font-bold text-xs text-on-surface mr-1.5">
													{row.registrationNumber}
												</span>
												{row.make} {row.model}
											</td>
											<td className="font-medium text-on-surface">₹{row.totalAmount.toLocaleString('en-IN')}</td>
											<td>{getJobCardStatusLabel(row.status)}</td>
											<td className="text-on-surface-variant">
												{new Date(row.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
 </>
 ) : (
 <div className="p-8 text-center">
 <span className="material-symbols-outlined text-4xl text-outline-variant block mb-2">assignment</span>
 <p className="font-medium text-on-surface-variant">No job cards created yet.</p>
 <Link to="/job-cards/new" className="btn-primary inline-flex mt-3">
 <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>assignment_add</span>
 New Job Card
 </Link>
 </div>
 )}
 </section>

 {/* Quick Actions */}
 <section className="data-card p-6">
 <h2 className="text-lg font-semibold text-headline-sm text-on-surface mb-4">Quick Actions</h2>
 <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
 {[
 { icon: 'person_add', label: 'New Customer', to: '/customers' },
 { icon: 'assignment_add', label: 'New Job Card', to: '/job-cards/new' },
 { icon: 'inventory_2', label: 'Catalogue', to: '/catalogue' },
 { icon: 'analytics', label: 'Reports', to: '/reports' },
 ].map(action => (
 <Link key={action.to} to={action.to} className="flex flex-col items-center gap-2 p-4 bg-surface-container-low rounded-lg border border-outline-variant hover:border-secondary hover:text-secondary transition-colors">
 <span className="material-symbols-outlined text-3xl text-on-surface-variant">{action.icon}</span>
 <span className="text-sm text-sm font-medium text-on-surface">{action.label}</span>
 </Link>
 ))}
 </div>
 </section>
 </div>
 );
}
