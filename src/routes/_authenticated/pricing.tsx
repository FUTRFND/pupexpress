import { createFileRoute } from "@tanstack/react-router";
import { DollarSign, TrendingUp, Gift } from "lucide-react";

import {
  InfoPage,
  InfoBanner,
  RowsCard,
  BulletCard,
} from "@/components/info/info-page";

export const Route = createFileRoute("/_authenticated/pricing")({
  component: PricingPage,
});

function PricingPage() {
  return (
    <InfoPage
      title="Pricing & Rates"
      description="Transparent fares with no surprises — you always see the estimated total before you confirm a ride."
    >
      <InfoBanner
        title="5% cheaper than UberX"
        subtitle="Same quality, better value for you and your pet"
      />

      <RowsCard
        title="How fares are calculated"
        description="Every fare is built from a base fare plus distance, time, a pet-size fee, and platform fees."
        rows={[
          { label: "Base fare", value: "$2.38" },
          { label: "Distance", value: "$1.52 / mi" },
          { label: "Time", value: "$0.29 / min" },
          { label: "Pet size fee", value: "$1 – $6" },
          { label: "Platform fees", value: "from $2.60" },
        ]}
      />

      <RowsCard
        title="Example trip"
        description="6 miles • 15 minutes • medium dog (illustrative only)"
        rows={[
          { label: "Base fare", value: "$2.38" },
          { label: "Distance", value: "$7.60" },
          { label: "Time", value: "$4.35" },
          { label: "Pet fee (medium)", value: "$2.50" },
          { label: "Subtotal", value: "$14.05", emphasis: true },
          { label: "Booking fee", value: "$1.85" },
          { label: "Insurance fee", value: "$0.75" },
          { label: "Total", value: "$16.65", emphasis: true },
        ]}
      />

      <BulletCard
        title="Pet size pricing"
        icon={DollarSign}
        items={[
          "Small (under 25 lbs) — lowest pet fee, carrier required",
          "Medium (25–60 lbs) — standard pet fee with a seatbelt harness",
          "Large (over 60 lbs) — highest pet fee, may need a larger vehicle",
        ]}
      />

      <BulletCard
        title="Surge pricing"
        icon={TrendingUp}
        items={[
          "During high demand (rush hour, bad weather, holidays) a multiplier may apply.",
          "The app always shows your estimated fare before you confirm — no surprises.",
        ]}
      />

      <BulletCard
        title="Ways to save"
        icon={Gift}
        items={[
          "Referral codes for a discount on your first ride",
          "Loyalty rewards as you take more rides",
          "Seasonal promotions",
          "Eligible discounts can be combined",
        ]}
      />
    </InfoPage>
  );
}
