import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { confirm } from "@/components/ui/ConfirmDialog";
import { ActionGroup, ActionIcon, DataTable } from "@/components/ui/DataTable";
import { Field, Input } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { PageLoader } from "@/components/ui/Loaders";
import { PageHeader } from "@/components/ui/PageHeader";
import { GRID_3, Section } from "@/components/ui/Section";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { attendanceApi, attendanceKeys } from "@/features/attendance/api";
import { formatDateTime } from "@/lib/format";
import { notify } from "@/lib/notify";
import { useBranchStore } from "@/stores/branch-store";
import type { AttendanceQr, LinkedDevice } from "@/types/attendance";

type Direction = "in" | "out";
const POSTER: Record<Direction, { title: string; hint: string }> = {
  in: { title: "CHECK IN", hint: "Scan with your phone camera when you arrive" },
  out: { title: "CHECK OUT", hint: "Scan with your phone camera when you leave" },
};

const posterUrl = (token: string, direction: Direction) =>
  `${window.location.origin}/checkin/${token}?type=${direction}`;

const isLocalHost = ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname);

/** /attendance/qr — the branch's CHECK IN / CHECK OUT posters, gym location (geofence) and linked phones. */
export function AttendanceQrPage() {
  const branch = useBranchStore((s) => s.selectedBranchId);
  const qr = useQuery({
    queryKey: attendanceKeys.qr(branch),
    queryFn: () => attendanceApi.qr(),
    enabled: branch !== null,
  });

  if (branch === null) {
    return (
      <div>
        <PageHeader title="Attendance QR" showBack />
        <p className="text-sm text-muted">Select a branch to see its QR codes.</p>
      </div>
    );
  }
  if (qr.isLoading) return <PageLoader />;
  const settings = qr.data?.data;
  if (!settings) return <p className="text-sm text-muted">{qr.error?.message ?? "Could not load the QR codes."}</p>;
  return <QrScreen settings={settings} />;
}

function QrScreen({ settings }: { settings: AttendanceQr }) {
  const qc = useQueryClient();
  const [images, setImages] = useState<Record<Direction, string>>();

  useEffect(() => {
    let cancelled = false;
    void Promise.all((["in", "out"] as const).map((d) =>
      QRCode.toDataURL(posterUrl(settings.checkin_token, d), { width: 640, margin: 1, errorCorrectionLevel: "M" })))
      .then(([inImg, outImg]) => {
        if (!cancelled && inImg && outImg) setImages({ in: inImg, out: outImg });
      });
    return () => {
      cancelled = true;
    };
  }, [settings.checkin_token]);

  const regenerate = useMutation({
    mutationFn: () => attendanceApi.regenerateQr(),
    onSuccess: async (res) => {
      notify.success(res.message);
      await qc.invalidateQueries({ queryKey: attendanceKeys.all });
    },
    onError: notify.error,
  });

  const print = (directions: Direction[]) => {
    if (!images) return;
    const win = window.open("", "_blank", "width=900,height=1000");
    if (!win) return notify.errorText("Allow pop-ups to print the posters");
    const pages = directions.map((d) => `
      <section>
        <p class="org">${escapeHtml(settings.branch_name)}</p>
        <h1>${POSTER[d].title}</h1>
        <img src="${images[d]}" alt="${POSTER[d].title} QR" />
        <p class="hint">${POSTER[d].hint}</p>
        <p class="small">First time? Enter your phone number and member / staff ID once.</p>
      </section>`).join("");
    win.document.write(`<!doctype html><html><head><title>Attendance QR · ${escapeHtml(settings.branch_name)}</title>
      <style>
        body{margin:0;font-family:Arial,Helvetica,sans-serif;color:black;background:white}
        section{height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;
          page-break-after:always;text-align:center}
        h1{font-size:72px;letter-spacing:4px;margin:8px 0 24px}
        img{width:70vmin;height:70vmin}
        .org{font-size:22px;font-weight:bold;text-transform:uppercase;letter-spacing:3px;margin:0}
        .hint{font-size:24px;margin:24px 0 8px}.small{font-size:16px;color:dimgray;margin:0}
      </style></head><body>${pages}</body></html>`);
    win.document.close();
    win.onload = () => win.print();
  };

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      notify.success("Link copied");
    } catch {
      notify.errorText("Couldn't copy. Select the link and copy it manually");
    }
  };

  return (
    <div>
      <PageHeader
        title="Attendance QR"
        subtitle={`${settings.branch_name} · staff and members scan these with their phone camera`}
        showBack
        actions={
          <>
            <Button variant="secondary" icon={<Icon name="refresh" className="h-4 w-4" />} loading={regenerate.isPending}
              onClick={async () => {
                if (await confirm("Create new QR codes? The printed posters stop working until you print the new ones.")) {
                  regenerate.mutate();
                }
              }}>
              Regenerate
            </Button>
            <Button icon={<Icon name="print" className="h-4 w-4" />} disabled={!images} onClick={() => print(["in", "out"])}>
              Print both posters
            </Button>
          </>
        }
      />

      {isLocalHost && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-warning-line bg-warning-soft px-4 py-3 text-[13px] text-warning">
          <Icon name="alert" className="mt-0.5 h-4 w-4" />
          <span>
            You're on <b>localhost</b>, so these QR codes only open on this computer. To test with a phone, open the
            app using this computer's network address (same Wi-Fi), or use the deployed site.
          </span>
        </div>
      )}

      <div className="mb-5 grid grid-cols-1 gap-5 md:grid-cols-2">
        {(["in", "out"] as const).map((d) => {
          const url = posterUrl(settings.checkin_token, d);
          return (
            <section key={d} className="flex flex-col items-center rounded-2xl border border-line bg-surface p-6 text-center shadow-subtle">
              <span className="text-xs font-bold uppercase tracking-[0.12em] text-muted">{settings.branch_name}</span>
              <h2 className="m-0 mt-1 font-display text-4xl uppercase tracking-wide text-ink">
                <Icon name={d === "in" ? "logIn" : "logOut"} className="mr-2 inline h-7 w-7 align-[-3px] text-accent" />
                {POSTER[d].title}
              </h2>
              <div className="my-4 rounded-xl bg-white p-3">
                {images ? <img src={images[d]} alt={`${POSTER[d].title} QR code`} className="h-56 w-56" />
                  : <div className="h-56 w-56 animate-pulse rounded-lg bg-hover" />}
              </div>
              <p className="m-0 text-sm text-muted">{POSTER[d].hint}</p>
              <div className="mt-4 flex w-full items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-lg bg-subtle px-3 py-2 text-left text-xs text-secondary-grey" title={url}>{url}</code>
                <Button variant="secondary" className="h-9 px-3 py-0 text-xs" onClick={() => void copy(url)}>Copy</Button>
                <Button variant="secondary" className="h-9 px-3 py-0 text-xs" disabled={!images} onClick={() => print([d])}>Print</Button>
              </div>
            </section>
          );
        })}
      </div>

      <LocationSection settings={settings} />
      <LinkedPhones />
    </div>
  );
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}

// ── gym location (geofence) ────────────────────────────────────────────

const coordinate = (min: number, max: number, label: string) => z.string().trim().refine(
  (v) => v === "" || (!Number.isNaN(Number(v)) && Number(v) >= min && Number(v) <= max), `Enter a valid ${label}`);

const locationSchema = z.object({
  latitude: coordinate(-90, 90, "latitude"),
  longitude: coordinate(-180, 180, "longitude"),
  geofence_m: z.number({ invalid_type_error: "Enter the radius" }).int("Whole metres").min(50, "At least 50 m").max(1000, "At most 1000 m"),
}).superRefine((v, ctx) => {
  if ((v.latitude === "") !== (v.longitude === "")) {
    const path = v.latitude === "" ? "latitude" : "longitude";
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message: "Enter both latitude and longitude" });
  }
});
type LocationValues = z.infer<typeof locationSchema>;

const FORM_ID = "gym-location-form";

function LocationSection({ settings }: { settings: AttendanceQr }) {
  const qc = useQueryClient();
  const [locating, setLocating] = useState(false);
  const isSet = settings.latitude !== null && settings.longitude !== null;
  const { register, handleSubmit, setValue, reset, formState: { errors, isDirty } } = useForm<LocationValues>({
    resolver: zodResolver(locationSchema),
    defaultValues: { latitude: settings.latitude?.toString() ?? "", longitude: settings.longitude?.toString() ?? "",
      geofence_m: settings.geofence_m },
  });

  const save = useMutation({
    mutationFn: (v: LocationValues) => attendanceApi.updateLocation({
      latitude: v.latitude === "" ? null : Number(v.latitude),
      longitude: v.longitude === "" ? null : Number(v.longitude),
      geofence_m: v.geofence_m,
    }),
    onSuccess: async (res) => {
      notify.success(res.message);
      const s = res.data;
      reset({ latitude: s.latitude?.toString() ?? "", longitude: s.longitude?.toString() ?? "", geofence_m: s.geofence_m });
      await qc.invalidateQueries({ queryKey: attendanceKeys.qr(s.branch_id) });
    },
    onError: notify.error,
  });

  const useHere = () => {
    if (!navigator.geolocation) return notify.errorText("This browser can't share its location");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setValue("latitude", pos.coords.latitude.toFixed(6), { shouldDirty: true, shouldValidate: true });
        setValue("longitude", pos.coords.longitude.toFixed(6), { shouldDirty: true, shouldValidate: true });
      },
      (err) => {
        setLocating(false);
        notify.errorText(err.code === err.PERMISSION_DENIED ? "Location permission was denied" : "Couldn't get the location");
      },
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  };

  return (
    <Section
      className="mb-5"
      title="Gym location"
      description="A scan counts only when the phone is within this radius of the gym. Leave empty to accept the QR from anywhere."
      aside={isSet ? <StatusBadge value="ON" tone="green" label="Location check on" />
        : <StatusBadge value="OFF" tone="amber" label="Location check off" />}
    >
      <form id={FORM_ID} onSubmit={handleSubmit((v) => save.mutate(v))} noValidate>
        <div className={GRID_3}>
          <Field label="Latitude" htmlFor="loc-lat" error={errors.latitude?.message}>
            <Input id="loc-lat" inputMode="decimal" placeholder="13.082700" invalid={!!errors.latitude} {...register("latitude")} />
          </Field>
          <Field label="Longitude" htmlFor="loc-lng" error={errors.longitude?.message}>
            <Input id="loc-lng" inputMode="decimal" placeholder="80.270700" invalid={!!errors.longitude} {...register("longitude")} />
          </Field>
          <Field label="Radius (metres)" htmlFor="loc-radius" required error={errors.geofence_m?.message}>
            <Input id="loc-radius" type="number" min={50} max={1000} step={10} invalid={!!errors.geofence_m}
              {...register("geofence_m", { valueAsNumber: true })} />
          </Field>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button variant="secondary" icon={<Icon name="mapPin" className="h-4 w-4" />} loading={locating} onClick={useHere}>
            Use this device's location
          </Button>
          <span className="text-xs text-muted">Do this from inside the gym, or copy the coordinates from Google Maps.</span>
          <div className="ml-auto flex gap-2">
            {isSet && (
              <Button variant="secondary" disabled={save.isPending}
                onClick={() => save.mutate({ latitude: "", longitude: "", geofence_m: settings.geofence_m })}>
                Turn off
              </Button>
            )}
            <Button type="submit" form={FORM_ID} loading={save.isPending} disabled={!isDirty}>Save location</Button>
          </div>
        </div>
      </form>
    </Section>
  );
}

// ── linked phones ──────────────────────────────────────────────────────

function deviceName(userAgent: string | null): string {
  if (!userAgent) return "Unknown phone";
  if (/iPhone/i.test(userAgent)) return "iPhone";
  if (/Android/i.test(userAgent)) return "Android phone";
  if (/iPad/i.test(userAgent)) return "iPad";
  return "Browser";
}

function LinkedPhones() {
  const qc = useQueryClient();
  const branch = useBranchStore((s) => s.selectedBranchId);
  const devices = useQuery({ queryKey: attendanceKeys.devices(branch), queryFn: () => attendanceApi.devices() });

  const unlink = useMutation({
    mutationFn: (id: string) => attendanceApi.unlinkDevice(id),
    onSuccess: async (res) => {
      notify.success(res.message);
      await qc.invalidateQueries({ queryKey: attendanceKeys.devices(branch) });
    },
    onError: notify.error,
  });

  const columns: ColumnDef<LinkedDevice, unknown>[] = [
    { accessorKey: "person_name", header: "Linked to",
      cell: ({ row }) => (
        <div className="min-w-0">
          <div className="truncate font-semibold text-ink">{row.original.person_name}</div>
          <div className="font-mono text-xs text-muted">{row.original.person_code}</div>
        </div>
      ) },
    { accessorKey: "person_type", header: "Type", meta: { width: "110px" },
      cell: ({ row }) => <StatusBadge value={row.original.person_type}
        tone={row.original.person_type === "STAFF" ? "purple" : "blue"} /> },
    { id: "device", header: "Phone", meta: { width: "150px" },
      cell: ({ row }) => (
        <span className="inline-flex items-center gap-1.5 text-secondary-grey">
          <Icon name="smartphone" className="h-4 w-4" />{deviceName(row.original.user_agent)}
        </span>
      ) },
    { accessorKey: "created_at", header: "Linked on", meta: { width: "160px" },
      cell: ({ row }) => formatDateTime(row.original.created_at) },
    { accessorKey: "last_used_at", header: "Last scan", meta: { width: "160px" },
      cell: ({ row }) => formatDateTime(row.original.last_used_at) },
    { id: "actions", header: "Actions", meta: { width: "100px" },
      cell: ({ row }) => (
        <ActionGroup>
          <ActionIcon kind="delete" title="Unlink phone"
            onClick={async () => {
              if (await confirm(`Unlink ${row.original.person_name}'s phone? They'll verify again on their next scan.`)) {
                unlink.mutate(row.original.id);
              }
            }} />
        </ActionGroup>
      ) },
  ];

  return (
    <DataTable
      columns={columns}
      data={devices.data?.data ?? []}
      loading={devices.isLoading}
      fetching={devices.isFetching}
      getRowId={(d) => d.id}
      emptyIcon="smartphone"
      emptyMessage="No phones linked yet"
      emptyHint="A phone is linked the first time someone scans a poster and verifies their phone number and ID."
      toolbar={
        <div className="flex items-center justify-between gap-3 border-b border-line px-6 py-4">
          <div>
            <h3 className="m-0 text-[15px] font-bold text-ink">Linked phones</h3>
            <p className="m-0 mt-0.5 text-[13px] text-muted">One phone per person. Unlink a lost phone, or one that someone else needs to use.</p>
          </div>
          {devices.data && <span className="tab-count">{devices.data.data.length}</span>}
        </div>
      }
    />
  );
}
