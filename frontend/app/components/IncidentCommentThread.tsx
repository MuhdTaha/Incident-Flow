"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { authFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send } from "lucide-react";

type IncidentCommentThreadProps = {
  incidentId: string;
  onCommentAdded: () => void;
};

export default function IncidentCommentThread({ incidentId, onCommentAdded }: IncidentCommentThreadProps) {
  const { user } = useAuth();
  const [comment, setComment] = useState("");
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const room = supabase.channel(`incident_${incidentId}`);

    room
      .on("broadcast", { event: "typing" }, (payload) => {
        // Ignore own typing events broadcast back
        if (payload.payload.user_id === user?.id) return;

        setTypingUser(payload.payload.user_name);

        // Reset the auto-clear timer on each received event
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        typingTimerRef.current = setTimeout(() => setTypingUser(null), 3000);
      })
      .subscribe();

    channelRef.current = room;

    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      supabase.removeChannel(room);
    };
  }, [incidentId, user?.id]);

  const handleTyping = async (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setComment(e.target.value);

    if (channelRef.current && user) {
      await channelRef.current.send({
        type: "broadcast",
        event: "typing",
        payload: {
          user_id: user.id,
          user_name: user.user_metadata?.full_name ?? user.email ?? "Someone",
        },
      });
    }
  };

  const handleSubmit = async () => {
    if (!comment.trim()) return;
    setSubmitting(true);
    try {
      const res = await authFetch(`/incidents/${incidentId}/comment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment }),
      });
      if (res.ok) {
        setComment("");
        onCommentAdded();
      }
    } catch (err) {
      console.error("Failed to post comment", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex items-end gap-2 py-2">
      <div className="min-w-0 flex-1">
        {typingUser && (
          <p className="mb-1 text-xs text-slate-600 dark:text-slate-300 animate-pulse">
            {typingUser} is typing...
          </p>
        )}
        <Textarea
          value={comment}
          onChange={handleTyping}
          placeholder="Add a comment..."
          rows={1}
          className="min-h-9 resize-none text-sm text-slate-800 dark:text-slate-100"
        />
      </div>
      <Button
        size="sm"
        onClick={handleSubmit}
        disabled={submitting || !comment.trim()}
        className="h-9 shrink-0 gap-2"
      >
        <Send className="h-3.5 w-3.5" />
        {submitting ? "Posting..." : "Post"}
      </Button>
    </div>
  );
}
