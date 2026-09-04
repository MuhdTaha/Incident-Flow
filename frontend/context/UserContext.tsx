"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { usePathname } from "next/navigation";
import { authFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export type AppRole = "ADMIN" | "MANAGER" | "ENGINEER" | "BOT";

export type CurrentUser = {
  id: string;
  role: AppRole;
  org_id: string;
  full_name: string;
  invite_pending?: boolean;
  can_create_org?: boolean;
};

type DirectoryUser = {
  id: string;
  full_name: string;
  email: string;
  role: string;
};

interface UserContextType {
  currentUser: CurrentUser | null;
  currentUserLoading: boolean;
  users: DirectoryUser[];
  userMap: Record<string, DirectoryUser>;
  loading: boolean;
  refreshUsers: () => Promise<void>;
  refreshCurrentUser: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

function isAuthPath(pathname: string) {
  return pathname.startsWith("/login") || pathname.startsWith("/register") || pathname.startsWith("/invite");
}

export function UserProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const pathname = usePathname();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [currentUserLoading, setCurrentUserLoading] = useState(() => Boolean(session));
  const [users, setUsers] = useState<DirectoryUser[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchCurrentUser = useCallback(async () => {
    if (!session?.access_token) {
      setCurrentUser(null);
      return;
    }

    setCurrentUserLoading(true);
    try {
      const res = await authFetch("/users/me");
      if (res.status === 401) {
        setCurrentUser(null);
        return;
      }
      if (res.ok) {
        const data: CurrentUser = await res.json();
        setCurrentUser(data);
      }
    } catch (error) {
      console.error("Failed to fetch current user:", error);
      setCurrentUser(null);
    } finally {
      setCurrentUserLoading(false);
    }
  }, [session]);

  const fetchUsers = useCallback(async () => {
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

  useEffect(() => {
    if (!session) {
      setCurrentUser(null);
      setUsers([]);
      setCurrentUserLoading(false);
      return;
    }

    if (!isAuthPath(pathname)) {
      void fetchCurrentUser();
      void fetchUsers();
    } else {
      setCurrentUserLoading(false);
    }
  }, [fetchCurrentUser, fetchUsers, session, pathname]);

  const userMap = useMemo(() => {
    return users.reduce((acc, user) => {
      acc[user.id] = user;
      return acc;
    }, {} as Record<string, DirectoryUser>);
  }, [users]);

  return (
    <UserContext.Provider
      value={{
        currentUser,
        currentUserLoading,
        users,
        userMap,
        loading,
        refreshUsers: fetchUsers,
        refreshCurrentUser: fetchCurrentUser,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export const useUserDirectory = () => {
  const context = useContext(UserContext);
  if (!context) throw new Error("useUserDirectory must be used within a UserProvider");
  return context;
};

export const useCurrentUser = () => {
  const context = useContext(UserContext);
  if (!context) throw new Error("useCurrentUser must be used within a UserProvider");

  const role = context.currentUser?.role ?? null;
  return {
    currentUser: context.currentUser,
    loading: context.currentUserLoading,
    role,
    isAdmin: role === "ADMIN",
    isManagerOrAdmin: role === "ADMIN" || role === "MANAGER",
    refreshCurrentUser: context.refreshCurrentUser,
  };
};
