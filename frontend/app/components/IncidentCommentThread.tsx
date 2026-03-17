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
    <div className="mt-6 border-t border-slate-100 pt-5 space-y-2">
      {/* Typing indicator — reserves height so the layout doesn't jump */}
      <div className="min-h-4.5">
        {typingUser && (
          <span className="text-xs text-slate-500 animate-pulse">
            {typingUser} is typing...
          </span>
        )}
      </div>

      <Textarea
        value={comment}
        onChange={handleTyping}
        placeholder="Add a comment..."
        rows={3}
        className="resize-none text-sm"
      />

      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={submitting || !comment.trim()}
          className="gap-2"
        >
          <Send className="h-3.5 w-3.5" />
          {submitting ? "Posting..." : "Post Comment"}
        </Button>
      </div>
    </div>
  );
}
