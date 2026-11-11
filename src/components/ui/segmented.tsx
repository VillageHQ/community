"use client";

import { cn } from "cn";
import Link from "next/link";

// Founderhall's segmented control (crop segmented-control.png): a Vellum track (3 px padding, radius 8); segments
// 32 px, 500 14 Graphite; the chosen one is Leaf with a small shadow and Ink text. "In our network / Everywhere",
// report periods, Ask / Update.
type Segment<Value extends string> = { value: Value; label: string };

type SegmentedControlProps<Value extends string> = {
  label: string;
  segments: readonly Segment<Value>[];
  value: Value;
  onChange: (value: Value) => void;
  // Fills its row, segments sharing the width (the sidebar's Console | View as a founder).
  isBlock?: boolean;
  className?: string;
};

export function SegmentedControl<Value extends string>({ label, segments, value, onChange, isBlock = false, className }: SegmentedControlProps<Value>) {
  return (
    <div role="group" aria-label={label} className={cn("fh-seg", isBlock && "fh-block", className)}>
      {segments.map((segment) => (
        <button key={segment.value} type="button" aria-pressed={segment.value === value} onClick={() => onChange(segment.value)}>
          {segment.label}
        </button>
      ))}
    </div>
  );
}

type SegmentedLinksProps = { label: string; links: readonly { href: string; label: string; isCurrent: boolean }[]; isBlock?: boolean; className?: string };

// The same control where each segment is its own address (report periods, search scope).
export function SegmentedLinks({ label, links, isBlock = false, className }: SegmentedLinksProps) {
  return (
    <div role="group" aria-label={label} className={cn("fh-seg", isBlock && "fh-block", className)}>
      {links.map((link) => (
        <Link key={link.href} href={link.href} className="fh-segbtn" aria-current={link.isCurrent ? "true" : undefined}>
          {link.label}
        </Link>
      ))}
    </div>
  );
}
