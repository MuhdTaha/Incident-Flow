"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { authFetch } from "@/lib/api";
import { messageFromResponse, toastNetworkError } from "@/lib/api-error";
import { toast } from "@/lib/toast";
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
        if (res.ok || res.status === 404) {
          setHasReport(res.ok);
          return;
        }
        toast.error(await messageFromResponse(res, "Couldn't check for an existing post-mortem."));
        setHasReport(false);
      } catch {
        if (!mounted) return;
        toastNetworkError();
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
        throw new Error(await messageFromResponse(res, "Couldn't generate the post-mortem. Try again."));
      }
      setHasReport(true);
      window.open(`/postmortem/${incidentId}`, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't generate the post-mortem. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const openReport = (printMode = false) => {
    const suffix = printMode ? "?print=1" : "";
    window.open(`/postmortem/${incidentId}${suffix}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="mt-4 pt-2">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold flex items-center gap-2 text-slate-800 dark:text-slate-100">
          <Sparkles className="h-4 w-4 text-purple-500" />
          AI Post-Mortem Report
        </h3>

        {hasReport ? (
          <div className="flex items-center gap-2">
            <Button onClick={() => openReport(false)} size="sm" variant="secondary" className="bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-500/20 dark:text-purple-200 dark:hover:bg-purple-500/30">
              <Eye className="h-4 w-4 mr-2" />
              View Report
            </Button>
          </div>
        ) : (
          <Button onClick={generateReport} disabled={loading || checking} size="sm" variant="secondary" className="bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-500/20 dark:text-purple-200 dark:hover:bg-purple-500/30">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileText className="h-4 w-4 mr-2" />}
            {loading ? "Analyzing Logs..." : checking ? "Checking Report..." : "Generate Report"}
          </Button>
        )}
      </div>
    </div>
  );
}
