import { createClient } from "@/lib/supabase/server";
import type { RegistryEntry } from "@/lib/supabase/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const ROLE_LABELS: Record<string, string> = {
  admin: "Админ",
  partner: "Партнёр",
  specialist: "Специалист",
};

export default async function RegistryPage() {
  const supabase = await createClient();
  const { data: entries } = await supabase
    .from("registry")
    .select("*")
    .order("rating", { ascending: false, nullsFirst: false })
    .returns<RegistryEntry[]>();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Реестр участников</h1>
      <div className="flex flex-col gap-2">
        {entries?.map((e) => (
          <Card key={e.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-medium">
                {e.full_name}
                <Badge variant="outline">{ROLE_LABELS[e.role]}</Badge>
              </div>
              <div className="text-muted-foreground text-sm">
                {e.rating != null && `★ ${e.rating} · `}
                закрыто дел: {e.cases_closed}
              </div>
            </CardContent>
          </Card>
        ))}
        {(!entries || entries.length === 0) && (
          <p className="text-muted-foreground text-sm">Реестр пуст.</p>
        )}
      </div>
    </div>
  );
}
