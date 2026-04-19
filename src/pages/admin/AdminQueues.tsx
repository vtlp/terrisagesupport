import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { GitBranch, Plus, Trash2, Users, UserPlus, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { fetchProfiles, fetchQueues, type ProfileRow, type QueueRow } from '@/lib/ticketsApi';

interface QueueMember {
  id: string;
  queue_id: string;
  user_id: string;
  is_active: boolean;
  sort_order: number;
}

export default function AdminQueues() {
  const [autoAssign, setAutoAssign] = useState(true);
  const [queues, setQueues] = useState<QueueRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [members, setMembers] = useState<QueueMember[]>([]);
  const [newName, setNewName] = useState('');
  const [newKey, setNewKey] = useState('');
  const [addMemberFor, setAddMemberFor] = useState<Record<string, string>>({});

  const reload = async () => {
    setQueues(await fetchQueues());
    const { data } = await supabase.from('ticket_queue_members').select('*').order('sort_order');
    setMembers((data ?? []) as QueueMember[]);
  };

  useEffect(() => {
    reload();
    fetchProfiles().then(setProfiles).catch(() => {});
  }, []);

  const updateQueue = async (id: string, patch: Partial<QueueRow>) => {
    const { error } = await supabase.from('ticket_queues').update(patch).eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Queue updated');
    reload();
  };

  const createQueue = async () => {
    if (!newName.trim() || !newKey.trim()) { toast.error('Name and key required'); return; }
    const { error } = await supabase.from('ticket_queues').insert({
      name: newName.trim(), key: newKey.trim().toLowerCase().replace(/\s+/g, '_'),
    });
    if (error) { toast.error(error.message); return; }
    setNewName(''); setNewKey('');
    toast.success('Queue created');
    reload();
  };

  const deleteQueue = async (id: string) => {
    if (!window.confirm('Delete this queue?')) return;
    const { error } = await supabase.from('ticket_queues').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Queue deleted');
    reload();
  };

  const addMember = async (queueId: string) => {
    const userId = addMemberFor[queueId];
    if (!userId) { toast.error('Pick a member'); return; }
    const max = members.filter(m => m.queue_id === queueId).reduce((a, m) => Math.max(a, m.sort_order), -1);
    const { error } = await supabase.from('ticket_queue_members').insert({
      queue_id: queueId, user_id: userId, sort_order: max + 1,
    });
    if (error) { toast.error(error.message); return; }
    setAddMemberFor(prev => ({ ...prev, [queueId]: '' }));
    toast.success('Member added');
    reload();
  };

  const removeMember = async (memberId: string) => {
    const { error } = await supabase.from('ticket_queue_members').delete().eq('id', memberId);
    if (error) { toast.error(error.message); return; }
    toast.success('Member removed');
    reload();
  };

  const toggleMember = async (memberId: string, isActive: boolean) => {
    const { error } = await supabase.from('ticket_queue_members').update({ is_active: isActive }).eq('id', memberId);
    if (error) { toast.error(error.message); return; }
    reload();
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Assignment Rules</h1>
          <p className="text-muted-foreground">Configure ticket queues and round-robin routing</p>
        </div>
        <div className="flex items-center gap-3 bg-card border border-border rounded-lg px-4 py-2">
          <Label htmlFor="auto-assign" className="text-sm">Auto-Assignment</Label>
          <Switch id="auto-assign" checked={autoAssign} onCheckedChange={setAutoAssign} />
          <Badge className={autoAssign ? 'bg-success/20 text-success' : 'bg-muted text-muted-foreground'}>
            {autoAssign ? 'ON' : 'OFF'}
          </Badge>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Plus className="h-4 w-4 text-primary" /> New Queue</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-3">
          <Input placeholder="Display name (e.g. Billing)" value={newName} onChange={e => setNewName(e.target.value)} className="flex-1" />
          <Input placeholder="Key (e.g. billing)" value={newKey} onChange={e => setNewKey(e.target.value)} className="flex-1" />
          <Button onClick={createQueue}><Plus className="h-4 w-4 mr-1" />Add Queue</Button>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {queues.map(queue => {
          const queueMembers = members.filter(m => m.queue_id === queue.id);
          const memberOptions = profiles.filter(p => !queueMembers.some(m => m.user_id === p.id));
          return (
            <Card key={queue.id}>
              <CardHeader className="pb-3 flex flex-row items-start justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <GitBranch className="h-4 w-4 text-primary" />
                    {queue.name}
                    <Badge variant="outline" className="text-[10px]">{queue.key}</Badge>
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">{queue.description || 'No description'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={queue.is_active} onCheckedChange={v => updateQueue(queue.id, { is_active: v })} />
                  <Button variant="ghost" size="icon" onClick={() => deleteQueue(queue.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Description</Label>
                    <Input
                      defaultValue={queue.description ?? ''}
                      onBlur={e => e.target.value !== (queue.description ?? '') && updateQueue(queue.id, { description: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Default Assignee (fallback if no members)</Label>
                    <Select
                      value={queue.default_assignee ?? '__none__'}
                      onValueChange={v => updateQueue(queue.id, { default_assignee: v === '__none__' ? null : v })}
                    >
                      <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                      <SelectContent className="bg-card">
                        <SelectItem value="__none__">Unassigned</SelectItem>
                        {profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Round-robin members */}
                <div className="space-y-2 pt-2 border-t border-border/50">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Users className="h-3 w-3" /> Round-robin members ({queueMembers.length})
                  </Label>
                  <div className="space-y-1.5">
                    {queueMembers.length === 0 && (
                      <p className="text-xs text-muted-foreground italic">No members yet. Add staff to enable round-robin.</p>
                    )}
                    {queueMembers.map(m => {
                      const profile = profiles.find(p => p.id === m.user_id);
                      return (
                        <div key={m.id} className="flex items-center gap-2 bg-muted/30 rounded px-2 py-1.5">
                          <Users className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm flex-1">{profile?.full_name ?? 'Unknown user'}</span>
                          <Switch checked={m.is_active} onCheckedChange={v => toggleMember(m.id, v)} />
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeMember(m.id)}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex gap-2">
                    <Select
                      value={addMemberFor[queue.id] || ''}
                      onValueChange={v => setAddMemberFor(prev => ({ ...prev, [queue.id]: v }))}
                    >
                      <SelectTrigger className="flex-1 h-8 text-sm">
                        <SelectValue placeholder="Add staff member…" />
                      </SelectTrigger>
                      <SelectContent className="bg-card">
                        {memberOptions.length === 0 && <div className="text-xs text-muted-foreground p-2">All staff are members</div>}
                        {memberOptions.map(p => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button size="sm" onClick={() => addMember(queue.id)} disabled={!addMemberFor[queue.id]}>
                      <UserPlus className="h-3.5 w-3.5 mr-1" /> Add
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {queues.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">No queues yet — create one above.</p>
        )}
      </div>
    </div>
  );
}
