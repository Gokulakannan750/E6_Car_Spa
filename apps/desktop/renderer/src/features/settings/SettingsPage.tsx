export default function SettingsPage() {
 return (
 <div className="space-y-6">
 <div className="flex items-center justify-between">
 <h1 className="font-headline-lg text-headline-lg text-on-surface">Settings</h1>
 <button className="flex items-center gap-1.5 bg-secondary text-on-secondary font-label-md text-label-md uppercase px-4 py-2 rounded hover:opacity-90 transition-opacity">
 <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>save</span>
 Save Settings
 </button>
 </div>

 <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
 <div className="lg:col-span-2 space-y-6">
 {/* Company Info */}
 <div className="bg-surface rounded-xl border border-outline-variant shadow-sm p-6">
 <h2 className="font-headline-sm text-headline-sm text-on-surface mb-4">Company Information</h2>
 <div className="space-y-4">
 <div>
 <label className="block font-label-md text-label-md text-on-surface-variant uppercase mb-1">Company Name</label>
 <input type="text" defaultValue="Car Spa Management" className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2.5 text-body-sm focus:border-secondary focus:ring-1 focus:ring-secondary" />
 </div>
 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="block font-label-md text-label-md text-on-surface-variant uppercase mb-1">Phone</label>
 <input type="tel" defaultValue="+91 98765 43210" className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2.5 text-body-sm focus:border-secondary focus:ring-1 focus:ring-secondary" />
 </div>
 <div>
 <label className="block font-label-md text-label-md text-on-surface-variant uppercase mb-1">Email</label>
 <input type="email" defaultValue="info@carspa.com" className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2.5 text-body-sm focus:border-secondary focus:ring-1 focus:ring-secondary" />
 </div>
 </div>
 <div>
 <label className="block font-label-md text-label-md text-on-surface-variant uppercase mb-1">Address</label>
 <textarea rows={3} defaultValue="123 Main Street, City, State - 400001" className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2.5 text-body-sm focus:border-secondary focus:ring-1 focus:ring-secondary resize-none" />
 </div>
 </div>
 </div>

 {/* Invoice Settings */}
 <div className="bg-surface rounded-xl border border-outline-variant shadow-sm p-6">
 <h2 className="font-headline-sm text-headline-sm text-on-surface mb-4">Invoice Settings</h2>
 <div className="space-y-4">
 <div className="grid grid-cols-3 gap-4">
 <div>
 <label className="block font-label-md text-label-md text-on-surface-variant uppercase mb-1">Currency</label>
 <select className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2.5 text-body-sm focus:border-secondary focus:ring-1 focus:ring-secondary">
 <option value="INR">INR (₹)</option>
 <option value="USD">USD ($)</option>
 </select>
 </div>
 <div>
 <label className="block font-label-md text-label-md text-on-surface-variant uppercase mb-1">Tax Rate (%)</label>
 <input type="number" defaultValue="18" className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2.5 text-body-sm focus:border-secondary focus:ring-1 focus:ring-secondary" />
 </div>
 <div>
 <label className="block font-label-md text-label-md text-on-surface-variant uppercase mb-1">Invoice Prefix</label>
 <input type="text" defaultValue="INV" className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2.5 text-body-sm focus:border-secondary focus:ring-1 focus:ring-secondary" />
 </div>
 </div>
 </div>
 </div>
 </div>

 <div className="space-y-6">
 {/* Quick Info */}
 <div className="bg-surface rounded-xl border border-outline-variant shadow-sm p-6">
 <h2 className="font-headline-sm text-headline-sm text-on-surface mb-4">Application</h2>
 <div className="space-y-3 text-sm">
 <div className="flex justify-between">
 <span className="text-on-surface-variant">Version</span>
 <span className="text-on-surface font-medium">1.0.0</span>
 </div>
 <div className="flex justify-between">
 <span className="text-on-surface-variant">Build</span>
 <span className="text-on-surface font-medium">2025.01.01</span>
 </div>
 <div className="flex justify-between">
 <span className="text-on-surface-variant">Electron</span>
 <span className="text-on-surface font-medium">32.x</span>
 </div>
 <div className="flex justify-between">
 <span className="text-on-surface-variant">Platform</span>
 <span className="text-on-surface font-medium">Windows</span>
 </div>
 </div>
 </div>
 </div>
 </div>
 </div>
 );
}
