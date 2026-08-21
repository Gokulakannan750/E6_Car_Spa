import { ReactNode, useEffect } from 'react';
import { useAuth } from '../../features/auth';

export default function ThemeProvider({ children }: { children: ReactNode }) {
 const { user } = useAuth();

 useEffect(() => {
 const savedTheme = localStorage.getItem('theme');
 const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
 const isDark = savedTheme ? savedTheme === 'dark' : prefersDark;

 if (isDark) {
 document.documentElement.classList.add('dark');
} else {
 document.documentElement.classList.remove('dark');
}
}, [user]);

 return <>{children}</>;
}
