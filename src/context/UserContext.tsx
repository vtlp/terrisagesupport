import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Session, User as AuthUser } from '@supabase/supabase-js';

export type AppRole = 'admin' | 'support_agent';

interface Profile {
  id: string;
  full_name: string;
  email: string;
  is_active: boolean;
}

interface UserContextValue {
  authUser: AuthUser | null;
  session: Session | null;
  profile: Profile | null;
  role: AppRole | null;
  isAdmin: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  // legacy compat for existing components
  currentUser: { user_id: string; full_name: string; email: string; role: string; is_active: boolean };
  setCurrentUser: (u: unknown) => void;
}

const UserContext = createContext<UserContextValue | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setAuthUser(s?.user ?? null);
      if (s?.user) {
        // Defer to avoid deadlock
        setTimeout(() => loadProfileAndRole(s.user.id), 0);
      } else {
        setProfile(null);
        setRole(null);
      }
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setAuthUser(s?.user ?? null);
      if (s?.user) loadProfileAndRole(s.user.id);
      else setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadProfileAndRole = async (userId: string) => {
    const [{ data: p }, { data: r }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
      supabase.from('user_roles').select('role').eq('user_id', userId).maybeSingle(),
    ]);
    if (p) setProfile(p as Profile);
    if (r) setRole(r.role as AppRole);
    setLoading(false);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const isAdmin = role === 'admin';

  const currentUser = {
    user_id: authUser?.id ?? '',
    full_name: profile?.full_name ?? authUser?.email ?? '',
    email: profile?.email ?? authUser?.email ?? '',
    role: role === 'admin' ? 'ADMIN' : 'SUPPORT_AGENT',
    is_active: profile?.is_active ?? true,
  };

  return (
    <UserContext.Provider value={{
      authUser, session, profile, role, isAdmin, loading, signOut,
      currentUser, setCurrentUser: () => {},
    }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used within UserProvider');
  return ctx;
}
