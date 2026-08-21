import { useState } from 'react';

export default function QuotationsInvoices() {
 const [tab, setTab] = useState<'quotes' | 'invoices'>('quotes');

 return (
 <div className="space-y-6">
 {/* Page Header */}
 <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
 <div>
 <h1 className="font-display-lg text-display-lg md:text-headline-lg font-bold text-on-surface tracking-tight">Quotations &amp; Invoices</h1>
 <p className="font-medium text-sm text-on-surface-variant">Manage quotations and invoices</p>
 </div>
 <div className="flex gap-2">
 <button onClick={() => setTab('quotes')} className={`px-4 py-2 rounded-lg font-semibold text-xs uppercase tracking-wider text-label-md transition-colors ${tab === 'quotes' ? 'bg-secondary text-white' : 'border border-outline-variant text-on-surface hover:bg-surface-variant'}`}>Quotations</button>
 <button onClick={() => setTab('invoices')} className={`px-4 py-2 rounded-lg font-semibold text-xs uppercase tracking-wider text-label-md transition-colors ${tab === 'invoices' ? 'bg-secondary text-white' : 'border border-outline-variant text-on-surface hover:bg-surface-variant'}`}>Invoices</button>
 </div>
 </div>

 {/* Empty State */}
 <div className="bg-surface rounded-xl border border-outline-variant shadow-sm p-12 text-center">
 <span className="material-symbols-outlined text-outline mb-4" style={{ fontSize: '48px' }}>description</span>
 <h2 className="text-xl font-semibold text-headline-md text-on-surface mb-2">{tab === 'quotes' ? 'No Quotations Yet' : 'No Invoices Yet'}</h2>
 <p className="font-medium text-sm text-on-surface-variant max-w-md mx-auto">{tab === 'quotes' ? 'Quotations will appear here once created from job cards. They are generated during the quoting workflow.' : 'Invoices will appear here once job cards are completed and billed.'}</p>
 </div>
 </div>
 );
}
