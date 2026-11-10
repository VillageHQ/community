import { ExternalTextLink } from "@/components/external-text-link";
import { VILLAGE_PROFILE_REMOVAL_URL } from "@/platform/village/links";

type DisclosureItem = { when: string; what: string };

const SENT_ITEMS: DisclosureItem[] = [
  { when: "When you join network search", what: "Your email and a random ID number. Not your name or your card." },
  { when: "When you connect your network", what: "You connect it on Village's own screen. This site never sees your contacts." },
  { when: "When you search", what: "The words you search for." },
  { when: "When you look at someone's intro paths", what: "That person's LinkedIn address." },
  { when: "When you share with the community", what: "That you're in this community's group, so members can see you know someone." },
];

const FILL_IN_ITEM: DisclosureItem = {
  when: "When your card is filled in",
  what: "Your email the first time, then your LinkedIn address every 30 days. It goes under the community's account, not yours, and only while you allow it.",
};

const NEVER_SENT = "Village never gets your messages, posts, asks, intro notes or what you write on your card, apart from the LinkedIn address you add there.";

// The member's privacy area: everything this site sends to Village, in plain words.
export function VillageDisclosure({ isFillInOn }: { isFillInOn: boolean }) {
  const items = isFillInOn ? [...SENT_ITEMS, FILL_IN_ITEM] : SENT_ITEMS;
  return (
    <section aria-labelledby="village-disclosure-title" className="mt-5 grid gap-4 rounded-card bg-card p-5 shadow-panel sm:rounded-panel sm:p-7">
      <div className="grid gap-1">
        <h2 id="village-disclosure-title" className="type-h3">
          What Village receives
        </h2>
        <p className="type-small text-foreground-soft">Network search and intro paths run on Village. This is everything this site sends it about you.</p>
      </div>
      <dl className="grid gap-3">
        {items.map(({ when, what }) => (
          <div key={when} className="grid gap-0.5">
            <dt className="font-bold">{when}</dt>
            <dd className="type-small text-foreground-soft">{what}</dd>
          </div>
        ))}
      </dl>
      <p className="type-small text-foreground-soft">{NEVER_SENT}</p>
      <p className="type-small text-foreground-soft">
        To remove your public profile from Village itself, use <ExternalTextLink href={VILLAGE_PROFILE_REMOVAL_URL}>Village&apos;s removal form</ExternalTextLink>.
      </p>
    </section>
  );
}
