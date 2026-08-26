import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { ChangePasswordForm } from "@/components/settings/change-password-form";

export default async function AccountSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <>
      <PageHeader
        title="บัญชีของฉัน"
        description="เปลี่ยนรหัสผ่านของบัญชีคุณ"
      />
      <ChangePasswordForm forced={user.mustChangePassword} />
    </>
  );
}
