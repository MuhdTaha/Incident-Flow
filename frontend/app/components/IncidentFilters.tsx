"use client";

import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { X, ChevronDown } from "lucide-react";
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
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const updatePosition = () => {
    const el = buttonRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 4, left: rect.left });
  };

  useLayoutEffect(() => {
    if (!isOpen) return;
    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (wrapRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      setIsOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const toggleOption = (option: string) => {
    onChange(
      selected.includes(option)
        ? selected.filter(v => v !== option)
        : [...selected, option]
    );
  };

  return (
    <div className="relative inline-block" ref={wrapRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className="flex items-center gap-2 h-8 px-2.5 bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-white/10 rounded-md text-sm text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
      >
        {label}
        {selected.length > 0 && (
          <Badge variant="secondary" className="ml-0.5 bg-blue-50 text-blue-800 dark:bg-blue-500/20 dark:text-blue-200">
            {selected.length}
          </Badge>
        )}
        <ChevronDown className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
      </button>

      {isOpen && createPortal(
        <div
          ref={menuRef}
          role="listbox"
          style={{ top: menuPos.top, left: menuPos.left }}
          className="fixed z-[80] min-w-48 rounded-md border border-slate-200 bg-white shadow-lg dark:border-white/10 dark:bg-slate-900"
        >
          <div className="p-1.5">
            {options.map((option) => (
              <label
                key={option}
                className="flex items-center gap-2 p-1.5 hover:bg-slate-50 dark:hover:bg-white/5 rounded cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(option)}
                  onChange={() => toggleOption(option)}
                  className="h-3.5 w-3.5 rounded border-slate-300 cursor-pointer"
                />
                <span className="text-sm text-slate-800 dark:text-slate-100">{option}</span>
              </label>
            ))}
          </div>
        </div>,
        document.body
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
    <div className="flex flex-wrap items-center gap-2">
      {/* Search Input */}
      <div className="relative flex-1 min-w-52">
        <input
          type="text"
          placeholder="Search by title or ID..."
          className="w-full h-8 pl-3 pr-8 py-1.5 bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-white/10 rounded-lg text-sm text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
          value={filters.search}
          onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
        />
        {filters.search && (
           <X 
            className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500 dark:text-slate-400 cursor-pointer" 
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
        className="h-8 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/70 px-2.5 py-1 text-sm text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500/20"
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
          className="text-slate-600 hover:text-red-600 h-8 dark:text-slate-400"
        >
          Clear All
        </Button>
      )}
    </div>
  );
}
