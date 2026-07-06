import type { Case, Track } from "@/lib/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function toLocalDatetimeInput(value: string | null) {
  if (!value) return "";
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function CaseForm({
  tracks,
  item,
  action,
}: {
  tracks: Track[];
  item?: Case;
  action: (formData: FormData) => void;
}) {
  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="title">Название (обезличенное)</Label>
        <Input id="title" name="title" required defaultValue={item?.title} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="summary">Описание (обезличенное, без ПД)</Label>
        <Textarea
          id="summary"
          name="summary"
          required
          rows={4}
          defaultValue={item?.summary}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="track_id">Направление</Label>
        <Select name="track_id" defaultValue={item?.track_id ?? tracks[0]?.id}>
          <SelectTrigger id="track_id" className="w-full">
            <SelectValue placeholder="Выберите направление" />
          </SelectTrigger>
          <SelectContent>
            {tracks.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="fee_min_rub">Гонорар от, ₽</Label>
          <Input
            id="fee_min_rub"
            name="fee_min_rub"
            type="number"
            min={0}
            defaultValue={item?.fee_min_rub ?? undefined}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="fee_max_rub">Гонорар до, ₽</Label>
          <Input
            id="fee_max_rub"
            name="fee_max_rub"
            type="number"
            min={0}
            defaultValue={item?.fee_max_rub ?? undefined}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="min_role">Минимальный уровень</Label>
        <Select name="min_role" defaultValue={item?.min_role ?? "specialist"}>
          <SelectTrigger id="min_role" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="specialist">Специалист</SelectItem>
            <SelectItem value="partner">Партнёр</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="respond_until">Отклики до</Label>
        <Input
          id="respond_until"
          name="respond_until"
          type="datetime-local"
          defaultValue={toLocalDatetimeInput(item?.respond_until ?? null)}
        />
      </div>

      <Button type="submit">{item ? "Сохранить" : "Создать дело"}</Button>
    </form>
  );
}
