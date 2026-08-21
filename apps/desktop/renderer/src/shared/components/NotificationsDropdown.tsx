import { useState } from 'react';

const notifications = [
 { id: 1, message: 'New booking from John Smith', time: '2 min ago', read: false },
 { id: 2, message: 'Inventory alert: Engine Degreaser low', time: '15 min ago', read: false },
 { id: 3, message: '5-star review received', time: '1 hour ago', read: true },
];

export default function NotificationsDropdown() {
 const [isOpen, setIsOpen] = useState(false);
 const unreadCount = notifications.filter(n => !n.read).length;

 return (
 <div className="relative">
 <button
 onClick={() => setIsOpen(!isOpen)}
 className="relative p-2 hover:bg-gray-100 dark:hover:bg-slate-800
 rounded-xl text-gray-400 hover:text-gray-600 transition-colors"
 >
 <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>
 notifications
 </span>
 {unreadCount > 0 && (
 <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px]
 font-bold rounded-full flex items-center justify-center">
 {unreadCount}
 </span>
 )}
 </button>

 {isOpen && (
 <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-slate-900
 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-lg
 z-50 overflow-hidden">
 <div className="p-4 border-b border-gray-200 dark:border-slate-700">
 <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
 Notifications
 </h3>
 </div>
 <div className="divide-y divide-gray-200 dark:divide-slate-700 max-h-80 overflow-y-auto">
 {notifications.map(n => (
 <div key={n.id} className={`p-3 hover:bg-gray-50 dark:hover:bg-slate-800 cursor-pointer
 ${!n.read ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}>
 <p className="text-sm text-gray-900 dark:text-white">{n.message}</p>
 <p className="text-xs text-gray-400 mt-1">{n.time}</p>
 </div>
 ))}
 </div>
 <div className="p-3 border-t border-gray-200 dark:border-slate-700">
 <button className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700
 font-medium w-full text-center">
 View all notifications
 </button>
 </div>
 </div>
 )}
 </div>
);
}
