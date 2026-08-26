"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Umbrella } from "lucide-react";
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
import { Avatar } from "@/components/shared/avatar";
import { createLeaveAction } from "@/server/actions/leave";
import type { MemberOption } from "@/components/kanban/types";

const labelClass = "text-muted-foreground text-xs font-semibold";
const fieldClass = "bg-input-bg h-11 rounded-xl";

export function LeaveDialog({
  self,
  members,
  canChooseUser,
  today,
}: {
  self: MemberOption;
  members: MemberOption[];
  canChooseUser: boolean;
  today: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState(self.id);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  const submit = () => {
    startTransition(async () => {
      const result = await createLeaveAction({
        userId: canChooseUser ? userId : self.id,
        startDate,
        endDate,
        reason,
      });
      if (result.ok) {
        toast.success("ส่งคำขอลาแล้ว");
        setOpen(false);
        setReason("");
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button>
            <Umbrella size={16} strokeWidth={2} />
            ขอลางาน
          </Button>
        }
      />
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>ขอลางาน</DialogTitle>
          <DialogDescription>
            เลือกช่วงวันที่และระบุเหตุผลเพื่อส่งให้หัวหน้าทีมอนุมัติ
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="leave-user" className={labelClass}>
              ผู้ลา
            </Label>
            {canChooseUser ? (
              <select
                id="leave-user"
                value={userId}
                onChange={(event) => setUserId(event.target.value)}
                className="bg-input-bg border-line text-ink h-11 w-full rounded-xl border px-3 text-sm"
              >
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                    {member.jobTitle ? ` · ${member.jobTitle}` : ""}
                  </option>
                ))}
              </select>
            ) : (
              <div className="bg-hover flex items-center gap-2.5 rounded-xl p-2.5">
                <Avatar user={self} size={28} />
                <span className="text-sm font-semibold">{self.name}</span>
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="leave-start" className={labelClass}>
                วันเริ่มลา
              </Label>
              <Input
                id="leave-start"
                type="date"
                value={startDate}
                onChange={(event) => {
                  setStartDate(event.target.value);
                  // Keep the range valid as the start moves past the end.
                  if (endDate < event.target.value)
                    setEndDate(event.target.value);
                }}
                className={fieldClass}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="leave-end" className={labelClass}>
                ถึงวันที่
              </Label>
              <Input
                id="leave-end"
                type="date"
                value={endDate}
                min={startDate}
                onChange={(event) => setEndDate(event.target.value)}
                className={fieldClass}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="leave-reason" className={labelClass}>
              เหตุผล
            </Label>
            <Input
              id="leave-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="เช่น ลาป่วย ธุระส่วนตัว"
              className={fieldClass}
            />
          </div>
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
          <Button type="button" onClick={submit} disabled={pending}>
            {pending ? "กำลังส่ง" : "ส่งคำขอลา"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
