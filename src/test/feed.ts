import type { Database } from "../database/client.ts";
import { comment, post } from "../database/feed-schema.ts";
import { POST_TYPES } from "../lib/feed/feed-api.ts";

type PostSeed = { authorId: string; body?: string; createdAt?: Date; pinnedAt?: Date; pinnedByUserId?: string };

export async function seedPost(database: Database, seed: PostSeed) {
  const [seeded] = await database
    .insert(post)
    .values({ type: POST_TYPES.plain, body: "A seeded post", ...seed })
    .returning({ id: post.id });
  if (!seeded) throw new Error("The seeded post is missing.");
  return seeded.id;
}

type CommentSeed = { postId: string; authorId: string; body?: string; createdAt?: Date };

export async function seedComment(database: Database, seed: CommentSeed) {
  const [seeded] = await database
    .insert(comment)
    .values({ body: "A seeded reply", ...seed })
    .returning({ id: comment.id });
  if (!seeded) throw new Error("The seeded comment is missing.");
  return seeded.id;
}
