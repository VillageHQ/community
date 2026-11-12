import pg from "pg";

type WatchedClient = { _activeQuery?: unknown; _queryQueue?: unknown[] };
type QueryArgs = Parameters<pg.Client["query"]>;

// Records every query sent while its connection is still busy with another. pg 8 queues those with a deprecation
// warning (once per process), and pg 9 will refuse them. Two queries at once on a pool are fine (each takes its own
// connection); on a transaction they are not.
export function watchQueryOverlap() {
  const overlaps: string[] = [];
  const original = pg.Client.prototype.query;
  pg.Client.prototype.query = function (this: pg.Client & WatchedClient, ...args: QueryArgs) {
    if (this._activeQuery || (this._queryQueue?.length ?? 0) > 0) {
      const [first] = args as unknown[];
      const text = typeof first === "string" ? first : String((first as { text?: unknown } | null)?.text ?? first);
      overlaps.push(text.slice(0, 160));
    }
    return (original as (...rest: QueryArgs) => unknown).apply(this, args);
  } as typeof original;
  return {
    overlaps,
    stop: () => {
      pg.Client.prototype.query = original;
    },
  };
}
