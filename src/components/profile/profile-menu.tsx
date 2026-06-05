import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import type { ComponentType } from "react";
import {
  DollarSign,
  ShieldCheck,
  Siren,
  HeartHandshake,
  HelpCircle,
  ListChecks,
  Dog,
  Mail,
  Gift,
  Car,
  ChevronRight,
  Shield,
  FileText,
  Lock,
} from "lucide-react";

import { checkIsAdmin } from "@/lib/admin.functions";
import { Card, CardContent } from "@/components/ui/card";

type IconType = ComponentType<{ className?: string }>;

type MenuItem = {
  icon: IconType;
  label: string;
  subtitle: string;
} & ({ to: string } | { href: string });

const ITEMS: MenuItem[] = [
  {
    icon: Car,
    label: "Become a Driver",
    subtitle: "Submit documents & set up payouts",
    to: "/driver/verify",
  },
  {
    icon: Gift,
    label: "Refer & Earn",
    subtitle: "Share your code, friends get 25% off",
    to: "/referrals",
  },
  {
    icon: DollarSign,
    label: "Pricing & Rates",
    subtitle: "See how fares are calculated",
    to: "/pricing",
  },
  {
    icon: ShieldCheck,
    label: "Safety Center",
    subtitle: "Safety tips & built-in features",
    to: "/safety",
  },
  {
    icon: Siren,
    label: "Emergency Help",
    subtitle: "Emergency contacts & what to do",
    to: "/emergency",
  },
  {
    icon: HeartHandshake,
    label: "Harassment Prevention",
    subtitle: "Your rights & how to report",
    to: "/harassment-prevention",
  },
  {
    icon: ListChecks,
    label: "How to Use",
    subtitle: "Step-by-step guide for riders & drivers",
    to: "/how-to-use",
  },
  {
    icon: HelpCircle,
    label: "FAQ",
    subtitle: "Answers to common questions",
    to: "/faq",
  },
  {
    icon: ListChecks,
    label: "Community Guidelines",
    subtitle: "What's expected of everyone",
    to: "/community-guidelines",
  },
  {
    icon: Dog,
    label: "Pet Care Guidelines",
    subtitle: "Keep every ride safe & comfortable",
    to: "/pet-care-guidelines",
  },
  {
    icon: Lock,
    label: "Privacy Policy",
    subtitle: "How we handle your data",
    to: "/privacy",
  },
  {
    icon: FileText,
    label: "Terms of Service",
    subtitle: "The rules for using PupXpress",
    to: "/terms",
  },
  {
    icon: Mail,
    label: "Contact Support",
    subtitle: "support@pupxpress.com",
    href: "mailto:support@pupxpress.com?subject=PupXpress%20Support%20Request",
  },
];

function Row({ item }: { item: MenuItem }) {
  const Icon = item.icon;
  return (
    <>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{item.label}</span>
        <span className="block truncate text-sm text-muted-foreground">
          {item.subtitle}
        </span>
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
    </>
  );
}

export function ProfileMenu() {
  const checkFn = useServerFn(checkIsAdmin);
  const adminQuery = useQuery({
    queryKey: ["is-admin"],
    queryFn: () => checkFn(),
    staleTime: 60_000,
  });

  return (
    <Card>
      <CardContent className="divide-y p-0">
        {adminQuery.data?.isAdmin ? (
          <Link
            to="/admin"
            className="flex items-center gap-3 p-4 transition-colors hover:bg-accent"
          >
            <Row
              item={{
                icon: Shield,
                label: "Admin Dashboard",
                subtitle: "Manage drivers, applications & rides",
                to: "/admin",
              }}
            />
          </Link>
        ) : null}
        {ITEMS.map((item) =>
          "to" in item ? (
            <Link
              key={item.label}
              to={item.to}
              className="flex items-center gap-3 p-4 transition-colors hover:bg-accent"
            >
              <Row item={item} />
            </Link>
          ) : (
            <a
              key={item.label}
              href={item.href}
              className="flex items-center gap-3 p-4 transition-colors hover:bg-accent"
            >
              <Row item={item} />
            </a>
          ),
        )}
      </CardContent>
    </Card>
  );
}
