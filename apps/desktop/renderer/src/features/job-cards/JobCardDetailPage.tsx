import { useParams } from 'react-router-dom';
import JobCardDetails from './JobCardDetails';

export function JobCardDetailPage() {
 const { id } = useParams<{ id: string }>();
 if (!id) {
 return (
 <div className="p-8 text-center">
 <p className="font-medium text-on-error-container">Invalid job card ID</p>
 </div>
 );
 }
 return <JobCardDetails />;
}