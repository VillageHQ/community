import { CircleQuestionMark, HandHelping, Heart, Lightbulb, Rocket, ThumbsUp, Trophy, type LucideIcon } from "lucide-react";

import { POST_TYPES, REACTIONS, type Reaction } from "@/lib/feed/feed-api";

export const POST_TYPE_DISPLAY = {
  [POST_TYPES.ask]: { label: "Ask", icon: CircleQuestionMark, tone: "accent" },
  [POST_TYPES.win]: { label: "Win", icon: Trophy, tone: "gold" },
  [POST_TYPES.offer]: { label: "Offer", icon: HandHelping, tone: "sage" },
} as const;

export const CHOOSABLE_POST_TYPES = [POST_TYPES.ask, POST_TYPES.win, POST_TYPES.offer] as const;

export const REACTION_DISPLAY: Record<Reaction, { label: string; icon: LucideIcon }> = {
  [REACTIONS.heart]: { label: "Heart", icon: Heart },
  [REACTIONS.thumbsUp]: { label: "Thumbs up", icon: ThumbsUp },
  [REACTIONS.idea]: { label: "Idea", icon: Lightbulb },
  [REACTIONS.rocket]: { label: "Rocket", icon: Rocket },
};

export const REACTION_ORDER: readonly Reaction[] = Object.values(REACTIONS);

export const SURFACE_TONES = { sunk: "sunk", surface: "surface" } as const;

export type SurfaceTone = (typeof SURFACE_TONES)[keyof typeof SURFACE_TONES];

export const SURFACE_TONE_CLASSES: Record<SurfaceTone, string> = {
  [SURFACE_TONES.sunk]: "bg-muted",
  [SURFACE_TONES.surface]: "bg-card",
};

export const FEED_AVATAR_SIZES = { composer: 48, post: 52, comment: 40, rail: 44 } as const;

export const POSTS_REGION_ID = "feed-posts";

export const ADMIN_DELETE_NOTE = "We'll keep a private record of the text, and that you deleted it.";

export function toPostElementId(postId: string) {
  return `post-${postId}`;
}

export function toReplyInputId(postId: string) {
  return `reply-${postId}`;
}

export const REPORT_NOTE =
  "It's saved for this community's admins. They'll see a copy, who wrote it and that you reported it. The author isn't told.";
