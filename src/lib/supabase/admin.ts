import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Сервисный клиент нужен ТОЛЬКО для auth.admin.* (приглашение пользователя по email) —
// эта операция в принципе не может идти через RLS, т.к. создаёт запись в auth.users.
// Все остальные операции (включая запись в profiles) должны идти через обычный клиент
// пользователя, чтобы реальным контролем доступа оставался RLS.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
