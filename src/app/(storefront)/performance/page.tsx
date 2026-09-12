import type { Metadata } from "next";
import { CatalogFamilyPage } from "@/components/storefront/catalog-family-page";

export const metadata: Metadata = {
  title: "الأداء الرياضي",
  description: "اختيارات قانونية ومصرح بها لروتين التمرين من KeepFit Supplement.",
};

export default function PerformancePage() {
  return <CatalogFamilyPage family="performance" />;
}
