"use server";

import { AuthError, CredentialsSignin } from "next-auth";
import { signIn, signOut, LOGIN_ERROR_CODES } from "@/lib/auth";
import { loginSchema } from "@/lib/validators/auth";

export type ActionResult = { ok: boolean; message?: string };

const GENERIC_LOGIN_ERROR = "อีเมลหรือรหัสผ่านไม่ถูกต้อง";

const LOGIN_ERRORS: Record<string, string> = {
  [LOGIN_ERROR_CODES.invalid]: GENERIC_LOGIN_ERROR,
  [LOGIN_ERROR_CODES.rateLimited]:
    "พยายามเข้าสู่ระบบบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่",
};

/**
 * Credentials login. Returns a readable Thai message instead of throwing so the
 * form can render it inline; never reveals whether the email or password was wrong.
 */
export async function loginAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { ok: false, message: GENERIC_LOGIN_ERROR };
  }

  const callbackUrl = (formData.get("callbackUrl") as string) || undefined;

  try {
    // redirectTo lets Auth.js send the user on; the thrown redirect is expected.
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo:
        callbackUrl && callbackUrl.startsWith("/") ? callbackUrl : "/",
    });
    return { ok: true };
  } catch (error) {
    if (error instanceof CredentialsSignin) {
      return {
        ok: false,
        message: LOGIN_ERRORS[error.code] ?? GENERIC_LOGIN_ERROR,
      };
    }
    if (error instanceof AuthError) {
      // Anything else (misconfiguration, transport failure) is not the user's fault.
      return {
        ok: false,
        message: "เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
      };
    }
    // Next.js signals redirects by throwing; let those bubble up.
    throw error;
  }
}

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}
