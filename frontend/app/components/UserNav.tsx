"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { User, Settings, LogOut } from "lucide-react";

export default function UserNav() {
  const { user } = useAuth();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (!user) return null;

  const initials = user.user_metadata?.full_name?.[0] || user.email?.[0] || "U";

  return (
    <div className="relative">
      <Button
        variant="ghost"
        className="flex items-center gap-2 pl-2 pr-4 rounded-full hover:bg-slate-200 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold">
          {initials}
        </div>
        <div className="text-left hidden md:block">
          <div className="text-sm font-semibold text-slate-700 leading-none">
            {user.user_metadata?.full_name || "User"}
          </div>
          <div className="text-[10px] text-slate-500 leading-none mt-1">
            {user.email}
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
                {user.user_metadata?.full_name || "User"}
              </p>
              <p className="text-xs text-slate-500 truncate">{user.email}</p>
            </div>

            <div className="py-1">
              <button className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors">
                <User className="h-4 w-4" /> Profile
              </button>
              <button className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors">
                <Settings className="h-4 w-4" /> Settings
              </button>
            </div>

            <div className="border-t border-slate-100 py-1">
              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
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