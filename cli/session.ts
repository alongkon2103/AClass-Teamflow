import { createInterface } from "node:readline";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import bcrypt from "bcryptjs";
import type { PrismaClient } from "@prisma/client";
import type { Actor } from "@/lib/permissions";

/**
 * Who the CLI is acting as.
 *
 * This is not a security boundary: anyone who can reach DATABASE_URL can
 * already read and write everything. Signing in decides which account the
 * services see, so permissions, authorship and notifications come out right.
 */
export type Session = {
  userId: string;
  email: string;
  name: string;
};

const SESSION_PATH = join(homedir(), ".teamflow", "session.json");

export function readSession(): Session | null {
  if (!existsSync(SESSION_PATH)) return null;

  try {
    const parsed: unknown = JSON.parse(readFileSync(SESSION_PATH, "utf8"));
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "userId" in parsed &&
      typeof (parsed as Session).userId === "string"
    ) {
      return parsed as Session;
    }
  } catch {
    // A corrupt file means "not signed in" rather than a crash.
  }
  return null;
}

function writeSession(session: Session): void {
  mkdirSync(dirname(SESSION_PATH), { recursive: true });
  writeFileSync(SESSION_PATH, `${JSON.stringify(session, null, 2)}\n`);
  // Readable only by its owner, the same as an ssh key.
  chmodSync(SESSION_PATH, 0o600);
}

export function clearSession(): void {
  if (existsSync(SESSION_PATH)) rmSync(SESSION_PATH);
}

export function sessionPath(): string {
  return SESSION_PATH;
}

/** Loads the signed-in account, refusing if it was deactivated or removed. */
export async function requireActor(
  db: PrismaClient,
): Promise<Actor & { name: string; email: string }> {
  const session = readSession();
  if (!session) {
    throw new Error("ยังไม่ได้เข้าสู่ระบบ — ใช้คำสั่ง `teamflow login` ก่อน");
  }

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { id: true, role: true, name: true, email: true, isActive: true },
  });
  if (!user || !user.isActive) {
    clearSession();
    throw new Error("บัญชีนี้ถูกปิดหรือถูกลบแล้ว — กรุณาเข้าสู่ระบบใหม่");
  }

  return {
    id: user.id,
    role: user.role,
    name: user.name,
    email: user.email,
  };
}

export async function login(
  db: PrismaClient,
  emailFlag: string | null,
): Promise<void> {
  const email = (emailFlag ?? (await prompt("อีเมล: "))).trim().toLowerCase();
  // Piped input lets the login be scripted without the password ever appearing
  // in argv, where `ps` would show it.
  const password = process.stdin.isTTY
    ? await promptHidden("รหัสผ่าน: ")
    : await readStdin();

  const user = await db.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      name: true,
      passwordHash: true,
      isActive: true,
    },
  });

  // Same message either way, so a wrong email and a wrong password look alike.
  const ok = user ? await bcrypt.compare(password, user.passwordHash) : false;
  if (!user || !ok) throw new Error("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
  if (!user.isActive) throw new Error("บัญชีนี้ถูกปิดการใช้งาน");

  writeSession({ userId: user.id, email: user.email, name: user.name });
}

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk: string) => (data += chunk));
    process.stdin.on("end", () => resolve(data.replace(/\r?\n$/, "")));
    process.stdin.on("error", reject);
  });
}

function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

/** Reads a line without echoing it, so a password never lands in the scrollback. */
function promptHidden(question: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const input = process.stdin;
    if (!input.isTTY) {
      reject(new Error("ต้องรันคำสั่งนี้ใน terminal จริงเพื่อกรอกรหัสผ่าน"));
      return;
    }

    process.stdout.write(question);
    input.setRawMode(true);
    input.resume();
    input.setEncoding("utf8");

    let value = "";
    const onData = (chunk: string) => {
      for (const char of chunk) {
        // Enter
        if (char === "\r" || char === "\n") {
          input.setRawMode(false);
          input.pause();
          input.off("data", onData);
          process.stdout.write("\n");
          resolve(value);
          return;
        }
        // Ctrl+C
        if (char === "\u0003") {
          input.setRawMode(false);
          input.pause();
          input.off("data", onData);
          process.stdout.write("\n");
          reject(new Error("ยกเลิกแล้ว"));
          return;
        }
        // Backspace / delete
        if (char === "\u007f" || char === "\b") {
          value = value.slice(0, -1);
          continue;
        }
        value += char;
      }
    };

    input.on("data", onData);
  });
}
