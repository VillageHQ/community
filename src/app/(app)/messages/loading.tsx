import { LoadingState } from "@/components/loading-state";

const LOADING_MESSAGE = "Just a moment…";

export default function MessagesLoading() {
  return (
    <div className="flex h-full items-center justify-center bg-card max-lg:rounded-card-phone max-lg:shadow-panel">
      <LoadingState title={LOADING_MESSAGE} />
    </div>
  );
}
