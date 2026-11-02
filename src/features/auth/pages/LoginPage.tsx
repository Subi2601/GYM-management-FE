import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Navigate, useNavigate } from "react-router-dom";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
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

const inputCls = "form-control min-h-[46px] text-[15px]";
const labelCls = "form-label";

export function LoginPage() {
  const navigate = useNavigate();
  const status = useAuthStore((s) => s.status);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
    // overflow-clip (not hidden): the glow blobs must not make this a scroll box that focus can shift.
    <div className="relative flex min-h-screen items-center justify-center overflow-clip p-5 max-[480px]:bg-surface max-[480px]:p-0">
      <div className="absolute -left-[120px] -top-[120px] z-0 h-[420px] w-[420px] rounded-full bg-accent opacity-[0.14] blur-[90px] max-[480px]:hidden" />
      <div className="absolute -bottom-[120px] -right-[120px] z-0 h-[420px] w-[420px] rounded-full bg-line-accent opacity-50 blur-[90px] max-[480px]:hidden" />
      <ThemeToggle className="absolute right-5 top-5 z-[2]" />

      <div className="relative z-[1] w-full max-w-[440px] animate-slideUp rounded-3xl border border-line bg-surface/90 px-12 py-14 shadow-modal backdrop-blur-[12px] max-[480px]:flex max-[480px]:min-h-screen max-[480px]:max-w-none max-[480px]:flex-col max-[480px]:justify-center max-[480px]:rounded-none max-[480px]:border-none max-[480px]:px-6 max-[480px]:py-10">
        <div className="mb-10 text-center">
          <div className="mb-3 flex items-center justify-center gap-3 font-display text-[34px] font-bold uppercase leading-none tracking-[0.5px] text-ink">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-grad text-[22px] text-white shadow-glow">S</div>
            Stag <span className="text-gradient">Fitness</span>
          </div>
          <p className="m-0 text-[15px] font-medium tracking-[-0.01em] text-muted">Management Portal Access</p>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-7" noValidate>
          {error && (
            <div role="alert" className="flex items-center gap-2.5 rounded-xl border border-line-accent bg-accent-light px-[18px] py-3.5 text-sm font-semibold text-accent">
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
            <div className="relative">
              <input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password"
                placeholder="••••••••" className={`${inputCls} pr-12`} {...register("password")} />
              <button type="button" onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword}
                title={showPassword ? "Hide password" : "Show password"}
                className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg border-none bg-transparent text-muted transition-colors hover:bg-hover hover:text-ink">
                <Icon name={showPassword ? "eyeOff" : "eye"} className="h-[18px] w-[18px]" />
              </button>
            </div>
          </div>
          <div className="mt-2">
            <Button type="submit" className="w-full" disabled={!formState.isValid} loading={formState.isSubmitting}>
              Sign in
            </Button>
          </div>
        </form>

        <div className="mt-12 border-t border-line-light pt-8 text-center text-[13px] font-medium text-muted">
          <p className="my-1.5 opacity-80">&copy; {new Date().getFullYear()} STAG FITNESS Systems</p>
          <p className="my-1.5 opacity-80">Secure Enterprise Session</p>
        </div>
      </div>
    </div>
  );
}
