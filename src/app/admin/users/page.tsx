import { createClient } from "@/lib/supabase/server";
import type { Profile, Track } from "@/lib/supabase/types";
import { InviteUserDialog } from "@/components/invite-user-dialog";
import {
  promoteToPartner,
  grantCreditAction,
  deactivateUser,
} from "@/app/admin/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const ROLE_LABELS: Record<string, string> = {
  admin: "Админ",
  partner: "Партнёр",
  specialist: "Специалист",
};

export default async function AdminUsersPage() {
  const supabase = await createClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<Profile[]>();

  const { data: tracks } = await supabase.from("tracks").select("*").returns<Track[]>();
  const tracksById = new Map((tracks ?? []).map((t) => [t.id, t.name]));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Пользователи</h1>
        <InviteUserDialog tracks={tracks ?? []} />
      </div>

      <div className="flex flex-col gap-2">
        {profiles?.map((p) => (
          <Card key={p.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 font-medium">
                  {p.full_name}
                  <Badge variant="outline">{ROLE_LABELS[p.role]}</Badge>
                  {!p.is_active && <Badge variant="destructive">неактивен</Badge>}
                </div>
                <div className="text-muted-foreground text-sm">
                  {p.track_id ? tracksById.get(p.track_id) : "без направления"}
                  {p.rating != null && ` · ★ ${p.rating}`} · {p.cases_closed} дел
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {p.role === "specialist" && (
                  <form action={promoteToPartner.bind(null, p.id)}>
                    <Button size="sm" variant="outline" type="submit">
                      Повысить до партнёра
                    </Button>
                  </form>
                )}
                {p.role !== "admin" && (
                  <form action={grantCreditAction.bind(null, p.id)}>
                    <Button size="sm" variant="outline" type="submit">
                      Начислить зачёт
                    </Button>
                  </form>
                )}
                {p.is_active && p.role !== "admin" && (
                  <form action={deactivateUser.bind(null, p.id)}>
                    <Button size="sm" variant="destructive" type="submit">
                      Деактивировать
                    </Button>
                  </form>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
