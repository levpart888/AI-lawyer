import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndProfile } from "@/lib/get-profile";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatRub, formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function MePage() {
  const { user, profile } = await getCurrentUserAndProfile();
  if (!user || !profile) return null;

  const supabase = await createClient();

  const { data: responses } = await supabase
    .from("responses")
    .select("id, comment, created_at, case:cases(id, title, status)")
    .eq("profile_id", user.id)
    .order("created_at", { ascending: false });

  const { data: assignments } = await supabase
    .from("assignments")
    .select("id, assigned_at, closed_at, fee_rub, case:cases(id, title, status)")
    .eq("executor_id", user.id)
    .order("assigned_at", { ascending: false });

  const { data: credits } = await supabase
    .from("credits")
    .select("*")
    .eq("profile_id", user.id)
    .order("created_at", { ascending: true });

  const creditIds = (credits ?? []).map((c) => c.id);
  const { data: transactions } = creditIds.length
    ? await supabase
        .from("credit_transactions")
        .select("id, amount_rub, created_at, assignment:assignments(case:cases(title))")
        .in("credit_id", creditIds)
        .order("created_at", { ascending: false })
    : { data: [] };

  // Серверный компонент рендерится заново на каждый запрос, поэтому "текущее
  // время" здесь — не проблема чистоты рендера, а часть данных запроса.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{profile.full_name}</CardTitle>
          <CardDescription>
            {profile.role === "partner" ? "Партнёр" : profile.role === "admin" ? "Админ" : "Специалист"}
            {profile.rating != null && ` · ★ ${profile.rating}`} · закрыто дел:{" "}
            {profile.cases_closed}
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Мои отклики</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {(!responses || responses.length === 0) && (
            <p className="text-muted-foreground text-sm">Откликов пока нет.</p>
          )}
          {responses?.map((r) => {
            const c = Array.isArray(r.case) ? r.case[0] : r.case;
            return (
              <div key={r.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                <span>{c?.title}</span>
                <Badge variant="outline">{c?.status}</Badge>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Мои дела</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {(!assignments || assignments.length === 0) && (
            <p className="text-muted-foreground text-sm">Пока нет назначенных дел.</p>
          )}
          {assignments?.map((a) => {
            const c = Array.isArray(a.case) ? a.case[0] : a.case;
            return (
              <div key={a.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                <span>{c?.title}</span>
                <div className="flex items-center gap-2">
                  {a.fee_rub != null && <span>{formatRub(a.fee_rub)}</span>}
                  <Badge variant={a.closed_at ? "success" : "outline"}>
                    {a.closed_at ? "закрыто" : "в работе"}
                  </Badge>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Зачёт стоимости обучения</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {(!credits || credits.length === 0) && (
            <p className="text-muted-foreground text-sm">Зачёт не начислен.</p>
          )}
          {credits?.map((c) => {
            const expired = new Date(c.expires_at).getTime() < now;
            return (
              <div key={c.id} className="rounded-md border p-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span>Начислено: {formatRub(c.amount_rub)}</span>
                  <span>Остаток: {formatRub(c.balance_rub)}</span>
                  {expired ? (
                    <Badge variant="destructive">сгорел</Badge>
                  ) : (
                    <Badge variant="outline">до {formatDateTime(c.expires_at)}</Badge>
                  )}
                </div>
              </div>
            );
          })}

          {transactions && transactions.length > 0 && (
            <>
              <Separator />
              <p className="text-sm font-medium">История списаний</p>
              {transactions.map((t) => {
                const a = Array.isArray(t.assignment) ? t.assignment[0] : t.assignment;
                const c = a && (Array.isArray(a.case) ? a.case[0] : a.case);
                return (
                  <div key={t.id} className="flex items-center justify-between text-sm">
                    <span>{c?.title ?? "Дело"}</span>
                    <span>-{formatRub(t.amount_rub)}</span>
                  </div>
                );
              })}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
