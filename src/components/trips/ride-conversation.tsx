import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  listRideMessages,
  sendRideMessage,
  markRideMessagesRead,
  type MessageDTO,
} from "@/lib/ride-detail.functions";
import { sendDemoMessage } from "@/lib/demo.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function formatTime(at: string): string {
  return new Date(at).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Realtime conversation between the rider and their assigned driver. New
 * messages stream in via Supabase Postgres changes (no polling); sends go
 * through a validated server function.
 */
export function RideConversation({
  rideId,
  counterpartName,
  disabled,
  demoMode,
}: {
  rideId: string;
  counterpartName: string | null;
  disabled?: boolean;
  /** When true, show a Rider/Driver toggle so one account can simulate both sides. */
  demoMode?: boolean;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const listFn = useServerFn(listRideMessages);
  const sendFn = useServerFn(sendRideMessage);
  const sendDemoFn = useServerFn(sendDemoMessage);
  const markReadFn = useServerFn(markRideMessagesRead);
  const [draft, setDraft] = useState("");
  const [sendAs, setSendAs] = useState<"rider" | "driver">("rider");
  const scrollRef = useRef<HTMLDivElement>(null);

  const queryKey = ["ride-messages", rideId];
  const { data: messages = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => listFn({ data: { rideId } }),
  });

  // Clear unread badges: mark counterpart messages read while the chat is open.
  const markRead = useCallback(() => {
    if (demoMode) return;
    markReadFn({ data: { rideId } })
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ["unread-messages"] });
        queryClient.invalidateQueries({ queryKey: ["conversations"] });
      })
      .catch(() => {
        /* best-effort; the badge refreshes on next load */
      });
  }, [demoMode, markReadFn, queryClient, rideId]);

  // Mark as read on open.
  useEffect(() => {
    markRead();
  }, [markRead]);



  // Realtime: append new messages as they arrive.
  useEffect(() => {
    const channel = supabase
      .channel(`ride-messages-${rideId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `ride_id=eq.${rideId}`,
        },
        (payload) => {
          const row = payload.new as MessageDTO;
          queryClient.setQueryData<MessageDTO[]>(queryKey, (prev) => {
            const list = prev ?? [];
            if (list.some((m) => m.id === row.id)) return list;
            return [...list, row];
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rideId]);

  // Auto-scroll to the newest message.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length]);

  const sendMutation = useMutation({
    mutationFn: (body: string) =>
      demoMode
        ? sendDemoFn({ data: { rideId, body, as: sendAs } })
        : sendFn({ data: { rideId, body } }),
    onSuccess: (msg) => {
      queryClient.setQueryData<MessageDTO[]>(queryKey, (prev) => {
        const list = prev ?? [];
        if (list.some((m) => m.id === msg.id)) return list;
        return [...list, msg];
      });
      setDraft("");
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Couldn't send message"),
  });

  const handleSend = () => {
    const body = draft.trim();
    if (!body || sendMutation.isPending) return;
    sendMutation.mutate(body);
  };

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border">
      <div className="flex items-center justify-between gap-2 border-b bg-muted/40 px-4 py-2.5 text-sm font-medium">
        <span>
          {counterpartName ? `Chat with ${counterpartName}` : "Conversation"}
        </span>
        {demoMode ? (
          <div className="flex items-center gap-1 rounded-full bg-background p-0.5 text-xs">
            {(["rider", "driver"] as const).map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => setSendAs(role)}
                className={cn(
                  "rounded-full px-2.5 py-1 capitalize transition-colors",
                  sendAs === role
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {role}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {demoMode ? (
        <p className="bg-muted/20 px-4 py-1.5 text-[11px] text-muted-foreground">
          Demo mode — sending as <span className="font-medium capitalize">{sendAs}</span>. Switch above to reply from the other side.
        </p>
      ) : null}

      <div
        ref={scrollRef}
        className="flex max-h-80 min-h-40 flex-col gap-2 overflow-y-auto p-3"
      >
        {isLoading ? (
          <div className="flex flex-1 items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading messages…
          </div>
        ) : messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No messages yet. Say hello to coordinate the pickup.
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === user?.id;
            return (
              <div
                key={m.id}
                className={cn(
                  "flex flex-col",
                  mine ? "items-end" : "items-start",
                )}
              >
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
                    mine
                      ? "rounded-br-sm bg-primary text-primary-foreground"
                      : "rounded-bl-sm bg-muted text-foreground",
                  )}
                >
                  {m.body}
                </div>
                <span className="mt-0.5 text-[10px] text-muted-foreground">
                  {formatTime(m.created_at)}
                </span>
              </div>
            );
          })
        )}
      </div>

      <div className="flex items-center gap-2 border-t p-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={
            disabled
              ? "Conversation closed"
              : demoMode
                ? `Message as ${sendAs}…`
                : "Type a message…"
          }
          maxLength={2000}
          disabled={disabled}
          className="h-10"
        />
        <Button
          size="icon"
          className="h-10 w-10 shrink-0"
          onClick={handleSend}
          disabled={disabled || !draft.trim() || sendMutation.isPending}
          aria-label="Send message"
        >
          {sendMutation.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
