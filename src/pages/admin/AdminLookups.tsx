import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, X, Pencil, Check, ListChecks, Tag, MapPin, Globe, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  useLookup, createLookup, updateLookup, deleteLookup, type LookupKind, type LookupRow,
} from '@/hooks/useLookups';

function LookupEditor({ kind, title, icon: Icon, description, withState }: {
  kind: LookupKind;
  title: string;
  icon: React.ElementType;
  description: string;
  withState?: boolean;
}) {
  const items = useLookup(kind, { activeOnly: false });
  const [newValue, setNewValue] = useState('');
  const [newState, setNewState] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [busy, setBusy] = useState(false);

  const add = async () => {
    if (!newValue.trim()) return;
    setBusy(true);
    try {
      await createLookup(kind, newValue, withState ? { state: newState.trim() || undefined } : undefined);
      setNewValue(''); setNewState('');
      toast.success(`Added "${newValue.trim()}"`);
    } catch (e) {
      toast.error((e as Error).message || 'Failed to add');
    } finally { setBusy(false); }
  };

  const remove = async (id: string, name: string) => {
    if (!window.confirm(`Remove "${name}"? This cannot be undone.`)) return;
    try { await deleteLookup(kind, id); toast.success('Removed'); }
    catch (e) { toast.error((e as Error).message || 'Failed to remove'); }
  };

  const saveEdit = async (item: LookupRow) => {
    const v = editValue.trim();
    if (!v) return;
    try { await updateLookup(kind, item.id, { name: v }); setEditingId(null); toast.success('Updated'); }
    catch (e) { toast.error((e as Error).message || 'Failed to update'); }
  };

  const toggleActive = async (item: LookupRow) => {
    try { await updateLookup(kind, item.id, { is_active: !item.is_active }); }
    catch (e) { toast.error((e as Error).message || 'Failed to update'); }
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
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
            className="flex-1"
            disabled={busy}
          />
          {withState && (
            <Input
              value={newState}
              onChange={e => setNewState(e.target.value)}
              placeholder="State (optional)"
              className="w-40"
              disabled={busy}
            />
          )}
          <Button size="sm" onClick={add} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 min-h-[40px]">
          {items.map(item => (
            <div key={item.id} className="group">
              {editingId === item.id ? (
                <div className="flex items-center gap-1">
                  <Input
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    className="h-7 w-40 text-xs"
                    onKeyDown={e => { if (e.key === 'Enter') saveEdit(item); if (e.key === 'Escape') setEditingId(null); }}
                    autoFocus
                  />
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => saveEdit(item)}>
                    <Check className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <Badge
                  variant={item.is_active ? 'secondary' : 'outline'}
                  className={`gap-1 pr-1 cursor-default ${!item.is_active ? 'opacity-50 line-through' : ''}`}
                >
                  {item.name}
                  {withState && item.state && <span className="text-[10px] text-muted-foreground">· {item.state}</span>}
                  <Switch
                    checked={item.is_active}
                    onCheckedChange={() => toggleActive(item)}
                    className="ml-1 scale-50 -my-2"
                    aria-label={`Toggle ${item.name}`}
                  />
                  <button onClick={() => { setEditingId(item.id); setEditValue(item.name); }} className="ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Pencil className="h-2.5 w-2.5" />
                  </button>
                  <button onClick={() => remove(item.id, item.name)} className="ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive">
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
        <p className="text-xs text-muted-foreground">
          {items.filter(i => i.is_active).length} active · {items.length} total
        </p>
      </CardContent>
    </Card>
  );
}

export default function AdminLookups() {
  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Lookup Management</h1>
        <p className="text-muted-foreground">
          Configure system-wide dropdown lists. Changes propagate live across the entire application.
        </p>
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
            kind="sources"
            title="Enquiry Sources"
            icon={ListChecks}
            description="These options appear in the enquiry source dropdown when creating or editing enquiries."
          />
        </TabsContent>

        <TabsContent value="tags">
          <LookupEditor
            kind="tags"
            title="Ticket Tags"
            icon={Tag}
            description="Tags available for categorising support tickets. Inactive tags are hidden from selectors."
          />
        </TabsContent>

        <TabsContent value="markets">
          <LookupEditor
            kind="cities"
            title="Cities / Markets"
            icon={MapPin}
            description="City/market options used in tickets, enquiries, and onboarding forms."
            withState
          />
        </TabsContent>

        <TabsContent value="portals">
          <LookupEditor
            kind="portals"
            title="Real Estate Portals"
            icon={Globe}
            description="Property portals list used in enquiry and account profiles."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
