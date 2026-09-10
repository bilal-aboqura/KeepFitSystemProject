// ============================================================================
// Phase 2: create (or update) the owner admin account and grant is_admin.
// Run:  node --env-file=.env.local scripts/seed-admin.mjs
// ============================================================================
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;

if (!url || !serviceKey || !email || !password) {
  console.error("✗ Missing Supabase URL/service key or ADMIN_EMAIL/ADMIN_PASSWORD.");
  process.exit(1);
}

const sb = createClient(url, serviceKey, { auth: { persistSession: false } });

async function main() {
  let userId;

  const { data: list } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const existing = list?.users?.find((u) => u.email === email);

  if (existing) {
    userId = existing.id;
    console.log(`→ User already exists (${email}). Resetting password + confirming email.`);
    const { error } = await sb.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
    });
    if (error) throw error;
  } else {
    console.log(`→ Creating owner account (${email}).`);
    const { data, error } = await sb.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: "Owner" },
    });
    if (error) throw error;
    userId = data.user.id;
  }

  // Grant admin flag (service role bypasses RLS).
  const { error: upErr } = await sb
    .from("profiles")
    .upsert(
      { id: userId, email, full_name: "Owner", is_admin: true },
      { onConflict: "id" },
    );
  if (upErr) throw upErr;

  const { data: prof } = await sb
    .from("profiles")
    .select("email, is_admin")
    .eq("id", userId)
    .single();

  console.log("\n✅ Owner admin ready:");
  console.table({ email, id: userId, is_admin: prof?.is_admin });
  console.log("Login at: http://localhost:3000/admin/login");
}

main().catch((e) => {
  console.error("✗ seed-admin failed:", e);
  process.exit(1);
});
