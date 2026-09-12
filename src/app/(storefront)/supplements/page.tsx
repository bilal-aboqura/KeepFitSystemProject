import type { Metadata } from "next";
import { CatalogFamilyPage } from "@/components/storefront/catalog-family-page";

export const metadata: Metadata = {
  title: "المكملات الغذائية",
  description: "تسوّق أقسام المكملات الغذائية من KeepFit Supplement.",
};

export default function SupplementsPage() {
  return <CatalogFamilyPage family="supplements" />;
}
