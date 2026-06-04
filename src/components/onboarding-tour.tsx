import { useRef, useState, useCallback } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import pupxpressLogo from "@/assets/pupxpress-logo.png.asset.json";
import tourRides from "@/assets/tour-rides.jpg.asset.json";
import tourTracking from "@/assets/tour-tracking.jpg.asset.json";
import tourChat from "@/assets/tour-chat.jpg.asset.json";
import tourSchedule from "@/assets/tour-schedule.jpg.asset.json";
import tourRefer from "@/assets/tour-refer.jpg.asset.json";

interface TourSlide {
  image: string;
  title: string;
  description: string;
}

const SLIDES: TourSlide[] = [
  {
    image: tourRides.url,
    title: "Door-to-door dog rides",
    description:
      "Book trusted, dog-friendly rides in seconds. Your pup travels safe, comfy and in good hands.",
  },
  {
    image: tourTracking.url,
    title: "Live tracking & ETA",
    description:
      "Follow every trip on the map in real time, with traffic-aware arrival times you can count on.",
  },
  {
    image: tourChat.url,
    title: "Chat with your driver",
    description:
      "Coordinate pickups and share pet-care notes instantly with built-in ride messaging.",
  },
  {
    image: tourSchedule.url,
    title: "Schedule & save favorites",
    description:
      "Plan rides ahead of time and rebook your go-to places with a single tap.",
  },
  {
    image: tourRefer.url,
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
          return (
            <section
              key={slide.title}
              className="flex w-full shrink-0 snap-center flex-col items-center justify-center gap-8 px-8 text-center"
            >
              <div className="relative flex items-center justify-center">
                <span
                  className="absolute -inset-3 rounded-[2.75rem] opacity-50 blur-2xl"
                  style={{ background: "var(--gradient-hero)" }}
                  aria-hidden
                />
                <div className="relative h-64 w-64 overflow-hidden rounded-[2.25rem] shadow-[var(--shadow-elegant)] ring-1 ring-border/50">
                  <img
                    src={slide.image}
                    alt={slide.title}
                    width={1024}
                    height={1024}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
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
