import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import QRCode from "qrcode";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { confirm } from "@/components/ui/ConfirmDialog";
import { Input } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { enquiryKeys, enquiryLinkApi, enquiryUrl } from "@/features/leads/enquiry-api";
import { escapeHtml } from "@/features/payments/collection-report";
import { useWriteAccess } from "@/hooks/use-write-access";
import { notify } from "@/lib/notify";
import { useBranchStore } from "@/stores/branch-store";

const isLocalHost = ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname);

/**
 * The branch's public enquiry form: link + QR to share on WhatsApp / Instagram / a printed poster.
 * Every submit lands in this branch's Leads (source "Enquiry form"). Regenerate makes old links stop working.
 */
export function EnquiryLinkModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const branch = useBranchStore((s) => s.selectedBranchId);
  const regen = useWriteAccess("lead:create");
  const link = useQuery({
    queryKey: enquiryKeys.link(branch),
    queryFn: async () => (await enquiryLinkApi.get()).data,
    enabled: !!branch,
  });
  const url = link.data ? enquiryUrl(link.data.token) : "";
  const [qr, setQr] = useState<string>();
  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    void QRCode.toDataURL(url, { width: 640, margin: 1, errorCorrectionLevel: "M" }).then((img) => {
      if (!cancelled) setQr(img);
    });
    return () => {
      cancelled = true;
    };
  }, [url]);

  const regenerate = useMutation({
    mutationFn: enquiryLinkApi.regenerate,
    onSuccess: async (res) => {
      notify.success(res.message);
      await qc.invalidateQueries({ queryKey: enquiryKeys.link(branch) });
    },
    onError: notify.error,
  });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      notify.success("Link copied");
    } catch {
      notify.errorText("Couldn't copy. Select the link and copy it manually");
    }
  };

  const share = () => {
    const text = `Thinking of joining ${link.data?.branch_name ?? "our gym"}? Leave your details here and we'll call you with plans and offers:\n${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  };

  const print = () => {
    if (!qr || !link.data) return;
    const win = window.open("", "_blank", "width=900,height=1000");
    if (!win) return notify.errorText("Allow pop-ups to print the poster");
    win.document.write(`<!doctype html><html><head><title>Enquiry QR · ${escapeHtml(link.data.branch_name)}</title>
      <style>
        body{margin:0;font-family:Arial,Helvetica,sans-serif;color:black;background:white}
        section{height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
        h1{font-size:60px;letter-spacing:3px;margin:8px 0 20px}
        img{width:62vmin;height:62vmin}
        .org{font-size:22px;font-weight:bold;text-transform:uppercase;letter-spacing:3px;margin:0}
        .hint{font-size:26px;margin:22px 0 8px}.small{font-size:16px;color:dimgray;margin:0}
      </style></head><body><section>
        <p class="org">${escapeHtml(link.data.branch_name)}</p>
        <h1>JOIN US</h1>
        <img src="${qr}" alt="Enquiry QR" />
        <p class="hint">Scan to get plans &amp; offers</p>
        <p class="small">Leave your name and number, we'll call you.</p>
      </section></body></html>`);
    win.document.close();
    win.onload = () => win.print();
  };

  return (
    <Modal
      open
      title="Enquiry form"
      subtitle={link.data ? `${link.data.branch_name} · every enquiry lands here in Leads` : "Public form for new enquiries"}
      onClose={onClose}
      width="620px"
      footer={<Button variant="secondary" onClick={onClose}>Close</Button>}
    >
      {!branch ? (
        <p className="m-0 text-sm text-muted">Select a branch in the sidebar: each branch has its own enquiry link.</p>
      ) : link.isLoading ? (
        <p className="m-0 text-sm text-muted">Loading…</p>
      ) : link.isError ? (
        <p className="m-0 text-sm text-danger">{link.error.message}</p>
      ) : (
        <div className="flex flex-col gap-4">
          {isLocalHost && (
            <div className="flex items-start gap-3 rounded-xl border border-warning-line bg-warning-soft px-4 py-3 text-[13px] text-warning">
              <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
              <span>You're on <b>localhost</b>: this link opens only on this computer. Phones on the same Wi-Fi need this
                computer's network address; customers need the hosted site.</span>
            </div>
          )}
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <div className="shrink-0 rounded-2xl border border-line bg-white p-3">
              {qr ? <img src={qr} alt="Enquiry form QR" className="h-44 w-44" /> : <div className="h-44 w-44" />}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <p className="m-0 text-sm text-secondary-grey">
                Share this link on WhatsApp, Instagram or your website, or print the QR for the reception. People fill
                their name and number; they show up in <b className="text-ink">Leads</b> as <b className="text-ink">New</b>, to call today.
              </p>
              <div className="flex gap-2">
                <Input value={url} readOnly onFocus={(e) => e.target.select()} aria-label="Enquiry form link" />
                <Button variant="secondary" icon={<Icon name="clipboard" className="h-4 w-4" />} onClick={() => void copy()}>Copy</Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button icon={<Icon name="whatsapp" className="h-4 w-4" />} onClick={share}>Share on WhatsApp</Button>
                <Button variant="secondary" icon={<Icon name="print" className="h-4 w-4" />} disabled={!qr} onClick={print}>Print poster</Button>
                {qr && (
                  <a href={qr} download={`enquiry-qr-${link.data?.branch_name ?? "branch"}.png`}
                    className="inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2 text-sm font-semibold text-ink no-underline hover:border-line-accent">
                    <Icon name="download" className="h-4 w-4" />QR image
                  </a>
                )}
                <a href={url} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-2 px-2 py-2 text-sm font-semibold text-accent no-underline">
                  <Icon name="eye" className="h-4 w-4" />Open form
                </a>
              </div>
            </div>
          </div>
          {regen.show && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3 text-xs text-muted">
              <span>Getting spam? Make a new link; the old link and posters stop working.</span>
              <span title={regen.reason}>
                <Button variant="secondary" className="h-8 px-3 py-0 text-xs" disabled={regen.disabled} loading={regenerate.isPending}
                  onClick={async () => {
                    if (await confirm("Make a new enquiry link? The current link and printed posters will stop working.")) regenerate.mutate();
                  }}>
                  New link
                </Button>
              </span>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
