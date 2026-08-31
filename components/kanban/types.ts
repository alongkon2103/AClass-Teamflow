import type { TaskStatus, Priority } from "@prisma/client";

/** Board data shared between the server page and the client board. */
export type BoardTaskView = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  startDate: string; // YYYY-MM-DD, already normalised to Bangkok
  dueDate: string | null;
  /** Calendar day the work finished; drives the countdown into the archive. */
  completedAt: string | null;
  /** Stands in for completedAt on older tasks that never recorded one. */
  updatedAt: string;
  sortOrder: number;
  assigneeIds: string[];
  assignees: { id: string; name: string; avatarColor: string }[];
  gameId: string | null;
  gameNote: string | null;
  progressCount: number;
};

export type MemberOption = {
  id: string;
  name: string;
  jobTitle: string | null;
  avatarColor: string;
  avatarUrl: string | null;
};

export type GameOption = { id: string; name: string };
