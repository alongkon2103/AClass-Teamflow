import { PrismaClient } from "@prisma/client";

/**
 * The CLI's own database client.
 *
 * It does not reuse lib/db because that one logs errors itself: Prisma writes
 * a stack dump with the failing query straight to stderr, which is noise in
 * front of the one readable line the CLI prints instead. There is also no hot
 * reload here, so the singleton guard that lib/db needs is pointless.
 */
export const db = new PrismaClient({ log: [] });
