import { useEffect, useState, type RefObject } from "react";

import type { Invoice } from "@/types/payment";

/**
 * A4 PDF of a rendered invoice sheet (what the member receives on WhatsApp). The PDF libraries load only when
 * an invoice is shared, so they never weigh on the rest of the app.
 */
export async function invoicePdfFile(node: HTMLElement, receiptNo: string): Promise<File> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);
  await document.fonts?.ready;
  // windowWidth: lay the copy out at desktop width so a phone / narrow window still gets the A4 design,
  // not the sheet's small-screen layout.
  const canvas = await html2canvas(node, { scale: 2, backgroundColor: "white", useCORS: true, logging: false,
    windowWidth: 1280 });
  const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const pageW = 210;
  const pageH = 297;
  const imgH = (canvas.height * pageW) / canvas.width;
  const image = canvas.toDataURL("image/jpeg", 0.92);
  if (imgH <= pageH * 1.3) {
    // Normal invoice: one page (shrunk a little if it runs over, centred).
    const scale = Math.min(1, pageH / imgH);
    const w = pageW * scale;
    pdf.addImage(image, "JPEG", (pageW - w) / 2, 0, w, imgH * scale);
  } else {
    // Long invoice (many lines): continue on extra pages.
    for (let offset = 0; offset < imgH - 0.5; offset += pageH) {
      if (offset > 0) pdf.addPage();
      pdf.addImage(image, "JPEG", 0, -offset, pageW, imgH);
    }
  }
  return new File([pdf.output("blob")], `Invoice-${receiptNo}.pdf`, { type: "application/pdf" });
}

/**
 * Builds the PDF as soon as the sheet is on screen, so the WhatsApp click can share it straight away
 * (browsers only open the share sheet / a new tab right after a click, not after a slow async step).
 */
export function useInvoicePdf(invoice: Invoice | undefined, sheetRef: RefObject<HTMLElement>) {
  const [pdf, setPdf] = useState<File | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!invoice || !sheetRef.current) return;
    let cancelled = false;
    setPdf(null);
    setFailed(false);
    const node = sheetRef.current;
    const id = window.setTimeout(() => {
      invoicePdfFile(node, invoice.receipt_no)
        .then((file) => { if (!cancelled) setPdf(file); })
        .catch(() => { if (!cancelled) setFailed(true); });
    }, 300);   // let the sheet paint (fonts, layout) first
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [invoice, sheetRef]);

  return { pdf, failed };
}
