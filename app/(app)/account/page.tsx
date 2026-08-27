import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/shared/page-header";
import { ChangePasswordForm } from "@/components/settings/change-password-form";
import { AvatarUploader } from "@/components/settings/avatar-uploader";

export default async function AccountSettingsPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");

  // Straight from the database: the JWT still holds the photo from sign-in.
  const user = await db.user.findUnique({
    where: { id: session.id },
    select: {
      name: true,
      avatarColor: true,
      avatarUrl: true,
      mustChangePassword: true,
    },
  });
  if (!user) redirect("/login");

  return (
    <>
      <PageHeader
        title="บัญชีของฉัน"
        description="ตั้งรูปโปรไฟล์และเปลี่ยนรหัสผ่านของบัญชีคุณ"
      />
      <AvatarUploader
        user={{
          name: user.name,
          avatarColor: user.avatarColor,
          avatarUrl: user.avatarUrl,
        }}
      />
      <ChangePasswordForm forced={user.mustChangePassword} />
    </>
  );
}
