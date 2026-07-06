import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndProfile } from "@/lib/get-profile";
import type { Case } from "@/lib/supabase/types";
import { CaseCard } from "@/components/case-card";

export const dynamic = "force-dynamic";

export default async function CasesPage() {
  const { profile } = await getCurrentUserAndProfile();
  const supabase = await createClient();

  const { data: cases } = await supabase
    .from("cases")
    .select("*")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .returns<Case[]>();

  const { data: myResponses } = await supabase
    .from("responses")
    .select("case_id");

  const respondedIds = new Set((myResponses ?? []).map((r) => r.case_id));

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Опубликованные дела</h1>
      {(!cases || cases.length === 0) && (
        <p className="text-muted-foreground text-sm">
          Пока нет опубликованных дел в вашем направлении.
        </p>
      )}
      <div className="flex flex-col gap-3">
        {cases?.map((c) => (
          <CaseCard
            key={c.id}
            item={c}
            alreadyResponded={respondedIds.has(c.id)}
            canRespond={profile?.role === "partner" || c.min_role === "specialist"}
          />
        ))}
      </div>
    </div>
  );
}
