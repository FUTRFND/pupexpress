import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  ShieldX,
  Users,
  Car,
  ClipboardList,
  Route as RouteIcon,
  CheckCircle2,
  XCircle,
} from "lucide-react";

import {
  checkIsAdmin,
  getAdminStats,
  listAdminDrivers,
  listAdminApplications,
  listAdminRides,
  reviewDriverApplication,
} from "@/lib/admin.functions";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
  errorComponent: ({ error }) => (
    <div className="flex flex-col gap-3">
      <AdminHeader />
      <Card>
        <CardContent className="py-10 text-center text-sm text-destructive">
          {error instanceof Error ? error.message : "Couldn't load the admin dashboard."}
        </CardContent>
      </Card>
    </div>
  ),
});

function AdminHeader() {
  return (
    <div className="flex items-center gap-2">
      <Button asChild variant="ghost" size="icon" className="-ml-2 rounded-full">
        <Link to="/profile" aria-label="Back to profile">
          <ArrowLeft className="h-5 w-5" />
        </Link>
      </Button>
      <h1 className="text-2xl font-bold tracking-tight">Admin</h1>
    </div>
  );
}

function AdminPage() {
  const checkFn = useServerFn(checkIsAdmin);
  const gate = useQuery({
    queryKey: ["is-admin"],
    queryFn: () => checkFn(),
    staleTime: 60_000,
  });

  if (gate.isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <AdminHeader />
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Checking access…
        </div>
      </div>
    );
  }

  if (!gate.data?.isAdmin) {
    return (
      <div className="flex flex-col gap-3">
        <AdminHeader />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <ShieldX className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              You don't have access to the admin dashboard.
            </p>
            <Button asChild variant="outline">
              <Link to="/home">Back to home</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <AdminHeader />
      <Tabs defaultValue="overview">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="drivers">Drivers</TabsTrigger>
          <TabsTrigger value="apps">Applications</TabsTrigger>
          <TabsTrigger value="rides">Rides</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-4">
          <OverviewTab />
        </TabsContent>
        <TabsContent value="drivers" className="mt-4">
          <DriversTab />
        </TabsContent>
        <TabsContent value="apps" className="mt-4">
          <ApplicationsTab />
        </TabsContent>
        <TabsContent value="rides" className="mt-4">
          <RidesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Loading({ label }: { label: string }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> {label}
      </CardContent>
    </Card>
  );
}

function OverviewTab() {
  const fn = useServerFn(getAdminStats);
  const q = useQuery({ queryKey: ["admin-stats"], queryFn: () => fn() });

  if (q.isLoading) return <Loading label="Loading stats…" />;
  if (q.isError || !q.data)
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-destructive">
          Couldn't load stats.
        </CardContent>
      </Card>
    );

  const s = q.data;
  const stats = [
    { icon: Users, label: "Total users", value: String(s.totalUsers) },
    { icon: Car, label: "Drivers", value: String(s.totalDrivers) },
    {
      icon: ClipboardList,
      label: "Pending applications",
      value: String(s.pendingApplications),
    },
    { icon: RouteIcon, label: "Total rides", value: String(s.totalRides) },
    {
      icon: CheckCircle2,
      label: "Completed rides",
      value: String(s.completedRides),
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        {stats.map((st) => {
          const Icon = st.icon;
          return (
            <Card key={st.label}>
              <CardContent className="flex flex-col gap-1 py-4">
                <Icon className="size-4 text-primary" />
                <p className="text-2xl font-bold">{st.value}</p>
                <p className="text-xs text-muted-foreground">{st.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Revenue (paid rides)</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border bg-background p-3">
            <p className="text-xs text-muted-foreground">Gross volume</p>
            <p className="mt-1 text-lg font-semibold">
              {formatCurrency(s.grossVolume)}
            </p>
          </div>
          <div className="rounded-lg border bg-background p-3">
            <p className="text-xs text-muted-foreground">Platform fees</p>
            <p className="mt-1 text-lg font-semibold">
              {formatCurrency(s.platformFees)}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function DriversTab() {
  const fn = useServerFn(listAdminDrivers);
  const q = useQuery({ queryKey: ["admin-drivers"], queryFn: () => fn() });

  if (q.isLoading) return <Loading label="Loading drivers…" />;
  const drivers = q.data ?? [];
  if (drivers.length === 0)
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No drivers yet.
        </CardContent>
      </Card>
    );

  return (
    <div className="flex flex-col gap-2">
      {drivers.map((d) => (
        <Card key={d.id}>
          <CardContent className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {d.fullName ?? "Unnamed driver"}
              </p>
              <p className="truncate text-xs text-muted-foreground">{d.email}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <Badge variant={d.payoutsEnabled ? "default" : "outline"}>
                {d.payoutsEnabled ? "Payouts on" : "No payouts"}
              </Badge>
              <span className="text-[10px] uppercase text-muted-foreground">
                {d.onboardingStatus}
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ApplicationsTab() {
  const queryClient = useQueryClient();
  const fn = useServerFn(listAdminApplications);
  const reviewFn = useServerFn(reviewDriverApplication);
  const q = useQuery({
    queryKey: ["admin-applications"],
    queryFn: () => fn(),
  });

  const reviewMutation = useMutation({
    mutationFn: (vars: { verificationId: string; decision: "approve" | "reject" }) =>
      reviewFn({ data: vars }),
    onSuccess: (_d, vars) => {
      toast.success(
        vars.decision === "approve" ? "Application approved" : "Application rejected",
      );
      queryClient.invalidateQueries({ queryKey: ["admin-applications"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Couldn't update application"),
  });

  if (q.isLoading) return <Loading label="Loading applications…" />;
  const apps = q.data ?? [];
  if (apps.length === 0)
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No driver applications yet.
        </CardContent>
      </Card>
    );

  const variantFor = (status: string) =>
    status === "approved" ? "default" : status === "rejected" ? "destructive" : "outline";

  return (
    <div className="flex flex-col gap-3">
      {apps.map((a) => {
        const pendingThis =
          reviewMutation.isPending &&
          (reviewMutation.variables as { verificationId: string }).verificationId === a.id;
        return (
          <Card key={a.id}>
            <CardContent className="flex flex-col gap-3 py-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {a.applicantName ?? "Unnamed applicant"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {a.applicantEmail}
                  </p>
                </div>
                <Badge variant={variantFor(a.status)}>{a.status}</Badge>
              </div>
              <div className="text-sm">
                <p className="text-foreground">{a.vehicle}</p>
                {a.licensePlate ? (
                  <p className="text-xs text-muted-foreground">
                    Plate: {a.licensePlate}
                  </p>
                ) : null}
              </div>
              {a.status === "pending" ? (
                <div className="flex gap-2">
                  <Button
                    className="h-9 flex-1"
                    disabled={pendingThis}
                    onClick={() =>
                      reviewMutation.mutate({
                        verificationId: a.id,
                        decision: "approve",
                      })
                    }
                  >
                    <CheckCircle2 className="size-4" /> Approve
                  </Button>
                  <Button
                    variant="outline"
                    className="h-9 flex-1 text-destructive hover:text-destructive"
                    disabled={pendingThis}
                    onClick={() =>
                      reviewMutation.mutate({
                        verificationId: a.id,
                        decision: "reject",
                      })
                    }
                  >
                    <XCircle className="size-4" /> Reject
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function RidesTab() {
  const fn = useServerFn(listAdminRides);
  const q = useQuery({ queryKey: ["admin-rides"], queryFn: () => fn() });

  if (q.isLoading) return <Loading label="Loading rides…" />;
  const rides = q.data ?? [];
  if (rides.length === 0)
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No rides yet.
        </CardContent>
      </Card>
    );

  return (
    <div className="flex flex-col gap-2">
      {rides.map((r) => (
        <Card key={r.id}>
          <CardContent className="flex flex-col gap-2 py-3">
            <div className="flex items-center justify-between gap-2">
              <Badge variant="outline">{r.status}</Badge>
              <span className="text-xs text-muted-foreground">
                {new Date(r.createdAt).toLocaleDateString()}
              </span>
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {r.pickupAddress} → {r.destinationAddress}
            </p>
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{formatCurrency(r.rideTotal)}</span>
              <div className="flex gap-1">
                <Badge variant="outline" className="text-[10px]">
                  {r.paymentStatus}
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  {r.transferStatus}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
