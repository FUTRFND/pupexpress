import { createFileRoute } from "@tanstack/react-router";

import { InfoPage } from "@/components/info/info-page";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const FAQ_GROUPS: { category: string; items: { q: string; a: string }[] }[] = [
  {
    category: "General",
    items: [
      {
        q: "What is PupXpress?",
        a: "PupXpress is a ride-sharing service designed for pet owners. We connect you with pet-friendly drivers who safely transport you and your pets to vet appointments, grooming, parks, or anywhere you need to go.",
      },
      {
        q: "What types of pets can ride?",
        a: "We primarily serve dogs and cats of all sizes. Pricing adjusts based on your pet's size to ensure a comfortable ride for everyone.",
      },
      {
        q: "Can I bring multiple pets?",
        a: "Yes. When booking, select each pet you'd like to bring. Additional pet fees may apply based on the total size and number of animals.",
      },
      {
        q: "How do I book a ride?",
        a: "Switch to Rider mode, enter your pickup and destination, select your pet, and tap Request Ride. We'll match you with a nearby driver and you complete payment once the ride is done.",
      },
      {
        q: "What's the cancellation policy?",
        a: "You can cancel free of charge shortly after requesting a ride. After a driver accepts, a small cancellation fee may apply.",
      },
    ],
  },
  {
    category: "Pricing & Payments",
    items: [
      {
        q: "How is pricing calculated?",
        a: "Fares include a base fare, distance, time, a pet-size fee, and platform fees. You always see the estimated fare before confirming. See the Pricing & Rates page for details.",
      },
      {
        q: "What payment methods do you accept?",
        a: "We accept major credit and debit cards through our secure payment system. Payment is processed after your ride is completed and you receive a receipt by email.",
      },
      {
        q: "Can I tip my driver?",
        a: "Yes — tips are optional but appreciated, and 100% of tips go directly to your driver. You can add a tip after your ride is completed.",
      },
    ],
  },
  {
    category: "Safety",
    items: [
      {
        q: "How are drivers verified?",
        a: "All drivers undergo background checks, vehicle inspections, and pet-safety training before they can accept rides.",
      },
      {
        q: "How do you keep my pet safe?",
        a: "Drivers are trained in pet handling, vehicles are inspected for pet-friendliness, and we require secured carriers or harnesses. Every ride is tracked in real time.",
      },
      {
        q: "Can I track my ride in real time?",
        a: "Yes. Once your ride is accepted you can track your driver's location on the map and get arrival updates.",
      },
    ],
  },
  {
    category: "Drivers",
    items: [
      {
        q: "How do I become a driver?",
        a: "Open your Profile and tap Become a Driver. Upload your license, registration, insurance, and vehicle photos. Verification usually takes 24–48 hours.",
      },
      {
        q: "How do I start accepting rides?",
        a: "Switch to Driver mode and go online to start receiving nearby requests. You can accept or decline each one, and go offline whenever you're done.",
      },
    ],
  },
];

export const Route = createFileRoute("/_authenticated/faq")({
  component: FaqPage,
});

function FaqPage() {
  return (
    <InfoPage
      title="FAQ"
      description="Answers to the questions we hear most often."
    >
      {FAQ_GROUPS.map((group) => (
        <Card key={group.category}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{group.category}</CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {group.items.map((item, i) => (
                <AccordionItem key={i} value={`${group.category}-${i}`}>
                  <AccordionTrigger className="text-left text-sm font-medium">
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground">
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      ))}
    </InfoPage>
  );
}
