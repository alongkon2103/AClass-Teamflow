import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { listMembers } from "@/server/services/member";
import { PageHeader } from "@/components/shared/page-header";
import { MemberManager } from "@/components/settings/member-manager";

export default async function MembersSettingsPage() {
  // The settings layout already enforces the leader-only rule.
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const members = await listMembers(db);

  return (
    <>
      <PageHeader
        title="สมาชิกทีม"
        description="เพิ่ม แก้ไข และกำหนดสิทธิ์ของสมาชิกในทีม"
      />
      <MemberManager
        members={members.map((member) => ({
          id: member.id,
          email: member.email,
          name: member.name,
          role: member.role,
          jobTitle: member.jobTitle,
          avatarColor: member.avatarColor,
          isActive: member.isActive,
          mustChangePassword: member.mustChangePassword,
          taskCount: member._count.assignedTasks,
        }))}
        currentUserId={user.id}
      />
    </>
  );
}
