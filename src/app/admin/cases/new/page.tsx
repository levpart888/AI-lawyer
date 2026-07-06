import { createClient } from "@/lib/supabase/server";
import type { Track } from "@/lib/supabase/types";
import { CaseForm } from "@/components/case-form";
import { createCase } from "@/app/admin/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function NewCasePage() {
  const supabase = await createClient();
  const { data: tracks } = await supabase
    .from("tracks")
    .select("*")
    .returns<Track[]>();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Новое дело</CardTitle>
      </CardHeader>
      <CardContent>
        <CaseForm tracks={tracks ?? []} action={createCase} />
      </CardContent>
    </Card>
  );
}
