import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck, MapPin, Car, Users } from "lucide-react";

import { InfoPage, BulletCard } from "@/components/info/info-page";

export const Route = createFileRoute("/_authenticated/safety")({
  component: SafetyPage,
});

function SafetyPage() {
  return (
    <InfoPage
      title="Safety Center"
      description="Your safety and your pet's safety come first. Here's how we keep every ride secure."
    >
      <BulletCard
        title="Built-in safety features"
        icon={ShieldCheck}
        items={[
          "Real-time GPS tracking on every ride, start to finish",
          "Quick access to emergency services from the app",
          "All drivers undergo comprehensive background screening",
        ]}
      />

      <BulletCard
        title="Verify your driver"
        icon={Car}
        items={[
          "Check the driver photo, name, and vehicle details before entering",
          "Confirm the license plate matches the app",
          "Ask the driver to confirm your name before getting in",
          "Never get into an unmarked vehicle",
        ]}
      />

      <BulletCard
        title="Share your trip"
        icon={MapPin}
        items={[
          "Share your live location during the ride",
          "Let someone know your expected arrival time",
          "Keep location services enabled for accurate tracking",
        ]}
      />

      <BulletCard
        title="During the ride"
        icon={Users}
        items={[
          "Sit in the back seat with your pet secured",
          "Keep your pet on a leash or in a carrier",
          "Buckle up — both you and your pet",
          "Trust your instincts — if something feels wrong, speak up",
          "Keep your phone charged and accessible",
        ]}
      />

      <BulletCard
        title="For drivers"
        icon={ShieldCheck}
        items={[
          "Confirm the rider's name before they enter",
          "Check the rider rating before accepting",
          "Keep doors locked until the rider arrives",
          "Trust your judgment — you can decline rides",
        ]}
      />
    </InfoPage>
  );
}
