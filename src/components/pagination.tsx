import { ArrowLeft, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";

type PaginationProps = { page: number; pageCount: number; label: string; onPageChange: (page: number) => void };

export function Pagination({ page, pageCount, label, onPageChange }: PaginationProps) {
  if (pageCount <= 1) return null;
  return (
    <nav aria-label={label} className="mt-6 flex flex-wrap items-center justify-center gap-3">
      <Button type="button" variant="outline" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        <ArrowLeft aria-hidden="true" />
        Previous
      </Button>
      <span className="type-small px-1 font-semibold text-foreground-soft">
        Page {page} of {pageCount}
      </span>
      <Button type="button" variant="outline" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}>
        Next
        <ArrowRight aria-hidden="true" />
      </Button>
    </nav>
  );
}
