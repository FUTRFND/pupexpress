import { createFileRoute } from "@tanstack/react-router";
import { Heart, Ban, AlertTriangle, Flag } from "lucide-react";

import { InfoPage, BulletCard } from "@/components/info/info-page";

export const Route = createFileRoute("/_authenticated/community-guidelines")({
  component: CommunityGuidelinesPage,
});

function CommunityGuidelinesPage() {
  return (
    <InfoPage
      title="Community Guidelines"
      description="PupXpress works because of mutual respect between riders, drivers, and pets."
    >
      <BulletCard
        title="Our values"
        icon={Heart}
        items={[
          "Treat all community members — riders, drivers, and pets — with respect and compassion",
          "Prioritize the safety and well-being of everyone",
          "Provide exceptional experiences for pets and their owners",
          "Welcome all responsible pet owners and drivers",
        ]}
      />

      <BulletCard
        title="Zero-tolerance violations"
        icon={Ban}
        items={[
          "Physical violence or threats toward any person or animal",
          "Harassment, discrimination, or hate speech",
          "Sexual misconduct or inappropriate behavior",
          "Driving under the influence of drugs or alcohol",
          "Animal abuse or neglect",
          "Fraudulent activity or payment disputes",
        ]}
      />

      <BulletCard
        title="Serious violations"
        icon={AlertTriangle}
        items={[
          "Consistent poor ratings or behavior",
          "Unsafe or reckless driving",
          "Bringing aggressive or uncontrolled pets",
          "Property damage without accepting responsibility",
          "Repeated cancellations or no-shows",
          "Smoking or vaping in the vehicle",
        ]}
      />

      <BulletCard
        title="How to report an issue"
        icon={Flag}
        items={[
          "Open the ride in your trip history",
          "Select Report an Issue and choose a category",
          "Provide a detailed description and any evidence",
          "Our safety team reviews all reports, typically within 24 hours",
        ]}
      />
    </InfoPage>
  );
}
