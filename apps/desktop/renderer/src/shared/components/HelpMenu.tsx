import { useState } from 'react';

export default function HelpMenu() {
 const [isOpen, setIsOpen] = useState(false);

 return (
 <div className="relative">
 <button
 onClick={() => setIsOpen(!isOpen)}
 className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl
 text-gray-400 hover:text-gray-600 transition-colors"
 >
 <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>
 help
 </span>
 </button>

 {isOpen && (
 <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-slate-900
 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-lg z-50 p-4">
 <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
 Help & Support
 </h3>
 <div className="space-y-2">
 <button className="w-full text-left px-3 py-2 text-sm text-gray-700
 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-lg
 transition-colors flex items-center gap-2">
 <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
 help_outline
 </span>
 Documentation
 </button>
 <button className="w-full text-left px-3 py-2 text-sm text-gray-700
 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-lg
 transition-colors flex items-center gap-2">
 <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
 support_agent
 </span>
 Contact Support
 </button>
 <button className="w-full text-left px-3 py-2 text-sm text-gray-700
 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-lg
 transition-colors flex items-center gap-2">
 <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
 video_call
 </span>
 Video Tutorials
 </button>
 </div>
 </div>
 )}
 </div>
);
}
