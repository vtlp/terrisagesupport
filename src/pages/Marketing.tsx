import { useUser } from '@/context/UserContext';
import { Navigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Marketing() {
  const { isAdmin } = useUser();

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Marketing</h1>
      <p className="text-muted-foreground">Strategy, execution logging, and target management. Admin only.</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Targets</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Quarterly targets for builder vs agency accounts.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Activity Log</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Referrals, contacts, champions, cold calls, events, costs.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Geo Insights</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">City/region tagging and demand analysis.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
