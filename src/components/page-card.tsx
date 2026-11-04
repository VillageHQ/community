import type { ReactNode } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type PageCardProps = { title: string; description?: string; children?: ReactNode };

export function PageCard({ title, description, children }: PageCardProps) {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>
            <h1>{title}</h1>
          </CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </CardHeader>
        {children ? <CardContent className="grid gap-4">{children}</CardContent> : null}
      </Card>
    </main>
  );
}
