"use client";

import { useState, useRef, useEffect } from "react";
import { Check, Filter, X, ChevronDown } from "lucide-react";
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

const SEVERITIES = ['SEV1', 'SEV2', 'SEV3', 'SEV4'];
const STATUSES = ['DETECTED', 'INVESTIGATING', 'MITIGATED', 'RESOLVED', 'CLOSED'];

function MultiSelectDropdown({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const toggleOption = (option: string) => {
    onChange(
      selected.includes(option)
        ? selected.filter(v => v !== option)
        : [...selected, option]
    );
  };

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 h-9 px-3 bg-white border border-slate-200 rounded-md text-sm hover:bg-slate-50 transition-colors"
      >
        {label}
        {selected.length > 0 && (
          <Badge variant="secondary" className="ml-1 bg-blue-50 text-blue-700">
            {selected.length}
          </Badge>
        )}
        <ChevronDown className="h-4 w-4 text-slate-400" />
      </button>

      {isOpen && (
        <div className="absolute top-full mt-1 left-0 bg-white border border-slate-200 rounded-md shadow-lg z-10 min-w-48">
          <div className="p-2">
            {options.map((option) => (
              <label
                key={option}
                className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(option)}
                  onChange={() => toggleOption(option)}
                  className="h-4 w-4 rounded border-slate-300 cursor-pointer"
                />
                <span className="text-sm">{option}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function IncidentFilters({ filters, setFilters }: IncidentFiltersProps) {
  const { users } = useUserDirectory();

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

      {/* Severity Dropdown */}
      <MultiSelectDropdown
        label="Severity"
        options={SEVERITIES}
        selected={filters.severities}
        onChange={(severities) => setFilters(prev => ({ ...prev, severities }))}
      />

      {/* Status Dropdown */}
      <MultiSelectDropdown
        label="Status"
        options={STATUSES}
        selected={filters.statuses}
        onChange={(statuses) => setFilters(prev => ({ ...prev, statuses }))}
      />

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