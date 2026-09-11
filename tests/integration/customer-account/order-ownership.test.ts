import { it,expect,vi } from "vitest";
const mock=vi.hoisted(()=>({from:vi.fn()}));
vi.mock("@/lib/supabase/server",()=>({getSupabaseServiceClient:()=>({from:mock.from})}));
import { getCustomerOrder,listCustomerOrders } from "@/lib/customers/queries";
it("filters detail and summaries by canonical customer ID with pagination",async()=>{
  const q={select:vi.fn(),eq:vi.fn(),order:vi.fn(),range:vi.fn().mockResolvedValue({data:[],error:null}),maybeSingle:vi.fn().mockResolvedValue({data:null,error:null})};
  for(const key of ["select","eq","order"] as const)q[key].mockReturnValue(q);mock.from.mockReturnValue(q);
  expect(await getCustomerOrder("customer-a","other-order")).toBeNull();expect(q.eq).toHaveBeenCalledWith("customer_id","customer-a");
  await listCustomerOrders("customer-a",2);expect(q.range).toHaveBeenCalledWith(20,39);
});
