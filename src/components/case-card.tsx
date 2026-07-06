import Link from "next/link";
import type { Case } from "@/lib/supabase/types";
import { formatFeeRange, formatDateTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { RespondDialog } from "@/components/respond-dialog";

export function CaseCard({
  item,
  alreadyResponded,
  canRespond,
}: {
  item: Case;
  alreadyResponded: boolean;
  canRespond: boolean;
}) {
  const deadline = formatDateTime(item.respond_until);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>
            <Link href={`/cases/${item.id}`} className="hover:underline">
              {item.title}
            </Link>
          </CardTitle>
          {item.min_role === "partner" && (
            <Badge variant="secondary">нужен уровень: партнёр</Badge>
          )}
        </div>
        <CardDescription>{item.summary}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-1 text-sm">
        <div>
          <span className="text-muted-foreground">Вилка гонорара: </span>
          {formatFeeRange(item.fee_min_rub, item.fee_max_rub)}
        </div>
        {deadline && (
          <div>
            <span className="text-muted-foreground">Отклики до: </span>
            {deadline}
          </div>
        )}
      </CardContent>
      <CardFooter>
        {alreadyResponded ? (
          <Badge variant="success">отклик отправлен</Badge>
        ) : canRespond ? (
          <RespondDialog caseId={item.id} caseTitle={item.title} />
        ) : (
          <Badge variant="outline">доступно только партнёрам</Badge>
        )}
      </CardFooter>
    </Card>
  );
}
