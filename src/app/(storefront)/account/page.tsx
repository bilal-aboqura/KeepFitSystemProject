import Link from "next/link";
import { getCurrentCustomer } from "@/lib/customers/session";
export default async function AccountPage() { const customer = await getCurrentCustomer(); return <section className="glass-elevated p-6"><p className="text-sm text-fg-dim">Your account</p><h1 className="mt-2 text-3xl font-bold text-fg">{customer?.full_name || "Complete your profile"}</h1><p className="mt-3 text-fg-muted">Manage your profile, delivery addresses, and orders.</p><Link href="/account/complete-profile" className="btn btn-primary mt-6">Complete profile</Link></section>; }
