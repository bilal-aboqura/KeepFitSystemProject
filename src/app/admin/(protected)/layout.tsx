import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Store } from "lucide-react";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { AdminSidebar } from "@/components/admin/sidebar";
import { LogoutButton } from "@/components/admin/logout-button";
import { SetupNotice } from "@/components/admin/setup-notice";
import { ToastProvider } from "@/components/admin/toast";

export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return <SetupNotice />;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) redirect("/admin/login?error=notadmin");

  return (
    <ToastProvider>
      <div className="admin-light min-h-[calc(100dvh-72px)] bg-ink text-fg">
        <header className="sticky top-0 z-40 border-b border-border bg-white/88 backdrop-blur-xl">
          <div className="mx-auto flex h-[72px] max-w-[1680px] items-center justify-between px-5 lg:px-8">
          <Link href="/admin" className="flex items-center gap-3">
            <Image 
              src="/logo.png" 
              alt="Xeemo" 
              width={120} 
              height={32} 
              className="h-8 w-auto object-contain brightness-0"
            />
            <div className="hidden min-w-0 sm:block">
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-fg">Xeemo</span>
                <span className="pill pill-info text-[10px]">Admin</span>
              </div>
              <p className="text-xs text-fg-dim">Store operations, catalog, and content</p>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-1.5 rounded-xl border border-border bg-white px-3 py-2 text-sm text-fg-dim transition hover:border-border-hover hover:text-fg">
              <Store size={14} />
              <span className="hidden sm:inline">View store</span>
            </Link>
            <LogoutButton />
          </div>
          </div>
        </header>
        <div className="mx-auto flex max-w-[1680px] flex-col gap-6 px-4 py-4 lg:flex-row lg:px-6 lg:py-6">
          <AdminSidebar />
          <main className="min-w-0 flex-1">
            <div className="space-y-6">{children}</div>
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
