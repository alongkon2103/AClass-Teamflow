"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  feedbackFormSchema,
  type FeedbackFormInput,
  type FeedbackFormValues,
} from "@/lib/validators/feedback";
import { createFeedbackAction } from "@/server/actions/feedback";
import type { GameOption } from "@/components/kanban/types";

const labelClass = "text-muted-foreground text-xs font-semibold";
const fieldClass = "bg-input-bg h-11 rounded-xl";
const selectClass =
  "bg-input-bg border-line text-ink h-11 w-full rounded-xl border px-3 text-sm";

export function FeedbackDialog({
  games,
  suggestedTicket,
  today,
}: {
  games: GameOption[];
  suggestedTicket: string;
  today: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const form = useForm<FeedbackFormValues, unknown, FeedbackFormInput>({
    resolver: zodResolver(feedbackFormSchema),
    defaultValues: {
      customerName: "",
      ticketNumber: suggestedTicket,
      reportedAt: today,
      gameId: games[0]?.id ?? "",
      body: "",
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const result = await createFeedbackAction(values);
      if (result.ok) {
        toast.success(`บันทึกฟีดแบค ${result.data?.ticketNumber ?? ""} แล้ว`);
        form.reset({
          customerName: "",
          ticketNumber: "",
          reportedAt: today,
          gameId: games[0]?.id ?? "",
          body: "",
        });
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  });

  const errors = form.formState.errors;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button>
            <Plus size={16} strokeWidth={2} />
            เพิ่ม Feedback
          </Button>
        }
      />
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>เพิ่ม Feedback</DialogTitle>
          <DialogDescription>
            บันทึกฟีดแบคจากลูกค้าพร้อมหมายเลข Ticket
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="customerName" className={labelClass}>
                ชื่อลูกค้า
              </Label>
              <Input
                id="customerName"
                className={fieldClass}
                {...form.register("customerName")}
              />
              {errors.customerName ? (
                <p className="text-danger-ink text-xs">
                  {errors.customerName.message}
                </p>
              ) : null}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="ticketNumber" className={labelClass}>
                Ticket
              </Label>
              <Input
                id="ticketNumber"
                className={fieldClass}
                {...form.register("ticketNumber")}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="reportedAt" className={labelClass}>
                วันที่แจ้ง
              </Label>
              <Input
                id="reportedAt"
                type="date"
                className={fieldClass}
                {...form.register("reportedAt")}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="gameId" className={labelClass}>
                เกมที่แจ้ง
              </Label>
              <select
                id="gameId"
                className={selectClass}
                {...form.register("gameId")}
              >
                {games.length === 0 ? (
                  <option value="">ยังไม่มีเกมในคลัง</option>
                ) : null}
                {games.map((game) => (
                  <option key={game.id} value={game.id}>
                    {game.name}
                  </option>
                ))}
              </select>
              {errors.gameId ? (
                <p className="text-danger-ink text-xs">
                  {errors.gameId.message}
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="body" className={labelClass}>
              ฟีดแบคจากลูกค้า
            </Label>
            <Textarea
              id="body"
              rows={4}
              className="bg-input-bg rounded-xl"
              {...form.register("body")}
            />
            {errors.body ? (
              <p className="text-danger-ink text-xs">{errors.body.message}</p>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              ยกเลิก
            </Button>
            <Button type="submit" disabled={pending || games.length === 0}>
              {pending ? "กำลังบันทึก" : "บันทึก"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
