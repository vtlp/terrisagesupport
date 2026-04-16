import { useState, useEffect } from 'react';
import { Plus, Search, MoreHorizontal, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

type AppRole = 'admin' | 'support_agent';

interface UserRow {
  id: string;
  full_name: string;
  email: string;
  is_active: boolean;
  role: AppRole | null;
}

export default function AdminUsers() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [newUser, setNewUser] = useState({ full_name: '', email: '', password: '', role: 'support_agent' as AppRole });
  const [editForm, setEditForm] = useState({ full_name: '', role: 'support_agent' as AppRole, password: '' });

  const load = async () => {
    setLoading(true);
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('user_roles').select('user_id, role'),
    ]);
    const roleMap = new Map<string, AppRole>();
    (roles ?? []).forEach((r: { user_id: string; role: AppRole }) => roleMap.set(r.user_id, r.role));
    setUsers((profiles ?? []).map((p) => ({
      id: p.id, full_name: p.full_name, email: p.email, is_active: p.is_active,
      role: roleMap.get(p.id) ?? null,
    })));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleAddUser = async () => {
    if (!newUser.full_name || !newUser.email || !newUser.password) {
      toast.error('Fill all fields'); return;
    }
    if (newUser.password.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('admin-create-user', {
      body: newUser,
    });
    setBusy(false);
    if (error || (data as { error?: string })?.error) {
      toast.error((data as { error?: string })?.error ?? error?.message ?? 'Failed');
      return;
    }
    toast.success('User created');
    setNewUser({ full_name: '', email: '', password: '', role: 'support_agent' });
    setIsAddOpen(false);
    load();
  };

  const openEdit = (u: UserRow) => {
    setEditingUser(u);
    setEditForm({ full_name: u.full_name, role: u.role ?? 'support_agent', password: '' });
    setIsEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingUser) return;
    setBusy(true);
    const body: Record<string, unknown> = {
      user_id: editingUser.id,
      full_name: editForm.full_name,
      role: editForm.role,
    };
    if (editForm.password) body.password = editForm.password;
    const { data, error } = await supabase.functions.invoke('admin-update-user', { body });
    setBusy(false);
    if (error || (data as { error?: string })?.error) {
      toast.error((data as { error?: string })?.error ?? error?.message ?? 'Failed'); return;
    }
    toast.success('User updated');
    setIsEditOpen(false);
    load();
  };

  const toggleActive = async (u: UserRow) => {
    const { data, error } = await supabase.functions.invoke('admin-update-user', {
      body: { user_id: u.id, is_active: !u.is_active },
    });
    if (error || (data as { error?: string })?.error) {
      toast.error('Failed'); return;
    }
    toast.success(u.is_active ? 'Deactivated' : 'Activated');
    load();
  };

  const filtered = users.filter(u =>
    u.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Teams & Users</h1>
          <p className="text-muted-foreground">Manage support team members</p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary w-full sm:w-auto"><Plus className="h-4 w-4 mr-2" />Add User</Button>
          </DialogTrigger>
          <DialogContent className="bg-card">
            <DialogHeader><DialogTitle>Add User</DialogTitle><DialogDescription>Create a new team member</DialogDescription></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-1.5"><Label>Full Name</Label><Input value={newUser.full_name} onChange={e => setNewUser(p => ({ ...p, full_name: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={newUser.email} onChange={e => setNewUser(p => ({ ...p, email: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Temporary Password</Label><Input type="password" value={newUser.password} onChange={e => setNewUser(p => ({ ...p, password: e.target.value }))} placeholder="Min 8 characters" /></div>
              <div className="space-y-1.5"><Label>Role</Label>
                <Select value={newUser.role} onValueChange={(v: AppRole) => setNewUser(p => ({ ...p, role: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-card">
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="support_agent">Support Agent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
              <Button onClick={handleAddUser} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search users…" className="pl-9" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : (
      <>
      <Card className="hidden md:block">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(u => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar><AvatarFallback className="bg-primary/10 text-primary">{(u.full_name || u.email).split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}</AvatarFallback></Avatar>
                      <div><p className="font-medium">{u.full_name || '—'}</p><p className="text-sm text-muted-foreground">{u.email}</p></div>
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="outline">{u.role === 'admin' ? 'Admin' : u.role === 'support_agent' ? 'Support Agent' : 'No role'}</Badge></TableCell>
                  <TableCell><Badge className={u.is_active ? 'bg-success/20 text-success' : 'bg-muted text-muted-foreground'}>{u.is_active ? 'Active' : 'Inactive'}</Badge></TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-card">
                        <DropdownMenuItem onClick={() => openEdit(u)}>Edit</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => toggleActive(u)}>
                          {u.is_active ? 'Deactivate' : 'Activate'}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="md:hidden space-y-3">
        {filtered.map(u => (
          <Card key={u.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar><AvatarFallback className="bg-primary/10 text-primary">{(u.full_name || u.email).split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}</AvatarFallback></Avatar>
                  <div>
                    <p className="font-medium text-sm">{u.full_name || '—'}</p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-card">
                    <DropdownMenuItem onClick={() => openEdit(u)}>Edit</DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive" onClick={() => toggleActive(u)}>
                      {u.is_active ? 'Deactivate' : 'Activate'}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="flex gap-2 mt-2">
                <Badge variant="outline" className="text-xs">{u.role ?? 'No role'}</Badge>
                <Badge className={`text-xs ${u.is_active ? 'bg-success/20 text-success' : 'bg-muted text-muted-foreground'}`}>{u.is_active ? 'Active' : 'Inactive'}</Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      </>
      )}

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="bg-card">
          <DialogHeader><DialogTitle>Edit User</DialogTitle><DialogDescription>{editingUser?.email}</DialogDescription></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5"><Label>Full Name</Label><Input value={editForm.full_name} onChange={e => setEditForm(p => ({ ...p, full_name: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Role</Label>
              <Select value={editForm.role} onValueChange={(v: AppRole) => setEditForm(p => ({ ...p, role: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="bg-card">
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="support_agent">Support Agent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Reset Password (optional)</Label><Input type="password" value={editForm.password} onChange={e => setEditForm(p => ({ ...p, password: e.target.value }))} placeholder="Leave blank to keep current" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
