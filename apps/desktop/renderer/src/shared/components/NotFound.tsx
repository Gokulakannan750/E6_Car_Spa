import { Link } from 'react-router-dom';

export default function NotFound() {
 return (
 <div className="min-h-[60vh] flex flex-col items-center justify-center text-center">
 <span className="material-symbols-outlined text-gray-300" style={{ fontSize: '80px' }}>
 construction
 </span>
 <h1 className="text-3xl font-bold text-gray-900 dark:text-white mt-4">
 404 - Page Not Found
 </h1>
 <p className="text-gray-500 dark:text-gray-400 mt-2">
 The page you're looking for doesn't exist.
 </p>
 <Link
 to="/dashboard"
 className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700
 text-white font-medium rounded-xl transition-colors"
 >
 <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
 arrow_back
 </span>
 Back to Dashboard
 </Link>
 </div>
);
}
