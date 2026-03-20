"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import ReactMarkdown, { Components } from "react-markdown";
import { authFetch } from "@/lib/api";

interface CodeProps {
  children?: React.ReactNode;
  inline?: boolean;
  className?: string;
}

// Custom components for better markdown styling
const markdownComponents: Components = {
  h1: ({ children }) => (
    <h1 className="mb-6 mt-8 text-4xl font-bold text-slate-900 border-b-2 border-blue-500 pb-3">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-4 mt-6 text-3xl font-bold text-slate-800">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-3 mt-5 text-2xl font-semibold text-slate-800">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="mb-2 mt-4 text-xl font-semibold text-slate-700">{children}</h4>
  ),
  p: ({ children }) => (
    <p className="mb-4 leading-7 text-slate-700">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="mb-4 ml-6 list-disc space-y-2 text-slate-700">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-4 ml-6 list-decimal space-y-2 text-slate-700">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="leading-7">{children}</li>
  ),
  blockquote: ({ children }) => (
    <blockquote className="mb-4 border-l-4 border-blue-400 bg-blue-50 py-2 px-4 italic text-slate-700">
      {children}
    </blockquote>
  ),
  code: ({ children, inline }: CodeProps) => {
    if (inline) {
      return (
        <code className="rounded bg-slate-200 px-1.5 py-0.5 font-mono text-sm text-slate-900">
          {children}
        </code>
      );
    }
    return (
      <code className="block rounded-lg bg-slate-900 p-4 font-mono text-sm text-slate-100 overflow-x-auto mb-4">
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="bg-slate-900 rounded-lg p-4 overflow-x-auto mb-4">{children}</pre>
  ),
  table: ({ children }) => (
    <div className="mb-4 overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-blue-100 text-slate-900 font-semibold">{children}</thead>
  ),
  tbody: ({ children }) => (
    <tbody className="divide-y divide-slate-200">{children}</tbody>
  ),
  tr: ({ children }) => (
    <tr className="hover:bg-slate-50">{children}</tr>
  ),
  th: ({ children }) => (
    <th className="px-4 py-3 text-left font-semibold text-slate-900">{children}</th>
  ),
  td: ({ children }) => (
    <td className="px-4 py-3 text-slate-700">{children}</td>
  ),
  hr: () => (
    <hr className="my-8 border-t-2 border-slate-300" />
  ),
  strong: ({ children }) => (
    <strong className="font-bold text-slate-900">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="italic text-slate-700">{children}</em>
  ),
  a: ({ children, href }) => (
    <a
      href={href}
      className="text-blue-600 underline hover:text-blue-800 transition-colors"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ),
};

export default function PostMortemPage() {
  const params = useParams<{ incidentId: string }>();
  const searchParams = useSearchParams();
  const incidentId = params?.incidentId;

  const [markdown, setMarkdown] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const printMode = useMemo(() => searchParams.get("print") === "1", [searchParams]);

  useEffect(() => {
    if (!incidentId) return;

    let mounted = true;
    const fetchReport = async () => {
      setLoading(true);
      setError("");

      try {
        const res = await authFetch(`/incidents/${incidentId}/postmortem`, { method: "GET" });
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          throw new Error(payload.detail || "Unable to load post-mortem report");
        }

        const data = await res.json();
        if (!mounted) return;
        setMarkdown(data.report_markdown || "");
      } catch (err) {
        if (!mounted) return;
        const message = err instanceof Error ? err.message : "Unable to load post-mortem report";
        setError(message);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchReport();
    return () => {
      mounted = false;
    };
  }, [incidentId]);

  useEffect(() => {
    if (!printMode || !markdown) return;

    const id = window.setTimeout(() => {
      window.print();
    }, 300);

    return () => window.clearTimeout(id);
  }, [printMode, markdown]);

  if (loading) {
    return (
      <div className="min-h-screen bg-linear-to-b from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-slate-700 font-medium">Loading post-mortem report...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-linear-to-b from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="mx-auto max-w-md rounded-lg border border-red-300 bg-red-50 p-6 text-center">
          <div className="mb-3 text-3xl">⚠️</div>
          <p className="text-red-800 font-medium mb-2">Failed to Load Report</p>
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-linear-to-b from-slate-50 to-slate-100 py-12 px-4">
      <article className="mx-auto max-w-4xl rounded-xl border border-slate-300 bg-white shadow-lg">
        {/* Header */}
        <div className="bg-linear-to-r from-slate-900 to-slate-800 px-8 py-6 rounded-t-xl">
          <h1 className="text-3xl font-bold text-white">Incident Post-Mortem Report</h1>
          <p className="mt-2 text-slate-300 text-sm">Incident ID: <span className="font-mono font-semibold">{incidentId}</span></p>
        </div>

        {/* Content */}
        <div className="p-8 max-w-none">
          <ReactMarkdown components={markdownComponents}>
            {markdown}
          </ReactMarkdown>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 bg-slate-50 px-8 py-4 rounded-b-xl text-sm text-slate-500">
          Generated: {new Date().toLocaleString()}
        </div>
      </article>
    </main>
  );
}
