import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Case, Track, Assignment } from "@/lib/supabase/types";
import { CaseForm } from "@/components/case-form";
import { AssignCaseForm } from "@/components/assign-case-form";
import { CloseCaseForm } from "@/components/close-case-form";
import { updateCase, setCaseStatus } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminCaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: item } = await supabase
    .from("cases")
    .select("*")
    .eq("id", id)
    .maybeSingle<Case>();
  if (!item) notFound();

  const { data: tracks } = await supabase.from("tracks").select("*").returns<Track[]>();

  const { data: responses } = await supabase
    .from("responses")
    .select("id, comment, created_at, profile:profiles(id, full_name, role, rating, cases_closed)")
    .eq("case_id", id);

  const { data: assignment } = await supabase
    .from("assignments")
    .select("*")
    .eq("case_id", id)
    .maybeSingle<Assignment>();

  const { data: candidates } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("track_id", item.track_id)
    .eq("is_active", true);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold">{item.title}</h1>
        <Badge variant="outline">{item.status}</Badge>
      </div>

      <div className="flex gap-2">
        {item.status === "draft" && (
          <form action={setCaseStatus.bind(null, id, "published")}>
            <Button size="sm" type="submit">
              Опубликовать
            </Button>
          </form>
        )}
        {(item.status === "draft" || item.status === "published") && (
          <form action={setCaseStatus.bind(null, id, "cancelled")}>
            <Button size="sm" variant="outline" type="submit">
              Отменить
            </Button>
          </form>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Редактировать дело</CardTitle>
        </CardHeader>
        <CardContent>
          <CaseForm tracks={tracks ?? []} item={item} action={updateCase.bind(null, id)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Отклики ({responses?.length ?? 0})
          </CardTitle>
          <CardDescription>
            Видны только администратору — участники не видят чужие отклики.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {(!responses || responses.length === 0) && (
            <p className="text-muted-foreground text-sm">Откликов пока нет.</p>
          )}
          {responses?.map((r) => {
            const p = Array.isArray(r.profile) ? r.profile[0] : r.profile;
            return (
              <div key={r.id} className="rounded-md border p-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{p?.full_name}</span>
                  <Badge variant="outline">
                    {p?.role === "partner" ? "партнёр" : "специалист"}
                  </Badge>
                  {p?.rating != null && <span>★ {p.rating}</span>}
                  <span className="text-muted-foreground">
                    · {p?.cases_closed ?? 0} закрытых дел
                  </span>
                </div>
                {r.comment && <p className="mt-1">{r.comment}</p>}
                <p className="text-muted-foreground mt-1 text-xs">
                  {formatDateTime(r.created_at)}
                </p>
              </div>
            );
          })}

          {!assignment && item.status === "published" && (
            <AssignCaseForm caseId={id} candidates={candidates ?? []} />
          )}
        </CardContent>
      </Card>

      {assignment && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Назначение</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm">
              Назначено: {formatDateTime(assignment.assigned_at)}
            </p>
            {assignment.closed_at ? (
              <Badge variant="success" className="w-fit">
                Дело закрыто {formatDateTime(assignment.closed_at)}
              </Badge>
            ) : (
              <CloseCaseForm assignmentId={assignment.id} />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
