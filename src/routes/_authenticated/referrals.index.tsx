import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowLeft,
  Copy,
  Check,
  Share2,
  Trophy,
  Gift,
  Loader2,
  Users,
} from "lucide-react";

import { getMyReferral } from "@/lib/referrals.functions";
import { formatCurrency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/referrals/")({
  component: ReferralsPage,
});

function ReferralsPage() {
  const getMyReferralFn = useServerFn(getMyReferral);
  const [copied, setCopied] = useState(false);

  const query = useQuery({
    queryKey: ["referral", "me"],
    queryFn: () => getMyReferralFn(),
  });

  const referral = query.data;

  const handleCopy = async () => {
    if (!referral) return;
    try {
      await navigator.clipboard.writeText(referral.code);
      setCopied(true);
      toast.success("Code copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy the code");
    }
  };

  const handleShare = async () => {
    if (!referral) return;
    const text = `Use my PupXpress code ${referral.code} for 25% off your first pet ride! 🐾`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "PupXpress", text });
      } catch {
        /* user cancelled */
      }
    } else {
      try {
        await navigator.clipboard.writeText(text);
        toast.success("Invite copied to clipboard!");
      } catch {
        toast.error("Couldn't share");
      }
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button
          asChild
          variant="ghost"
          size="icon"
          className="-ml-2 rounded-full"
        >
          <Link to="/profile" aria-label="Back to profile">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Refer & Earn</h1>
      </div>
      <p className="text-muted-foreground">
        Share your code. Friends get 25% off their first ride, and you climb the
        leaderboard with every redemption.
      </p>

      {query.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading your code…
        </div>
      ) : query.isError ? (
        <Card>
          <CardContent className="p-4 text-sm text-destructive">
            Couldn't load your referral code. Please try again.
          </CardContent>
        </Card>
      ) : referral ? (
        <>
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Gift className="size-5 text-primary" /> Your referral code
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex items-center justify-between rounded-xl border border-dashed bg-muted/40 px-4 py-3">
                <span className="text-2xl font-extrabold tracking-widest">
                  {referral.code}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleCopy}
                  aria-label="Copy code"
                >
                  {copied ? (
                    <Check className="size-5 text-emerald-500" />
                  ) : (
                    <Copy className="size-5" />
                  )}
                </Button>
              </div>
              <Button className="h-11" onClick={handleShare}>
                <Share2 className="size-4" /> Share invite
              </Button>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardContent className="flex flex-col items-center gap-1 p-4 text-center">
                <Users className="size-5 text-primary" />
                <span className="text-2xl font-bold">{referral.totalUses}</span>
                <span className="text-xs text-muted-foreground">
                  Friends referred
                </span>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex flex-col items-center gap-1 p-4 text-center">
                <Gift className="size-5 text-primary" />
                <span className="text-2xl font-bold">
                  {formatCurrency(referral.totalSavings)}
                </span>
                <span className="text-xs text-muted-foreground">
                  Total savings given
                </span>
              </CardContent>
            </Card>
          </div>

          <Button asChild variant="outline" className="h-11">
            <Link to="/referrals/leaderboard">
              <Trophy className="size-4" /> View leaderboard
            </Link>
          </Button>

          {referral.recentUses.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recent redemptions</CardTitle>
              </CardHeader>
              <CardContent className="divide-y p-0">
                {referral.recentUses.map((use, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-4 text-sm"
                  >
                    <span>{use.userName}</span>
                    <span className="font-medium text-emerald-600">
                      −{formatCurrency(use.discountAmount)}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
