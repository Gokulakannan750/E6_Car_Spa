import { Outlet } from 'react-router-dom';
import Sidebar from '../features/dashboard/Sidebar';

export default function Shell() {
 return (
 <div className="flex h-screen overflow-hidden bg-background">
 <Sidebar />
 <div className="flex-1 flex flex-col min-w-0 ml-0">
 <GlobalHeader />
 <main className="flex-1 overflow-y-auto p-6">
 <Outlet />
 </main>
 </div>
 </div>
 );
}

function GlobalHeader() {
 return (
 <header className="h-16 bg-surface border-b border-outline-variant shadow-sm flex items-center justify-between px-6 shrink-0">
 <div className="flex items-center gap-4">
 <h2 className="text-2xl font-semibold tracking-tight text-headline-lg text-on-surface uppercase tracking-tight">
 Car Spa
 </h2>
 <div className="hidden lg:flex items-center bg-surface-container-low border border-outline-variant rounded px-3 py-2 w-64 focus-within:border-secondary focus-within:ring-1 focus-within:ring-secondary transition-all ml-4">
 <span className="material-symbols-outlined text-on-surface-variant mr-1" style={{ fontSize: '20px' }}>
 search
 </span>
 <input
 className="bg-transparent border-none outline-none text-sm text-sm w-full p-0 text-on-surface placeholder:text-on-surface-variant focus:ring-0"
 placeholder="Search job cards, customers..."
 />
 </div>
 </div>
 <div className="flex items-center gap-3">
 <button className="relative p-2 text-on-surface-variant hover:text-secondary transition-colors rounded-full hover:bg-surface-container-low">
 <span className="material-symbols-outlined">notifications</span>
 <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-error rounded-full" />
 </button>
 <button className="hidden md:flex items-center justify-center gap-1.5 bg-secondary text-white font-semibold text-xs uppercase tracking-wider text-label-md uppercase px-4 py-2 rounded hover:opacity-90 shadow-sm transition-opacity">
 <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>assignment_add</span>
 New Job Card
 </button>
 <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-outline-variant hover:border-secondary transition-colors cursor-pointer ml-1">
 <img
 alt="User"
 className="w-full h-full object-cover"
 />
 </div>
 </div>
 </header>
 );
}
