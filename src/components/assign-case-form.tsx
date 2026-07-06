"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { assignCase } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Candidate {
  id: string;
  full_name: string;
  role: string;
}

export function AssignCaseForm({
  caseId,
  candidates,
}: {
  caseId: string;
  candidates: Candidate[];
}) {
  const [executorId, setExecutorId] = useState<string>("");
  const [supervisorId, setSupervisorId] = useState<string>("none");
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    if (!executorId) {
      toast.error("Выберите исполнителя");
      return;
    }
    startTransition(async () => {
      try {
        await assignCase(
          caseId,
          executorId,
          supervisorId === "none" ? null : supervisorId,
        );
        toast.success("Дело назначено");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Ошибка назначения");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border p-3">
      <p className="text-sm font-medium">Назначить исполнителя</p>
      <Select value={executorId} onValueChange={setExecutorId}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Исполнитель" />
        </SelectTrigger>
        <SelectContent>
          {candidates.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.full_name} ({c.role === "partner" ? "партнёр" : "специалист"})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={supervisorId} onValueChange={setSupervisorId}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Супервизор (опционально)" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Без супервизора</SelectItem>
          {candidates
            .filter((c) => c.id !== executorId)
            .map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.full_name}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>

      <Button onClick={handleSubmit} disabled={isPending}>
        {isPending ? "Назначаем..." : "Назначить"}
      </Button>
    </div>
  );
}
