"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyChannel, notifyPersonal } from "@/lib/telegram";
import type { MinRole, Role } from "@/lib/supabase/types";

function parseOptionalInt(value: FormDataEntryValue | null) {
  if (!value || value === "") return null;
  const n = parseInt(value.toString(), 10);
  return Number.isNaN(n) ? null : n;
}

function parseOptionalDate(value: FormDataEntryValue | null) {
  if (!value || value === "") return null;
  return new Date(value.toString()).toISOString();
}

export async function createCase(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Не авторизовано");

  const payload = {
    track_id: String(formData.get("track_id")),
    title: String(formData.get("title")),
    summary: String(formData.get("summary")),
    fee_min_rub: parseOptionalInt(formData.get("fee_min_rub")),
    fee_max_rub: parseOptionalInt(formData.get("fee_max_rub")),
    min_role: String(formData.get("min_role")) as MinRole,
    respond_until: parseOptionalDate(formData.get("respond_until")),
    created_by: user.id,
  };

  const { data, error } = await supabase
    .from("cases")
    .insert(payload)
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  revalidatePath("/admin");
  redirect(`/admin/cases/${data.id}`);
}

export async function updateCase(caseId: string, formData: FormData) {
  const supabase = await createClient();

  const payload = {
    track_id: String(formData.get("track_id")),
    title: String(formData.get("title")),
    summary: String(formData.get("summary")),
    fee_min_rub: parseOptionalInt(formData.get("fee_min_rub")),
    fee_max_rub: parseOptionalInt(formData.get("fee_max_rub")),
    min_role: String(formData.get("min_role")) as MinRole,
    respond_until: parseOptionalDate(formData.get("respond_until")),
  };

  const { error } = await supabase.from("cases").update(payload).eq("id", caseId);
  if (error) throw new Error(error.message);

  revalidatePath("/admin");
  revalidatePath(`/admin/cases/${caseId}`);
}

export async function setCaseStatus(
  caseId: string,
  status: "draft" | "published" | "cancelled",
) {
  const supabase = await createClient();
  const { data: item } = await supabase
    .from("cases")
    .select("title, fee_min_rub, fee_max_rub, respond_until")
    .eq("id", caseId)
    .maybeSingle();

  const { error } = await supabase.from("cases").update({ status }).eq("id", caseId);
  if (error) throw new Error(error.message);

  if (status === "published" && item) {
    void notifyChannel(
      `Опубликовано новое дело «${item.title}».` +
        (item.fee_min_rub || item.fee_max_rub
          ? ` Вилка: ${item.fee_min_rub ?? "?"}–${item.fee_max_rub ?? "?"} ₽.`
          : "") +
        (item.respond_until
          ? ` Отклики до ${new Date(item.respond_until).toLocaleString("ru-RU")}.`
          : ""),
    );
  }

  revalidatePath("/admin");
  revalidatePath(`/admin/cases/${caseId}`);
  revalidatePath("/cases");
}

export async function assignCase(
  caseId: string,
  executorId: string,
  supervisorId: string | null,
) {
  const supabase = await createClient();

  const { error: assignError } = await supabase.from("assignments").insert({
    case_id: caseId,
    executor_id: executorId,
    supervisor_id: supervisorId,
  });
  if (assignError) throw new Error(assignError.message);

  const { error: statusError } = await supabase
    .from("cases")
    .update({ status: "assigned" })
    .eq("id", caseId);
  if (statusError) throw new Error(statusError.message);

  const { data: item } = await supabase
    .from("cases")
    .select("title")
    .eq("id", caseId)
    .maybeSingle();

  if (item) {
    void notifyChannel(`Дело «${item.title}» назначено исполнителю.`);
  }
  void notifyPersonal(executorId, `Вам назначено дело «${item?.title ?? ""}».`);
  if (supervisorId) {
    void notifyPersonal(
      supervisorId,
      `Вы назначены супервизором по делу «${item?.title ?? ""}».`,
    );
  }

  revalidatePath("/admin");
  revalidatePath(`/admin/cases/${caseId}`);
  revalidatePath("/cases");
}

export async function closeCaseAction(input: {
  assignmentId: string;
  feeRub: number;
  platformFeeRub: number;
  score: number;
  clientComment: string;
}) {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("close_case", {
    p_assignment_id: input.assignmentId,
    p_fee_rub: input.feeRub,
    p_platform_fee_rub: input.platformFeeRub,
    p_score: input.score,
    p_client_comment: input.clientComment || null,
  });
  if (error) throw new Error(error.message);

  const { data: assignment } = await supabase
    .from("assignments")
    .select("executor_id, case_id")
    .eq("id", input.assignmentId)
    .maybeSingle();

  if (assignment) {
    const { data: item } = await supabase
      .from("cases")
      .select("title")
      .eq("id", assignment.case_id)
      .maybeSingle();

    void notifyChannel(`Дело «${item?.title ?? ""}» закрыто. Оценка клиента: ${input.score}/5.`);
    void notifyPersonal(
      assignment.executor_id,
      `Дело «${item?.title ?? ""}» закрыто с оценкой ${input.score}/5. Списано с зачёта: ${data.charged_rub} ₽.`,
    );
  }

  revalidatePath("/admin");
  revalidatePath("/me");
  revalidatePath("/registry");

  return data as {
    charged_rub: number;
    remaining_balance_rub: number | null;
    due_rub: number;
  };
}

export async function inviteUser(formData: FormData) {
  const email = String(formData.get("email"));
  const fullName = String(formData.get("full_name"));
  const role = String(formData.get("role")) as Role;
  const trackId = String(formData.get("track_id")) || null;

  const admin = createAdminClient();
  const { data: invited, error: inviteError } =
    await admin.auth.admin.inviteUserByEmail(email);
  if (inviteError) throw new Error(inviteError.message);

  const supabase = await createClient();
  const { error: profileError } = await supabase.from("profiles").insert({
    id: invited.user.id,
    full_name: fullName,
    role,
    track_id: trackId,
  });
  if (profileError) throw new Error(profileError.message);

  revalidatePath("/admin/users");
}

export async function promoteToPartner(profileId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ role: "partner" })
    .eq("id", profileId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/users");
}

export async function grantCreditAction(profileId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("grant_credit", {
    p_profile_id: profileId,
  });
  if (error) throw new Error(error.message);
  void notifyPersonal(profileId, "Вам начислен зачёт стоимости обучения.");
  revalidatePath("/admin/users");
  revalidatePath("/me");
}

export async function deactivateUser(profileId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ is_active: false })
    .eq("id", profileId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/users");
  revalidatePath("/registry");
}
