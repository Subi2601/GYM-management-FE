import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Navigate, useNavigate } from "react-router-dom";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { authApi } from "@/features/auth/api";
import { toApiError } from "@/lib/api-error";
import { reconcileBranch } from "@/providers/AuthProvider";
import { useAuthStore } from "@/stores/auth-store";
import { useBranchStore } from "@/stores/branch-store";

const schema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});
type FormValues = z.infer<typeof schema>;

const inputCls =
  "rounded-[14px] border-[1.5px] border-line bg-subtle px-5 py-4 text-[15px] font-medium text-ink transition-all duration-[250ms] " +
  "placeholder:text-muted focus:-translate-y-px focus:border-accent focus:bg-surface focus:shadow-[0_0_0_4px_rgba(225,29,72,0.1)] focus:outline-none";
const labelCls = "pl-1 text-[11px] font-bold uppercase tracking-[0.1em] text-secondary-grey";

export function LoginPage() {
  const navigate = useNavigate();
  const status = useAuthStore((s) => s.status);
  const [error, setError] = useState("");
  const { register, handleSubmit, formState } = useForm<FormValues>({ resolver: zodResolver(schema), mode: "onChange" });

  if (status === "authed") return <Navigate to="/" replace />;

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setError("");
    try {
      const store = useAuthStore.getState();
      const { data } = await authApi.login(email, password);
      store.setToken(data.access_token);
      const { data: me } = await authApi.me();
      store.setMe(me);
      reconcileBranch(me);
      store.setStatus("authed");
      // Owners pick a branch first (as before); trainers land on their branch directly.
      const needsBranchChoice = me.can_switch_branch && useBranchStore.getState().selectedBranchId === undefined;
      navigate(needsBranchChoice ? "/branch-selection" : "/", { replace: true });
    } catch (e) {
      setError(toApiError(e).message || "Invalid email or password");
    }
  });

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-subtle bg-[radial-gradient(at_0%_0%,rgba(225,29,72,0.05)_0px,transparent_50%),radial-gradient(at_100%_0%,rgba(30,41,59,0.05)_0px,transparent_50%),radial-gradient(at_100%_100%,rgba(225,29,72,0.05)_0px,transparent_50%),radial-gradient(at_0%_100%,rgba(30,41,59,0.05)_0px,transparent_50%)] p-5 max-[480px]:bg-surface max-[480px]:p-0">
      <div className="absolute -left-[100px] -top-[100px] z-0 h-[400px] w-[400px] rounded-full bg-accent opacity-40 blur-[80px] max-[480px]:hidden" />
      <div className="absolute -bottom-[100px] -right-[100px] z-0 h-[400px] w-[400px] rounded-full bg-primary-grey opacity-40 blur-[80px] max-[480px]:hidden" />

      <div className="relative z-[1] w-full max-w-[440px] animate-slideUp rounded-3xl border border-line/80 bg-surface/90 px-12 py-14 shadow-[0_20px_25px_-5px_rgba(0,0,0,0.15),0_10px_10px_-5px_rgba(0,0,0,0.06)] backdrop-blur-[12px] max-[480px]:flex max-[480px]:min-h-screen max-[480px]:max-w-none max-[480px]:flex-col max-[480px]:justify-center max-[480px]:rounded-none max-[480px]:border-none max-[480px]:px-6 max-[480px]:py-10">
        <div className="mb-10 text-center">
          <div className="mb-3 flex items-center justify-center gap-3 text-[28px] font-extrabold tracking-[-1px] text-ink">
            <div className="h-8 w-2.5 rounded-md bg-gradient-to-br from-accent to-[#be123c] shadow-[0_4px_12px_rgba(225,29,72,0.3)]" />
            STAG <strong className="bg-gradient-to-br from-accent to-[#be123c] bg-clip-text text-transparent">FITNESS</strong>
          </div>
          <p className="m-0 text-[15px] font-medium tracking-[-0.01em] text-muted">Management Portal Access</p>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-7" noValidate>
          {error && (
            <div role="alert" className="flex items-center gap-2.5 rounded-xl border border-[rgba(251,113,133,0.3)] bg-accent-light px-[18px] py-3.5 text-sm font-semibold text-accent">
              <Icon name="alert" strokeWidth={2.5} />
              {error}
            </div>
          )}
          <div className="flex flex-col gap-2.5">
            <label htmlFor="email" className={labelCls}>Email Address</label>
            <input id="email" type="email" autoComplete="username" placeholder="e.g. owner@gym.com" className={inputCls} {...register("email")} />
          </div>
          <div className="flex flex-col gap-2.5">
            <label htmlFor="password" className={labelCls}>Password</label>
            <input id="password" type="password" autoComplete="current-password" placeholder="••••••••" className={inputCls} {...register("password")} />
          </div>
          <div className="mt-2">
            <Button type="submit" className="w-full" disabled={!formState.isValid} loading={formState.isSubmitting}>
              Authenticate
            </Button>
          </div>
        </form>

        <div className="mt-12 border-t border-[rgba(241,245,249,0.8)] pt-8 text-center text-[13px] font-medium text-muted">
          <p className="my-1.5 opacity-80">&copy; {new Date().getFullYear()} STAG FITNESS Systems</p>
          <p className="my-1.5 opacity-80">Secure Enterprise Session</p>
        </div>
      </div>
    </div>
  );
}
