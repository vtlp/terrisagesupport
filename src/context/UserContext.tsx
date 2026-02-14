import { createContext, useContext, useState, type ReactNode } from 'react';
import type { User } from '@/types/core';
import { UserRole } from '@/types/core';

interface UserContextValue {
  currentUser: User;
  setCurrentUser: (user: User) => void;
  isAdmin: boolean;
}

const defaultUser: User = {
  user_id: 'U001',
  full_name: 'Sarah Chen',
  email: 'sarah@terrisage.com',
  role: UserRole.ADMIN,
  is_active: true,
};

const UserContext = createContext<UserContextValue>({
  currentUser: defaultUser,
  setCurrentUser: () => {},
  isAdmin: true,
});

export function UserProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User>(defaultUser);

  return (
    <UserContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        isAdmin: currentUser.role === UserRole.ADMIN,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
