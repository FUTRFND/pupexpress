import { CalendarClock } from "lucide-react";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

/** Format a Date into the value a datetime-local input expects (local time). */
function toLocalInputValue(date: Date): string {
  const tzOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
}

/**
 * Lets a rider choose to book now or schedule a ride for a future time.
 * `value` is the local datetime-local string (or null for "ride now").
 */
export function ScheduleRidePicker({
  enabled,
  value,
  onToggle,
  onChange,
}: {
  enabled: boolean;
  value: string;
  onToggle: (enabled: boolean) => void;
  onChange: (value: string) => void;
}) {
  // Minimum selectable time: 15 minutes from now, rounded for nicer UX.
  const min = toLocalInputValue(new Date(Date.now() + 15 * 60 * 1000));

  return (
    <div className="flex flex-col gap-3 rounded-xl border p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarClock className="size-4 text-primary" />
          <span className="text-sm font-medium">Schedule for later</span>
        </div>
        <Switch checked={enabled} onCheckedChange={onToggle} />
      </div>
      {enabled ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="scheduled-for" className="text-xs text-muted-foreground">
            Pickup time
          </Label>
          <Input
            id="scheduled-for"
            type="datetime-local"
            className="h-11"
            min={min}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          We'll match you with a driver right away.
        </p>
      )}
    </div>
  );
}
