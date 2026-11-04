import { LoadingPanel, PlaceholderRow } from "@/components/loading-state";

const LOADING_MESSAGE = "Just a moment…";
const PLACEHOLDER_ROWS = ["first", "second", "third"];

export default function AppLoading() {
  return (
    <div role="status" className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_296px] lg:gap-7">
      <div className="grid gap-5">
        <LoadingPanel title={LOADING_MESSAGE} />
        <div className="grid gap-2.5">
          {PLACEHOLDER_ROWS.map((row) => (
            <PlaceholderRow key={row} />
          ))}
        </div>
      </div>
      <div className="hidden lg:block">
        <PlaceholderRow />
      </div>
    </div>
  );
}
