"use client";

import { cn } from "cn";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { collapseSegments, splitIntoSegments, TEXT_SEGMENTS, type TextSegment } from "@/lib/feed/post-text";

const LINK_RELATIONSHIP = "noopener noreferrer";

function Segment({ segment }: { segment: TextSegment }) {
  if (segment.kind === TEXT_SEGMENTS.text) return segment.text;
  return (
    <a
      href={segment.href}
      target="_blank"
      rel={LINK_RELATIONSHIP}
      className="font-semibold text-brand-emphasis underline hover:no-underline"
    >
      {segment.text}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

export function RichText({ text, className }: { text: string; className?: string }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const segments = splitIntoSegments(text);
  const collapsed = collapseSegments(segments);
  const shownSegments = isExpanded ? segments : collapsed.segments;

  return (
    <>
      <p className={cn("wrap-anywhere whitespace-pre-wrap", className)}>
        {shownSegments.map((segment, position) => (
          <Segment key={position} segment={segment} />
        ))}
      </p>
      {collapsed.isCollapsed ? (
        <Button
          type="button"
          variant="quiet"
          size="sm"
          aria-expanded={isExpanded}
          className="mt-1 -ml-3 px-3"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? "Show less" : "Show more"}
        </Button>
      ) : null}
    </>
  );
}
