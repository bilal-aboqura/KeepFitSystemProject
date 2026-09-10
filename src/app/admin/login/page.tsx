import { Suspense } from "react";
import { LoginForm } from "./login-form";

export default function AdminLoginPage() {
  return (
    <div className="admin-light min-h-dvh bg-ink text-fg">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
