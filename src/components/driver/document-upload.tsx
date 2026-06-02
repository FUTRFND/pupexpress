import { useEffect, useRef, useState } from "react";
import { Loader2, Upload, Check, FileText, X } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const BUCKET = "driver-documents";
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ACCEPT = "image/png,image/jpeg,image/webp,application/pdf";

/**
 * Uploads a single document/photo to the private driver-documents bucket under
 * the signed-in user's folder, and reports back the storage path. Renders a
 * preview (signed URL) once a file is stored. RLS enforces per-user access.
 */
export function DocumentUpload({
  label,
  kind,
  value,
  onChange,
}: {
  label: string;
  kind: string;
  value: string | null;
  onChange: (path: string | null) => void;
}) {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Resolve a signed preview URL whenever a stored path exists.
  useEffect(() => {
    let active = true;
    if (!value) {
      setPreviewUrl(null);
      return;
    }
    supabase.storage
      .from(BUCKET)
      .createSignedUrl(value, 3600)
      .then(({ data }) => {
        if (active) setPreviewUrl(data?.signedUrl ?? null);
      });
    return () => {
      active = false;
    };
  }, [value]);

  const handleFile = async (file: File) => {
    setError(null);
    if (!user) {
      setError("You must be signed in.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("File is too large (max 10 MB).");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
      const path = `${user.id}/${kind}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;
      onChange(path);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const isPdf = value?.toLowerCase().endsWith(".pdf");

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{label}</span>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />

      {value ? (
        <div className="flex items-center gap-3 rounded-lg border p-2">
          {isPdf ? (
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-muted">
              <FileText className="size-6 text-muted-foreground" />
            </span>
          ) : previewUrl ? (
            <img
              src={previewUrl}
              alt={label}
              className="h-14 w-14 shrink-0 rounded-md object-cover"
            />
          ) : (
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-muted">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </span>
          )}
          <span className="flex flex-1 items-center gap-1.5 text-sm text-emerald-600">
            <Check className="size-4" /> Uploaded
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onChange(null)}
            aria-label={`Remove ${label}`}
          >
            <X className="size-4" />
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          className={cn("h-11 justify-start", error && "border-destructive")}
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Uploading…
            </>
          ) : (
            <>
              <Upload className="size-4" /> Upload {label.toLowerCase()}
            </>
          )}
        </Button>
      )}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
