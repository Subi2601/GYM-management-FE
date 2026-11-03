import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useParams, useSearchParams } from "react-router-dom";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Icon, type IconName } from "@/components/ui/Icon";
import { checkinApi, formatClock, formatDuration } from "@/features/attendance/api";
import { toApiError } from "@/lib/api-error";
import { cn } from "@/lib/utils";
import type { CheckResult } from "@/types/attendance";

type Direction = "in" | "out";

const verifySchema = z.object({
  phone: z.string().trim().regex(/^\d{10}$/, "Enter your 10-digit mobile number"),
  id_number: z.string().trim().min(1, "Enter your member / staff ID").max(20),
});
type VerifyValues = z.infer<typeof verifySchema>;

type Outcome =
  | { kind: "success"; result: CheckResult; message: string }
  | { kind: "error"; message: string };

interface Position {
  latitude: number;
  longitude: number;
  accuracy: number;
}

function getPosition(): Promise<Position> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("This browser can't share its location. Ask the front desk"));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy }),
      (err) => reject(new Error(err.code === err.PERMISSION_DENIED
        ? "Location is blocked. Allow location for this site in your browser settings, then scan again"
        : "Couldn't get your location. Turn on GPS and scan again")),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 },
    );
  });
}

/**
 * /checkin/:token?type=in|out — opened by scanning a branch poster (no login, phone-sized).
 * First scan on a phone: verify phone number + ID once. After that the scan checks in / out straight away.
 */
export function CheckinPage() {
  const { token = "" } = useParams<{ token: string }>();
  const [params] = useSearchParams();
  const direction: Direction = params.get("type") === "out" ? "out" : "in";
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [phase, setPhase] = useState<"idle" | "locating" | "saving">("idle");
  const autoRan = useRef(false);

  const info = useQuery({ queryKey: ["checkin", token], queryFn: () => checkinApi.info(token), retry: false });
  const details = info.data?.data;

  const scan = useCallback(async () => {
    if (!details) return;
    setOutcome(null);
    try {
      let position: Position | undefined;
      if (details.location_required) {
        setPhase("locating");
        position = await getPosition();
      }
      setPhase("saving");
      const res = await checkinApi.scan(token, { direction, ...position });
      setOutcome({ kind: "success", result: res.data, message: res.message ?? "" });
    } catch (err) {
      setOutcome({ kind: "error", message: err instanceof Error && !("status" in err) ? err.message : toApiError(err).message });
    } finally {
      setPhase("idle");
    }
  }, [details, token, direction]);

  // A linked phone checks in / out as soon as the poster is scanned.
  useEffect(() => {
    if (details?.person && !autoRan.current) {
      autoRan.current = true;
      void scan();
    }
  }, [details, scan]);

  const verify = useMutation({
    mutationFn: (v: VerifyValues) => checkinApi.verify(token, v),
    onSuccess: async () => {
      await info.refetch();
      autoRan.current = true;
      await scan();
    },
  });

  const title = direction === "in" ? "Check in" : "Check out";

  return (
    <div className="flex min-h-screen flex-col items-center bg-main px-4 py-8">
      <div className="w-full max-w-[420px]">
        <div className="mb-6 flex items-center justify-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-grad font-display text-xl text-white">S</div>
          <span className="font-display text-2xl uppercase tracking-wide text-ink">Stag Fitness</span>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-6 shadow-premium">
          {info.isLoading && <Busy text="Opening…" />}

          {info.isError && (
            <Result tone="danger" icon="alert" title="QR not recognised" message={toApiError(info.error).message} />
          )}

          {details && (
            <>
              <div className="mb-5 text-center">
                <div className="text-xs font-bold uppercase tracking-[0.12em] text-muted">{details.branch_name}</div>
                <h1 className="m-0 mt-1 inline-flex items-center gap-2 font-display text-3xl uppercase tracking-wide text-ink">
                  <Icon name={direction === "in" ? "logIn" : "logOut"} className="h-6 w-6 text-accent" />
                  {title}
                </h1>
                {details.person && (
                  <p className="m-0 mt-1 text-sm text-muted">This phone is linked to <b className="text-ink">{details.person.name}</b></p>
                )}
              </div>

              {phase !== "idle" && <Busy text={phase === "locating" ? "Checking you're at the gym…" : "Saving…"} />}

              {phase === "idle" && outcome?.kind === "success" && (
                <Result tone="success" icon={outcome.result.direction === "IN" ? "logIn" : "logOut"}
                  title={`${outcome.result.direction === "IN" ? "Checked in" : "Checked out"} · ${formatClock(outcome.result.time)}`}
                  message={outcome.result.direction === "IN"
                    ? `Welcome, ${outcome.result.name}.${outcome.result.late ? " You're marked late today." : " Have a great workout!"}`
                    : `You were in for ${formatDuration(outcome.result.duration_minutes)}. See you next time, ${outcome.result.name}.`} />
              )}

              {phase === "idle" && outcome?.kind === "error" && (
                <>
                  <Result tone="danger" icon="ban" title="Couldn't mark attendance" message={outcome.message} />
                  {details.person && (
                    <Button className="mt-5 w-full justify-center" onClick={() => void scan()}>Try again</Button>
                  )}
                </>
              )}

              {phase === "idle" && !details.person && !outcome && (
                <VerifyForm pending={verify.isPending} error={verify.error ? toApiError(verify.error).message : undefined}
                  onSubmit={(v) => verify.mutate(v)} />
              )}
            </>
          )}
        </div>

        <p className="mt-5 text-center text-xs text-muted">
          {details?.person ? "Not you? Ask the front desk to unlink this phone." : "Having trouble? Ask the front desk to mark your attendance."}
        </p>
      </div>
    </div>
  );
}

function VerifyForm({ pending, error, onSubmit }: {
  pending: boolean; error?: string; onSubmit: (v: VerifyValues) => void;
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<VerifyValues>({
    resolver: zodResolver(verifySchema),
    defaultValues: { phone: "", id_number: "" },
  });
  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      <div className="flex items-start gap-3 rounded-xl bg-info-soft px-4 py-3 text-[13px] text-info">
        <Icon name="smartphone" className="mt-0.5 h-4 w-4" />
        <span>First time on this phone? Verify once. Next time, just scan.</span>
      </div>
      <Field label="Mobile number" htmlFor="ci-phone" required error={errors.phone?.message}>
        <Input id="ci-phone" inputMode="numeric" autoComplete="tel" maxLength={10} placeholder="10-digit mobile"
          invalid={!!errors.phone} {...register("phone")} />
      </Field>
      <Field label="Member / staff ID" htmlFor="ci-id" required error={errors.id_number?.message}>
        <Input id="ci-id" autoComplete="off" maxLength={20} placeholder="e.g. 42 for SG-042" invalid={!!errors.id_number}
          {...register("id_number")} />
      </Field>
      {error && <p className="m-0 rounded-lg bg-danger-soft px-3 py-2 text-[13px] font-semibold text-danger">{error}</p>}
      <Button type="submit" loading={pending} className="w-full justify-center">Verify and continue</Button>
    </form>
  );
}

function Busy({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-sm font-semibold text-muted">
      <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-line border-t-accent" />
      {text}
    </div>
  );
}

function Result({ tone, icon, title, message }: { tone: "success" | "danger"; icon: IconName; title: string; message: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-4 text-center">
      <span className={cn("flex h-16 w-16 items-center justify-center rounded-full",
        tone === "success" ? "bg-success-soft text-success" : "bg-danger-soft text-danger")}>
        <Icon name={icon} className="h-8 w-8" />
      </span>
      <div className="text-lg font-extrabold text-ink">{title}</div>
      <p className="m-0 text-sm text-secondary-grey">{message}</p>
    </div>
  );
}
