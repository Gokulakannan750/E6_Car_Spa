import { Card } from '../../components/ui';

export function JobCardsPage() {
 return (
 <div className="space-y-6">
 <div className="flex items-center justify-between">
 <div>
 <h1>Job Cards</h1>
 <p className="text-slate-500 mt-1">Manage and track all vehicle service jobs</p>
 </div>
 <a href="/job-cards/new" className="btn btn-primary">
 + New Job Card
 </a>
 </div>

 <Card>
 <div className="p-6 text-center text-slate-500">
 <p>Job card management interface coming soon...</p>
 </div>
 </Card>
 </div>
 );
}