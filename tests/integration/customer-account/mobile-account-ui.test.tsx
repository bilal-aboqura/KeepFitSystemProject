import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { it,expect,vi } from "vitest";
import { ui } from "@/lib/i18n/translations";
const locale=vi.hoisted(()=>({lang:"ar" as "ar"|"en"}));
vi.mock("@/components/language/provider",()=>({useLang:()=>({lang:locale.lang,t:ui[locale.lang]})}));
vi.mock("next/navigation",()=>({useRouter:()=>({refresh:vi.fn(),replace:vi.fn()})}));
import { CustomerProfileForm } from "@/components/storefront/customer-profile-form";
import { CustomerAddressForm } from "@/components/storefront/customer-address-form";
import { CustomerAuth } from "@/components/storefront/customer-auth";
it.each(["ar","en"] as const)("renders labelled account controls and retained values in %s",lang=>{
  locale.lang=lang;
  const html=renderToStaticMarkup(<div dir={lang==="ar"?"rtl":"ltr"}><CustomerProfileForm initial={{full_name:"Test Name",phone:"01012345678"}}/><CustomerAddressForm/><CustomerAuth/></div>);
  expect(html).toContain(ui[lang].account.name);expect(html).toContain(ui[lang].account.address);
  expect(html).toContain('value="Test Name"');expect(html).toContain('type="tel"');
  expect(html).toContain('min-h-11');expect(html).toContain(ui[lang].account.signIn);
});
