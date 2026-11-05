"use client";

import { ChevronRight, ChevronsUpDown, LogOut, Moon, ShieldCheck, UserRound, X } from "lucide-react";
import Link from "next/link";
import { Dialog, DropdownMenu } from "radix-ui";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { NetworkByVillage } from "@/components/village-mark";
import { describeBadge } from "@/lib/navigation";
import { ROUTES } from "@/platform/http/routes";
import { signOut } from "@/platform/auth/sign-out";

import { NavigationBadge } from "./navigation-links";
import { applyTheme, useIsDarkTheme } from "./use-theme";

export type ShellMember = { id: string; name: string; email: string; image?: string | null; isAdmin: boolean };

const MEMBER_ROLE_LABELS = { admin: "Admin", member: "Member" };

function readRoleLabel(isAdmin: boolean) {
  return isAdmin ? MEMBER_ROLE_LABELS.admin : MEMBER_ROLE_LABELS.member;
}

const MENU_ITEM =
  "flex min-h-12 cursor-pointer items-center gap-3.5 rounded-full px-4 text-base leading-5 font-semibold outline-none select-none data-[highlighted]:bg-muted data-[highlighted]:outline-3 data-[highlighted]:outline-offset-0 data-[highlighted]:outline-ring [&_svg]:size-icon [&_svg]:shrink-0";

function SwitchVisual({ isOn }: { isOn: boolean }) {
  return (
    <span
      aria-hidden="true"
      data-state={isOn ? "checked" : "unchecked"}
      className="relative ml-auto block h-8 w-12 shrink-0 rounded-full bg-muted shadow-[inset_0_0_0_1.5px_var(--input)] data-[state=checked]:bg-primary data-[state=checked]:shadow-[inset_0_0_0_1.5px_var(--brand-edge)]"
    >
      <span
        data-state={isOn ? "checked" : "unchecked"}
        className="absolute top-1 left-1 block size-6 rounded-full bg-foreground transition-transform duration-150 data-[state=checked]:translate-x-4 data-[state=checked]:bg-primary-foreground"
      />
    </span>
  );
}

export function SidebarUserMenu({ member }: { member: ShellMember }) {
  const isDark = useIsDarkTheme();
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger
        className="flex min-h-16 w-full items-center gap-3 rounded-field bg-card px-3 py-2 text-left shadow-panel hover:bg-muted"
      >
        <Avatar stableId={member.id} name={member.name} imageUrl={member.image} sizePx={44} />
        <span className="sr-only">Account menu for </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate type-label">{member.name}</span>
          <span className="type-micro block font-medium text-muted-foreground">{readRoleLabel(member.isAdmin)}</span>
        </span>
        <ChevronsUpDown aria-hidden="true" className="size-icon-small shrink-0 text-muted-foreground" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Content
        side="top"
        align="start"
        sideOffset={8}
        className="z-40 w-[248px] rounded-card bg-popover p-2 text-foreground shadow-panel data-[state=open]:animate-in data-[state=open]:fade-in-0"
      >
          <p className="type-small truncate px-4 py-2 text-muted-foreground">{member.email}</p>
          <DropdownMenu.Item asChild className={MENU_ITEM}>
            <Link href={ROUTES.editCard}>
              <UserRound aria-hidden="true" />
              My card
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.CheckboxItem
            checked={isDark}
            onCheckedChange={applyTheme}
            onSelect={(event) => event.preventDefault()}
            className={MENU_ITEM}
          >
            <Moon aria-hidden="true" />
            Dark mode
            <SwitchVisual isOn={isDark} />
          </DropdownMenu.CheckboxItem>
          <DropdownMenu.Item onSelect={signOut} className={MENU_ITEM}>
            <LogOut aria-hidden="true" />
            Sign out
          </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}

const SHEET_ROW =
  "flex min-h-14 w-full items-center gap-3.5 rounded-input px-4 text-base leading-5 font-semibold [&_svg]:size-icon [&_svg]:shrink-0";

export function AdminSheetRow({ badgeCount }: { badgeCount: number | undefined }) {
  return (
    <Dialog.Close asChild>
      <Link href={ROUTES.admin} className={`${SHEET_ROW} bg-accent font-bold text-accent-foreground`}>
        <ShieldCheck aria-hidden="true" />
        Admin
        <NavigationBadge count={badgeCount} />
        <ChevronRight aria-hidden="true" className={badgeCount ? undefined : "ml-auto"} />
      </Link>
    </Dialog.Close>
  );
}

type PhoneUserMenuProps = { member: ShellMember; adminBadgeCount: number | undefined };

export function PhoneUserMenu({ member, adminBadgeCount }: PhoneUserMenuProps) {
  const isDark = useIsDarkTheme();
  return (
    <Dialog.Root>
      <Dialog.Trigger className="relative flex size-11 shrink-0 items-center justify-center rounded-full">
        <Avatar stableId={member.id} name={member.name} imageUrl={member.image} sizePx={40} />
        <span className="sr-only">Account menu for {member.name}</span>
        {adminBadgeCount ? (
          <span className="type-tab absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-[5px] font-bold text-primary-foreground shadow-[0_0_0_2px_var(--background)]">
            {adminBadgeCount}
            <span className="sr-only"> {describeBadge(adminBadgeCount)}</span>
          </span>
        ) : null}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-30 bg-[rgb(10_12_10/0.48)] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-40 rounded-t-[32px] bg-card px-4 pt-2.5 pb-[max(env(safe-area-inset-bottom),24px)] data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom">
          <div aria-hidden="true" className="mx-auto mb-4 h-[5px] w-11 rounded-full bg-input" />
          <div className="flex items-center gap-3.5 px-2 pb-4">
            <Avatar stableId={member.id} name={member.name} imageUrl={member.image} sizePx={56} />
            <div className="min-w-0 flex-1">
              <Dialog.Title className="type-h3 truncate">{member.name}</Dialog.Title>
              <Dialog.Description className="type-small truncate text-muted-foreground">{member.email}</Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button type="button" variant="quiet" size="icon" aria-label="Close account menu">
                <X aria-hidden="true" />
              </Button>
            </Dialog.Close>
          </div>
          <div className="flex flex-col gap-1">
            {member.isAdmin ? <AdminSheetRow badgeCount={adminBadgeCount} /> : null}
            <Dialog.Close asChild>
              <Link href={ROUTES.editCard} className={`${SHEET_ROW} hover:bg-muted`}>
                <UserRound aria-hidden="true" />
                My card
                <ChevronRight aria-hidden="true" className="ml-auto" />
              </Link>
            </Dialog.Close>
            <label htmlFor="phone-dark-mode" className={SHEET_ROW}>
              <Moon aria-hidden="true" />
              Dark mode
              <span className="ml-auto">
                <Switch id="phone-dark-mode" checked={isDark} onCheckedChange={applyTheme} />
              </span>
            </label>
            <button type="button" onClick={signOut} className={`${SHEET_ROW} hover:bg-muted`}>
              <LogOut aria-hidden="true" />
              Sign out
            </button>
          </div>
          <div className="mt-3 px-4">
            <NetworkByVillage />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
