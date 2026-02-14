import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, X, Pencil, Check, ListChecks, Tag, MapPin, Globe } from 'lucide-react';
import { toast } from 'sonner';

interface LookupItem {
  id: string;
  value: string;
}

function LookupEditor({ title, icon: Icon, items: initial, description }: {
  title: string;
  icon: React.ElementType;
  items: LookupItem[];
  description: string;
}) {
  const [items, setItems] = useState<LookupItem[]>(initial);
  const [newValue, setNewValue] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const addItem = () => {
    const v = newValue.trim();
    if (!v) return;
    if (items.some(i => i.value.toLowerCase() === v.toLowerCase())) {
      toast.error('Already exists');
      return;
    }
    setItems([...items, { id: `LK${Date.now()}`, value: v }]);
    setNewValue('');
    toast.success(`Added "${v}"`);
  };

  const removeItem = (id: string) => {
    setItems(items.filter(i => i.id !== id));
    toast.success('Removed');
  };

  const startEdit = (item: LookupItem) => {
    setEditingId(item.id);
    setEditValue(item.value);
  };

  const saveEdit = () => {
    if (!editValue.trim()) return;
    setItems(items.map(i => i.id === editingId ? { ...i, value: editValue.trim() } : i));
    setEditingId(null);
    toast.success('Updated');
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          {title}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input
            value={newValue}
            onChange={e => setNewValue(e.target.value)}
            placeholder={`Add new ${title.toLowerCase().replace(/s$/, '')}…`}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addItem(); } }}
            className="flex-1"
          />
          <Button size="sm" onClick={addItem}><Plus className="h-4 w-4" /></Button>
        </div>
        <div className="flex flex-wrap gap-2 min-h-[40px]">
          {items.map(item => (
            <div key={item.id} className="group">
              {editingId === item.id ? (
                <div className="flex items-center gap-1">
                  <Input
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    className="h-7 w-32 text-xs"
                    onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingId(null); }}
                    autoFocus
                  />
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={saveEdit}>
                    <Check className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <Badge variant="secondary" className="gap-1 pr-1 cursor-default">
                  {item.value}
                  <button onClick={() => startEdit(item)} className="ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Pencil className="h-2.5 w-2.5" />
                  </button>
                  <button onClick={() => removeItem(item.id)} className="ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
            </div>
          ))}
          {items.length === 0 && (
            <p className="text-xs text-muted-foreground italic">No items yet. Add one above.</p>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{items.length} item{items.length !== 1 ? 's' : ''}</p>
      </CardContent>
    </Card>
  );
}

const defaultSources: LookupItem[] = [
  { id: 'S1', value: 'Call (Direct)' },
  { id: 'S2', value: 'Landing Page' },
  { id: 'S3', value: 'Meta Ads' },
  { id: 'S4', value: 'Champion / Partner' },
  { id: 'S5', value: 'CP Request (Projects)' },
];

const defaultTags: LookupItem[] = [
  { id: 'T1', value: 'export' },
  { id: 'T2', value: 'integration' },
  { id: 'T3', value: 'billing' },
  { id: 'T4', value: 'onboarding' },
  { id: 'T5', value: 'login' },
  { id: 'T6', value: 'performance' },
  { id: 'T7', value: 'mobile' },
  { id: 'T8', value: 'data-import' },
  { id: 'T9', value: 'leads' },
  { id: 'T10', value: 'google' },
];

const defaultMarkets: LookupItem[] = [
  { id: 'M1', value: 'Mumbai' },
  { id: 'M2', value: 'Pune' },
  { id: 'M3', value: 'Delhi' },
  { id: 'M4', value: 'Bangalore' },
  { id: 'M5', value: 'Chennai' },
  { id: 'M6', value: 'Hyderabad' },
  { id: 'M7', value: 'Kolkata' },
  { id: 'M8', value: 'Ahmedabad' },
  { id: 'M9', value: 'Jaipur' },
  { id: 'M10', value: 'Kochi' },
];

const defaultPortals: LookupItem[] = [
  { id: 'P1', value: 'MagicBricks' },
  { id: 'P2', value: '99acres' },
  { id: 'P3', value: 'Housing.com' },
  { id: 'P4', value: 'NoBroker' },
  { id: 'P5', value: 'CommonFloor' },
  { id: 'P6', value: 'Square Yards' },
];

export default function AdminLookups() {
  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Lookup Management</h1>
        <p className="text-muted-foreground">Configure system-wide dropdown lists and tags</p>
      </div>

      <Tabs defaultValue="sources">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="sources"><ListChecks className="h-4 w-4 mr-1" />Sources</TabsTrigger>
          <TabsTrigger value="tags"><Tag className="h-4 w-4 mr-1" />Tags</TabsTrigger>
          <TabsTrigger value="markets"><MapPin className="h-4 w-4 mr-1" />Markets</TabsTrigger>
          <TabsTrigger value="portals"><Globe className="h-4 w-4 mr-1" />Portals</TabsTrigger>
        </TabsList>

        <TabsContent value="sources">
          <LookupEditor
            title="Enquiry Sources"
            icon={ListChecks}
            items={defaultSources}
            description="These options appear in the enquiry source dropdown when creating or editing enquiries."
          />
        </TabsContent>

        <TabsContent value="tags">
          <LookupEditor
            title="Ticket Tags"
            icon={Tag}
            items={defaultTags}
            description="Tags available for categorizing support tickets. Users can also add custom tags."
          />
        </TabsContent>

        <TabsContent value="markets">
          <LookupEditor
            title="Market Field Values"
            icon={MapPin}
            items={defaultMarkets}
            description="City/market options used in tickets and marketing geo-tagging."
          />
        </TabsContent>

        <TabsContent value="portals">
          <LookupEditor
            title="Real Estate Portals"
            icon={Globe}
            items={defaultPortals}
            description="Property portals list used in enquiry and account profiles."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
