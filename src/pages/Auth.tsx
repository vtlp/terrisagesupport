import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/context/UserContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { Loader2, Info } from 'lucide-react';

export default function Auth() {
  const { authUser, loading } = useUser();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [stay, setStay] = useState(true);
  const [busy, setBusy] = useState(false);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    const seeded = localStorage.getItem('admin_seeded');
    if (!seeded) {
      setSeeding(true);
      supabase.functions.invoke('seed-admin')
        .then(() => localStorage.setItem('admin_seeded', '1'))
        .catch(() => {})
        .finally(() => setSeeding(false));
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (authUser) return <Navigate to="/" replace />;

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    // Persistence preference: when unchecked, sign out at tab close.
    localStorage.setItem('session_persist', stay ? '1' : '0');
    sessionStorage.setItem('session_alive', '1');
    toast.success('Signed in');
    navigate('/', { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-xl">Terrisage Support</CardTitle>
          <p className="text-sm text-muted-foreground">Sign in to continue</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignIn} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="stay" checked={stay} onCheckedChange={(v) => setStay(!!v)} />
              <Label htmlFor="stay" className="cursor-pointer text-sm">Stay signed in</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>Uncheck on shared devices.</TooltipContent>
              </Tooltip>
            </div>
            <Button type="submit" className="w-full" disabled={busy || seeding}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sign in'}
            </Button>
            {seeding && <p className="text-xs text-muted-foreground text-center">Preparing admin account...</p>}
            <p className="text-xs text-muted-foreground text-center">
              Contact your administrator for access.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
