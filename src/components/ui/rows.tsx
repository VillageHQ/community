import { cn } from "cn";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

// Founderhall prefers ruled rows to boxed cards (design-system.md §3.6).

// `.rows` + `.r` (crops row-member-admin.png, rows-intros.png): a rule on top, then one grid row per item
// (start | who | end), padding 12/0, a rule under each; a link row gets a soft Vellum band on hover.
export function Rows({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="rows" className={cn("fh-rows", className)} {...props} />;
}

type RowProps = {
  // An avatar, a logo or an icon.
  start?: ReactNode;
  // The serif name (16/21).
  title: ReactNode;
  // The 13 px Graphite line under it.
  detail?: ReactNode;
  // Right-aligned: a pill over a 12 px date, or a button.
  end?: ReactNode;
  endNote?: ReactNode;
  href?: string;
  className?: string;
};

export function Row({ start, title, detail, end, endNote, href, className }: RowProps) {
  const content = (
    <>
      {start ?? <span />}
      <span className="fh-who">
        <b>{title}</b>
        {detail ? <span>{detail}</span> : null}
      </span>
      {end || endNote ? (
        <span className="fh-end">
          {end}
          {endNote ? <small>{endNote}</small> : null}
        </span>
      ) : null}
    </>
  );
  return href ? (
    <Link href={href} className={cn("fh-r", className)}>
      {content}
    </Link>
  ) : (
    <div className={cn("fh-r", className)}>{content}</div>
  );
}

// Set up's list (crop setup-rows.png): one ruled line per page, a title, its one-line description, a status on the
// right and a chevron.
export function SetupRows({ rows }: { rows: readonly { href: string; title: string; description: string; status?: ReactNode }[] }) {
  return (
    <div className="fh-setup-rows fh-rows">
      {rows.map((row) => (
        <Link key={row.href} href={row.href} className="fh-r">
          <span className="fh-who">
            <b className="fh-plain">{row.title}</b>
            <span>{row.description}</span>
          </span>
          <span className="fh-end">
            {row.status}
            <ChevronRight aria-hidden="true" className="fh-i fh-s" strokeWidth={1.5} />
          </span>
        </Link>
      ))}
    </div>
  );
}

// A setting row (crop setrow.png): the label and a hint left, one control right (a switch, a number stepper).
export function SetRow({ label, hint, control, htmlFor }: { label: ReactNode; hint?: ReactNode; control: ReactNode; htmlFor?: string }) {
  return (
    <div className="fh-setrow">
      <label htmlFor={htmlFor} className="min-w-0">
        <b>{label}</b>
        {hint ? <span>{hint}</span> : null}
      </label>
      {control}
    </div>
  );
}

// The history list (crop history-list.png): ruled two-column lines, a bold thing left and a Graphite date right.
export function HistoryList({ items }: { items: readonly { key: string; title: ReactNode; when: ReactNode }[] }) {
  return (
    <ul className="fh-hist">
      {items.map((item) => (
        <li key={item.key}>
          <b>{item.title}</b>
          <span>{item.when}</span>
        </li>
      ))}
    </ul>
  );
}

// A profile's field block (crop fieldblock-profile.png): a 13/600 Graphite key, a 15.5/23 value (17/25 serif for
// "working on"), ruled; an edit form may replace the value in place.
export function FieldBlock({ label, action, children, isSerif = false }: { label: ReactNode; action?: ReactNode; children: ReactNode; isSerif?: boolean }) {
  return (
    <div className="fh-fieldblock">
      <div className="fh-k">
        <span>{label}</span>
        {action}
      </div>
      <div className={cn("fh-v", isSerif && "fh-serif")}>{children}</div>
    </div>
  );
}
