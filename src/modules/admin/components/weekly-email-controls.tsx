"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";

import { FormError } from "@/components/form-error";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { postRequest } from "@/platform/http/post-request";
import { API_ROUTES } from "@/platform/http/routes";
import { WEEKDAYS, type WeeklySchedule } from "@/platform/weekly-email/schedule";

const messageSchema = z.object({ message: z.string() });
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const SELECT_CLASSES = "type-body block min-h-12 w-full rounded-input border-0 bg-card px-5 py-2.5 shadow-[inset_0_0_0_1.5px_var(--input)]";

export function WeeklyScheduleForm({ schedule, timeZones }: { schedule: WeeklySchedule; timeZones: readonly string[] }) {
  const router = useRouter();
  const [weekday, setWeekday] = useState(schedule.weekday);
  const [hour, setHour] = useState(schedule.hour);
  const [timeZone, setTimeZone] = useState(schedule.timeZone);
  const save = useMutation({
    mutationFn: () => postRequest(API_ROUTES.adminWeeklyEmailSchedule, { weekday, hour, timeZone }, messageSchema),
    onSuccess: () => router.refresh(),
  });
  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="weekly-day">Day</Label>
          <select id="weekly-day" className={SELECT_CLASSES} value={weekday} onChange={(event) => setWeekday(Number(event.target.value))}>
            {WEEKDAYS.map((name, index) => (
              <option key={name} value={index}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="weekly-hour">Time</Label>
          <select id="weekly-hour" className={SELECT_CLASSES} value={hour} onChange={(event) => setHour(Number(event.target.value))}>
            {HOURS.map((value) => (
              <option key={value} value={value}>
                {String(value).padStart(2, "0")}:00
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="weekly-time-zone">Time zone</Label>
        <Input id="weekly-time-zone" list="weekly-time-zones" value={timeZone} onChange={(event) => setTimeZone(event.target.value)} autoComplete="off" />
        <datalist id="weekly-time-zones">
          {timeZones.map((zone) => (
            <option key={zone} value={zone} />
          ))}
        </datalist>
      </div>
      {save.isSuccess ? <Alert variant="success">{save.data.message}</Alert> : null}
      <FormError message={save.error?.message ?? null} />
      <div>
        <Button type="submit" disabled={save.isPending} className="max-sm:w-full">
          Save the schedule
        </Button>
      </div>
    </form>
  );
}

const testSchema = z.object({ outcome: z.string(), message: z.string() });

export function WeeklyTestButton() {
  const send = useMutation({ mutationFn: () => postRequest(API_ROUTES.adminWeeklyEmailTest, {}, testSchema) });
  return (
    <div className="grid gap-3">
      <div>
        <Button variant="outline" disabled={send.isPending} onClick={() => send.mutate()} className="max-sm:w-full">
          Send a test to me
        </Button>
      </div>
      {send.isSuccess ? <Alert variant={send.data.outcome === "sent" || send.data.outcome === "queued" ? "success" : "info"}>{send.data.message}</Alert> : null}
      <FormError message={send.error?.message ?? null} />
    </div>
  );
}
