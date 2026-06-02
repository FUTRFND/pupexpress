import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, User } from "lucide-react";

import { getMyProfile, updateMyProfile } from "@/lib/profile.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Editable name + phone form backed by the profiles table. */
export function ProfileEditor() {
  const queryClient = useQueryClient();
  const getFn = useServerFn(getMyProfile);
  const updateFn = useServerFn(updateMyProfile);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => getFn(),
  });

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? "");
      setPhone(profile.phone ?? "");
    }
  }, [profile]);

  const mutation = useMutation({
    mutationFn: (input: { full_name: string; phone: string | null }) =>
      updateFn({ data: input }),
    onSuccess: (next) => {
      queryClient.setQueryData(["my-profile"], next);
      toast.success("Profile updated");
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Couldn't save profile"),
  });

  const dirty =
    fullName.trim() !== (profile?.full_name ?? "") ||
    phone.trim() !== (profile?.phone ?? "");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <User className="size-4" /> Account details
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </div>
        ) : (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!fullName.trim()) return;
              mutation.mutate({
                full_name: fullName.trim(),
                phone: phone.trim() || null,
              });
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="profile-name">Full name</Label>
              <Input
                id="profile-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jane Doe"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="profile-phone">Phone (optional)</Label>
              <Input
                id="profile-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 123-4567"
              />
            </div>
            <Button
              type="submit"
              className="h-10 self-start"
              disabled={mutation.isPending || !dirty}
            >
              {mutation.isPending ? "Saving…" : "Save changes"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
