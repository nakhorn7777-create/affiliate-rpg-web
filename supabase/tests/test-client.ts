import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

const URL = process.env.TEST_SUPABASE_URL!;
const ANON_KEY = process.env.TEST_SUPABASE_ANON_KEY!;
const SERVICE_ROLE_KEY = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY!;

if (!URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
  throw new Error(
    "Missing TEST_SUPABASE_URL / TEST_SUPABASE_ANON_KEY / TEST_SUPABASE_SERVICE_ROLE_KEY. " +
      "These must point at a dedicated test project — never the production one."
  );
}

// Uses the service role key — only ever used here for test setup/teardown
// (creating/deleting test users, seeding data). Never used inside an
// assertion to bypass RLS; assertions always go through a signed-in
// anon-key client so RLS/RPC security is actually exercised.
export const adminClient = createClient<Database>(URL, SERVICE_ROLE_KEY);

export async function createTestUser(email: string, password: string) {
  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw error ?? new Error(`Failed to create test user ${email}`);
  }
  return data.user;
}

// Signs in through the anon-key client, exactly like a real browser
// session would — this is what makes RLS/RPC checks meaningful, since
// auth.uid() inside Postgres resolves from this session's JWT.
export async function signInAsTestUser(email: string, password: string) {
  const client = createClient<Database>(URL, ANON_KEY);
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

export async function deleteTestUser(userId: string) {
  await adminClient.auth.admin.deleteUser(userId);
}
