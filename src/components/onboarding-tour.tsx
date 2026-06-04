import { useRef, useState, useCallback } from "react";
import {
  Car,
  Navigation,
  MessageCircle,
  CalendarClock,
  Gift,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import pupxpressLogo from "@/assets/pupxpress-logo.png.asset.json";

interface TourSlide {
  icon: LucideIcon;
  title: string;
  description: string;
}

const SLIDES: TourSlide[] = [
  {
    icon: Car,
    title: "Door-to-door dog rides",
    description:
      "Book trusted, dog-friendly rides in seconds. Your pup travels safe, comfy and in good hands.",
  },
  {
    icon: Navigation,
    title: "Live tracking & ETA",
    description:
      "Follow every trip on the map in real time, with traffic-aware arrival times you can count on.",
  },
  {
    icon: MessageCircle,
    title: "Chat with your driver",
    description:
      "Coordinate pickups and share pet-care notes instantly with built-in ride messaging.",
  },
  {
    icon: CalendarClock,
    title: "Schedule & save favorites",
    description:
      "Plan rides ahead of time and rebook your go-to places with a single tap.",
  },
  {
    icon: Gift,
    title: "Refer, tip & earn",
    description:
      "Invite friends for ride credit, tip great drivers, and switch to driver mode to earn.",
  },
];

export function OnboardingTour({ onDone }: { onDone: () => void }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const isLast = index === SLIDES.length - 1;

  const handleScroll = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const next = Math.round(el.scrollLeft / el.clientWidth);
    setIndex(next);
  }, []);

  const goTo = useCallback((i: number) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  }, []);

  const handleNext = () => {
    if (isLast) onDone();
    else goTo(index + 1);
  };

  return (
    <div
      className="flex min-h-screen flex-col bg-background"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {/* Top bar: logo + skip */}
      <div className="flex items-center justify-between px-5 pt-4">
        <img src={pupxpressLogo.url} alt="PupXpress" className="h-9 w-auto" />
        <button
          type="button"
          onClick={onDone}
          className="rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Skip
        </button>
      </div>

      {/* Swipeable track */}
      <div
        ref={trackRef}
        onScroll={handleScroll}
        className="flex flex-1 snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {SLIDES.map((slide) => {
          const Icon = slide.icon;
          return (
            <section
              key={slide.title}
              className="flex w-full shrink-0 snap-center flex-col items-center justify-center gap-8 px-8 text-center"
            >
              <div className="relative flex items-center justify-center">
                <span
                  className="absolute h-44 w-44 rounded-full opacity-60 blur-2xl"
                  style={{ background: "var(--gradient-hero)" }}
                  aria-hidden
                />
                <div
                  className="relative flex h-36 w-36 items-center justify-center rounded-[2rem] text-primary-foreground shadow-[var(--shadow-elegant)]"
                  style={{ background: "var(--gradient-hero)" }}
                >
                  <Icon className="h-16 w-16" strokeWidth={1.6} />
                </div>
              </div>

              <div className="space-y-3">
                <h2 className="text-2xl font-bold tracking-tight text-foreground">
                  {slide.title}
                </h2>
                <p className="mx-auto max-w-xs text-base leading-relaxed text-muted-foreground">
                  {slide.description}
                </p>
              </div>
            </section>
          );
        })}
      </div>

      {/* Dots + actions */}
      <div className="flex flex-col gap-6 px-8 pb-8 pt-2">
        <div className="flex items-center justify-center gap-2">
          {SLIDES.map((slide, i) => (
            <button
              key={slide.title}
              type="button"
              aria-label={`Go to slide ${i + 1}`}
              onClick={() => goTo(i)}
              className={cn(
                "h-2 rounded-full transition-all",
                i === index ? "w-6 bg-primary" : "w-2 bg-muted-foreground/30",
              )}
            />
          ))}
        </div>

        <Button className="h-12 w-full text-base" onClick={handleNext}>
          {isLast ? "Get started" : "Next"}
        </Button>
      </div>
    </div>
  );
}
