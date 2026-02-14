import { useState } from 'react';
import { Plus, Search, MoreHorizontal } from 'lucide-react';
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
import { seedUsers } from '@/data/seedData';
import { toast } from 'sonner';
import type { User } from '@/types/core';
import { UserRole } from '@/types/core';

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>(seedUsers);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [newUser, setNewUser] = useState({ full_name: '', email: '', role: UserRole.SUPPORT_AGENT as UserRole });

  const handleAddUser = () => {
    if (!newUser.full_name || !newUser.email) { toast.error('Fill all fields'); return; }
    const user: User = { user_id: `U${Date.now()}`, full_name: newUser.full_name, email: newUser.email, role: newUser.role, is_active: true };
    setUsers(prev => [...prev, user]);
    setNewUser({ full_name: '', email: '', role: UserRole.SUPPORT_AGENT });
    setIsDialogOpen(false);
    toast.success('User added');
  };

  const toggleActive = (userId: string) => {
    setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, is_active: !u.is_active } : u));
    toast.success('Status updated');
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
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary w-full sm:w-auto"><Plus className="h-4 w-4 mr-2" />Add User</Button>
          </DialogTrigger>
          <DialogContent className="bg-card">
            <DialogHeader><DialogTitle>Add User</DialogTitle><DialogDescription>Create a new team member</DialogDescription></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-1.5"><Label>Full Name</Label><Input value={newUser.full_name} onChange={e => setNewUser(p => ({ ...p, full_name: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={newUser.email} onChange={e => setNewUser(p => ({ ...p, email: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Role</Label>
                <Select value={newUser.role} onValueChange={(v: UserRole) => setNewUser(p => ({ ...p, role: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-card">
                    <SelectItem value={UserRole.ADMIN}>Admin</SelectItem>
                    <SelectItem value={UserRole.SUPPORT_AGENT}>Support Agent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleAddUser}>Add</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search users…" className="pl-9" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
      </div>

      {/* Desktop table */}
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
                <TableRow key={u.user_id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar><AvatarFallback className="bg-primary/10 text-primary">{u.full_name.split(' ').map(n => n[0]).join('')}</AvatarFallback></Avatar>
                      <div><p className="font-medium">{u.full_name}</p><p className="text-sm text-muted-foreground">{u.email}</p></div>
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="outline">{u.role}</Badge></TableCell>
                  <TableCell><Badge className={u.is_active ? 'bg-success/20 text-success' : 'bg-muted text-muted-foreground'}>{u.is_active ? 'Active' : 'Inactive'}</Badge></TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-card">
                        <DropdownMenuItem>Edit</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => toggleActive(u.user_id)}>
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

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {filtered.map(u => (
          <Card key={u.user_id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar><AvatarFallback className="bg-primary/10 text-primary">{u.full_name.split(' ').map(n => n[0]).join('')}</AvatarFallback></Avatar>
                  <div>
                    <p className="font-medium text-sm">{u.full_name}</p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-card">
                    <DropdownMenuItem>Edit</DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive" onClick={() => toggleActive(u.user_id)}>
                      {u.is_active ? 'Deactivate' : 'Activate'}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="flex gap-2 mt-2">
                <Badge variant="outline" className="text-xs">{u.role}</Badge>
                <Badge className={`text-xs ${u.is_active ? 'bg-success/20 text-success' : 'bg-muted text-muted-foreground'}`}>{u.is_active ? 'Active' : 'Inactive'}</Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
