export function JobCardsPage() {
 return (
 <div className="space-y-6">
 <div className="flex items-center justify-between">
 <div>
 <h1 className="font-headline-lg text-headline-lg text-on-surface">Job Cards</h1>
 <p className="text-body-md text-on-surface-variant mt-1">Manage and track all vehicle service jobs</p>
 </div>
 <a href="/job-cards/new" className="flex items-center gap-1.5 bg-secondary text-on-secondary font-label-md text-label-md uppercase px-4 py-2 rounded hover:opacity-90 transition-opacity">
 <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
 New Job Card
 </a>
 </div>

 <div className="bg-surface rounded-xl border border-outline-variant shadow-sm overflow-hidden">
 <div className="px-6 py-8 text-center text-on-surface-variant">
 <span className="material-symbols-outlined text-4xl text-outline block mb-2">assignment</span>
 <p className="font-body-md">Create a new job card to get started.</p>
 <a href="/job-cards/new" className="inline-block mt-4 btn-primary">New Job Card</a>
 </div>
 </div>
 </div>
 );
}