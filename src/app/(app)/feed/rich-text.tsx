"use client";

import { cn } from "cn";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { collapseSegments, splitIntoSegments, TEXT_SEGMENTS, type TextSegment } from "@/lib/feed/post-text";

const LINK_RELATIONSHIP = "noopener noreferrer";

export const RICH_TEXT_TONES = { surface: "surface", accent: "accent" } as const;

type RichTextTone = (typeof RICH_TEXT_TONES)[keyof typeof RICH_TEXT_TONES];

const LINK_TONES: Record<RichTextTone, string> = {
  [RICH_TEXT_TONES.surface]: "text-brand-emphasis",
  [RICH_TEXT_TONES.accent]: "text-inherit",
};

const TOGGLE_TONES: Record<RichTextTone, string> = {
  [RICH_TEXT_TONES.surface]: "",
  [RICH_TEXT_TONES.accent]: "text-inherit hover:bg-transparent hover:text-inherit hover:underline",
};

function Segment({ segment, tone }: { segment: TextSegment; tone: RichTextTone }) {
  if (segment.kind === TEXT_SEGMENTS.text) return segment.text;
  return (
    <a
      href={segment.href}
      target="_blank"
      rel={LINK_RELATIONSHIP}
      className={cn("font-semibold underline hover:no-underline", LINK_TONES[tone])}
    >
      {segment.text}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

type RichTextProps = { text: string; className?: string; tone?: RichTextTone };

export function RichText({ text, className, tone = RICH_TEXT_TONES.surface }: RichTextProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const segments = splitIntoSegments(text);
  const collapsed = collapseSegments(segments);
  const shownSegments = isExpanded ? segments : collapsed.segments;

  return (
    <>
      <p className={cn("wrap-anywhere whitespace-pre-wrap", className)}>
        {shownSegments.map((segment, position) => (
          <Segment key={position} segment={segment} tone={tone} />
        ))}
      </p>
      {collapsed.isCollapsed ? (
        <Button
          type="button"
          variant="quiet"
          size="sm"
          aria-expanded={isExpanded}
          className={cn("mt-1 -ml-3 px-3", TOGGLE_TONES[tone])}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? "Show less" : "Show more"}
        </Button>
      ) : null}
    </>
  );
}
