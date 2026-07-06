"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { closeCaseAction } from "@/app/admin/actions";
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
import { formatRub } from "@/lib/format";

export function CloseCaseForm({ assignmentId }: { assignmentId: string }) {
  const [feeRub, setFeeRub] = useState("");
  const [platformFeeRub, setPlatformFeeRub] = useState("");
  const [platformFeeTouched, setPlatformFeeTouched] = useState(false);
  const [score, setScore] = useState("5");
  const [comment, setComment] = useState("");
  const [isPending, startTransition] = useTransition();
  const [summary, setSummary] = useState<{
    charged_rub: number;
    remaining_balance_rub: number | null;
    due_rub: number;
  } | null>(null);

  function handleFeeChange(value: string) {
    setFeeRub(value);
    if (!platformFeeTouched) {
      const fee = parseInt(value, 10);
      setPlatformFeeRub(Number.isNaN(fee) ? "" : String(Math.round(fee * 0.25)));
    }
  }

  function handleSubmit() {
    const fee = parseInt(feeRub, 10);
    const platformFee = parseInt(platformFeeRub, 10);
    if (Number.isNaN(fee) || Number.isNaN(platformFee)) {
      toast.error("Укажите гонорар и комиссию");
      return;
    }
    startTransition(async () => {
      try {
        const result = await closeCaseAction({
          assignmentId,
          feeRub: fee,
          platformFeeRub: platformFee,
          score: parseInt(score, 10),
          clientComment: comment,
        });
        setSummary(result);
        toast.success("Дело закрыто");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Ошибка закрытия дела");
      }
    });
  }

  if (summary) {
    return (
      <div className="flex flex-col gap-1 rounded-md border p-3 text-sm">
        <p className="font-medium">Дело закрыто</p>
        <p>Списано с зачёта: {formatRub(summary.charged_rub)}</p>
        <p>
          Остаток зачёта:{" "}
          {summary.remaining_balance_rub == null
            ? "нет активного зачёта"
            : formatRub(summary.remaining_balance_rub)}
        </p>
        <p className="font-medium">К оплате партнёром: {formatRub(summary.due_rub)}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border p-3">
      <p className="text-sm font-medium">Закрыть дело</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label>Гонорар, ₽</Label>
          <Input
            type="number"
            min={0}
            value={feeRub}
            onChange={(e) => handleFeeChange(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Комиссия платформы, ₽ (25%, редактируемо)</Label>
          <Input
            type="number"
            min={0}
            value={platformFeeRub}
            onChange={(e) => {
              setPlatformFeeTouched(true);
              setPlatformFeeRub(e.target.value);
            }}
          />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label>Оценка клиента</Label>
        <Select value={score} onValueChange={setScore}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[5, 4, 3, 2, 1].map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-2">
        <Label>Комментарий клиента (со слов клиента)</Label>
        <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} />
      </div>
      <Button onClick={handleSubmit} disabled={isPending}>
        {isPending ? "Закрываем..." : "Закрыть дело и применить зачёт"}
      </Button>
    </div>
  );
}
