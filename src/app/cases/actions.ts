"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function respondToCase(caseId: string, comment: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Не авторизовано" };
  }

  const { error } = await supabase.from("responses").insert({
    case_id: caseId,
    profile_id: user.id,
    comment: comment || null,
  });

  if (error) {
    return { error: "Не удалось отправить отклик: недостаточно прав или дедлайн истёк" };
  }

  revalidatePath("/cases");
  revalidatePath(`/cases/${caseId}`);

  return { error: null };
}
