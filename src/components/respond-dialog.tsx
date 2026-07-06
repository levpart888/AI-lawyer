"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { respondToCase } from "@/app/cases/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";

export function RespondDialog({
  caseId,
  caseTitle,
}: {
  caseId: string;
  caseTitle: string;
}) {
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    startTransition(async () => {
      const { error } = await respondToCase(caseId, comment);
      if (error) {
        toast.error(error);
        return;
      }
      toast.success("Отклик отправлен");
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Откликнуться</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Отклик на дело</DialogTitle>
          <DialogDescription>{caseTitle}</DialogDescription>
        </DialogHeader>
        <Textarea
          placeholder="Комментарий (необязательно)"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={4}
        />
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Отмена</Button>
          </DialogClose>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? "Отправляем..." : "Отправить отклик"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
