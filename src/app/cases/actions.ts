"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { notifyPersonal, notifyChannel } from "@/lib/telegram";

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

  const { data: caseRow } = await supabase
    .from("cases")
    .select("title")
    .eq("id", caseId)
    .maybeSingle();
  if (caseRow) {
    void notifyChannel(`Новый отклик на дело «${caseRow.title}»`);
  }
  void notifyPersonal(user.id, "Ваш отклик отправлен администратору.");

  return { error: null };
}
