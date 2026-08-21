import { useState, useContext, createContext, type ReactNode } from 'react';

interface SidebarContextValue {
 isExpanded: boolean;
 toggle: () => void;
}

export const SidebarContext = createContext<SidebarContextValue>({
 isExpanded: true,
 toggle: () => {},
});

export function useSidebar(): SidebarContextValue {
 return useContext(SidebarContext);
}

export function SidebarProvider({ children }: { children: ReactNode }) {
 const [isExpanded, setIsExpanded] = useState(true);
 const toggle = () => setIsExpanded(prev => !prev);

 return (
 <SidebarContext.Provider value={{ isExpanded, toggle }}>
 {children}
 </SidebarContext.Provider>
 );
}
