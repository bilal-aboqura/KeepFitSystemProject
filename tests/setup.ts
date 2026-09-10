import { beforeEach } from "vitest";
beforeEach(() => { process.env.NEXT_PUBLIC_SUPABASE_URL ??= ""; });
