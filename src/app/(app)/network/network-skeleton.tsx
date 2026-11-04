import { LoadingPanel, PlaceholderRow } from "@/components/loading-state";

const LOADING_MESSAGE = "Checking your network…";

export function NetworkSkeleton() {
  return (
    <div role="status" className="grid gap-5">
      <LoadingPanel title={LOADING_MESSAGE} />
      <PlaceholderRow />
      <PlaceholderRow />
    </div>
  );
}
