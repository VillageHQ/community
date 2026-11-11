"use client";

import { LogOut, Moon } from "lucide-react";
import Link from "next/link";
import { useId } from "react";

import { Avatar } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { applyTheme, useIsDarkTheme } from "@/components/use-theme";
import { signOut } from "@/platform/auth/sign-out";
import { ROUTES } from "@/platform/http/routes";

export type ShellMember = { id: string; name: string; email: string; image?: string | null; isAdmin: boolean };

// Founderhall has no account menu (crop sidebar-me-signout.png): the sidebar ends with the member's face, name and
// role, a plain Sign out link, then the footer line. My profile is a menu item; on a phone the avatar opens it.
export function SidebarMember({ member }: { member: ShellMember }) {
  return (
    <>
      <div className="fh-me">
        <Avatar stableId={member.id} name={member.name} imageUrl={member.image} sizePx={28} />
        <span className="min-w-0">
          <b className="truncate">{member.name}</b>
          <span>{member.isAdmin ? "Admin" : "Member"}</span>
        </span>
      </div>
      <div className="fh-me-actions">
        <SignOutButton />
      </div>
    </>
  );
}

export function SignOutButton() {
  return (
    <button type="button" onClick={signOut} className="fh-linkbtn">
      <LogOut aria-hidden="true" className="fh-i fh-xs" strokeWidth={1.5} />
      Sign out
    </button>
  );
}

// The phone top bar's avatar: a link to My profile.
export function PhoneProfileLink({ member }: { member: ShellMember }) {
  return (
    <Link href={ROUTES.editCard} aria-label="My profile" className="rounded-full">
      <Avatar stableId={member.id} name={member.name} imageUrl={member.image} sizePx={28} />
    </Link>
  );
}

// Dark mode waits on the owner's decision (Founderhall has none). Until then the switch lives as one setting row on
// Your data, where Founderhall's map puts it if it stays.
export function DarkModeRow() {
  const isDark = useIsDarkTheme();
  const id = useId();
  return (
    <div className="fh-setrow">
      <label htmlFor={id} className="flex min-w-0 items-start gap-2.5">
        <Moon aria-hidden="true" className="fh-i fh-s mt-px text-graphite" strokeWidth={1.5} />
        <div>
          <b>Dark mode</b>
          <span>Light text on a dark page, on this device.</span>
        </div>
      </label>
      <Switch id={id} checked={isDark} onCheckedChange={applyTheme} />
    </div>
  );
}
