import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useUser } from '@/context/UserContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, User, KeyRound } from 'lucide-react';

export default function Profile() {
  const { authUser, profile, role, isAdmin } = useUser();
  const [fullName, setFullName] = useState('');
  const [savingName, setSavingName] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (profile) setFullName(profile.full_name ?? '');
  }, [profile]);

  const saveName = async () => {
    if (!authUser) return;
    const trimmed = fullName.trim();
    if (!trimmed) {
      toast.error('Name cannot be empty');
      return;
    }
    if (trimmed.length > 100) {
      toast.error('Name must be 100 characters or less');
      return;
    }
    setSavingName(true);
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: trimmed, updated_at: new Date().toISOString() })
      .eq('id', authUser.id);
    if (!error) {
      await supabase.auth.updateUser({ data: { full_name: trimmed } });
    }
    setSavingName(false);
    if (error) toast.error(error.message);
    else toast.success('Name updated');
  };

  const changePassword = async () => {
    if (!authUser?.email) return;
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('Fill in all password fields');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('New password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    setSavingPassword(true);
    // Verify current password by re-authenticating
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: authUser.email,
      password: currentPassword,
    });
    if (verifyError) {
      setSavingPassword(false);
      toast.error('Current password is incorrect');
      return;
    }
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPassword(false);
    if (updateError) {
      toast.error(updateError.message);
      return;
    }
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    toast.success('Password updated');
  };

  const nameDirty = fullName.trim() !== (profile?.full_name ?? '').trim() && fullName.trim().length > 0;
  const passwordDirty = currentPassword.length > 0 || newPassword.length > 0 || confirmPassword.length > 0;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">My Profile</h1>
        <p className="text-sm text-muted-foreground">Manage your account details and password.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><User className="h-4 w-4" /> Account Details</CardTitle>
          <CardDescription>Update your name. Email and role are managed by your admin.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              maxLength={100}
              placeholder="Your name"
            />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={authUser?.email ?? ''} disabled />
            <p className="text-xs text-muted-foreground">Email cannot be changed.</p>
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                {role === 'admin' ? 'Admin' : role === 'support_agent' ? 'Support Agent' : '—'}
              </Badge>
              {!isAdmin && (
                <span className="text-xs text-muted-foreground">Contact an admin to change your role.</span>
              )}
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={saveName} disabled={savingName}>
              {savingName && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><KeyRound className="h-4 w-4" /> Change Password</CardTitle>
          <CardDescription>Enter your current password to set a new one.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="currentPassword">Current Password</Label>
            <Input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="newPassword">New Password</Label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
            <p className="text-xs text-muted-foreground">Must be at least 8 characters.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm New Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={changePassword} disabled={savingPassword}>
              {savingPassword && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Update Password
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
