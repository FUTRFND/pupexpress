import { createFileRoute } from "@tanstack/react-router";

import { InfoPage } from "@/components/info/info-page";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Step = { title: string; body: string };

const RIDER_STEPS: Step[] = [
  {
    title: "Create your account",
    body: "Sign up with your email or a social account. It only takes about 30 seconds.",
  },
  {
    title: "Add your pet",
    body: "Go to Profile and add your furry friend — name, breed, weight, and temperament notes help drivers prepare.",
  },
  {
    title: "Add a payment method",
    body: "Add a credit or debit card securely. Payment is processed automatically after each ride.",
  },
  {
    title: "Request a ride",
    body: "Enter your pickup and destination, select your pet, and tap Request Ride to match with a nearby driver.",
  },
  {
    title: "Track your driver",
    body: "Watch your driver's location in real time on the map and get notified when they arrive.",
  },
  {
    title: "Rate your experience",
    body: "After the ride, rate your driver and leave feedback. Add a tip for great service.",
  },
];

const DRIVER_STEPS: Step[] = [
  {
    title: "Get verified",
    body: "Upload your license, registration, insurance, and vehicle photos. Our team reviews within 24–48 hours.",
  },
  {
    title: "Complete training",
    body: "Review pet-safety guidelines and learn how to secure different pet sizes safely.",
  },
  {
    title: "Go online",
    body: "Switch to Driver mode and go online to start receiving nearby ride requests.",
  },
  {
    title: "Accept rides",
    body: "Review the pickup, destination, and pet info, then accept or decline. Navigate with your preferred map app.",
  },
  {
    title: "Earn & get bonuses",
    body: "Keep your vehicle clean and pet-friendly, deliver great rides, and earn tips and rating bonuses.",
  },
];

function Steps({ steps }: { steps: Step[] }) {
  return (
    <ol className="space-y-4">
      {steps.map((step, i) => (
        <li key={i} className="flex gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
            {i + 1}
          </span>
          <div>
            <p className="font-semibold">{step.title}</p>
            <p className="text-sm text-muted-foreground">{step.body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export const Route = createFileRoute("/_authenticated/how-to-use")({
  component: HowToUsePage,
});

function HowToUsePage() {
  return (
    <InfoPage
      title="How to Use PupXpress"
      description="A quick guide to getting around with your pet — for riders and drivers."
    >
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">For riders</CardTitle>
        </CardHeader>
        <CardContent>
          <Steps steps={RIDER_STEPS} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">For drivers</CardTitle>
        </CardHeader>
        <CardContent>
          <Steps steps={DRIVER_STEPS} />
        </CardContent>
      </Card>
    </InfoPage>
  );
}
