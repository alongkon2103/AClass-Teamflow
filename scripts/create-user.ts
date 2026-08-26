/**
 * Creates (or updates) a single user from the command line.
 *
 * Needed to bootstrap the first LEADER on a fresh deployment, before the member
 * management UI exists. Re-running with the same email resets that user's
 * password rather than failing.
 *
 *   pnpm user:create <email> <password> <name> [LEADER|MEMBER] [jobTitle]
 *
 * The password is read from argv and only ever stored as a bcrypt hash.
 */
import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { AVATAR_PALETTE } from "../lib/constants";

const prisma = new PrismaClient();
const BCRYPT_COST = 12;

async function main() {
  const [email, password, name, roleArg, jobTitle] = process.argv.slice(2);

  if (!email || !password || !name) {
    console.error(
      "Usage: pnpm user:create <email> <password> <name> [LEADER|MEMBER] [jobTitle]",
    );
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exit(1);
  }

  const role = roleArg === "MEMBER" ? Role.MEMBER : Role.LEADER;
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

  // Pick a colour no existing member is using (SPEC 5.8).
  const taken = new Set(
    (await prisma.user.findMany({ select: { avatarColor: true } })).map(
      (user) => user.avatarColor,
    ),
  );
  const avatarColor =
    AVATAR_PALETTE.find((colour) => !taken.has(colour)) ?? AVATAR_PALETTE[0];

  const user = await prisma.user.upsert({
    where: { email: email.trim().toLowerCase() },
    update: { passwordHash, role, isActive: true, mustChangePassword: false },
    create: {
      email: email.trim().toLowerCase(),
      name,
      passwordHash,
      role,
      jobTitle: jobTitle ?? (role === Role.LEADER ? "หัวหน้าทีม" : "ทีมงาน"),
      avatarColor,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      jobTitle: true,
      avatarColor: true,
      isActive: true,
    },
  });

  console.log("User ready:", user);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
