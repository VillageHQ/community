import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ROUTES } from "@/platform/http/routes";
import { SEARCH_PROMPT_MAX_LENGTH, SEARCH_PROMPT_PARAM } from "@/modules/network/contract";

const TITLE_ID = "today-search-title";
const HINT_ID = "today-search-hint";

// The top of Today: one way to start an intro. It opens network search with the words already searched.
export function TodaySearchBox({ communityName }: { communityName: string }) {
  return (
    <form
      role="search"
      aria-labelledby={TITLE_ID}
      action={ROUTES.network}
      method="get"
      className="grid gap-3 rounded-card-phone bg-card p-card-phone shadow-panel sm:rounded-card sm:p-5"
    >
      <label id={TITLE_ID} htmlFor={SEARCH_PROMPT_PARAM} className="type-h3">
        Who do you want to meet?
      </label>
      <div className="flex gap-2">
        <Input
          id={SEARCH_PROMPT_PARAM}
          name={SEARCH_PROMPT_PARAM}
          required
          maxLength={SEARCH_PROMPT_MAX_LENGTH}
          pattern=".*\S.*"
          title="Describe who you want to meet."
          aria-describedby={HINT_ID}
          placeholder="A buyer at a hospital group…"
          className="min-h-12 flex-1 px-4"
        />
        <Button type="submit">Find</Button>
      </div>
      <p id={HINT_ID} className="type-small text-foreground-soft">
        We show who in {communityName} knows them. You write one note.
      </p>
    </form>
  );
}
