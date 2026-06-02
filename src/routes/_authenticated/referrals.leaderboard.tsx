import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Trophy, Loader2, Medal } from "lucide-react";

import { getReferralLeaderboard } from "@/lib/referrals.functions";
import { formatCurrency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/referrals/leaderboard")({
  component: LeaderboardPage,
});

const RANK_STYLES: Record<number, string> = {
  1: "text-amber-500",
  2: "text-slate-400",
  3: "text-amber-700",
};

function LeaderboardPage() {
  const getLeaderboardFn = useServerFn(getReferralLeaderboard);
  const query = useQuery({
    queryKey: ["referral", "leaderboard"],
    queryFn: () => getLeaderboardFn(),
  });

  const entries = query.data ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button
          asChild
          variant="ghost"
          size="icon"
          className="-ml-2 rounded-full"
        >
          <Link to="/referrals" aria-label="Back to referrals">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Leaderboard</h1>
      </div>
      <p className="text-muted-foreground">
        The top PupXpress referrers. Share your code to climb the ranks.
      </p>

      {query.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading leaderboard…
        </div>
      ) : entries.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-8 text-center">
            <Trophy className="size-8 text-muted-foreground" />
            <p className="font-medium">No referrals yet</p>
            <p className="text-sm text-muted-foreground">
              Be the first to share your code and top the leaderboard!
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="divide-y p-0">
            {entries.map((entry) => (
              <div
                key={entry.code}
                className="flex items-center gap-3 p-4"
              >
                <span className="flex w-8 shrink-0 items-center justify-center">
                  {entry.rank <= 3 ? (
                    <Medal
                      className={cn("size-5", RANK_STYLES[entry.rank])}
                    />
                  ) : (
                    <span className="text-sm font-semibold text-muted-foreground">
                      {entry.rank}
                    </span>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {entry.name}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {entry.totalUses} referral
                    {entry.totalUses === 1 ? "" : "s"}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-medium text-emerald-600">
                  {formatCurrency(entry.totalSavings)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
