"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { authFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

type User = {
  id: string;
  full_name: string;
  email: string;
  role: string;
};

interface UserContextType {
  users: User[];
  userMap: Record<string, User>; // Quick lookup by ID
  loading: boolean;
  refreshUsers: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth(); // Get the current session
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchUsers = useCallback(async () => {
    // Only fetch if there's an active session with a valid access token  
    if (!session?.access_token) {
      return;
    }

    setLoading(true);
    try {
      const res = await authFetch("/users");
      if (res.status === 401) {
        return;
      }

      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (error) {
      console.error("Failed to fetch users:", error);
    } finally {
      setLoading(false);
    }
  }, [session]);

  // Initial fetch when session becomes available
  useEffect(() => { 
    const isAuthPage = window.location.pathname.startsWith("/login") || window.location.pathname.startsWith("/register");

    if (session && !isAuthPage) {
      fetchUsers(); 
    }
  }, [fetchUsers, session]);

  // Create a memoized lookup table: { "uuid-123": { full_name: "...", role: "..." } }
  const userMap = useMemo(() => {
    return users.reduce((acc, user) => {
      acc[user.id] = user;
      return acc;
    }, {} as Record<string, User>);
  }, [users]);

  return (
    <UserContext.Provider value={{ users, userMap, loading, refreshUsers: fetchUsers }}>
      {children}
    </UserContext.Provider>
  );
}

export const useUserDirectory = () => {
  const context = useContext(UserContext);
  if (!context) throw new Error("useUserDirectory must be used within a UserProvider");
  return context;
};