import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { credentialsText } from "@/features/staff/lib/staff-login";
import { notify } from "@/lib/notify";
import { openWhatsApp } from "@/lib/utils";

export interface Credentials {
  name: string;
  phone: string;
  email: string;
  password: string;
  branch: string;
}

/**
 * Shown once after a login is created or its password reset — the owner copies it or sends it on WhatsApp.
 * The password isn't stored readable anywhere, so this is the moment to share it (or reset again later).
 */
export function LoginCredentialsModal({ creds, onClose }: { creds: Credentials; onClose: () => void }) {
  const text = credentialsText({ ...creds, url: `${window.location.origin}/login` });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      notify.success("Login details copied");
    } catch {
      notify.errorText("Couldn't copy. Select the details and copy them manually");
    }
  };

  const row = (label: string, value: string, mono = false) => (
    <div className="flex items-center justify-between gap-4 border-b border-line-light px-4 py-3 last:border-b-0">
      <span className="text-[13px] font-semibold text-muted">{label}</span>
      <span className={mono ? "select-all font-mono text-[15px] font-bold text-ink" : "text-sm font-semibold text-ink"}>{value}</span>
    </div>
  );

  return (
    <Modal
      open
      title="Login ready"
      subtitle={`Share these with ${creds.name}. You can reset the password any time from the staff page.`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" icon={<Icon name="clipboard" className="h-4 w-4" />} onClick={() => void copy()}>Copy</Button>
          <button type="button" onClick={() => openWhatsApp(creds.phone, text)}
            className="inline-flex cursor-pointer items-center gap-2 rounded-lg border-0 bg-success px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90">
            <Icon name="whatsapp" className="h-4 w-4" /> Send on WhatsApp
          </button>
          <Button onClick={onClose}>Done</Button>
        </>
      }
    >
      <div className="overflow-hidden rounded-xl border border-line bg-subtle">
        {row("Login ID", creds.email, true)}
        {row("Password", creds.password, true)}
        {row("Branch", creds.branch)}
      </div>
      <p className="m-0 mt-3 text-xs text-muted">
        They'll only see {creds.branch}'s data. You can sign in with these details to check what they see.
      </p>
    </Modal>
  );
}
