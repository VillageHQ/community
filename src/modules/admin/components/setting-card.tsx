import type { ReactNode } from "react";

import { Card, CardTitle } from "@/components/ui/card";

export function SettingCard({ title, tag, children }: { title: string; tag: ReactNode; children: ReactNode }) {
  return (
    <Card className="grid gap-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>{title}</CardTitle>
        {tag}
      </div>
      {children}
    </Card>
  );
}
