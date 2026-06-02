import { createFileRoute } from "@tanstack/react-router";
import { Backpack, Dog, Cat, Thermometer, Ban } from "lucide-react";

import { InfoPage, BulletCard } from "@/components/info/info-page";

export const Route = createFileRoute("/_authenticated/pet-care-guidelines")({
  component: PetCareGuidelinesPage,
});

function PetCareGuidelinesPage() {
  return (
    <InfoPage
      title="Pet Care Guidelines"
      description="A few simple steps keep every ride safe and comfortable for your pet."
    >
      <BulletCard
        title="Before the ride"
        icon={Backpack}
        items={[
          "Bring a leash or carrier (required for all pets)",
          "Pack waste bags and a comfort item like a favorite toy or blanket",
          "Brush your pet and clean muddy paws to protect the vehicle",
          "Avoid feeding 1–2 hours before to prevent motion sickness",
          "Bring water and a collapsible bowl for longer rides",
        ]}
      />

      <BulletCard
        title="Securing dogs"
        icon={Dog}
        items={[
          "Small (under 25 lbs): secured carrier or pet seatbelt harness — never on your lap",
          "Medium (25–60 lbs): crash-tested seatbelt harness in the back seat",
          "Large (over 60 lbs): heavy-duty harness; consider booking a larger vehicle",
          "Inform the driver of your pet's size when booking",
        ]}
      />

      <BulletCard
        title="Traveling with cats"
        icon={Cat}
        items={[
          "Must be in a secure, enclosed carrier — no exceptions",
          "Carrier should be escape-proof with secure latches",
          "Line the carrier with absorbent material",
          "Familiarize your cat with the carrier before ride day",
        ]}
      />

      <BulletCard
        title="Comfort & temperature"
        icon={Thermometer}
        items={[
          "Ask the driver to adjust AC or heat for your pet's comfort",
          "Ensure adequate airflow; never leave pets in hot vehicles",
          "Offer small amounts of water on rides over 30 minutes",
          "Bring familiar items and stay calm — pets pick up on your energy",
        ]}
      />

      <BulletCard
        title="Not allowed"
        icon={Ban}
        items={[
          "Aggressive or uncontrolled pets",
          "Pets showing signs of illness (vomiting, diarrhea)",
          "Exotic or wild animals without prior approval",
          "Pets that are not up to date on vaccinations",
        ]}
      />
    </InfoPage>
  );
}
