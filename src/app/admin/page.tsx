import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Case, CaseStatus } from "@/lib/supabase/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatFeeRange } from "@/lib/format";

export const dynamic = "force-dynamic";

const STATUS_ORDER: CaseStatus[] = [
  "draft",
  "published",
  "assigned",
  "in_progress",
  "closed",
  "cancelled",
];

const STATUS_LABELS: Record<CaseStatus, string> = {
  draft: "Черновики",
  published: "Опубликованы",
  assigned: "Назначены",
  in_progress: "В работе",
  closed: "Закрыты",
  cancelled: "Отменены",
};

export default async function AdminCasesPage() {
  const supabase = await createClient();
  const { data: cases } = await supabase
    .from("cases")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<Case[]>();

  const grouped = STATUS_ORDER.map((status) => ({
    status,
    items: (cases ?? []).filter((c) => c.status === status),
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Дела</h1>
        <Link href="/admin/cases/new">
          <Button size="sm">Новое дело</Button>
        </Link>
      </div>

      {grouped.map(
        (group) =>
          group.items.length > 0 && (
            <div key={group.status} className="flex flex-col gap-2">
              <h2 className="text-muted-foreground text-sm font-medium">
                {STATUS_LABELS[group.status]} ({group.items.length})
              </h2>
              <div className="flex flex-col gap-2">
                {group.items.map((c) => (
                  <Link key={c.id} href={`/admin/cases/${c.id}`}>
                    <Card className="hover:bg-accent/50 transition-colors">
                      <CardContent className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="font-medium">{c.title}</div>
                          <div className="text-muted-foreground text-sm">
                            {formatFeeRange(c.fee_min_rub, c.fee_max_rub)}
                          </div>
                        </div>
                        {c.min_role === "partner" && (
                          <Badge variant="secondary">партнёр</Badge>
                        )}
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          ),
      )}

      {(!cases || cases.length === 0) && (
        <p className="text-muted-foreground text-sm">Дел пока нет.</p>
      )}
    </div>
  );
}
