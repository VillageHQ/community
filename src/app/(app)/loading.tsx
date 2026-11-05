import { LoadingPanel } from "@/components/loading-state";

const LOADING_MESSAGE = "Just a moment…";

export default function AppLoading() {
  return (
    <div role="status">
      <LoadingPanel title={LOADING_MESSAGE} />
    </div>
  );
}
