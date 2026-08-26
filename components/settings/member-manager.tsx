"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { KeyRound, Plus, Users } from "lucide-react";
import { Role } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar } from "@/components/shared/avatar";
import { EmptyState } from "@/components/shared/empty-state";
import {
  createMemberAction,
  resetMemberPasswordAction,
  setMemberActiveAction,
  updateMemberAction,
} from "@/server/actions/member";

export type MemberRow = {
  id: string;
  email: string;
  name: string;
  role: Role;
  jobTitle: string | null;
  avatarColor: string;
  isActive: boolean;
  mustChangePassword: boolean;
  taskCount: number;
};

const labelClass = "text-muted-foreground text-xs font-semibold";
const fieldClass = "bg-input-bg h-11 rounded-xl";
const selectClass =
  "bg-input-bg border-line text-ink h-11 w-full rounded-xl border px-3 text-sm";

export function MemberManager({
  members,
  currentUserId,
}: {
  members: MemberRow[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<string | null>(null);
  const [resetting, setResetting] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const [form, setForm] = useState({
    name: "",
    email: "",
    jobTitle: "",
    role: Role.MEMBER as Role,
    temporaryPassword: "",
  });

  const run = (
    fn: () => Promise<{ ok: boolean; message?: string }>,
    success: string,
    after?: () => void,
  ) =>
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        toast.success(success);
        after?.();
        router.refresh();
      } else {
        toast.error(result.message ?? "ทำรายการไม่สำเร็จ");
      }
    });

  const add = () =>
    run(
      () => createMemberAction(form),
      "เพิ่มสมาชิกแล้ว",
      () =>
        setForm({
          name: "",
          email: "",
          jobTitle: "",
          role: Role.MEMBER,
          temporaryPassword: "",
        }),
    );

  return (
    <>
      <section className="border-line bg-surface mb-4 rounded-[18px] border p-5 shadow-sm">
        <h2 className="mb-3 text-[15.5px] font-bold">เพิ่มสมาชิกใหม่</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="m-name" className={labelClass}>
              ชื่อ
            </Label>
            <Input
              id="m-name"
              className={fieldClass}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="m-email" className={labelClass}>
              อีเมล
            </Label>
            <Input
              id="m-email"
              type="email"
              className={fieldClass}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="m-title" className={labelClass}>
              ตำแหน่ง
            </Label>
            <Input
              id="m-title"
              className={fieldClass}
              value={form.jobTitle}
              placeholder="เช่น Developer, Designer"
              onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="m-role" className={labelClass}>
              สิทธิ์
            </Label>
            <select
              id="m-role"
              className={selectClass}
              value={form.role}
              onChange={(e) =>
                setForm({ ...form, role: e.target.value as Role })
              }
            >
              <option value={Role.MEMBER}>ทีมงาน</option>
              <option value={Role.LEADER}>หัวหน้าทีม</option>
            </select>
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="m-pass" className={labelClass}>
              รหัสผ่านชั่วคราว (ผู้ใช้ต้องเปลี่ยนเมื่อเข้าสู่ระบบครั้งแรก)
            </Label>
            <Input
              id="m-pass"
              className={fieldClass}
              value={form.temporaryPassword}
              onChange={(e) =>
                setForm({ ...form, temporaryPassword: e.target.value })
              }
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button type="button" onClick={add} disabled={pending}>
            <Plus size={16} strokeWidth={2} />
            เพิ่มสมาชิก
          </Button>
        </div>
      </section>

      {members.length === 0 ? (
        <div className="border-line bg-surface rounded-[18px] border">
          <EmptyState icon={Users} message="ยังไม่มีสมาชิกในทีม" />
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {members.map((member) => (
            <li
              key={member.id}
              className="border-line bg-surface rounded-2xl border p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-center gap-3">
                <Avatar user={member} size={36} />
                <div className="min-w-0">
                  <p className="text-sm font-bold">
                    {member.name}
                    {member.id === currentUserId ? (
                      <span className="text-muted-foreground ml-1 text-xs">
                        (คุณ)
                      </span>
                    ) : null}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {member.email} · {member.jobTitle ?? "ทีมงาน"} ·{" "}
                    {member.taskCount} งาน
                  </p>
                </div>

                <span className="bg-primary-soft text-primary-ink rounded-full px-2 py-0.5 text-[11px] font-bold">
                  {member.role === Role.LEADER ? "หัวหน้าทีม" : "ทีมงาน"}
                </span>
                {!member.isActive ? (
                  <span className="bg-hover text-muted-foreground rounded-full px-2 py-0.5 text-[11px] font-bold">
                    ปิดใช้งาน
                  </span>
                ) : null}
                {member.mustChangePassword ? (
                  <span
                    className="rounded-full px-2 py-0.5 text-[11px] font-bold"
                    style={{
                      color: "var(--color-doing-ink)",
                      background:
                        "color-mix(in srgb, var(--color-doing) 16%, transparent)",
                    }}
                  >
                    ต้องเปลี่ยนรหัสผ่าน
                  </span>
                ) : null}

                <div className="ml-auto flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      setEditing(editing === member.id ? null : member.id)
                    }
                  >
                    แก้ไข
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={pending}
                    onClick={() => {
                      setResetting(resetting === member.id ? null : member.id);
                      setNewPassword("");
                    }}
                  >
                    <KeyRound size={14} strokeWidth={2} />
                    ตั้งรหัสใหม่
                  </Button>
                  <Button
                    type="button"
                    variant={member.isActive ? "destructive" : "secondary"}
                    size="sm"
                    disabled={pending || member.id === currentUserId}
                    onClick={() =>
                      run(
                        () =>
                          setMemberActiveAction({
                            id: member.id,
                            isActive: !member.isActive,
                          }),
                        member.isActive ? "ปิดใช้งานแล้ว" : "เปิดใช้งานแล้ว",
                      )
                    }
                  >
                    {member.isActive ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                  </Button>
                </div>
              </div>

              {editing === member.id ? (
                <EditMemberRow
                  member={member}
                  pending={pending}
                  onCancel={() => setEditing(null)}
                  onSave={(values) =>
                    run(
                      () => updateMemberAction({ id: member.id, ...values }),
                      "บันทึกแล้ว",
                      () => setEditing(null),
                    )
                  }
                />
              ) : null}

              {resetting === member.id ? (
                <div className="border-line mt-3 flex flex-wrap items-end gap-2 border-t pt-3">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor={`pw-${member.id}`} className={labelClass}>
                      รหัสผ่านชั่วคราวใหม่
                    </Label>
                    <Input
                      id={`pw-${member.id}`}
                      className={fieldClass}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      run(
                        () =>
                          resetMemberPasswordAction({
                            id: member.id,
                            temporaryPassword: newPassword,
                          }),
                        "ตั้งรหัสผ่านใหม่แล้ว",
                        () => setResetting(null),
                      )
                    }
                  >
                    บันทึก
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setResetting(null)}
                  >
                    ยกเลิก
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function EditMemberRow({
  member,
  pending,
  onCancel,
  onSave,
}: {
  member: MemberRow;
  pending: boolean;
  onCancel: () => void;
  onSave: (values: { name: string; jobTitle: string; role: Role }) => void;
}) {
  const [name, setName] = useState(member.name);
  const [jobTitle, setJobTitle] = useState(member.jobTitle ?? "");
  const [role, setRole] = useState<Role>(member.role);

  return (
    <div className="border-line mt-3 grid gap-3 border-t pt-3 sm:grid-cols-3">
      <div className="flex flex-col gap-2">
        <Label htmlFor={`n-${member.id}`} className={labelClass}>
          ชื่อ
        </Label>
        <Input
          id={`n-${member.id}`}
          className={fieldClass}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`t-${member.id}`} className={labelClass}>
          ตำแหน่ง
        </Label>
        <Input
          id={`t-${member.id}`}
          className={fieldClass}
          value={jobTitle}
          onChange={(e) => setJobTitle(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`r-${member.id}`} className={labelClass}>
          สิทธิ์
        </Label>
        <select
          id={`r-${member.id}`}
          className={selectClass}
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
        >
          <option value={Role.MEMBER}>ทีมงาน</option>
          <option value={Role.LEADER}>หัวหน้าทีม</option>
        </select>
      </div>
      <div className="flex gap-2 sm:col-span-3 sm:justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          ยกเลิก
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={pending}
          onClick={() => onSave({ name, jobTitle, role })}
        >
          บันทึก
        </Button>
      </div>
    </div>
  );
}
