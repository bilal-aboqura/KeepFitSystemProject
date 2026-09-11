import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const migrationUrl = new URL("../../supabase/migrations/002_customer_type_approval.sql", import.meta.url);

describe("customer type migration contract", () => {
  it("backfills Retail before enforcing the effective-type invariant", async () => {
    const sql = await readFile(migrationUrl, "utf8");
    const backfill = sql.indexOf("update public.customers");
    const notNull = sql.indexOf("alter column customer_type_id set not null");
    expect(backfill).toBeGreaterThan(-1);
    expect(notNull).toBeGreaterThan(backfill);
    expect(sql).toContain("'retail'");
    expect(sql).toContain("'wholesale'");
    expect(sql).toContain("'gym_owner'");
  });

  it("enforces one pending request while allowing shared phone values", async () => {
    const sql = await readFile(migrationUrl, "utf8");
    expect(sql).toMatch(/unique index[^;]+customer_type_requests[^;]+where\s+status\s*=\s*'pending'/i);
    expect(sql).not.toMatch(/unique[^;]+business_phone/i);
  });

  it("keeps guarded transitions private and audit-backed", async () => {
    const sql = await readFile(migrationUrl, "utf8");
    for (const command of [
      "create_customer_type_request",
      "approve_customer_type_request",
      "reject_customer_type_request",
      "assign_customer_type",
    ]) {
      expect(sql).toContain(`function public.${command}`);
      expect(sql).toMatch(new RegExp(`revoke all on function public\\.${command}[^;]+from public, anon, authenticated`, "i"));
    }
    expect(sql).toContain("customer_type_audit_events");
    expect(sql).toContain("status = 'pending'");
    expect(sql).toContain("'superseded'");
  });

  it("defines customer-owned reads without customer mutation policies", async () => {
    const sql = await readFile(migrationUrl, "utf8");
    expect(sql).toContain('create policy "customer_type_requests_self_read"');
    expect(sql).not.toMatch(/create policy[^;]+customer_type_requests[^;]+for\s+(insert|update|delete|all)/i);
    expect(sql).toMatch(/revoke\s+(insert|all)[^;]+customer_type_requests[^;]+from anon, authenticated/i);
  });

  it("derives customer request ownership from the authenticated server session", async () => {
    const route = await readFile(
      new URL("../../src/app/api/customer/type-requests/route.ts", import.meta.url),
      "utf8",
    );
    expect(route).toContain("getCurrentCustomer()");
    expect(route).toContain("createCustomerTypeRequest(customer.id, body)");
    expect(route).not.toMatch(/body\.(customer_id|customerId|status|effective_type)/);
  });

  it("guards every admin request decision route with the existing admin boundary", async () => {
    const routeUrls = [
      "../../src/app/api/admin/customer-type-requests/route.ts",
      "../../src/app/api/admin/customer-type-requests/[requestId]/route.ts",
      "../../src/app/api/admin/customer-type-requests/[requestId]/approve/route.ts",
      "../../src/app/api/admin/customer-type-requests/[requestId]/reject/route.ts",
      "../../src/app/api/admin/customers/[customerId]/customer-type/route.ts",
    ];
    for (const routeUrl of routeUrls) {
      const route = await readFile(new URL(routeUrl, import.meta.url), "utf8");
      expect(route).toContain("requireAdminUser()");
    }
  });

  it("wires stable-code filters and the dashboard attention link", async () => {
    const queue = await readFile(
      new URL("../../src/app/admin/(protected)/customer-type-requests/page.tsx", import.meta.url),
      "utf8",
    );
    const dashboard = await readFile(
      new URL("../../src/app/admin/(protected)/page.tsx", import.meta.url),
      "utf8",
    );
    const data = await readFile(new URL("../../src/lib/data/admin.ts", import.meta.url), "utf8");
    expect(queue).toContain("requestedType");
    expect(queue).toContain("effectiveType");
    expect(queue).toContain('status: first(search.status) || "pending"');
    expect(dashboard).toContain('href="/admin/customer-type-requests"');
    expect(data).toContain('eq("status", "pending")');
  });
});

const describeDatabase = process.env.DIRECT_URL ? describe.sequential : describe.skip;

describeDatabase("customer type database transitions", () => {
  const client = new pg.Client({ connectionString: process.env.DIRECT_URL });
  const ids = {
    user: randomUUID(),
    otherUser: randomUUID(),
    thirdUser: randomUUID(),
    admin: randomUUID(),
    customer: randomUUID(),
    otherCustomer: randomUUID(),
    thirdCustomer: randomUUID(),
    address: randomUUID(),
    order: randomUUID(),
  };
  let wholesaleRequestId = "";
  let approvedRequestId = "";
  let gymRequestId = "";

  async function insertAuthUser(id: string, email: string) {
    await client.query(
      `insert into auth.users (
        id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at
      ) values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated',
        'authenticated', $2, '', now(), '{}'::jsonb, '{}'::jsonb, now(), now())`,
      [id, email],
    );
  }

  async function runAsAuthenticated(userId: string, sql: string, params: unknown[] = []) {
    await client.query("savepoint authenticated_check");
    try {
      await client.query("select set_config('request.jwt.claim.sub', $1, true)", [userId]);
      await client.query("set local role authenticated");
      const result = await client.query(sql, params);
      await client.query("rollback to savepoint authenticated_check");
      return { result, error: null };
    } catch (error) {
      await client.query("rollback to savepoint authenticated_check");
      return { result: null, error: error as Error };
    }
  }

  async function expectDatabaseError(sql: string, params: unknown[], pattern: RegExp) {
    await client.query("savepoint expected_error");
    try {
      await client.query(sql, params);
      throw new Error("Expected the database command to fail");
    } catch (error) {
      await client.query("rollback to savepoint expected_error");
      expect((error as Error).message).toMatch(pattern);
    }
  }

  beforeAll(async () => {
    await client.connect();
    await client.query("begin");
    const migration = await readFile(migrationUrl, "utf8");
    await client.query(migration);
    await client.query("alter table public.customers alter column customer_type_id drop not null");
    await client.query("alter table public.customers alter column customer_type_id drop default");

    await insertAuthUser(ids.user, `customer-${ids.user}@example.test`);
    await insertAuthUser(ids.otherUser, `customer-${ids.otherUser}@example.test`);
    await insertAuthUser(ids.thirdUser, `customer-${ids.thirdUser}@example.test`);
    await insertAuthUser(ids.admin, `admin-${ids.admin}@example.test`);
    await client.query("update public.profiles set is_admin = true where id = $1", [ids.admin]);

    await client.query(
      `insert into public.customers (id, auth_user_id, full_name, email, phone, customer_type_id)
       values ($1, $2, 'Primary Customer', $3, '01012345678', null),
              ($4, $5, 'Other Customer', $6, '01112345678', null),
              ($7, $8, 'Third Customer', $9, '01212345678', null)`,
      [
        ids.customer,
        ids.user,
        `customer-${ids.user}@example.test`,
        ids.otherCustomer,
        ids.otherUser,
        `customer-${ids.otherUser}@example.test`,
        ids.thirdCustomer,
        ids.thirdUser,
        `customer-${ids.thirdUser}@example.test`,
      ],
    );
    await client.query(
      `insert into public.addresses
        (id, user_id, customer_id, full_name, phone, governorate, city, address, is_default)
       values ($1, $2, $3, 'Primary Customer', '01012345678', 'Cairo', 'Nasr City', 'Test address', true)`,
      [ids.address, ids.user, ids.customer],
    );
    await client.query(
      `insert into public.orders
        (id, order_number, user_id, customer_id, customer_name, customer_phone, alt_phone,
         governorate, city, address, payment_method)
       values ($1, $2, $3, $4, 'Primary Customer', '01012345678', '01012345678',
         'Cairo', 'Nasr City', 'Test address', 'cod')`,
      [ids.order, `T-${ids.order}`, ids.user, ids.customer],
    );
    await client.query(migration);
  });

  afterAll(async () => {
    await client.query("rollback");
    await client.end();
  });

  it("backfills existing customers to Retail without changing identity, addresses, or orders", async () => {
    const { rows } = await client.query(
      `select c.auth_user_id, t.code,
        exists(select 1 from public.addresses a where a.id = $2 and a.customer_id = c.id) as address_preserved,
        exists(select 1 from public.orders o where o.id = $3 and o.customer_id = c.id) as order_preserved
       from public.customers c
       join public.customer_types t on t.id = c.customer_type_id
       where c.id = $1`,
      [ids.customer, ids.address, ids.order],
    );
    expect(rows[0]).toMatchObject({
      auth_user_id: ids.user,
      code: "retail",
      address_preserved: true,
      order_preserved: true,
    });
  });

  it("creates one customer-owned pending request, shares phone values, and leaves effective types unchanged", async () => {
    const first = await client.query(
      `select public.create_customer_type_request($1, 'wholesale', 'Primary Trading',
        '01099999999', 'Cairo', 'Nasr City', null, null) as result`,
      [ids.customer],
    );
    wholesaleRequestId = first.rows[0].result.request_id;
    const second = await client.query(
      `select public.create_customer_type_request($1, 'wholesale', 'Other Trading',
        '01099999999', 'Giza', 'Dokki', null, null) as result`,
      [ids.otherCustomer],
    );
    expect(second.rows[0].result.status).toBe("pending");
    const types = await client.query(
      `select c.id, t.code from public.customers c
       join public.customer_types t on t.id = c.customer_type_id
       where c.id = any($1::uuid[]) order by c.id`,
      [[ids.customer, ids.otherCustomer]],
    );
    expect(types.rows.every((row) => row.code === "retail")).toBe(true);
    await expectDatabaseError(
      "select public.create_customer_type_request($1, 'gym_owner', 'Duplicate Gym', null, null, null, null, null)",
      [ids.customer],
      /PENDING_REQUEST_EXISTS/,
    );
  });

  it("rejects without changing the effective type and preserves private/public notes separately", async () => {
    await client.query(
      "select public.reject_customer_type_request($1, $2, 'More verification is needed', 'Private review note')",
      [wholesaleRequestId, ids.admin],
    );
    const { rows } = await client.query(
      `select r.status, r.rejection_reason_public, r.internal_admin_note, t.code
       from public.customer_type_requests r
       join public.customers c on c.id = r.customer_id
       join public.customer_types t on t.id = c.customer_type_id
       where r.id = $1`,
      [wholesaleRequestId],
    );
    expect(rows[0]).toMatchObject({
      status: "rejected",
      rejection_reason_public: "More verification is needed",
      internal_admin_note: "Private review note",
      code: "retail",
    });
  });

  it("allows reapplication, approves atomically once, and rejects stale decisions", async () => {
    const created = await client.query(
      "select public.create_customer_type_request($1, 'wholesale', 'Primary Trading', null, null, null, null, null) as result",
      [ids.customer],
    );
    approvedRequestId = created.rows[0].result.request_id;
    await client.query("select public.approve_customer_type_request($1, $2)", [approvedRequestId, ids.admin]);
    const { rows } = await client.query(
      `select r.status, t.code,
        (select count(*)::int from public.customer_type_audit_events e
         where e.request_id = r.id and e.action = 'approved') as approval_events
       from public.customer_type_requests r
       join public.customers c on c.id = r.customer_id
       join public.customer_types t on t.id = c.customer_type_id
       where r.id = $1`,
      [approvedRequestId],
    );
    expect(rows[0]).toMatchObject({ status: "approved", code: "wholesale", approval_events: 1 });
    await expectDatabaseError(
      "select public.reject_customer_type_request($1, $2, null, null)",
      [approvedRequestId, ids.admin],
      /REQUEST_NOT_PENDING/,
    );
  });

  it("keeps Wholesale effective while Gym Owner is pending", async () => {
    const created = await client.query(
      "select public.create_customer_type_request($1, 'gym_owner', 'Primary Gym', null, null, null, null, null) as result",
      [ids.customer],
    );
    gymRequestId = created.rows[0].result.request_id;
    const { rows } = await client.query(
      `select r.status, current_type.code as effective_code, requested_type.code as requested_code
       from public.customer_type_requests r
       join public.customers c on c.id = r.customer_id
       join public.customer_types current_type on current_type.id = c.customer_type_id
       join public.customer_types requested_type on requested_type.id = r.requested_type_id
       where r.id = $1`,
      [gymRequestId],
    );
    expect(rows[0]).toMatchObject({
      status: "pending",
      effective_code: "wholesale",
      requested_code: "gym_owner",
    });
  });

  it("direct assignment supersedes pending work, audits prior/new types, and makes finalization immutable", async () => {
    const assigned = await client.query(
      "select public.assign_customer_type($1, 'retail', $2, 'Operational correction') as result",
      [ids.customer, ids.admin],
    );
    expect(assigned.rows[0].result.superseded_request_id).toBe(gymRequestId);
    const { rows } = await client.query(
      `select r.status, previous.code as previous_code, next.code as next_code
       from public.customer_type_requests r
       join public.customer_type_audit_events e on e.request_id = r.id and e.action = 'assigned'
       join public.customer_types previous on previous.id = e.previous_type_id
       join public.customer_types next on next.id = e.new_type_id
       where r.id = $1`,
      [gymRequestId],
    );
    expect(rows[0]).toMatchObject({ status: "superseded", previous_code: "wholesale", next_code: "retail" });
    await expectDatabaseError(
      "select public.approve_customer_type_request($1, $2)",
      [gymRequestId, ids.admin],
      /REQUEST_NOT_PENDING/,
    );
  });

  it("rejects inactive types and non-admin decisions authoritatively", async () => {
    await client.query("update public.customer_types set is_active = false where code = 'gym_owner'");
    await expectDatabaseError(
      "select public.create_customer_type_request($1, 'gym_owner', 'Third Gym', null, null, null, null, null)",
      [ids.thirdCustomer],
      /TYPE_INACTIVE/,
    );
    await client.query("update public.customer_types set is_active = true where code = 'gym_owner'");
    await expectDatabaseError(
      "select public.assign_customer_type($1, 'wholesale', $2, 'Unauthorized')",
      [ids.thirdCustomer, ids.user],
      /ADMIN_UNAUTHORIZED/,
    );
  });

  it("supports explicit Retail-to-protected and protected-to-Retail assignment with prior/new audit values", async () => {
    await client.query(
      "select public.assign_customer_type($1, 'gym_owner', $2, 'Verified gym')",
      [ids.thirdCustomer, ids.admin],
    );
    await client.query(
      "select public.assign_customer_type($1, 'retail', $2, 'Return to baseline')",
      [ids.thirdCustomer, ids.admin],
    );
    const { rows } = await client.query(
      `select previous.code as previous_code, next.code as next_code
       from public.customer_type_audit_events e
       join public.customer_types previous on previous.id = e.previous_type_id
       join public.customer_types next on next.id = e.new_type_id
       where e.customer_id = $1 and e.action = 'assigned'
       order by e.occurred_at`,
      [ids.thirdCustomer],
    );
    expect(rows).toMatchObject([
      { previous_code: "retail", next_code: "gym_owner" },
      { previous_code: "gym_owner", next_code: "retail" },
    ]);
  });

  it("supports pending queue status/requested/effective filters and attention counts", async () => {
    await client.query(
      "select public.create_customer_type_request($1, 'wholesale', 'Third Trading', null, null, null, null, null)",
      [ids.thirdCustomer],
    );
    const { rows } = await client.query(
      `select count(*)::int as pending_count,
        count(*) filter (where requested.code = 'wholesale')::int as wholesale_count,
        count(*) filter (where effective.code = 'retail')::int as retail_effective_count
       from public.customer_type_requests r
       join public.customer_types requested on requested.id = r.requested_type_id
       join public.customers c on c.id = r.customer_id
       join public.customer_types effective on effective.id = c.customer_type_id
       where r.status = 'pending'`,
    );
    expect(rows[0]).toMatchObject({
      pending_count: 2,
      wholesale_count: 2,
      retail_effective_count: 2,
    });
  });

  it("enforces own-row reads and denies direct type, decision-note, and RPC mutation access", async () => {
    const own = await runAsAuthenticated(
      ids.user,
      "select id, customer_id, status, rejection_reason_public from public.customer_type_requests order by submitted_at",
    );
    expect(own.error).toBeNull();
    expect(own.result?.rows.length).toBeGreaterThan(0);
    expect(own.result?.rows.every((row) => row.customer_id === ids.customer)).toBe(true);

    const privateRead = await runAsAuthenticated(
      ids.user,
      "select internal_admin_note from public.customer_type_requests where id = $1",
      [wholesaleRequestId],
    );
    expect(privateRead.error?.message).toMatch(/permission denied/i);

    const directUpdate = await runAsAuthenticated(
      ids.user,
      "update public.customers set customer_type_id = (select id from public.customer_types where code = 'gym_owner') where id = $1",
      [ids.customer],
    );
    expect(directUpdate.error?.message).toMatch(/permission denied/i);

    const directRpc = await runAsAuthenticated(
      ids.user,
      "select public.assign_customer_type($1, 'gym_owner', $2, 'Escalation')",
      [ids.customer, ids.user],
    );
    expect(directRpc.error?.message).toMatch(/permission denied/i);
  });
});
