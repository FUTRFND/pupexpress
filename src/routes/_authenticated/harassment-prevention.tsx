import { createFileRoute } from "@tanstack/react-router";
import { ShieldAlert, Eye, HeartHandshake, Flag } from "lucide-react";

import { InfoPage, BulletCard } from "@/components/info/info-page";

export const Route = createFileRoute("/_authenticated/harassment-prevention")({
  component: HarassmentPreventionPage,
});

function HarassmentPreventionPage() {
  return (
    <InfoPage
      title="Harassment Prevention"
      description="PupXpress has zero tolerance for harassment. Everyone deserves a safe, respectful ride."
    >
      <BulletCard
        title="What counts as harassment"
        icon={ShieldAlert}
        items={[
          "Unwelcome comments about appearance, identity, or background",
          "Sexual advances, innuendo, or inappropriate touching",
          "Threats, intimidation, or aggressive behavior",
          "Discrimination or hate speech of any kind",
          "Repeated unwanted contact on or off the platform",
        ]}
      />

      <BulletCard
        title="If you experience it"
        icon={Flag}
        items={[
          "Your safety comes first — ask to pull over or exit if needed",
          "Call 911 immediately if you feel threatened",
          "Use the in-app emergency tools and Safety Line",
          "Report the incident through your trip history — you won't be charged for ending a ride early due to harassment",
          "Document what happened: time, location, and details",
        ]}
      />

      <BulletCard
        title="If you witness it"
        icon={Eye}
        items={[
          "Speak up safely if you can do so without escalating risk",
          "Support the person being harassed",
          "Report what you saw through the app",
          "Provide any photos or details that could help the review",
        ]}
      />

      <BulletCard
        title="Your rights"
        icon={HeartHandshake}
        items={[
          "Every report is reviewed confidentially by our safety team",
          "You can decline or end any ride that feels unsafe",
          "Retaliation against anyone who reports is strictly prohibited",
          "Serious violations result in immediate, permanent removal",
        ]}
      />
    </InfoPage>
  );
}
