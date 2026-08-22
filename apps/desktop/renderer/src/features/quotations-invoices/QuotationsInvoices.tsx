export function QuotationsInvoices() {
 return (
 <div className="space-y-6">
 {/* Page Header */}
 <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
 <div>
 <h1 className="font-display-lg text-display-lg md:text-headline-lg font-bold text-on-surface tracking-tight">Invoices</h1>
 <p className="font-medium text-sm text-on-surface-variant">Manage invoices</p>
 </div>
 </div>

 {/* Empty State */}
 <div className="bg-surface rounded-xl border border-outline-variant shadow-sm p-12 text-center">
 <span className="material-symbols-outlined text-outline mb-4" style={{ fontSize: '48px' }}>description</span>
 <h2 className="text-xl font-semibold text-headline-md text-on-surface mb-2">No Invoices Yet</h2>
 <p className="font-medium text-sm text-on-surface-variant max-w-md mx-auto">Invoices will appear here once job cards are completed and billed. Invoice functionality will be implemented in a future step.</p>
 </div>
 </div>
 );
}
