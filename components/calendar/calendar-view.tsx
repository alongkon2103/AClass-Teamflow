"use client";

import { useState } from "react";
import { MonthGrid } from "./month-grid";
import { DayDetailDialog } from "./day-detail";
import type { CalendarMonth } from "@/server/services/calendar";

/** Holds the selected-day state shared by the grid and the detail dialog. */
export function CalendarView({
  year,
  month,
  data,
  today,
}: {
  year: number;
  month: number;
  data: CalendarMonth;
  today: string;
}) {
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  return (
    <>
      <MonthGrid
        year={year}
        month={month}
        data={data}
        today={today}
        onSelectDay={setSelectedDay}
      />
      <DayDetailDialog
        day={selectedDay}
        today={today}
        onClose={() => setSelectedDay(null)}
      />
    </>
  );
}
