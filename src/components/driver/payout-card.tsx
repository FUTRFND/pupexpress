import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Wallet,
} from "lucide-react";

import {
  getDriverPayoutStatus,
  refreshDriverPayoutStatus,
  createDriverOnboardingLink,
  getDriverEarnings,
} from "@/lib/connect.functions";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const ONBOARDING_LABELS: Record<string, string> = {
  not_started: "Not started",
  pending: "In progress",
  restricted: "Action needed",
  complete: "Complete",
};

/**
 * Driver payout setup + earnings panel. Surfaces Stripe Connect onboarding
 * state, lets the driver complete payout setup, and shows today / pending /
 * all-time earnings. After returning from Stripe (?connect=return) the status
 * is re-synced from Stripe automatically.
 */
export function DriverPayoutCard() {
  const queryClient = useQueryClient();
  const statusFn = useServerFn(getDriverPayoutStatus);
  const refreshFn = useServerFn(refreshDriverPayoutStatus);
  const linkFn = useServerFn(createDriverOnboardingLink);
  const earningsFn = useServerFn(getDriverEarnings);

  const statusQuery = useQuery({
    queryKey: ["driver-payout-status"],
    queryFn: () => statusFn(),
  });

  const earningsQuery = useQuery({
    queryKey: ["driver-earnings"],
    queryFn: () => earningsFn(),
  });

  const refreshMutation = useMutation({
    mutationFn: () => refreshFn(),
    onSuccess: (status) => {
      queryClient.setQueryData(["driver-payout-status"], status);
      queryClient.invalidateQueries({ queryKey: ["driver-earnings"] });
    },
    onError: (err) =>
      toast.error(
        err instanceof Error ? err.message : "Couldn't refresh payout status",
      ),
  });

  const linkMutation = useMutation({
    mutationFn: () => linkFn(),
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
    onError: (err) =>
      toast.error(
        err instanceof Error ? err.message : "Couldn't start payout setup",
      ),
  });

  // Re-sync from Stripe when returning from the onboarding flow.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("connect")) {
      refreshMutation.mutate();
      params.delete("connect");
      const next = params.toString();
      window.history.replaceState(
        {},
        "",
        window.location.pathname + (next ? `?${next}` : ""),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const status = statusQuery.data;
  const earnings = earningsQuery.data;
  const currency = earnings?.currency ?? "usd";
  const payoutsEnabled = status?.payoutsEnabled ?? false;
  const onboardingComplete =
    status?.onboardingStatus === "complete" && payoutsEnabled;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Wallet className="size-4" /> Payouts
        </CardTitle>
        {status ? (
          <Badge variant={onboardingComplete ? "default" : "outline"}>
            {ONBOARDING_LABELS[status.onboardingStatus] ??
              status.onboardingStatus}
          </Badge>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {statusQuery.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Checking payout setup…
          </div>
        ) : onboardingComplete ? (
          <div className="flex items-center gap-2 text-sm text-foreground">
            <CheckCircle2 className="size-4 text-primary" />
            Payouts enabled — you'll receive transfers automatically.
          </div>
        ) : (
          <div className="flex flex-col gap-3 rounded-lg border border-dashed border-amber-500/50 bg-amber-500/5 p-3">
            <div className="flex items-start gap-2 text-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
              <span>
                Payout setup is incomplete. Finish onboarding to receive driver
                earnings.
              </span>
            </div>
            <Button
              className="h-10"
              disabled={linkMutation.isPending}
              onClick={() => linkMutation.mutate()}
            >
              {linkMutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Opening…
                </>
              ) : (
                "Complete payout setup"
              )}
            </Button>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2">
          <EarningStat
            label="Today"
            value={formatCurrency(earnings?.today ?? 0, currency)}
            loading={earningsQuery.isLoading}
          />
          <EarningStat
            label="Pending"
            value={formatCurrency(earnings?.pending ?? 0, currency)}
            loading={earningsQuery.isLoading}
          />
          <EarningStat
            label="All-time"
            value={formatCurrency(earnings?.allTime ?? 0, currency)}
            loading={earningsQuery.isLoading}
          />
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="self-start text-muted-foreground"
          disabled={refreshMutation.isPending}
          onClick={() => refreshMutation.mutate()}
        >
          <RefreshCw
            className={`size-3.5 ${refreshMutation.isPending ? "animate-spin" : ""}`}
          />
          Refresh status
        </Button>
      </CardContent>
    </Card>
  );
}

function EarningStat({
  label,
  value,
  loading,
}: {
  label: string;
  value: string;
  loading: boolean;
}) {
  return (
    <div className="rounded-lg border bg-background p-3 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold">
        {loading ? "…" : value}
      </p>
    </div>
  );
}
