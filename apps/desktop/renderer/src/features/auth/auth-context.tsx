import { useState, useCallback, useContext, createContext, useEffect, type ReactNode } from 'react';

export interface User {
 id: string;
 name: string;
 email: string;
 role: 'Owner' | 'Manager' | 'Admin' | 'Staff' | 'Receptionist';
 roleLabel: string;
 avatar?: string;
 loginTime: string;
}

export interface AuthContextValue {
 user: User | null;
 login: (user: User) => void;
 logout: () => void;
 isLoading: boolean;
}

export const AuthContext = createContext<AuthContextValue>({
 user: null,
 login: () => {},
 logout: () => {},
 isLoading: false,
});

const AUTH_KEY = 'car-spa-auth';

export function AuthProvider({ children }: { children: ReactNode }) {
 const [user, setUser] = useState<User | null>(null);
 const [isLoading, setIsLoading] = useState(true);

 // Restore auth from localStorage on mount
 useEffect(() => {
 try {
 const stored = localStorage.getItem(AUTH_KEY);
 if (stored) {
 const parsed = JSON.parse(stored) as User;
 setUser(parsed);
 }
 } catch {
 // Ignore parse errors
 } finally {
 setIsLoading(false);
 }
 }, []);

 const login = useCallback((userData: User) => {
 setIsLoading(true);
 setTimeout(() => {
 setUser(userData);
 localStorage.setItem(AUTH_KEY, JSON.stringify(userData));
 setIsLoading(false);
 }, 300);
 }, []);

 const logout = useCallback(() => {
 setUser(null);
 localStorage.removeItem(AUTH_KEY);
 }, []);

 return (
 <AuthContext.Provider value={{ user, login, logout, isLoading }}>
 {children}
 </AuthContext.Provider>
 );
}

export function useAuth(): AuthContextValue {
 const context = useContext(AuthContext);
 return context;
}
