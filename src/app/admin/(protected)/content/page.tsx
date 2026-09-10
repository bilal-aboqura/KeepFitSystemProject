import { adminListSettings } from "@/lib/data/admin-crud";
import { getAllCategories } from "@/lib/data/catalog";
import { getLang } from "@/lib/i18n/server";
import { SettingsEditor } from "@/components/admin/settings-editor";
import { AdminPageHeader } from "@/components/admin/page-header";

export default async function AdminContentPage() {
  const lang = await getLang();
  const ar = lang === "ar";
  const [settings, categories] = await Promise.all([
    adminListSettings(),
    getAllCategories(),
  ]);

  return (
    <div>
      <AdminPageHeader
        eyebrow={ar ? "محتوى المتجر" : "Storefront content"}
        title={ar ? "المحتوى" : "Content"}
        description={
          ar
            ? "حرر النصوص الأساسية والصور المرتبطة بالأقسام من شاشة واحدة."
            : "Edit core storefront copy and category-linked imagery from one screen."
        }
      />
      <SettingsEditor settings={settings} categories={categories} lang={lang} />
    </div>
  );
}
