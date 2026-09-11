import { requireCustomerPage } from "@/lib/customers/session";
import { listCustomerAddresses } from "@/lib/customers/addresses";
import { CustomerAddressForm } from "@/components/storefront/customer-address-form";
import { getLang } from "@/lib/i18n/server";
import { ui } from "@/lib/i18n/translations";
export default async function AddressesPage() {
  const c=await requireCustomerPage();const addresses=await listCustomerAddresses(c.id);const t=ui[await getLang()].account;
  return <section><h1 className="text-3xl font-bold">{t.addresses}</h1><CustomerAddressForm addresses={addresses}/></section>;
}
