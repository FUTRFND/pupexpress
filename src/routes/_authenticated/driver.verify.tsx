import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowLeft,
  ShieldCheck,
  Clock,
  CheckCircle2,
  XCircle,
  Car,
  Loader2,
} from "lucide-react";

import {
  getMyVerification,
  submitVerification,
  type DriverVerification,
} from "@/lib/driver-verification.functions";
import { DocumentUpload } from "@/components/driver/document-upload";
import { DriverPayoutCard } from "@/components/driver/payout-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/driver/verify")({
  component: DriverVerifyPage,
});

interface FormState {
  driverPhotoUrl: string | null;
  driversLicenseUrl: string | null;
  insuranceUrl: string | null;
  vehiclePhotoUrl: string | null;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: string;
  vehicleColor: string;
  licensePlate: string;
}

const EMPTY: FormState = {
  driverPhotoUrl: null,
  driversLicenseUrl: null,
  insuranceUrl: null,
  vehiclePhotoUrl: null,
  vehicleMake: "",
  vehicleModel: "",
  vehicleYear: "",
  vehicleColor: "",
  licensePlate: "",
};

function fromVerification(v: DriverVerification): FormState {
  return {
    driverPhotoUrl: v.driverPhotoUrl,
    driversLicenseUrl: v.driversLicenseUrl,
    insuranceUrl: v.insuranceUrl,
    vehiclePhotoUrl: v.vehiclePhotoUrl,
    vehicleMake: v.vehicleMake ?? "",
    vehicleModel: v.vehicleModel ?? "",
    vehicleYear: v.vehicleYear ? String(v.vehicleYear) : "",
    vehicleColor: v.vehicleColor ?? "",
    licensePlate: v.licensePlate ?? "",
  };
}

function DriverVerifyPage() {
  const queryClient = useQueryClient();
  const getVerificationFn = useServerFn(getMyVerification);
  const submitFn = useServerFn(submitVerification);

  const [form, setForm] = useState<FormState>(EMPTY);
  const [hydrated, setHydrated] = useState(false);

  const query = useQuery({
    queryKey: ["driver-verification"],
    queryFn: () => getVerificationFn(),
  });

  useEffect(() => {
    if (query.data && !hydrated) {
      setForm(fromVerification(query.data));
      setHydrated(true);
    }
  }, [query.data, hydrated]);

  const status = query.data?.status ?? "not_started";

  const set = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: val }));

  const yearNum = Number(form.vehicleYear);
  const yearValid =
    Number.isInteger(yearNum) &&
    yearNum >= 1980 &&
    yearNum <= new Date().getFullYear() + 1;

  const complete =
    Boolean(form.driverPhotoUrl) &&
    Boolean(form.driversLicenseUrl) &&
    Boolean(form.insuranceUrl) &&
    Boolean(form.vehiclePhotoUrl) &&
    form.vehicleMake.trim().length > 0 &&
    form.vehicleModel.trim().length > 0 &&
    form.vehicleColor.trim().length > 0 &&
    form.licensePlate.trim().length > 0 &&
    yearValid;

  const submitMutation = useMutation({
    mutationFn: () =>
      submitFn({
        data: {
          driverPhotoUrl: form.driverPhotoUrl!,
          driversLicenseUrl: form.driversLicenseUrl!,
          insuranceUrl: form.insuranceUrl!,
          vehiclePhotoUrl: form.vehiclePhotoUrl!,
          vehicleMake: form.vehicleMake.trim(),
          vehicleModel: form.vehicleModel.trim(),
          vehicleYear: yearNum,
          vehicleColor: form.vehicleColor.trim(),
          licensePlate: form.licensePlate.trim(),
        },
      }),
    onSuccess: (v) => {
      toast.success("Application submitted! We'll review within 2–3 days.");
      queryClient.setQueryData(["driver-verification"], v);
    },
    onError: (err) =>
      toast.error(
        err instanceof Error ? err.message : "Couldn't submit application",
      ),
  });

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
        <h1 className="text-2xl font-bold tracking-tight">Become a Driver</h1>
      </div>
      <p className="text-muted-foreground">
        Submit your documents and vehicle details, then set up payouts. We
        review applications within 2–3 business days.
      </p>

      {query.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading your application…
        </div>
      ) : (
        <>
          <StatusBanner status={status} notes={query.data?.notes ?? null} />

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="size-5 text-primary" /> Documents
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <DocumentUpload
                label="Your photo"
                kind="driver-photo"
                value={form.driverPhotoUrl}
                onChange={(p) => set("driverPhotoUrl", p)}
              />
              <DocumentUpload
                label="Driver's license"
                kind="license"
                value={form.driversLicenseUrl}
                onChange={(p) => set("driversLicenseUrl", p)}
              />
              <DocumentUpload
                label="Insurance document"
                kind="insurance"
                value={form.insuranceUrl}
                onChange={(p) => set("insuranceUrl", p)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Car className="size-5 text-primary" /> Vehicle
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Make">
                  <Input
                    value={form.vehicleMake}
                    onChange={(e) => set("vehicleMake", e.target.value)}
                    placeholder="Toyota"
                    maxLength={60}
                  />
                </Field>
                <Field label="Model">
                  <Input
                    value={form.vehicleModel}
                    onChange={(e) => set("vehicleModel", e.target.value)}
                    placeholder="Prius"
                    maxLength={60}
                  />
                </Field>
                <Field label="Year">
                  <Input
                    value={form.vehicleYear}
                    onChange={(e) =>
                      set(
                        "vehicleYear",
                        e.target.value.replace(/[^0-9]/g, "").slice(0, 4),
                      )
                    }
                    inputMode="numeric"
                    placeholder="2021"
                    className={cn(
                      form.vehicleYear && !yearValid && "border-destructive",
                    )}
                  />
                </Field>
                <Field label="Color">
                  <Input
                    value={form.vehicleColor}
                    onChange={(e) => set("vehicleColor", e.target.value)}
                    placeholder="Silver"
                    maxLength={40}
                  />
                </Field>
              </div>
              <Field label="License plate">
                <Input
                  value={form.licensePlate}
                  onChange={(e) =>
                    set("licensePlate", e.target.value.toUpperCase())
                  }
                  placeholder="ABC-1234"
                  maxLength={12}
                  className="uppercase"
                />
              </Field>
              <DocumentUpload
                label="Vehicle photo"
                kind="vehicle-photo"
                value={form.vehiclePhotoUrl}
                onChange={(p) => set("vehiclePhotoUrl", p)}
              />
            </CardContent>
          </Card>

          <Button
            className="h-11"
            disabled={!complete || submitMutation.isPending}
            onClick={() => submitMutation.mutate()}
          >
            {submitMutation.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Submitting…
              </>
            ) : status === "pending" || status === "approved" ? (
              "Update application"
            ) : (
              "Submit application"
            )}
          </Button>
          {!complete ? (
            <p className="text-center text-xs text-muted-foreground">
              Upload all documents and complete the vehicle details to submit.
            </p>
          ) : null}

          <div className="pt-2">
            <h2 className="mb-2 text-sm font-semibold">Payout setup</h2>
            <DriverPayoutCard />
          </div>
        </>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-sm">{label}</Label>
      {children}
    </div>
  );
}

function StatusBanner({
  status,
  notes,
}: {
  status: DriverVerification["status"];
  notes: string | null;
}) {
  if (status === "not_started") return null;

  const config = {
    pending: {
      icon: Clock,
      className: "border-amber-500/40 bg-amber-500/5 text-amber-700",
      title: "Application under review",
      body: "We're verifying your documents. This usually takes 2–3 business days.",
    },
    approved: {
      icon: CheckCircle2,
      className: "border-emerald-500/40 bg-emerald-500/5 text-emerald-700",
      title: "You're approved! 🎉",
      body: "You can now go online and accept rides in Driver mode.",
    },
    rejected: {
      icon: XCircle,
      className: "border-destructive/40 bg-destructive/5 text-destructive",
      title: "Application needs attention",
      body: notes ?? "Please review your documents and resubmit.",
    },
  }[status];

  const Icon = config.icon;
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-xl border p-4 text-sm",
        config.className,
      )}
    >
      <Icon className="mt-0.5 size-5 shrink-0" />
      <span>
        <span className="block font-semibold">{config.title}</span>
        <span className="block opacity-90">{config.body}</span>
      </span>
    </div>
  );
}
