import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-5 text-center">
      <div className="glass-elevated max-w-md p-12">
        <p className="font-display text-7xl text-brand">404</p>
        <h1 className="mt-5 font-heading text-2xl font-bold text-fg">Page not found</h1>
        <p className="mt-2 text-sm text-fg-dim">The page you are looking for does not exist or has been moved.</p>
        <Link href="/" className="btn btn-primary mt-8 gap-2">
          <ArrowLeft size={16} /> Back home
        </Link>
      </div>
    </div>
  );
}
