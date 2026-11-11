import { ArrowLeftRight, Building2, Check, CircleCheck, Download, GraduationCap, Hand, Landmark, Megaphone, MessageSquare, Pencil, Pin, Plus, Printer, Search, Send, Settings2, UserRoundPlus, type LucideIcon } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

import { FlashNote } from "@/components/flash";
import { Field } from "@/components/form-field";
import { FundMark } from "@/components/logo-tile";
import { BackLink, PageHeader, SectionHead } from "@/components/page-header";
import { PublicPage } from "@/components/public-page";
import { ProductCredit } from "@/components/source-code-link";
import { EmptyState } from "@/components/empty-state";
import { Avatar } from "@/components/ui/avatar";
import { Button, ButtonRow } from "@/components/ui/button";
import { SheetHead } from "@/components/ui/card";
import { OptionCard } from "@/components/ui/checkbox-card";
import { Chip, ChipCount, ChipRow, ExampleChips } from "@/components/ui/chip";
import { Breakdown, Ledger, Meter, StatusChecklist } from "@/components/ui/figures";
import { Input } from "@/components/ui/input";
import { ConsentLine, WhyYouBox } from "@/components/ui/note";
import { Pill, type PillTone } from "@/components/ui/pill";
import { FieldBlock, Row, Rows, SetRow, SetupRows } from "@/components/ui/rows";
import { AllowancePips, SearchBox } from "@/components/ui/search-box";
import { SegmentedControlStatic } from "@/components/ui/segmented-static";
import { Select } from "@/components/ui/select";
import { Stepper } from "@/components/ui/stepper";
import { Switch } from "@/components/ui/switch";
import { Tag, Tags } from "@/components/ui/tag";
import { Textarea } from "@/components/ui/textarea";
import { FounderViewStrip, ModeSwitch, SidebarNavigation, TabBar } from "@/shell/navigation-links";
import type { ShellNavigation } from "@/shell/navigation-rules";
import { PhoneFoot, ShellFooterLine, ShellFundMark } from "@/shell/shell-chrome";
import { SidebarMember } from "@/shell/user-menu";

const COMMUNITY = "Northwind Founders";
const SAM = { id: "member-sam", name: "Sam Lee", email: "sam.lee@example.com", isAdmin: false };
const MAYA = { id: "member-maya", name: "Maya Ortiz", email: "maya.ortiz@example.com", isAdmin: true };
const ICON: { "aria-hidden": true; className: string; strokeWidth: number } = { "aria-hidden": true, className: "fh-i fh-xs", strokeWidth: 1.5 };

const FILTER_CHIPS: { label: string; count: number }[] = [
  { label: "All", count: 14 },
  { label: "Invited", count: 4 },
  { label: "Joined", count: 5 },
  { label: "Connected", count: 5 },
  { label: "Admins", count: 1 },
  { label: "Asked to delete", count: 1 },
];

const HISTORY: { lead: string; rest: string }[] = [
  { lead: "Your profile:", rest: " your name, your own words, the lines filled in from public profiles, and your privacy choices." },
  { lead: "Your asks and answers", rest: " in Asks & updates." },
  { lead: "Your intros:", rest: " who asked whom, the states and dates, and the note. Only the people in an intro see its note; admins see names, states and dates." },
  { lead: "Your messages.", rest: ` ${COMMUNITY}’ admins can’t read them in the portal.` },
  { lead: "Your email address", rest: " (only admins see it), and a log of sign-ins and changes." },
];

type IntroLogLine = { when: string; by: string; to: string; through: string; tone: PillTone; stateLabel: string; then: string };

const INTRO_LOG: IntroLogLine[] = [
  { when: "11 Nov", by: "Sam Lee", to: "Nina Patel (Brightline Payments)", through: "Ada Okafor", tone: "declined", stateLabel: "withdrawn", then: "–" },
  { when: "11 Nov", by: "Sam Lee", to: "Rosa Lindqvist (Halcyon Health)", through: "Marcus Webb", tone: "made", stateLabel: "introduced", then: "answered 11 Nov · introduced 11 Nov" },
  { when: "10 Nov", by: "Marcus Webb", to: "Rachel Kim (Brightside Clinics)", through: "Sam Lee", tone: "open", stateLabel: "with connector", then: "–" },
];

const NEEDS: { icon: LucideIcon; title: string; line: string }[] = [
  { icon: Building2, title: "A customer", line: "Someone who could buy from you" },
  { icon: UserRoundPlus, title: "A hire", line: "Someone to join your team" },
  { icon: Landmark, title: "An investor", line: "A fund or angel for your next round" },
  { icon: GraduationCap, title: "An expert", line: "Someone who has solved this before" },
];

// Phone crops were taken at twice the pixels; they show at half their width.
const PHONE_CROPS = new Set(["shell-tabbar-member-phone", "shell-tabbar-admin-phone", "shell-topbar-phone", "footer-phone"]);

// Founderhall's crops keep 8 px around each part, except these, cut flush.
const UNPADDED_CROPS = new Set(["shell-sidebar-member", "shell-sidebar-admin", "shell-topbar-phone", "shell-tabbar-member-phone", "shell-tabbar-admin-phone", "shell-founder-view-strip", "public-page-card"]);

// The page's own frame: phone parts shown at 390 px, the desktop sidebar at full height, whatever the window.
const GALLERY_STYLES = `
.parts-frame .fh-tabbar{position:static;display:grid!important}
.parts-frame .fh-topbar{position:static;display:flex!important}
.parts-frame .fh-preview-strip{position:static}
.parts-frame .fh-phone-foot{display:block!important;margin-top:0}
.parts-frame .fh-me-actions{display:block;padding:6px 6px 0}
.parts-side .fh-side{display:flex!important;position:static;height:800px;flex-direction:column;padding:20px 16px 16px;background:var(--side);border-right:1px solid var(--rule)}
.parts-row{display:grid;gap:16px;padding:28px 0;border-top:1px solid var(--rule)}
.parts-pane > p{margin-bottom:8px;font:600 12px/16px var(--sans);color:var(--graphite)}
.parts-crop{display:block;max-width:100%;height:auto}
.parts-frame{overflow-x:auto}
`;

export type Crop = { src: string; width: number };

type PartProps = { id: string; title: string; crops: Record<string, Crop>; note?: string; width?: number; children: ReactNode };

function Part({ id, title, crops, note, width, children }: PartProps) {
  const crop = crops[id];
  const isPhone = PHONE_CROPS.has(id);
  return (
    <section id={id} className="parts-row" aria-labelledby={`${id}-title`}>
      <div>
        <h2 id={`${id}-title`} className="fh-h3">
          {title} <span className="fh-small fh-muted">crops/{id}.png</span>
        </h2>
        {note ? <p className="fh-small fh-muted mt-1">{note}</p> : null}
      </div>
      <div className="parts-pane">
        <p>Founderhall</p>
        {crop ? (
          // eslint-disable-next-line @next/next/no-img-element -- a local review picture, inlined
          <img src={crop.src} alt={`Founderhall's ${title}`} className="parts-crop" style={{ width: isPhone ? crop.width / 2 : crop.width }} />
        ) : (
          <p className="fh-small">No crop for this part.</p>
        )}
      </div>
      <div className="parts-pane">
        <p>Community</p>
        <div className={UNPADDED_CROPS.has(id) ? "parts-frame" : "parts-frame p-2"} style={width ? ({ maxWidth: width } as CSSProperties) : undefined}>
          {children}
        </div>
      </div>
    </section>
  );
}

function OnSheet({ children, padded = true }: { children: ReactNode; padded?: boolean }) {
  return <div className={padded ? "rounded-card border border-rule bg-leaf p-4" : "bg-leaf"}>{children}</div>;
}

export function PartsGallery({ crops, navigation }: { crops: Record<string, Crop>; navigation: ShellNavigation }) {
  const part = (id: string, title: string, children: ReactNode, options: { note?: string; width?: number } = {}) => (
    <Part id={id} title={title} crops={crops} {...options}>
      {children}
    </Part>
  );
  return (
    <main className="mx-auto max-w-[1280px] px-4 py-8 lg:px-10">
      <style>{GALLERY_STYLES}</style>
      <PageHeader
        eyebrow="Test page · off unless SHOW_PARTS_PAGE=true"
        title="Parts"
        description="Every shared part, beside Founderhall's crop of it (fh-reference/crops). The parts live in src/components and src/components/ui; Founderhall's styles are in src/app/parts.css."
      />

      <h2 className="fh-h2 mt-7">The shell</h2>
      {part(
        "shell-sidebar-member",
        "Sidebar, member",
        <div className="parts-side w-[264px]">
          <aside className="fh-side">
            <ShellFundMark name={COMMUNITY} logo={null} isAdmin={false} size="sidebar" pathname="/" />
            <SidebarNavigation navigation={navigation} isAdmin={false} badges={{}} pathname="/" />
            <SidebarMember member={SAM} />
            <ShellFooterLine isAdmin={false} pathname="/" />
          </aside>
        </div>,
        { width: 264 },
      )}
      {part(
        "shell-sidebar-admin",
        "Sidebar, console",
        <div className="parts-side w-[264px]">
          <aside className="fh-side">
            <ShellFundMark name={COMMUNITY} logo={null} isAdmin size="sidebar" pathname="/admin" />
            <ModeSwitch pathname="/admin" />
            <SidebarNavigation navigation={navigation} isAdmin badges={{}} pathname="/admin" />
            <SidebarMember member={MAYA} />
            <ShellFooterLine isAdmin pathname="/admin" />
          </aside>
        </div>,
        { width: 264 },
      )}
      {part(
        "shell-topbar-phone",
        "Phone top bar",
        <header className="fh-topbar">
          <ShellFundMark name={COMMUNITY} logo={null} isAdmin={false} size="default" pathname="/" />
          <span className="fh-spacer" />
          <Avatar stableId={SAM.id} name={SAM.name} sizePx={28} />
        </header>,
        { width: 390 },
      )}
      {part("shell-tabbar-member-phone", "Phone tab bar, member", <TabBar navigation={navigation} isAdmin={false} badges={{}} pathname="/" />, { width: 390 })}
      {part("shell-tabbar-admin-phone", "Phone tab bar, console", <TabBar navigation={navigation} isAdmin badges={{}} pathname="/admin" />, { width: 390 })}
      {part("shell-founder-view-strip", "Founder-view strip", <FounderViewStrip name={MAYA.name} pathname="/" />, { width: 1016 })}
      {part(
        "sidebar-me-signout",
        "The member and Sign out",
        <div className="parts-side">
          <div className="[&_.fh-me]:flex [&_.fh-me]:items-center [&_.fh-me]:gap-2.5 [&_.fh-me]:border-t [&_.fh-me]:border-rule [&_.fh-me]:px-1.5 [&_.fh-me]:pt-3 [&_.fh-me_b]:block [&_.fh-me_b]:text-[14px] [&_.fh-me_b]:leading-[18px] [&_.fh-me_b]:font-semibold [&_.fh-me_span_span]:block [&_.fh-me_span_span]:text-[12px] [&_.fh-me_span_span]:text-graphite">
            <SidebarMember member={SAM} />
          </div>
        </div>,
        { width: 247 },
      )}
      {part("footer-credit-admin", "Console footer (product credit)", <ProductCredit className="mt-0" />, { width: 247 })}
      {part("footer-phone", "Phone footer", <PhoneFoot isAdmin={false} pathname="/" />, { width: 374 })}
      {part("flash-ok", "Flash after an action", <FlashNote>Asked. We emailed your note; you hear back here and by email.</FlashNote>, { width: 952 })}
      {part("fund-mark-large", "Fund mark, public pages", <FundMark name={COMMUNITY} logo={null} size="public" className="mb-0" />, { width: 444 })}
      {part("fund-mark-monogram", "Fund mark, monogram (no logo)", <FundMark name={COMMUNITY} logo={null} size="public" className="mb-0" />, { width: 444 })}
      {part(
        "public-page-card",
        "Public page",
        <div className="[&_.fh-pub]:pt-10">
          <PublicPage community={{ name: COMMUNITY, logo: null }} withCredit hosting={`${COMMUNITY}, EU (Frankfurt)`} copyAs="div">
            <h1 className="fh-h2">Sign in to {COMMUNITY}</h1>
            <p className="fh-lede">We email you a link that signs you in. No password.</p>
            <Field htmlFor="parts-email" label="Your email" className="fh-field">
              <Input id="parts-email" type="email" placeholder="you@example.com" />
            </Field>
            <Button width="block" className="mt-3">
              Email me a sign-in link
            </Button>
            <p className="fh-label mt-5">Or look around without an email</p>
            <div className="grid gap-2">
              <Button variant="secondary" width="block">
                Try it as Maya (admin)
              </Button>
              <Button variant="secondary" width="block">
                Try it as Sam (member)
              </Button>
            </div>
            <p className="fh-small fh-muted mt-4">{COMMUNITY} is invite-only. If you were invited, use the address the invite went to.</p>
          </PublicPage>
        </div>,
        { width: 460 },
      )}

      <h2 className="fh-h2 mt-10">Type, buttons and choices</h2>
      {part(
        "pagehead-today",
        "Page head",
        <PageHeader
          eyebrow={`11 Nov · Sam’s week at ${COMMUNITY}`}
          title="You could help with this one"
          description="Plus one intro waiting for your yes. Each item also works by replying to Thursday’s email."
          action={
            <>
              <Button variant="ink">
                <ArrowLeftRight {...ICON} />
                Ask for an intro
              </Button>
              <Button variant="secondary">
                <Plus {...ICON} />
                Post an ask
              </Button>
            </>
          }
        />,
        { width: 952 },
      )}
      {part(
        "buttons-ink-secondary",
        "Ink and secondary buttons",
        <ButtonRow>
          <Button variant="ink">
            <ArrowLeftRight {...ICON} />
            Ask for an intro
          </Button>
          <Button variant="secondary">
            <Plus {...ICON} />
            Post an ask
          </Button>
        </ButtonRow>,
        { width: 952 },
      )}
      {part(
        "buttons-primary-secondary",
        "Primary and secondary buttons",
        <ButtonRow>
          <Button>
            <Hand {...ICON} />I can help
          </Button>
          <Button variant="secondary">Not this week</Button>
        </ButtonRow>,
        { width: 540 },
      )}
      {part("button-quiet-back", "Back link", <BackLink href="#button-quiet-back">Your intros</BackLink>, { width: 124 })}
      {part(
        "profile-actions",
        "Profile actions",
        <ButtonRow>
          <Button size="sm" className="h-auto min-h-8">
            <ArrowLeftRight {...ICON} />
            Ask for an intro via Ada
          </Button>
          <Button size="sm" variant="secondary">
            <MessageSquare {...ICON} />
            Message
          </Button>
        </ButtonRow>,
        { width: 858 },
      )}
      {part(
        "chips-tabs-asks",
        "Chips as page tabs",
        <ChipRow>
          <Chip isPressed>
            Open <ChipCount>8</ChipCount>
          </Chip>
          <Chip isPressed={false}>
            Updates <ChipCount>2</ChipCount>
          </Chip>
          <Chip isPressed={false}>
            Yours <ChipCount>4</ChipCount>
          </Chip>
          <Chip isPressed={false}>
            Answered <ChipCount>2</ChipCount>
          </Chip>
        </ChipRow>,
        { width: 574 },
      )}
      {part(
        "chips-filter-members",
        "Chips as filters",
        <ChipRow>
          {FILTER_CHIPS.map(({ label, count }, index) => (
            <Chip key={label} isPressed={index === 0}>
              {label} <ChipCount>{count}</ChipCount>
            </Chip>
          ))}
        </ChipRow>,
        { width: 952 },
      )}
      {part(
        "example-chips",
        "Example chips",
        <ExampleChips className="mt-0">
          {["Head of procurement at a US hospital", "someone at Halcyon Health", "seed investors in climate", "a former CFO"].map((example) => (
            <button key={example} type="button">
              {example}
            </button>
          ))}
        </ExampleChips>,
        { width: 952 },
      )}
      {part("segmented-control", "Segmented control", <SegmentedControlStatic label="Where to search" segments={["In our network", "Everywhere"]} current="In our network" />, { width: 242 })}
      {part(
        "pill",
        "Status pills",
        <div className="flex flex-wrap gap-2">
          <Pill tone="declined">withdrawn</Pill>
          <Pill tone="made">introduced</Pill>
          <Pill tone="open">with connector</Pill>
          <Pill tone="needs">Answer</Pill>
          <Pill tone="plain">Member</Pill>
        </div>,
        { note: "Founderhall's crop is the first pill it found; the other tones follow its CSS." },
      )}
      {part("switch", "Switch", <Switch defaultChecked aria-label="Send the weekly digest" />, { width: 60 })}
      {part(
        "setrow",
        "Setting row",
        <SetRow label="Send the weekly digest" hint="One email per member, only when something needs them." control={<Switch defaultChecked aria-label="Send the weekly digest" />} />,
        { width: 344 },
      )}
      {part(
        "option-radio-card",
        "Option card",
        <OptionCard name="parts-decide-one" id="parts-decide-one" title="Yes, introduce them" description={`We email Rachel once, from ${COMMUNITY}, in your name.`} />,
        { width: 470 },
      )}
      {part(
        "color-picker",
        "Colour row",
        <div className="fh-colorrow">
          <input type="color" defaultValue="#24525a" aria-label="Fund colour" />
          <Input defaultValue="#24525A" aria-label="Fund colour, as hex" className="min-h-11" />
        </div>,
        { width: 503 },
      )}
      {part("pips-allowance", "Allowance pips", <AllowancePips left={1} total={5} label="1 of 5 asks left this week" />, { width: 260 })}

      <h2 className="fh-h2 mt-10">Fields and forms</h2>
      {part("search-box", "Search box", <SearchBox placeholder="A person, a company or a role" aria-label="Search" />, { width: 952 })}
      {part("helpers-strip", "Search box on Asks", <SearchBox placeholder="Search every ask and its answers" aria-label="Search asks" />, {
        width: 574,
        note: "Founderhall's crop of the helpers strip caught the asks search box; the helpers strip itself is in post-ask.",
      })}
      {part(
        "filters-directory",
        "Filter selects",
        <div className="fh-filters mt-0">
          {["Any stage", "Any sector", "Any city", "Any cohort", "Updated: any time"].map((label) => (
            <label key={label} className="fh-filt">
              <span className="sr-only">{label}</span>
              <Select defaultValue={label}>
                <option>{label}</option>
              </Select>
            </label>
          ))}
        </div>,
        { width: 952 },
      )}
      {part(
        "decide-form",
        "Answer form (option cards)",
        <fieldset>
          <legend className="fh-label">Would you introduce them?</legend>
          <OptionCard name="parts-decide" id="parts-decide-yes" title="Yes, introduce them" description={`We email Rachel once, from ${COMMUNITY}, in your name.`} />
          <OptionCard name="parts-decide" id="parts-decide-no" title="Not this time" description="Marcus is told you can’t make this one. Never why." />
          <OptionCard name="parts-decide" id="parts-decide-unknown" title="I don’t know them well enough" description="Same message to Marcus: you can’t make this one." />
          <Field htmlFor="parts-target-email" label="Rachel’s email, if you say yes" hint="Used for this one ask. Rachel sees Marcus’ address only if they say yes." className="fh-field">
            <Input id="parts-target-email" placeholder="e.g. name@company.example" />
          </Field>
          <details className="mt-3.5">
            <summary className="text-[14px] font-semibold">Edit the note before it goes on</summary>
          </details>
          <Button width="block" className="mt-3.5">
            Send my answer
          </Button>
          <div className="mt-3">
            <ConsentLine />
          </div>
        </fieldset>,
        { width: 470 },
      )}
      {part(
        "form-intro-ask",
        "Intro ask form",
        <div>
          <BackLink href="#form-intro-ask">Ada Okafor</BackLink>
          <div className="fh-allow">
            <AllowancePips left={1} total={5} label="1 of 5 asks left this week" />
          </div>
          <p className="fh-small fh-muted">Asks you post and intro asks share it. Declined, expired and withdrawn intro asks come back.</p>
          <h1 className="fh-h1 mt-3.5">Write your forwardable note</h1>
          <p className="fh-lede">Ada forwards it to them as it is. We drafted it from your profile; change anything.</p>
          <div className="mt-4 flex items-center gap-3 rounded-card border border-rule bg-leaf p-3">
            <span className="text-[12.5px] font-semibold text-graphite">Through</span>
            <Avatar stableId="member-ada" name="Ada Okafor" sizePx={28} />
            <span>
              <b className="type-serif block text-[16px] leading-[21px]">Ada Okafor</b>
              <span className="block text-[13px] text-graphite">Founder, Gridwise</span>
            </span>
          </div>
          <p className="fh-label mt-4">Who should Ada introduce you to?</p>
          <div className="grid grid-cols-2 gap-2.5">
            <Field htmlFor="parts-name" label="Name">
              <Input id="parts-name" placeholder="e.g. Alex Rivera" />
            </Field>
            <Field htmlFor="parts-role" label="Role">
              <Input id="parts-role" placeholder="e.g. VP Procurement" />
            </Field>
            <Field htmlFor="parts-company" label="Company">
              <Input id="parts-company" placeholder="e.g. Halcyon Health" />
            </Field>
          </div>
          <div className="fh-mail mt-4">
            <div className="fh-mail-h">
              <div>
                <span className="fh-k">From</span>
                <span className="fh-v">Sam Lee via {COMMUNITY}</span>
              </div>
              <div>
                <span className="fh-k">To</span>
                <span className="fh-v">Ada Okafor</span>
              </div>
              <div className="fh-subj">Ada, would you introduce Sam Lee to …?</div>
            </div>
            <div className="fh-mail-b grid gap-3">
              <Field htmlFor="parts-who" label="Who I am and what I do">
                <Textarea id="parts-who" className="min-h-[88px]" defaultValue="I’m Sam, Co-founder & CEO at Tallyhealth. Prior-authorisation automation for outpatient clinics. Two pilots live; looking for a hospital group next." />
              </Field>
              <Field htmlFor="parts-why" label="Why this person, why now">
                <Textarea id="parts-why" className="min-h-[88px]" defaultValue="An intro to procurement at a US hospital group. I’d value 20 minutes with them." />
              </Field>
            </div>
          </div>
        </div>,
        { width: 470, note: "The crop stops part-way down the form; the rest is the same fields." },
      )}
      {part(
        "form-invites",
        "Invite form",
        <div>
          <Field htmlFor="parts-invites" label="Paste emails, one per line, or a CSV of name and email" hint={<>Up to 500 at a time. People who are already members are skipped. A whole alumni list? <a href="#form-invites">Import members (CSV)</a>.</>}>
            <Textarea id="parts-invites" placeholder={"e.g. ada.founder@example.com\nSam Lee, sam.lee@example.com"} />
          </Field>
          <fieldset className="fh-field">
            <legend className="fh-label">Profile fill-in: how did these members agree?</legend>
            <p className="fh-hint mt-0 mb-2.5">Required. Profiles are filled in from public profiles only for members with a consent record. Saved for each member with today’s date and your name.</p>
            <OptionCard name="parts-basis" id="parts-basis-terms" title="Members agreed in our membership terms on" description={<Input type="date" aria-label="Date" className="mt-2 w-60" />} />
            <OptionCard name="parts-basis" id="parts-basis-ask" defaultChecked isRecommended title="Ask each member at sign-in" description="Nothing is filled in until they tick “Fill in my profile from public profiles”." />
          </fieldset>
          <Button className="mt-3.5">
            <Send {...ICON} />
            Send invites
          </Button>
        </div>,
        { width: 503 },
      )}
      {part(
        "form-switches-radios",
        "Switches and radios on a sheet",
        <div className="rounded-card border border-rule bg-leaf px-6 py-[22px]">
          <h2 className="fh-h3 flex items-center gap-2">
            <Settings2 {...ICON} className="fh-i fh-s" />
            Your switches
          </h2>
          <SetRow label="Don’t look me up on public profiles" hint="Stops the fill-in for you and deletes what it found. Your own words stay. Search can then no longer name you as a path." control={<Switch aria-label="Don’t look me up on public profiles" />} />
          <SetRow label="Hide me from the directory" hint="Members can’t find or open your profile. Admins still see you." control={<Switch aria-label="Hide me from the directory" />} />
          <fieldset className="mt-4">
            <legend className="fh-label">Who can message me</legend>
            <OptionCard name="parts-policy" id="parts-policy-default" defaultChecked title="The community’s default" description="Now: anyone in the community." />
            <OptionCard name="parts-policy" id="parts-policy-anyone" title={`Anyone in ${COMMUNITY}`} description="Any member can start a conversation." />
            <OptionCard name="parts-policy" id="parts-policy-introduced" title="Only people I’ve been introduced to" description="Members you met through an intro here. Admins can always write." />
          </fieldset>
          <Button size="sm" className="mt-3.5">
            Save
          </Button>
        </div>,
        { width: 379 },
      )}
      {part(
        "composer-ask",
        "Ask composer",
        <div className="fh-sheet fh-composer">
          <div className="fh-seg fh-kind" role="radiogroup" aria-label="Ask or update">
            <label>
              <input type="radio" name="parts-kind" defaultChecked />
              <span>
                <Hand {...ICON} />
                Ask
              </span>
            </label>
            <label>
              <input type="radio" name="parts-kind" />
              <span>
                <Megaphone {...ICON} />
                Update
              </span>
            </label>
          </div>
          <div className="fh-oneline">
            <Input aria-label="What do you need?" placeholder="What do you need?" />
            <Button>Post</Button>
          </div>
          <details className="fh-more">
            <summary>
              <Search {...ICON} />
              Who are you trying to reach? <span className="fh-muted">Optional; it helps us find who can help</span>
            </summary>
          </details>
          <p className="fh-small fh-muted mt-2.5">
            <AllowancePips left={1} total={5} label="" /> 1 of 5 asks left this week. We check who in {COMMUNITY} can help, and tell them.
          </p>
        </div>,
        { width: 574 },
      )}
      {part(
        "reply-composer",
        "Reply box",
        <form className="fh-reply fh-static mt-0">
          <Textarea aria-label="Write a message" placeholder="Write a message" className="fh-input min-h-10 resize-y border-0" />
          <Button size="sm">
            <Send {...ICON} />
            Send
          </Button>
        </form>,
        { width: 952 },
      )}

      <h2 className="fh-h2 mt-10">Surfaces</h2>
      {part(
        "card-today-item",
        "Today item",
        <article className="fh-titem">
          <div className="fh-ph">
            <Avatar stableId="member-amara" name="Amara Diallo" sizePx={28} />
            <div>
              <b>Amara Diallo</b>
              <span>2 days ago</span>
            </div>
          </div>
          <p className="fh-body">Has anyone raised a seed round in New York for a hardware-heavy company? 20 minutes on how you pitched it would help.</p>
          <p className="fh-target">
            <Search {...ICON} />
            Trying to reach: a founder who raised a seed round in New York
          </p>
          <p className="fh-why">
            <b>Why you:</b> Your profile says you can help with “Raising a seed round in New York; HIPAA basics for first-time founders.”
          </p>
          <ButtonRow>
            <Button>
              <Hand {...ICON} />I can help
            </Button>
            <Button variant="secondary">Not this week</Button>
          </ButtonRow>
        </article>,
        { width: 574 },
      )}
      {part(
        "why-you-box",
        "“Why you” box",
        <WhyYouBox className="mt-0">
          <b className="text-ink">Why you:</b> Your profile says you can help with “Raising a seed round in New York; HIPAA basics for first-time founders.”
        </WhyYouBox>,
        { width: 540 },
      )}
      {part(
        "sheet-sidebar-card",
        "Sheet (side card)",
        <div className="fh-sheet">
          <SheetHead title="Your asks in motion" link={<a href="#sheet-sidebar-card">Yours</a>} />
          <AllowancePips left={1} total={5} label="1 of 5 asks left this week" />
          <p className="fh-small fh-muted mt-1.5">Asks you post and intro asks share it. Declined, expired and withdrawn intro asks come back.</p>
          <div className="fh-rows mt-1">
            {[
              ["We just signed our 40th clinic. Thank you to everyone who sent intros this quarter.", "No paths found yet · 0 answers …"],
              ["Who can intro me to a buyer at a US hospital group? We sell billing software to clinics.", "1 member can help · 0 answers …"],
              ["Who has hired a first VP Sales selling to US hospitals? I want an hour with someone who has done it.", "1 member can help · 1 answer · …"],
            ].map(([title, detail]) => (
              <a key={title} href="#sheet-sidebar-card" className="fh-r [&_.fh-who_b]:font-sans [&_.fh-who_b]:text-[15px] [&_.fh-who_b]:leading-5 [&_.fh-who_b]:whitespace-normal">
                <Hand {...ICON} className="fh-i fh-s" />
                <span className="fh-who">
                  <b>{title}</b>
                  <span>{detail}</span>
                </span>
                <span className="fh-end">
                  <Pill tone="open">Open</Pill>
                </span>
              </a>
            ))}
          </div>
        </div>,
        { width: 365 },
      )}
      {part(
        "sheet-note",
        "Sheet with a note",
        <div className="fh-sheet">
          <p className="fh-small fh-muted flex items-center gap-1.5">
            <Pencil {...ICON} />
            Sam’s note, as sent
          </p>
          <div className="mt-2 grid gap-5 text-[15px] leading-[23px]">
            <p>I’m Sam, co-founder & CEO of Tallyhealth: prior-authorisation automation for outpatient clinics.</p>
            <p>Halcyon is choosing its 2027 tools, and I’d value 20 minutes on how procurement decides.</p>
            <p>We cut approval time from 9 days to 2 at our first clinic.</p>
          </div>
          <p className="fh-small fh-muted mt-1.5">Only the people in this intro see the note. {COMMUNITY}’ admins see names, states and dates.</p>
        </div>,
        { width: 470 },
      )}
      {part("empty-state-admin", "Empty state", <EmptyState title="Nobody here" description="Try another filter." />, { width: 952 })}
      {part(
        "chat-post-sample",
        "Chat post sample",
        <p className="fh-chatpost">
          {COMMUNITY} · new ask from Priya: “An intro to a head of procurement at a US hospital group.”
          <br />I can help: &lt;http://127.0.0.1:9600/asks/12&gt;
        </p>,
        { width: 344 },
      )}

      <h2 className="fh-h2 mt-10">Rows and lists</h2>
      {part(
        "row-member-admin",
        "Member row (console)",
        <div className="fh-wide">
          <Rows className="fh-members-rows">
            <div className="fh-r">
              <Avatar stableId="member-ada" name="Ada Okafor" />
              <span className="fh-who">
                <b>Ada Okafor</b>
                <span>ada.okafor@example.com</span>
              </span>
              <span className="fh-c-aud">
                <span className="fh-jl">
                  <Building2 {...ICON} />
                </span>{" "}
                Founder, Gridwise
              </span>
              <span className="fh-c-status text-graphite">joined 26 Sep</span>
              <span className="fh-end">
                <Pill tone="made">Connected</Pill>
              </span>
            </div>
          </Rows>
        </div>,
        { width: 952 },
      )}
      {part(
        "rows-intros",
        "Intro rows",
        <Rows>
          <Row href="#rows-intros" start={<Avatar stableId="member-marcus" name="Marcus Webb" />} title="Marcus Webb asks you for an intro to Rachel Kim" detail="asked 10 Nov" end={<Pill tone="needs">Answer</Pill>} />
        </Rows>,
        { width: 952 },
      )}
      {part(
        "rows-jobs",
        "Job rows",
        <div className="fh-modrows fh-jobrows fh-rows">
          {[
            ["Process engineer, kiln retrofits", "Kilnworks · Paris · Engineering · posted 10 Nov · via ", "Amara Diallo"],
            ["Founding account executive", "Tallyhealth · Boston · Sales · posted 9 Nov · via ", "Sam Lee"],
            ["Senior backend engineer", "Ledgerline · London or remote (UK) · Engineering · posted 8 Nov · via ", "Priya Shah"],
          ].map(([title, detail, via]) => (
            <div key={title} className="fh-r">
              <span className="fh-jl">
                <Building2 {...ICON} className="fh-i fh-s" />
              </span>
              <span className="fh-who">
                <b>{title}</b>
                <span>
                  {detail}
                  <a href="#rows-jobs">{via}</a>
                </span>
              </span>
              <span className="fh-end">
                <Button size="sm" variant="secondary">
                  Apply
                </Button>
              </span>
            </div>
          ))}
        </div>,
        { width: 952 },
      )}
      {part(
        "card-member-directory",
        "Directory card",
        <div className="fh-cards">
          <a href="#card-member-directory" className="fh-mcard">
            <Avatar stableId="member-ada" name="Ada Okafor" />
            <span className="fh-who">
              <b>Ada Okafor</b>
              <span>Founder, Gridwise · Lagos</span>
            </span>
            <span className="fh-wo">Smart meters for small solar grids in West Africa. Testing pricing with 40 households.</span>
            <span className="fh-meta">
              <Tag>Pre-seed</Tag>
              <Tag>Climate</Tag>
              <Tag>Fund III</Tag>
              <span className="fh-fresh">fresh as of 5 Nov</span>
            </span>
          </a>
        </div>,
        { width: 470 },
      )}
      {part(
        "post-ask",
        "Ask post",
        <article className="fh-post">
          <div className="fh-ph">
            <Avatar stableId={SAM.id} name={SAM.name} sizePx={28} />
            <div>
              <b>Sam Lee</b>
              <span>Co-founder & CEO, Tallyhealth · just now</span>
            </div>
            <span className="fh-pinmark">
              <Pin {...ICON} />
              Pinned
            </span>
            <Pill tone="open">Open</Pill>
          </div>
          <p className="fh-body">
            <a href="#post-ask">We just signed our 40th clinic. Thank you to everyone who sent intros this quarter.</a>
          </p>
          <div className="fh-acts">
            <a className="fh-react" href="#post-ask">
              <MessageSquare {...ICON} />
              <span className="underline">0 answers</span>
            </a>
          </div>
        </article>,
        { width: 574 },
      )}
      {part(
        "search-result-path",
        "Search result",
        <div className="fh-result fh-known">
          <div className="fh-top">
            <Avatar stableId="member-marcus" name="Marcus Webb" />
            <div className="fh-who">
              <a href="#search-result-path">
                <span className="fh-name">Marcus Webb</span>
              </a>
              <p>CTO, Brightwater Logistics · Rotterdam</p>
            </div>
            <Tag>Member</Tag>
          </div>
          <p className="fh-pathtext mt-2.5">
            <CircleCheck {...ICON} /> <b>You already know Marcus</b> · You were introduced
          </p>
          <ButtonRow className="mt-3">
            <Button>
              <MessageSquare {...ICON} />
              Message
            </Button>
            <Button variant="quiet">Profile</Button>
          </ButtonRow>
        </div>,
        { width: 952 },
      )}
      {part(
        "profile-head",
        "Profile head",
        <div className="fh-profile-head">
          <Avatar stableId={SAM.id} name={SAM.name} sizePx={80} />
          <div>
            <h1 className="fh-h1">Sam Lee</h1>
            <p>Co-founder & CEO, Tallyhealth · New York</p>
            <p className="fh-small">This is how members see you. Change anything; you decide what shows.</p>
          </div>
        </div>,
        { width: 952 },
      )}
      {part(
        "fieldblock-profile",
        "Profile field",
        <OnSheet padded={false}>
          <FieldBlock
            label={
              <>
                Name <span className="fh-src fh-you">you</span>
              </>
            }
            action={
              <Button variant="quiet" size="sm">
                <Pencil {...ICON} />
                Edit
              </Button>
            }
          >
            Sam Lee
          </FieldBlock>
        </OnSheet>,
        { width: 510 },
      )}
      {part(
        "history-list",
        "History list",
        <ul className="fh-hist">
          {HISTORY.map(({ lead, rest }) => (
            <li key={lead} className="fh-wide">
              <span className="fh-rec">
                <b>{lead}</b>
                {rest}
              </span>
            </li>
          ))}
        </ul>,
        { width: 510 },
      )}
      {part(
        "setup-rows",
        "Set up list",
        <SetupRows
          rows={[
            { href: "#setup-rows", title: "Settings", description: "Your fund’s name, colour and logo, your plan, and who members write to about their data.", status: <Pill tone="made">Set up</Pill> },
            { href: "#setup-rows-mail", title: "Mail", description: "Invites, sign-in links and the weekly digest go out from your own domain.", status: <Pill tone="made">Set up</Pill> },
            { href: "#setup-rows-import", title: "Import members", description: "Bring a whole alumni list in from a spreadsheet (CSV), in one upload.", status: <span className="fh-small">optional</span> },
            { href: "#setup-rows-audit", title: "Audit log", description: "Every admin action, sign-in and privacy change, newest first.", status: <span className="fh-small">always on</span> },
          ]}
        />,
        { width: 952 },
      )}
      {part(
        "intro-log-table",
        "Intro log",
        <div className="fh-introlog">
          <div className="fh-loghead">
            <span>Asked</span>
            <span>Asked by</span>
            <span>For an intro to</span>
            <span>Through</span>
            <span>State</span>
            <span>Then</span>
          </div>
          {INTRO_LOG.map(({ when, by, to, through, tone, stateLabel, then }, index) => {
            const state = <Pill tone={tone}>{stateLabel}</Pill>;
            return (
            <div key={index} className="fh-logrow">
              <span className="fh-cell">{when}</span>
              <span className="fh-cell">
                <b>{by}</b>
              </span>
              <span className="fh-cell">{to}</span>
              <span className="fh-cell">{through}</span>
              <span className="fh-cell">{state}</span>
              <span className="fh-cell fh-then text-graphite">{then}</span>
              <span className="fh-m-line">
                <b>{by}</b> → {to}
              </span>
              <span className="fh-m-st">{state}</span>
              <span className="fh-m-meta">
                {when} · via {through}
              </span>
            </div>
            );
          })}
        </div>,
        { width: 952, note: "Who asked whom shows here as in Founderhall; whether the console may show it waits on the owner (areas.md, area 6)." },
      )}
      {part(
        "row-moderation",
        "Day and hour selects",
        <div className="grid max-w-[340px] grid-cols-2 gap-2.5">
          <Field htmlFor="parts-day" label="Day">
            <Select id="parts-day" defaultValue="Thursday">
              <option>Thursday</option>
            </Select>
          </Field>
          <Field htmlFor="parts-hour" label="Hour">
            <Select id="parts-hour" defaultValue="09:00">
              <option>09:00</option>
            </Select>
          </Field>
        </div>,
        { note: "Founderhall's crop of the moderation row caught the digest's Day and Hour selects; those are shown." },
      )}
      {part(
        "messages-bubbles",
        "Message bubbles",
        <div className="fh-msgs">
          <div className="fh-msg">
            Saw your VP Sales ask. Want to compare scorecards on Thursday? 30 minutes is plenty.
            <small>
              <span>Priya Shah</span>
              <span>9 Nov</span>
            </small>
          </div>
          <div className="fh-msg fh-me">
            Yes please. Thursday 4pm London works. I’ll bring our job spec.
            <small>
              <span>You</span>
              <span>9 Nov</span>
              <span className="fh-via">by email</span>
            </small>
          </div>
        </div>,
        { width: 952 },
      )}
      {part(
        "needcard-guided",
        "Need card",
        <a href="#needcard-guided" className="fh-needcard">
          <span className="fh-ic">
            <Building2 {...ICON} className="fh-i" />
          </span>
          <span>
            <b>A customer</b>
            <span>Someone who could buy from you</span>
          </span>
          <svg className="fh-i fh-s" viewBox="0 0 24 24" aria-hidden="true">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </a>,
        { width: 267 },
      )}
      {part(
        "needcards-grid",
        "Need cards",
        <div className="fh-needs mt-0">
          {NEEDS.map(({ icon: Icon, title, line }) => (
            <a key={title} href="#needcards-grid" className="fh-needcard">
              <span className="fh-ic">
                <Icon aria-hidden="true" className="fh-i" strokeWidth={1.5} />
              </span>
              <span>
                <b>{title}</b>
                <span>{line}</span>
              </span>
              <svg className="fh-i fh-s" viewBox="0 0 24 24" aria-hidden="true">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </a>
          ))}
        </div>,
        { width: 529 },
      )}

      <h2 className="fh-h2 mt-10">Figures and steps</h2>
      {part(
        "ledger-bars",
        "Ledger",
        <div className="bg-leaf px-2">
        <Ledger
          rows={[
            { label: "Asked for an intro", value: "5", percent: 100 },
            { label: "Connector said yes", value: "4", share: "80%", percent: 80, tone: "yes" },
            { label: "Target said yes", value: "3", share: "75%", percent: 60, tone: "yes" },
            { label: <b>Introduced</b>, value: "3", percent: 60, tone: "made", hasBookmark: true },
            { label: "Declined", note: "0 by connector, 0 by target", value: "0", percent: 0, tone: "declined" },
            { label: "Still open", note: "1 with connector, 1 with target", value: "2", percent: 40, tone: "open" },
            { label: "Found it helpful", note: "1 of 1 who answered", value: "100%", percent: 100, tone: "made" },
          ]}
        />
        </div>,
        { width: 503 },
      )}
      {part(
        "meter",
        "Meter",
        <div className="fh-meter mt-0">
          <div className="fh-track">
            <i style={{ "--w": "49%" } as CSSProperties} />
          </div>
        </div>,
        { width: 344 },
      )}
      {part(
        "costbox",
        "Lookups meter with marker",
        <div className="fh-sheet">
          <SheetHead title="Lookups this month" />
          <Meter figure="52" figureNote="lookups used this month, of 7,500" percent={0.7} mark={{ percent: 80, label: "80% warning" }} />
          <Breakdown
            items={[
              { label: "Search", value: "34" },
              { label: "Paths", value: "18" },
              { label: "Path checks", value: "0" },
              { label: "Profile fill-in", value: "0" },
            ]}
          />
        </div>,
        { width: 394, note: "The crop is the Village page's lookups sheet; its Latest lookups table uses the table part below." },
      )}
      {part(
        "breakdown",
        "Breakdown",
        <Breakdown
          items={[
            { label: "Sharing with the community", value: "4" },
            { label: "Connected, not allowing asks", value: "1" },
            { label: "Still syncing", value: "0" },
            { label: "Joined, not connected", value: "5" },
            { label: "Invited, not signed in", value: "4" },
          ]}
        />,
        { width: 344 },
      )}
      {part(
        "kv-tiles",
        "Figure tiles",
        <div className="grid gap-4">
          <Breakdown
            items={[
              { label: "Sharing with the community", value: "4" },
              { label: "Connected, not allowing asks", value: "1" },
              { label: "Still syncing", value: "0" },
              { label: "Joined, not connected", value: "5" },
              { label: "Invited, not signed in", value: "4" },
            ]}
          />
        </div>,
        { width: 344, note: "Founderhall's crop of the KV tiles caught the breakdown; the tiles themselves are in the report document below." },
      )}
      {part(
        "checklist-status",
        "Status checklist",
        <div className="grid gap-4">
          <StatusChecklist
            items={[
              { key: "smtp", state: "ok", title: "Mail service (SMTP)", value: "Set: 127.0.0.1", status: "set" },
              { key: "domain", state: "ok", title: "Sending domain", value: "hello@mail.northwind.example", status: "set" },
              { key: "sends", state: "ok", title: "Recent sends", value: "7 sent, 0 failed lately", status: "pass" },
              { key: "dns", state: "watch", title: "SPF, DKIM and DMARC", value: "Run Mail › Check DNS now", status: "not checked yet" },
            ]}
          />
        </div>,
        { width: 344, note: "Founderhall's crop caught the neighbouring lookups sheet (see costbox); this is the checklist from the admin home's Mail card." },
      )}
      {part(
        "stepper-intro-tracker",
        "Intro tracker",
        <Stepper
          steps={[
            { key: "asked", state: "done", title: "You asked Priya", detail: "31 Oct" },
            { key: "connector", state: "done", title: "Priya said yes and asked Alex", detail: "1 Nov" },
            { key: "target", state: "done", title: "Alex said yes", detail: "2 Nov" },
            { key: "introduced", state: "done", title: `Introduced by email from ${COMMUNITY}`, detail: "2 Nov" },
            { key: "helpful", state: "todo", title: "Was it helpful?", detail: "Asked 14 days after the intro" },
          ]}
        />,
        { width: 470 },
      )}

      <h2 className="fh-h2 mt-10">Documents</h2>
      {part(
        "report-actions",
        "Report actions",
        <div className="fh-report-actions">
          <SegmentedControlStatic label="Period" segments={["Q4 to date", "Q3", "Since launch"]} current="Q4 to date" />
          <Button>
            <Send {...ICON} />
            Send to partners
          </Button>
          <Button variant="secondary">
            <Download {...ICON} />
            CSV
          </Button>
          <Button variant="secondary">
            <Printer {...ICON} />
            PDF
          </Button>
        </div>,
        { width: 952 },
      )}
      {part(
        "report-outcomes",
        "What came of the intros",
        <ReportOutcomes />,
        { width: 746 },
      )}
      {part(
        "table",
        "Report head and figure tiles",
        <div className="fh-report border-t-0 shadow-none">
          <p className="fh-by mt-0">Prepared by Maya Ortiz · 11 Nov · from the intro log</p>
          <div className="fh-kv">
            <div>
              <b>6</b>
              <span>intros asked for</span>
            </div>
            <div>
              <b>3</b>
              <span>introduced, both said yes</span>
            </div>
          </div>
        </div>,
        { width: 365, note: "Founderhall's crop of the table caught the report's head; the table itself is in the report document." },
      )}
      {part("report-document", "Partner report", <ReportDocument />, { width: 836 })}
      {part(
        "mail-preview",
        "Mail preview",
        <div className="fh-mail">
          <div className="fh-mail-h">
            <div>
              <span className="fh-k">From</span>
              <span className="fh-v">
                {COMMUNITY} &lt;notify@mail.northwind.example&gt;
              </span>
            </div>
            <div>
              <span className="fh-k">To</span>
              <span className="fh-v">Maya Ortiz</span>
            </div>
            <div>
              <span className="fh-k">Headers</span>
              <span className="fh-v">List-Unsubscribe (one click) · Reply-To reply+d…@reply.northwind.example</span>
            </div>
            <div className="fh-subj">Maya, that’s everything this week</div>
          </div>
          <div className="fh-mail-b">
            <p>Hi Maya,</p>
            <p>Nothing needs you at {COMMUNITY} this week.</p>
            <p>
              That’s everything this week.{" "}
              <Button size="sm" variant="secondary">
                Open the portal
              </Button>
            </p>
            <p>Nobody is introduced without saying yes.</p>
            <p>
              <Button size="sm" variant="secondary">
                Stop the weekly digest
              </Button>
            </p>
            <p>Sent by {COMMUNITY} via its member portal.</p>
          </div>
        </div>,
        { width: 470 },
      )}

      <h2 className="fh-h2 mt-10">Heads</h2>
      {part("section-head", "Section head", <SectionHead title="2 asks on your paths" link={<a href="#section-head">All asks</a>} />, { width: 560, note: "No crop: from the Today shot." })}
      {part(
        "tags",
        "Tags",
        <Tags>
          <Tag>Pre-seed</Tag>
          <Tag>Climate</Tag>
          <Tag tone="sage">
            <Check aria-hidden="true" />
            Set up
          </Tag>
        </Tags>,
        { note: "No crop: from the directory card." },
      )}
    </main>
  );
}

function ReportOutcomes() {
  return (
    <section className="fh-outcomes mt-0" aria-labelledby="parts-outcomes">
      <div className="fh-ohead">
        <h2 id="parts-outcomes" className="fh-h3">
          What came of the intros
        </h2>
        <span>asked 14 days after each intro</span>
      </div>
      {[
        ["A customer conversation started", null, "1"],
        ["A hire", null, "0"],
        ["An investor meeting", null, "0"],
        ["Found it helpful", "0 not really, 0 too early to say", "1 of 1 who answered"],
        ["Pending", "introduced less than 14 days ago; asked at 14 days", "2 pending"],
      ].map(([label, note, value]) => (
        <div key={label} className="fh-orow">
          <span>
            {label}
            {note ? <small>{note}</small> : null}
          </span>
          <b>{value}</b>
        </div>
      ))}
      <p className="fh-oline">
        One line for the partner meeting: <b>6 asks and 3 intros made in the first 3 weeks, median 2 days from ask to intro, 1 customer conversation started, 2 outcomes pending.</b>
      </p>
    </section>
  );
}

function ReportDocument() {
  const tableRows = [
    ["Priya Shah", "2", "2", "2"],
    ["Marcus Webb", "1", "1", "1"],
    ["Amara Diallo", "1", "1", "0"],
  ];
  return (
    <article className="fh-report">
      <div className="fh-report-brand">
        <FundMark name={COMMUNITY} logo={null} className="contents [&_small]:hidden" />
        <span>
          Partner report
          <br />1 Oct – 11 Nov
        </span>
      </div>
      <h1 className="fh-h1">Northwind intros, Q4 2026 to date: 6 asked, 3 made, 0 declined</h1>
      <p className="fh-by">Prepared by Maya Ortiz · 11 Nov · from the intro log</p>
      <div className="fh-kv">
        {[
          ["6", "intros asked for"],
          ["3", "introduced, both said yes"],
          ["1", "found it helpful, 1 of 1"],
          ["2 days", "median from ask to intro"],
        ].map(([value, label]) => (
          <div key={label}>
            <b>{value}</b>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <ReportOutcomes />
      <h2>Every step, counted</h2>
      <Ledger
        rows={[
          { label: "Asked for an intro", value: "6", percent: 100 },
          { label: "Connector said yes", value: "4", share: "67%", percent: 67, tone: "yes" },
          { label: "Target said yes", value: "3", share: "75%", percent: 50, tone: "yes" },
          { label: <b>Introduced</b>, value: "3", percent: 50, tone: "made", hasBookmark: true },
          { label: "Declined", note: "0 at the connector, 0 by the person asked for", value: "0", percent: 0, tone: "declined" },
          { label: "Still open", note: "1 with the connector, 1 with the target", value: "2", percent: 33, tone: "open" },
        ]}
      />
      <div className="fh-two">
        <div>
          <h2>Top connectors</h2>
          <table className="fh-tbl">
            <thead>
              <tr>
                <th>Member</th>
                <th className="fh-n">Asked</th>
                <th className="fh-n">Yes</th>
                <th className="fh-n">Introduced</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map(([name, ...figures]) => (
                <tr key={name}>
                  <td>
                    <span className="fh-serif">{name}</span>
                  </td>
                  {figures.map((figure, index) => (
                    <td key={index} className="fh-n">
                      {figure}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <h2>By sector</h2>
          <table className="fh-tbl">
            <thead>
              <tr>
                <th>Sector</th>
                <th className="fh-n">Asked</th>
                <th className="fh-n">Made</th>
                <th className="fh-n">Declined</th>
                <th className="fh-n">Open</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Health", "3", "2", "0", "0"],
                ["Climate", "1", "0", "0", "1"],
                ["Fintech", "1", "1", "0", "0"],
              ].map(([sector, ...figures]) => (
                <tr key={sector}>
                  <td>
                    <span className="fh-serif">{sector}</span>
                  </td>
                  {figures.map((figure, index) => (
                    <td key={index} className="fh-n">
                      {figure}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <h2>The no’s, too</h2>
      <p className="fh-small">0 declined by the connector and 0 by the person asked for; 0 had no answer in 7 days. 1 withdrawn by the asker. 2 still open. Declines carry no reason, by design.</p>
    </article>
  );
}
