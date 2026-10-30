import { Component, type ErrorInfo, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/Button";

interface ErrorLayoutProps {
  code: string;
  message: string;
  actions: ReactNode;
}

function ErrorLayout({ code, message, actions }: ErrorLayoutProps) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <div className="text-[72px] font-extrabold leading-none tracking-[-2px] text-accent">{code}</div>
      <p className="m-0 text-base font-semibold text-secondary-grey">{message}</p>
      <div className="mt-2 flex gap-3">{actions}</div>
    </div>
  );
}

export function ForbiddenPage() {
  const navigate = useNavigate();
  return <ErrorLayout code="403" message="You don't have permission to view this page."
    actions={<Button onClick={() => navigate("/", { replace: true })}>Go to Home</Button>} />;
}

export function NotFoundPage() {
  const navigate = useNavigate();
  return <ErrorLayout code="404" message="This page doesn't exist."
    actions={<Button onClick={() => navigate("/", { replace: true })}>Go to Home</Button>} />;
}

export function SessionExpiredPage() {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-screen items-center justify-center bg-subtle">
      <ErrorLayout code="401" message="Your session has expired."
        actions={<Button onClick={() => navigate("/login", { replace: true })}>Sign In</Button>} />
    </div>
  );
}

interface BoundaryState {
  failed: boolean;
}

/** Render crashes show a 500 screen instead of a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  state: BoundaryState = { failed: false };

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("UI crash", error.message, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="flex min-h-screen items-center justify-center bg-subtle">
        <ErrorLayout code="500" message="Something went wrong on our side."
          actions={<>
            <Button variant="secondary" onClick={() => window.location.reload()}>Reload</Button>
            <Button onClick={() => window.location.assign("/")}>Go to Home</Button>
          </>} />
      </div>
    );
  }
}
