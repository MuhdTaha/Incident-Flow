"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useCurrentUser } from "@/context/UserContext";
import { Button } from "@/components/ui/button";
import { LogOut, LayoutDashboard } from "lucide-react";
import Link from "next/link";

export default function UserNav() {
  const { user } = useAuth();
  const { currentUser, isAdmin } = useCurrentUser();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (!user) return null;

  const displayName = currentUser?.full_name || user.user_metadata?.full_name || "User";
  const names = displayName.split(" ").filter((n: string) => n);
  const initials = names.length > 0
    ? (names[0][0] + (names.length > 1 ? names[names.length - 1][0] : "")).toUpperCase()
    : "U";
  const role = currentUser?.role || "…";

  return (
    <div className="relative">
      <Button
        variant="ghost"
        className="flex items-center gap-2 pl-4 pr-5 pt-7 pb-7 rounded-full hover:bg-slate-200 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="h-10 w-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold">
          {initials}
        </div>
        <div className="text-left hidden md:block">
          <div className="text-sm font-semibold text-slate-700 leading-none">
            {displayName}
          </div>
          <div className="text-[10px] text-slate-500 leading-none mt-1">
            {user.email}
          </div>
          <div className="text-[10px] text-slate-500 leading-none mt-1">
            {role || "User"}
          </div>
        </div>
      </Button>

      {isOpen && (
        <>
          {/* Invisible backdrop to close the menu when clicking outside */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)} 
          />
          
          <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg border border-slate-100 z-50 py-1 animate-in fade-in zoom-in duration-75">
            <div className="px-4 py-3 border-b border-slate-100">
              <p className="text-sm font-medium text-slate-900">
                {displayName} ({role})
              </p>
              <p className="text-xs text-slate-500 truncate">{user.email}</p>
            </div>

            {isAdmin && (
              <div className="py-1">
                <Link
                  href="/admin"
                  className="cursor-pointer w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors"
                  onClick={() => setIsOpen(false)}
                >
                  <LayoutDashboard className="h-4 w-4" />
                  <span>Admin Console</span>
                </Link>
              </div>
            )}

            <div className="border-t border-slate-100 py-1">
              <button
                onClick={handleLogout}
                className="cursor-pointer w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
              >
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}