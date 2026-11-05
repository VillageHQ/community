import type { LucideIcon } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

type NoticeCardProps = {
  title: string;
  description: string;
  icon: LucideIcon;
  href?: string;
  action?: string;
};

export function NoticeCard({ title, description, icon, href, action }: NoticeCardProps) {
  return (
    <div className="rounded-panel bg-card shadow-panel">
      <EmptyState headingLevel="h1" icon={icon} title={title} description={description}>
        {href ? (
          <Button asChild size="lg">
            <Link href={href}>{action}</Link>
          </Button>
        ) : null}
      </EmptyState>
    </div>
  );
}
