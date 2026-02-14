import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function AdminLookups() {
  return (
    <div className="p-4 md:p-6 space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Lookup Management</h1>
      <p className="text-muted-foreground">Manage configurable lists used across the system.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-lg">Enquiry Sources</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-muted-foreground">Manage the source options for enquiries.</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-lg">Ticket Tags</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-muted-foreground">Manage tags available on support tickets.</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-lg">Market Field Values</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-muted-foreground">Manage market dropdown options for tickets.</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-lg">Portals List</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-muted-foreground">Manage the list of real estate portals.</p></CardContent>
        </Card>
      </div>
    </div>
  );
}
