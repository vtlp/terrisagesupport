import { useState } from 'react';
import { Plus, Search, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { mockUsers } from '@/data/mockData';
import { toast } from 'sonner';
import type { User } from '@/types/support';

const availableTeams = ['sales', 'technical/support', 'onboarding', 'tier-1', 'tier-2'];

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>(mockUsers);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    primaryPhone: '',
    secondaryPhone: '',
    role: 'user' as 'admin' | 'user' | 'manager',
    teams: [] as string[],
  });
  const [editUser, setEditUser] = useState({
    name: '',
    email: '',
    primaryPhone: '',
    secondaryPhone: '',
    role: 'user' as 'admin' | 'user' | 'manager',
    teams: [] as string[],
  });

  const getInitials = (name: string) =>
    name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

  const handleTeamToggle = (team: string) => {
    setNewUser((prev) => ({
      ...prev,
      teams: prev.teams.includes(team)
        ? prev.teams.filter((t) => t !== team)
        : [...prev.teams, team],
    }));
  };

  const handleEditTeamToggle = (team: string) => {
    setEditUser((prev) => ({
      ...prev,
      teams: prev.teams.includes(team)
        ? prev.teams.filter((t) => t !== team)
        : [...prev.teams, team],
    }));
  };

  const handleAddUser = () => {
    if (!newUser.name || !newUser.email) {
      toast.error('Please fill in all required fields');
      return;
    }

    const user: User = {
      id: `u${Date.now()}`,
      name: newUser.name,
      email: newUser.email,
      primaryPhone: newUser.primaryPhone || undefined,
      secondaryPhone: newUser.secondaryPhone || undefined,
      role: newUser.role,
      teams: newUser.teams,
      avatar: undefined,
    };

    setUsers((prev) => [...prev, user]);
    setNewUser({ name: '', email: '', primaryPhone: '', secondaryPhone: '', role: 'user', teams: [] });
    setIsDialogOpen(false);
    toast.success('User added successfully');
  };

  const handleEditClick = (user: User) => {
    setEditingUser(user);
    setEditUser({
      name: user.name,
      email: user.email,
      primaryPhone: user.primaryPhone || '',
      secondaryPhone: user.secondaryPhone || '',
      role: user.role,
      teams: [...user.teams],
    });
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (!editingUser || !editUser.name || !editUser.email) {
      toast.error('Please fill in all required fields');
      return;
    }

    setUsers((prev) =>
      prev.map((u) =>
        u.id === editingUser.id
          ? {
              ...u,
              name: editUser.name,
              email: editUser.email,
              primaryPhone: editUser.primaryPhone || undefined,
              secondaryPhone: editUser.secondaryPhone || undefined,
              role: editUser.role,
              teams: editUser.teams,
            }
          : u
      )
    );
    setIsEditDialogOpen(false);
    setEditingUser(null);
    toast.success('User updated successfully');
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Teams & Users</h1>
          <p className="text-muted-foreground">Manage support team members and permissions</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4 mr-2" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
              <DialogDescription>
                Create a new support team member account
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  placeholder="Enter full name"
                  value={newUser.name}
                  onChange={(e) => setNewUser((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="user@terrisage.com"
                  value={newUser.email}
                  onChange={(e) => setNewUser((prev) => ({ ...prev, email: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="primaryPhone">Primary Phone</Label>
                  <Input
                    id="primaryPhone"
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={newUser.primaryPhone}
                    onChange={(e) => setNewUser((prev) => ({ ...prev, primaryPhone: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="secondaryPhone">Secondary Phone</Label>
                  <Input
                    id="secondaryPhone"
                    type="tel"
                    placeholder="+91 98765 43211"
                    value={newUser.secondaryPhone}
                    onChange={(e) => setNewUser((prev) => ({ ...prev, secondaryPhone: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="role">Role</Label>
                <Select
                  value={newUser.role}
                  onValueChange={(value: 'admin' | 'user' | 'manager') =>
                    setNewUser((prev) => ({ ...prev, role: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Teams</Label>
                <div className="grid grid-cols-2 gap-2">
                  {availableTeams.map((team) => (
                    <div key={team} className="flex items-center space-x-2">
                      <Checkbox
                        id={team}
                        checked={newUser.teams.includes(team)}
                        onCheckedChange={() => handleTeamToggle(team)}
                      />
                      <Label htmlFor={team} className="text-sm font-normal cursor-pointer">
                        {team}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddUser}>Add User</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-card rounded-lg border border-border">
        <div className="p-4 border-b border-border">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search users..." className="pl-9" />
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Teams</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {getInitials(user.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{user.name}</p>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize">
                    {user.role}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1 flex-wrap">
                    {user.teams.map((team) => (
                      <Badge key={team} variant="secondary" className="bg-accent/20 text-accent-foreground">
                        {team}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className="bg-success/20 text-success border-success/30">
                    Active
                  </Badge>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEditClick(user)}>
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem>View permissions</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive">
                        Deactivate
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update team member details and permissions
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Full Name</Label>
              <Input
                id="edit-name"
                placeholder="Enter full name"
                value={editUser.name}
                onChange={(e) => setEditUser((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-email">Email Address</Label>
              <Input
                id="edit-email"
                type="email"
                placeholder="user@terrisage.com"
                value={editUser.email}
                onChange={(e) => setEditUser((prev) => ({ ...prev, email: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-primaryPhone">Primary Phone</Label>
                <Input
                  id="edit-primaryPhone"
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={editUser.primaryPhone}
                  onChange={(e) => setEditUser((prev) => ({ ...prev, primaryPhone: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-secondaryPhone">Secondary Phone</Label>
                <Input
                  id="edit-secondaryPhone"
                  type="tel"
                  placeholder="+91 98765 43211"
                  value={editUser.secondaryPhone}
                  onChange={(e) => setEditUser((prev) => ({ ...prev, secondaryPhone: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-role">Role</Label>
              <Select
                value={editUser.role}
                onValueChange={(value: 'admin' | 'user' | 'manager') =>
                  setEditUser((prev) => ({ ...prev, role: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Teams</Label>
              <div className="grid grid-cols-2 gap-2">
                {availableTeams.map((team) => (
                  <div key={team} className="flex items-center space-x-2">
                    <Checkbox
                      id={`edit-${team}`}
                      checked={editUser.teams.includes(team)}
                      onCheckedChange={() => handleEditTeamToggle(team)}
                    />
                    <Label htmlFor={`edit-${team}`} className="text-sm font-normal cursor-pointer">
                      {team}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
