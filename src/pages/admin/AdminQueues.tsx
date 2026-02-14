import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GitBranch, Edit } from 'lucide-react';

export default function AdminQueues() {
  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Assignment Rules</h1>
        <p className="text-muted-foreground">Configure ticket and enquiry assignment routing</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <GitBranch className="h-4 w-4" />
            Routing Rules
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Tickets and enquiries are automatically assigned based on configured rules.
            Round-robin is the default assignment method.
          </p>
          <Button variant="outline">
            <Edit className="h-4 w-4 mr-2" />
            Configure Routing
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
