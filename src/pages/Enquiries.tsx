import { useState } from 'react';
import { Search, Plus, Phone, Globe, Users, Filter, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { mockEnquiries, enquiryMetrics, supportUsers } from '@/data/enquiryData';
import { ENQUIRY_SOURCE_LABELS, SEGMENT_LABELS, PIPELINE_STAGE_LABELS } from '@/types/enquiry';
import type { Enquiry, PipelineStage, EnquirySegment, EnquirySource } from '@/types/enquiry';
import { format } from 'date-fns';

const stageColors: Record<PipelineStage, string> = {
  enquiry_received: 'bg-slate-100 text-slate-700',
  qualified: 'bg-blue-100 text-blue-700',
  demo_scheduled: 'bg-indigo-100 text-indigo-700',
  demo_completed: 'bg-purple-100 text-purple-700',
  account_created: 'bg-primary/20 text-primary',
  verification_started: 'bg-amber-100 text-amber-700',
  import_in_progress: 'bg-orange-100 text-orange-700',
  activation_48h: 'bg-cyan-100 text-cyan-700',
  review_7day_scheduled: 'bg-teal-100 text-teal-700',
  review_7day_success: 'bg-emerald-100 text-emerald-700',
  ongoing_maintenance: 'bg-green-100 text-green-700',
};

export default function Enquiries() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [segmentFilter, setSegmentFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [selectedEnquiry, setSelectedEnquiry] = useState<Enquiry | null>(null);

  const filteredEnquiries = mockEnquiries.filter(enquiry => {
    const matchesSearch = enquiry.name.toLowerCase().includes(search.toLowerCase()) ||
      enquiry.phone.includes(search) ||
      enquiry.city.toLowerCase().includes(search.toLowerCase());
    const matchesStage = stageFilter === 'all' || enquiry.stage === stageFilter;
    const matchesSegment = segmentFilter === 'all' || enquiry.segment === segmentFilter;
    const matchesSource = sourceFilter === 'all' || enquiry.source === sourceFilter;
    return matchesSearch && matchesStage && matchesSegment && matchesSource;
  });

  const handleAssign = (enquiry: Enquiry) => {
    toast.success('Owner assigned', {
      description: `${enquiry.name} assigned to support agent`,
    });
  };

  const handleScheduleDemo = (enquiry: Enquiry) => {
    toast.success('Demo scheduled', {
      description: `Calendar invite sent to ${enquiry.name}`,
    });
  };

  const handleConvert = (enquiry: Enquiry) => {
    toast.success('Account created', {
      description: `Account created from enquiry ${enquiry.id}`,
    });
    navigate('/accounts');
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Enquiries</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Capture and convert leads into accounts
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90">
                <Plus className="h-4 w-4 mr-2" />
                New Enquiry
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>New Enquiry</DialogTitle>
              </DialogHeader>
              <EnquiryForm onSuccess={() => toast.success('Enquiry saved')} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-foreground">{enquiryMetrics.totalEnquiries}</div>
            <div className="text-xs text-muted-foreground">Total Enquiries</div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-foreground">{enquiryMetrics.newToday}</div>
            <div className="text-xs text-muted-foreground">New Today</div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">{enquiryMetrics.qualified}</div>
            <div className="text-xs text-muted-foreground">Qualified</div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-indigo-600">{enquiryMetrics.demoScheduled}</div>
            <div className="text-xs text-muted-foreground">Demo Scheduled</div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-primary">{enquiryMetrics.converted}</div>
            <div className="text-xs text-muted-foreground">Converted</div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-amber-600">{enquiryMetrics.pendingFollowUp}</div>
            <div className="text-xs text-muted-foreground">Pending Follow-up</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, phone, city..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Stage" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stages</SelectItem>
            {Object.entries(PIPELINE_STAGE_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={segmentFilter} onValueChange={setSegmentFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Segment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Segments</SelectItem>
            {Object.entries(SEGMENT_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            {Object.entries(ENQUIRY_SOURCE_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block">
        <Card className="border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Segment</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Next Action</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEnquiries.map((enquiry) => (
                <TableRow 
                  key={enquiry.id} 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setSelectedEnquiry(enquiry)}
                >
                  <TableCell className="font-mono text-sm">{enquiry.id}</TableCell>
                  <TableCell className="font-medium">{enquiry.name}</TableCell>
                  <TableCell>{enquiry.phone}</TableCell>
                  <TableCell>{enquiry.city}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-normal">
                      {SEGMENT_LABELS[enquiry.segment]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {ENQUIRY_SOURCE_LABELS[enquiry.source]}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge className={stageColors[enquiry.stage]}>
                      {PIPELINE_STAGE_LABELS[enquiry.stage]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {enquiry.nextAction && (
                      <div className="text-sm">
                        <div>{enquiry.nextAction}</div>
                        {enquiry.nextActionDate && (
                          <div className="text-xs text-muted-foreground">
                            {format(enquiry.nextActionDate, 'dd MMM, HH:mm')}
                          </div>
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => handleAssign(enquiry)}
                      >
                        Assign
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => handleScheduleDemo(enquiry)}
                      >
                        Demo
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleConvert(enquiry)}
                      >
                        Convert
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {filteredEnquiries.map((enquiry) => (
          <Card 
            key={enquiry.id} 
            className="border-border cursor-pointer"
            onClick={() => setSelectedEnquiry(enquiry)}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="font-medium">{enquiry.name}</div>
                  <div className="text-sm text-muted-foreground">{enquiry.phone}</div>
                </div>
                <Badge className={stageColors[enquiry.stage]}>
                  {PIPELINE_STAGE_LABELS[enquiry.stage]}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                <span>{enquiry.city}</span>
                <span>•</span>
                <span>{SEGMENT_LABELS[enquiry.segment]}</span>
                <span>•</span>
                <span>{ENQUIRY_SOURCE_LABELS[enquiry.source]}</span>
              </div>
              {enquiry.nextAction && (
                <div className="text-sm bg-muted/50 rounded-md p-2 mb-3">
                  <span className="font-medium">Next: </span>
                  {enquiry.nextAction}
                  {enquiry.nextActionDate && (
                    <span className="text-muted-foreground ml-1">
                      ({format(enquiry.nextActionDate, 'dd MMM')})
                    </span>
                  )}
                </div>
              )}
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1" onClick={(e) => { e.stopPropagation(); handleAssign(enquiry); }}>
                  Assign
                </Button>
                <Button size="sm" variant="outline" className="flex-1" onClick={(e) => { e.stopPropagation(); handleScheduleDemo(enquiry); }}>
                  Demo
                </Button>
                <Button size="sm" className="flex-1 bg-primary" onClick={(e) => { e.stopPropagation(); handleConvert(enquiry); }}>
                  Convert
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Enquiry Detail Dialog */}
      <Dialog open={!!selectedEnquiry} onOpenChange={() => setSelectedEnquiry(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedEnquiry && (
            <EnquiryDetail 
              enquiry={selectedEnquiry} 
              onAssign={() => { handleAssign(selectedEnquiry); setSelectedEnquiry(null); }}
              onScheduleDemo={() => { handleScheduleDemo(selectedEnquiry); setSelectedEnquiry(null); }}
              onConvert={() => { handleConvert(selectedEnquiry); setSelectedEnquiry(null); }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EnquiryDetail({ 
  enquiry, 
  onAssign, 
  onScheduleDemo, 
  onConvert 
}: { 
  enquiry: Enquiry; 
  onAssign: () => void;
  onScheduleDemo: () => void;
  onConvert: () => void;
}) {
  return (
    <div className="space-y-6">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-3">
          <span>{enquiry.name}</span>
          <Badge className={stageColors[enquiry.stage]}>
            {PIPELINE_STAGE_LABELS[enquiry.stage]}
          </Badge>
        </DialogTitle>
      </DialogHeader>

      {/* Contact Info */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-sm text-muted-foreground">Phone</div>
          <div className="font-medium">{enquiry.phone}</div>
        </div>
        <div>
          <div className="text-sm text-muted-foreground">City</div>
          <div className="font-medium">{enquiry.city}</div>
        </div>
        <div>
          <div className="text-sm text-muted-foreground">Segment</div>
          <div className="font-medium">{SEGMENT_LABELS[enquiry.segment]}</div>
        </div>
        <div>
          <div className="text-sm text-muted-foreground">Source</div>
          <div className="font-medium">{ENQUIRY_SOURCE_LABELS[enquiry.source]}</div>
        </div>
        {enquiry.assignedAgentName && (
          <div>
            <div className="text-sm text-muted-foreground">Assigned To</div>
            <div className="font-medium">{enquiry.assignedAgentName}</div>
          </div>
        )}
        {enquiry.preferredLanguage && (
          <div>
            <div className="text-sm text-muted-foreground">Language</div>
            <div className="font-medium capitalize">{enquiry.preferredLanguage}</div>
          </div>
        )}
      </div>

      {/* Qualification Checklist */}
      <div>
        <h3 className="font-medium mb-3">Qualification Checklist</h3>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className={`w-4 h-4 rounded-full ${enquiry.segmentConfirmed ? 'bg-primary' : 'bg-muted'}`} />
            <span className={enquiry.segmentConfirmed ? 'text-foreground' : 'text-muted-foreground'}>
              Segment confirmed
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-4 h-4 rounded-full ${enquiry.cityConfirmed ? 'bg-primary' : 'bg-muted'}`} />
            <span className={enquiry.cityConfirmed ? 'text-foreground' : 'text-muted-foreground'}>
              City confirmed
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-4 h-4 rounded-full ${enquiry.dataMigrationSourceConfirmed ? 'bg-primary' : 'bg-muted'}`} />
            <span className={enquiry.dataMigrationSourceConfirmed ? 'text-foreground' : 'text-muted-foreground'}>
              Data migration source confirmed
              {enquiry.dataMigrationSource && (
                <span className="text-muted-foreground ml-1">({enquiry.dataMigrationSource})</span>
              )}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-4 h-4 rounded-full ${enquiry.demoRequired ? 'bg-primary' : 'bg-muted'}`} />
            <span className="text-foreground">
              Demo required: {enquiry.demoRequired ? 'Yes' : 'No'}
            </span>
          </div>
        </div>
      </div>

      {/* Segment-specific info */}
      {(enquiry.segment === 'agency' || enquiry.segment === 'solo_agent') && (
        <div>
          <h3 className="font-medium mb-3">Agency/Broker Details</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            {enquiry.teamSize && (
              <div>
                <div className="text-muted-foreground">Team Size</div>
                <div>{enquiry.teamSize} members</div>
              </div>
            )}
            {enquiry.rentalsOnly !== undefined && (
              <div>
                <div className="text-muted-foreground">Rentals Focus</div>
                <div>{enquiry.rentalsOnly ? 'Yes' : 'No'}</div>
              </div>
            )}
            {enquiry.currentSystem && (
              <div>
                <div className="text-muted-foreground">Current System</div>
                <div className="capitalize">{enquiry.currentSystem.replace('_', ' ')}</div>
              </div>
            )}
            {enquiry.portalUsage && enquiry.portalUsage.length > 0 && (
              <div>
                <div className="text-muted-foreground">Portals</div>
                <div>{enquiry.portalUsage.filter(p => p !== 'none').join(', ') || 'None'}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {(enquiry.segment === 'builder' || enquiry.segment === 'venture_owner' || enquiry.segment === 'builder_group') && (
        <div>
          <h3 className="font-medium mb-3">Builder Details</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            {enquiry.inventoryType && (
              <div>
                <div className="text-muted-foreground">Inventory Type</div>
                <div className="capitalize">{enquiry.inventoryType.join(', ')}</div>
              </div>
            )}
            {enquiry.projectsCount && (
              <div>
                <div className="text-muted-foreground">Projects</div>
                <div>{enquiry.projectsCount} projects</div>
              </div>
            )}
            {enquiry.leadSources && (
              <div className="col-span-2">
                <div className="text-muted-foreground">Lead Sources</div>
                <div className="capitalize">{enquiry.leadSources.map(s => s.replace('_', ' ')).join(', ')}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-4 border-t">
        <Button variant="outline" onClick={onAssign}>
          Assign Owner
        </Button>
        <Button variant="outline" onClick={onScheduleDemo}>
          Schedule Demo
        </Button>
        <Button variant="outline" onClick={() => toast.success('Onboarding pack queued')}>
          Send Onboarding Pack
        </Button>
        <Button className="bg-primary hover:bg-primary/90" onClick={onConvert}>
          Convert to Account
        </Button>
      </div>
    </div>
  );
}

function EnquiryForm({ onSuccess }: { onSuccess: () => void }) {
  const [segment, setSegment] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-sm font-medium">Name</label>
        <Input placeholder="Contact name" required />
      </div>
      <div>
        <label className="text-sm font-medium">Phone</label>
        <Input placeholder="+91 XXXXX XXXXX" required />
      </div>
      <div>
        <label className="text-sm font-medium">City</label>
        <Input placeholder="City" required />
      </div>
      <div>
        <label className="text-sm font-medium">Segment</label>
        <Select value={segment} onValueChange={setSegment}>
          <SelectTrigger>
            <SelectValue placeholder="Select segment" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(SEGMENT_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-sm font-medium">Source</label>
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Select source" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(ENQUIRY_SOURCE_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" className="w-full bg-primary">
        Save Enquiry
      </Button>
    </form>
  );
}
