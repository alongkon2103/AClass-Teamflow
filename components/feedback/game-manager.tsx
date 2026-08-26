"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Gamepad2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/empty-state";
import {
  createGameAction,
  deleteGameAction,
  setGameActiveAction,
} from "@/server/actions/game";

export type GameRow = {
  id: string;
  name: string;
  isActive: boolean;
  feedbackCount: number;
  taskCount: number;
  canDelete: boolean;
};

export function GameManager({ games }: { games: GameRow[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [confirming, setConfirming] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (
    fn: () => Promise<{ ok: boolean; message?: string }>,
    success: string,
  ) =>
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        toast.success(success);
        router.refresh();
      } else {
        toast.error(result.message ?? "ทำรายการไม่สำเร็จ");
      }
    });

  const add = () => {
    if (!name.trim()) {
      toast.error("กรุณากรอกชื่อเกม");
      return;
    }
    run(() => createGameAction({ name }), "เพิ่มเกมแล้ว");
    setName("");
  };

  return (
    <>
      <div className="border-line bg-surface mb-4 rounded-[18px] border p-5 shadow-sm">
        <label
          htmlFor="game-name"
          className="text-muted-foreground text-xs font-semibold"
        >
          เพิ่มเกมใหม่
        </label>
        <div className="mt-2 flex gap-2">
          <Input
            id="game-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                add();
              }
            }}
            placeholder="ชื่อเกม"
            className="bg-input-bg h-11 rounded-xl"
          />
          <Button type="button" onClick={add} disabled={pending}>
            <Plus size={16} strokeWidth={2} />
            เพิ่ม
          </Button>
        </div>
      </div>

      {games.length === 0 ? (
        <div className="border-line bg-surface rounded-[18px] border">
          <EmptyState
            icon={Gamepad2}
            message="ยังไม่มีเกมในคลัง เพิ่มได้จากช่องด้านบน"
          />
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {games.map((game) => (
            <li
              key={game.id}
              className="border-line bg-surface flex flex-wrap items-center gap-3 rounded-2xl border p-4 shadow-sm"
            >
              <Gamepad2
                size={18}
                strokeWidth={2}
                className="text-primary-ink shrink-0"
                aria-hidden="true"
              />
              <span className="text-sm font-bold">{game.name}</span>
              {!game.isActive ? (
                <span className="bg-hover text-muted-foreground rounded-full px-2 py-0.5 text-[11px] font-bold">
                  ปิดใช้งาน
                </span>
              ) : null}
              <span className="text-muted-foreground text-xs">
                {game.taskCount} งาน · {game.feedbackCount} ฟีดแบค
              </span>

              <div className="ml-auto flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    run(
                      () =>
                        setGameActiveAction({
                          id: game.id,
                          isActive: !game.isActive,
                        }),
                      game.isActive ? "ปิดใช้งานเกมแล้ว" : "เปิดใช้งานเกมแล้ว",
                    )
                  }
                >
                  {game.isActive ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                </Button>

                {game.canDelete ? (
                  confirming === game.id ? (
                    <span className="flex items-center gap-2">
                      <span className="text-danger-ink text-xs font-semibold">
                        ลบถาวร?
                      </span>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        disabled={pending}
                        onClick={() => {
                          run(
                            () => deleteGameAction({ id: game.id }),
                            "ลบเกมแล้ว",
                          );
                          setConfirming(null);
                        }}
                      >
                        ยืนยัน
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirming(null)}
                      >
                        ยกเลิก
                      </Button>
                    </span>
                  ) : (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={pending}
                      onClick={() => setConfirming(game.id)}
                    >
                      <Trash2 size={14} strokeWidth={2} />
                      ลบ
                    </Button>
                  )
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
