import { createFileRoute } from "@tanstack/react-router";
import { Phone, AlertTriangle, Dog, Search } from "lucide-react";

import { InfoPage, BulletCard } from "@/components/info/info-page";
import { Card, CardContent } from "@/components/ui/card";

const CONTACTS = [
  {
    label: "Emergency Services",
    sub: "Medical emergency, accident, danger",
    tel: "911",
    display: "911",
  },
  {
    label: "PupXpress Safety Line",
    sub: "Unsafe driver, lost pet, incident during ride",
    tel: "1-800-787-7233",
    display: "1-800-PUP-SAFE",
  },
  {
    label: "Pet Poison Helpline",
    sub: "Pet ingestion of toxic substances",
    tel: "1-855-764-7661",
    display: "1-855-764-7661",
  },
  {
    label: "Animal Control",
    sub: "Lost pets, stray animals, animal welfare",
    tel: "311",
    display: "Local 311",
  },
];

export const Route = createFileRoute("/_authenticated/emergency")({
  component: EmergencyPage,
});

function EmergencyPage() {
  return (
    <InfoPage
      title="Emergency Help"
      description="If anyone is in immediate danger, call 911 first. Then use the resources below."
    >
      <Card>
        <CardContent className="space-y-2 py-4">
          {CONTACTS.map((c) => (
            <a
              key={c.label}
              href={`tel:${c.tel}`}
              className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Phone className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block font-semibold">{c.label}</span>
                <span className="block text-sm text-muted-foreground">
                  {c.sub}
                </span>
              </span>
              <span className="ml-auto whitespace-nowrap text-sm font-medium text-primary">
                {c.display}
              </span>
            </a>
          ))}
        </CardContent>
      </Card>

      <BulletCard
        title="If you're in an accident"
        icon={AlertTriangle}
        items={[
          "Ensure everyone's immediate safety — move to a safe location if possible",
          "Call 911 if anyone (human or pet) is injured",
          "Secure your pet to prevent escape or further injury",
          "Contact the PupXpress Safety Line immediately",
          "Take photos of the scene, damage, and injuries",
          "Report the incident through the app",
        ]}
      />

      <BulletCard
        title="Pet medical emergency"
        icon={Dog}
        items={[
          "Stay calm — your pet can sense your anxiety",
          "Assess the situation: is your pet breathing and responsive?",
          "Call the Pet Poison Helpline if ingestion is suspected",
          "Ask the driver to proceed directly to an emergency vet",
          "PupXpress will not charge for re-routing in emergencies",
        ]}
      />

      <BulletCard
        title="If you feel unsafe"
        icon={AlertTriangle}
        items={[
          "Politely ask the driver to pull over in a safe, public area",
          "Exit the vehicle with your pet if you feel unsafe",
          "Call the PupXpress Safety Line immediately",
          "Request a new driver through the app",
          "If threatened, call 911 without hesitation",
        ]}
      />

      <BulletCard
        title="Lost pet"
        icon={Search}
        items={[
          "Stay at the last known location — pets often return",
          "Contact PupXpress immediately to alert the driver network",
          "Call local animal control and shelters with a description",
          "Check the microchip registry and confirm your contact info",
          "Distribute flyers with a photo and contact info",
        ]}
      />
    </InfoPage>
  );
}
