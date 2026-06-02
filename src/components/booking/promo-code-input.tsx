import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Tag, Check, X, Loader2 } from "lucide-react";

import { validatePromoCode } from "@/lib/referrals.functions";
import { cn } from "@/lib/utils";

export interface PromoState {
  code: string;
  valid: boolean;
}

/**
 * Debounced, server-validated promo/referral code field.
 * Reports the validated code (uppercased) to the parent only when valid.
 */
export function PromoCodeInput({
  onValidatedChange,
}: {
  onValidatedChange?: (state: PromoState | null) => void;
}) {
  const validateFn = useServerFn(validatePromoCode);
  const [code, setCode] = useState("");
  const [valid, setValid] = useState<boolean | null>(null);
  const [validating, setValidating] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setValid(null);
      setMessage("");
      onValidatedChange?.(null);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setValidating(true);
      try {
        const result = await validateFn({ data: { code: trimmed } });
        if (cancelled) return;
        setValid(result.valid);
        setMessage(result.message);
        onValidatedChange?.(result.valid ? { code: trimmed, valid: true } : null);
      } catch {
        if (cancelled) return;
        setValid(false);
        setMessage("Unable to validate code");
        onValidatedChange?.(null);
      } finally {
        if (!cancelled) setValidating(false);
      }
    }, 500);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">Have a promo code?</span>
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg border px-3 transition-colors",
          valid === true && "border-emerald-500",
          valid === false && "border-destructive",
        )}
      >
        <Tag
          className={cn(
            "size-4 shrink-0",
            valid === true
              ? "text-emerald-500"
              : valid === false
                ? "text-destructive"
                : "text-muted-foreground",
          )}
        />
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Enter code (e.g. PUPX-A7B2)"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          maxLength={20}
          className="h-11 flex-1 bg-transparent text-sm uppercase outline-none placeholder:normal-case placeholder:text-muted-foreground"
        />
        {validating ? (
          <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
        ) : valid === true ? (
          <Check className="size-4 shrink-0 text-emerald-500" />
        ) : valid === false ? (
          <X className="size-4 shrink-0 text-destructive" />
        ) : null}
      </div>
      {message ? (
        <p
          className={cn(
            "text-xs",
            valid ? "text-emerald-600" : "text-destructive",
          )}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
