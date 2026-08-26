import { differenceInCalendarDays } from "date-fns";
import { formatCalendarDate, todayInBangkok } from "@/lib/date";
import { formatThaiDate } from "@/lib/format";

/** "วันนี้" / "เมื่อวาน" / "N วันก่อน" / an absolute date further back. */
export function relativeThaiTime(iso: string, now: Date = new Date()): string {
  const days = differenceInCalendarDays(now, new Date(iso));
  if (days <= 0) return "วันนี้";
  if (days === 1) return "เมื่อวาน";
  if (days < 7) return `${days} วันก่อน`;
  return formatThaiDate(formatCalendarDate(new Date(iso)));
}

export { todayInBangkok };
