import { db } from "@/lib/db";
import { listGames } from "@/server/services/game";
import { PageHeader } from "@/components/shared/page-header";
import { GameManager } from "@/components/feedback/game-manager";

export default async function GamesSettingsPage() {
  // The settings layout already enforces the leader-only rule.
  const games = await listGames(db);

  return (
    <>
      <PageHeader
        title="คลังเกม"
        description="จัดการรายชื่อเกมที่ใช้เลือกในงานและฟีดแบค"
      />
      <GameManager games={games} />
    </>
  );
}
