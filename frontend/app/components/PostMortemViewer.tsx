"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { authFetch } from "@/lib/api";
import { Eye, FileText, Printer, Loader2, Sparkles } from "lucide-react";

interface PostMortemViewerProps {
  incidentId: string;
  status: string;
}

export default function PostMortemViewer({ incidentId, status }: PostMortemViewerProps) {
  const [hasReport, setHasReport] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const isEligible = status === "RESOLVED" || status === "CLOSED";

  useEffect(() => {
    if (!isEligible) {
      setHasReport(false);
      setChecking(false);
      return;
    }

    let mounted = true;

    const checkExistingReport = async () => {
      try {
        const res = await authFetch(`/incidents/${incidentId}/postmortem`, {
          method: "GET",
        });
        if (!mounted) return;
        setHasReport(res.ok);
      } catch {
        if (!mounted) return;
        setHasReport(false);
      } finally {
        if (mounted) setChecking(false);
      }
    };

    checkExistingReport();
    return () => {
      mounted = false;
    };
  }, [incidentId, isEligible]);

  // Only show the AI generator for resolved or closed incidents
  if (!isEligible) return null;

  const generateReport = async () => {
    setLoading(true);
    try {
      const res = await authFetch(`/incidents/${incidentId}/postmortem`, {
        method: "POST"
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to generate report");
      }
      setHasReport(true);
      window.open(`/postmortem/${incidentId}`, "_blank", "noopener,noreferrer");
    } catch (error) {
      console.error("Failed to generate report", error);
      alert("Failed to generate report. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const openReport = (printMode = false) => {
    const suffix = printMode ? "?print=1" : "";
    window.open(`/postmortem/${incidentId}${suffix}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="mt-8 border-t border-slate-200 pt-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold flex items-center gap-2 text-slate-800">
          <Sparkles className="h-4 w-4 text-purple-500" />
          AI Post-Mortem Report
        </h3>

        {hasReport ? (
          <div className="flex items-center gap-2">
            <Button onClick={() => openReport(false)} size="sm" variant="secondary" className="bg-purple-50 text-purple-700 hover:bg-purple-100">
              <Eye className="h-4 w-4 mr-2" />
              View Report
            </Button>
          </div>
        ) : (
          <Button onClick={generateReport} disabled={loading || checking} size="sm" variant="secondary" className="bg-purple-50 text-purple-700 hover:bg-purple-100">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileText className="h-4 w-4 mr-2" />}
            {loading ? "Analyzing Logs..." : checking ? "Checking Report..." : "Generate Report"}
          </Button>
        )}
      </div>
    </div>
  );
}
