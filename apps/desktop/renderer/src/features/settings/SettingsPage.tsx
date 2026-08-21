import { Save } from 'lucide-react';
import { Card } from '../../components/ui';

export function SettingsPage() {
 return (
 <div className="space-y-6">
 <div className="flex items-center justify-between">
 <h1>Settings</h1>
 <button className="btn btn-primary flex items-center gap-2">
 <Save className="h-4 w-4" />
 Save Settings
 </button>
 </div>

 <div className="grid grid-cols-3 gap-6">
 <div className="col-span-2 space-y-6">
 {/* Company Info */}
 <Card>
 <h2 className="text-lg font-semibold text-slate-900 mb-4">Company Information</h2>
 <div className="space-y-4">
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Company Name</label>
 <input
 type="text"
 className="input w-full"
 defaultValue="Car Spa Management"
 />
 </div>
 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
 <input
 type="tel"
 className="input w-full"
 defaultValue="+91 98765 43210"
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
 <input
 type="email"
 className="input w-full"
 defaultValue="info@carspa.com"
 />
 </div>
 </div>
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
 <textarea
 className="input w-full"
 rows={3}
 defaultValue="123 Main Street, City, State - 400001"
 />
 </div>
 </div>
 </Card>

 {/* Invoice Settings */}
 <Card>
 <h2 className="text-lg font-semibold text-slate-900 mb-4">Invoice Settings</h2>
 <div className="space-y-4">
 <div className="grid grid-cols-3 gap-4">
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Currency</label>
 <select className="input w-full">
 <option value="INR">INR (₹)</option>
 <option value="USD">USD ($)</option>
 </select>
 </div>
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Tax Rate (%)</label>
 <input
 type="number"
 className="input w-full"
 defaultValue="18"
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Invoice Prefix</label>
 <input
 type="text"
 className="input w-full"
 defaultValue="INV"
 />
 </div>
 </div>
 </div>
 </Card>
 </div>

 <div className="space-y-6">
 {/* Quick Info */}
 <Card>
 <h2 className="text-lg font-semibold text-slate-900 mb-4">Application</h2>
 <div className="space-y-3 text-sm">
 <div className="flex justify-between">
 <span className="text-slate-500">Version</span>
 <span className="text-slate-900 font-medium">1.0.0</span>
 </div>
 <div className="flex justify-between">
 <span className="text-slate-500">Build</span>
 <span className="text-slate-900 font-medium">2025.01.01</span>
 </div>
 <div className="flex justify-between">
 <span className="text-slate-500">Electron</span>
 <span className="text-slate-900 font-medium">32.x</span>
 </div>
 <div className="flex justify-between">
 <span className="text-slate-500">Platform</span>
 <span className="text-slate-900 font-medium">Windows</span>
 </div>
 </div>
 </Card>
 </div>
 </div>
 </div>
 );
}