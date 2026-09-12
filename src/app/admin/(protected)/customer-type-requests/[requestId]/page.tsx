import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/page-header";
import { CustomerTypeRequestDetail } from "@/components/admin/customer-type-request-detail";
import { getAdminCustomerTypeRequest } from "@/lib/customers/type-requests";
import { getT } from "@/lib/i18n/server";

export default async function CustomerTypeRequestDetailPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = await params;
  const [request, t] = await Promise.all([getAdminCustomerTypeRequest(requestId), getT()]);
  if (!request) notFound();
  return (
    <div>
      <AdminPageHeader
        eyebrow={t.customerTypeAdmin.eyebrow}
        title={t.customerTypeAdmin.detailTitle}
        actions={
          <Link href="/admin/customer-type-requests" className="flex min-h-11 items-center gap-2 rounded-xl border border-border bg-white px-4 text-sm font-medium text-fg-muted transition hover:text-brand">
            <ArrowLeft size={16} /> {t.customerTypeAdmin.backToQueue}
          </Link>
        }
      />
      <div className="mt-6"><CustomerTypeRequestDetail request={request} /></div>
    </div>
  );
}
