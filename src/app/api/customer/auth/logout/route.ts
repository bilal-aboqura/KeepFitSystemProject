import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
export async function POST() {
  const sb=await getSupabaseServerClient();
  if(sb){const {error}=await sb.auth.signOut({scope:"local"});if(error)return NextResponse.json({error:"Sign-out failed"},{status:503});}
  return NextResponse.json({ok:true});
}
