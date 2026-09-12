import { it,expect,vi } from "vitest";
const mock=vi.hoisted(()=>({isAdmin:false,user:{id:"user"},from:vi.fn()}));
vi.mock("@/lib/supabase/server",()=>({getSupabaseServerClient:async()=>({auth:{getUser:async()=>({data:{user:mock.user}})},from:()=>({select:()=>({eq:()=>({single:async()=>({data:{is_admin:mock.isAdmin}})})})})}),getSupabaseServiceClient:()=>({from:mock.from})}));
import { requireAdmin } from "@/lib/admin-auth";
import { adminListCustomers } from "@/lib/data/admin-crud";
it("denies a normal customer and allows existing administrators",async()=>{mock.isAdmin=false;expect((await requireAdmin())?.status).toBe(403);mock.isAdmin=true;expect(await requireAdmin()).toBeNull();});
it("does not merge persistent customers by shared phone or guest snapshot",async()=>{
  const customers=[{id:"a",auth_user_id:"user-a",full_name:"A",phone:"01012345678",customer_type_id:null,created_at:"2026-01-01"},{id:"b",auth_user_id:"user-b",full_name:"B",phone:"01012345678",customer_type_id:null,created_at:"2026-01-01"}];
  mock.from.mockImplementation((table:string)=>{
    const data=table==="customers"?customers:table==="orders"?[{id:"guest",customer_id:null,customer_phone:"01012345678",customer_name:"Guest",governorate:"Cairo",city:"Cairo",created_at:"2026-01-02",grand_total:100,payment_status:"pending"}]:[];
    const result={data,error:null};
    const query={select:()=>query,order:async()=>result,eq:async()=>result};
    return query;
  });
  const rows=await adminListCustomers();expect(rows).toHaveLength(3);expect(rows.filter(r=>r.kind==="customer")).toHaveLength(2);expect(rows.find(r=>r.kind==="guest")?.full_name).toBe("Guest");
});
