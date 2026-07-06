import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndProfile } from "@/lib/get-profile";
import type { Case, Assignment, Profile } from "@/lib/supabase/types";
import { formatFeeRange, formatDateTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RespondDialog } from "@/components/respond-dialog";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  draft: "Черновик",
  published: "Опубликовано",
  assigned: "Назначено",
  in_progress: "В работе",
  closed: "Закрыто",
  cancelled: "Отменено",
};

export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { user, profile } = await getCurrentUserAndProfile();

  const { data: item } = await supabase
    .from("cases")
    .select("*")
    .eq("id", id)
    .maybeSingle<Case>();

  if (!item) notFound();

  const { data: response } = await supabase
    .from("responses")
    .select("id")
    .eq("case_id", id)
    .eq("profile_id", user!.id)
    .maybeSingle();

  const { data: assignment } = await supabase
    .from("assignments")
    .select("*")
    .eq("case_id", id)
    .maybeSingle<Assignment>();

  let supervisor: Profile | null = null;
  const isExecutor = assignment && assignment.executor_id === user?.id;
  if (isExecutor && assignment?.supervisor_id) {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", assignment.supervisor_id)
      .maybeSingle<Profile>();
    supervisor = data;
  }

  const canRespond =
    item.status === "published" &&
    (profile?.role === "partner" || item.min_role === "specialist");

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-xl">{item.title}</CardTitle>
            <Badge variant="outline">{STATUS_LABELS[item.status] ?? item.status}</Badge>
            {item.min_role === "partner" && (
              <Badge variant="secondary">нужен уровень: партнёр</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p>{item.summary}</p>
          <div className="text-sm">
            <span className="text-muted-foreground">Вилка гонорара: </span>
            {formatFeeRange(item.fee_min_rub, item.fee_max_rub)}
          </div>
          {item.respond_until && (
            <div className="text-sm">
              <span className="text-muted-foreground">Отклики до: </span>
              {formatDateTime(item.respond_until)}
            </div>
          )}

          {response ? (
            <Badge variant="success" className="w-fit">
              отклик отправлен
            </Badge>
          ) : (
            canRespond && <RespondDialog caseId={item.id} caseTitle={item.title} />
          )}

          {isExecutor && (
            <div className="mt-2 rounded-md border p-3 text-sm">
              <p className="font-medium">Вы назначены исполнителем этого дела</p>
              {supervisor ? (
                <p className="text-muted-foreground mt-1">
                  Супервизор: {supervisor.full_name}
                  {supervisor.telegram_chat_id && ` · Telegram: ${supervisor.telegram_chat_id}`}
                </p>
              ) : (
                <p className="text-muted-foreground mt-1">
                  Супервизор не назначен — работаете самостоятельно.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
