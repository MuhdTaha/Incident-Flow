"use client";

import { Check, Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useUserDirectory } from "@/context/UserContext";

export type FilterState = {
  severities: string[];
  statuses: string[];
  assigneeId: string | null;
  search: string;
};

interface IncidentFiltersProps {
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
}

export function IncidentFilters({ filters, setFilters }: IncidentFiltersProps) {
  const { users } = useUserDirectory();

  const toggleFilter = (type: 'severities' | 'statuses', value: string) => {
    setFilters(prev => ({
      ...prev,
      [type]: prev[type].includes(value)
        ? prev[type].filter(v => v !== value)
        : [...prev[type], value]
    }));
  };

  const clearFilters = () => setFilters({
    severities: [],
    statuses: [],
    assigneeId: null,
    search: filters.search // Keep search
  });

  const activeCount = filters.severities.length + filters.statuses.length + (filters.assigneeId ? 1 : 0);

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Search Input */}
      <div className="relative flex-1 min-w-60">
        <input
          type="text"
          placeholder="Search by title or ID..."
          className="w-full pl-4 pr-10 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
          value={filters.search}
          onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
        />
        {filters.search && (
           <X 
            className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 cursor-pointer" 
            onClick={() => setFilters(prev => ({ ...prev, search: "" }))}
           />
        )}
      </div>

      {/* Severity Filter */}
      <div className="flex gap-2">
        {['SEV1', 'SEV2', 'SEV3', 'SEV4'].map((sev) => (
          <Button
            key={sev}
            variant={filters.severities.includes(sev) ? "default" : "outline"}
            size="sm"
            onClick={() => toggleFilter('severities', sev)}
            className="h-9 px-3"
          >
            {sev}
          </Button>
        ))}
      </div>

      {/* Assignee Dropdown */}
      <select
        className="h-9 rounded-md border border-slate-200 bg-white px-3 py-1 text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
        value={filters.assigneeId || ""}
        onChange={(e) => setFilters(prev => ({ ...prev, assigneeId: e.target.value || null }))}
      >
        <option value="">All Assignees</option>
        {users.map(u => (
          <option key={u.id} value={u.id}>{u.full_name}</option>
        ))}
      </select>

      {activeCount > 0 && (
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={clearFilters}
          className="text-slate-500 hover:text-red-600 h-9"
        >
          Clear All
        </Button>
      )}
    </div>
  );
}