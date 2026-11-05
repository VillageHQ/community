"use client";

import { Ellipsis, type LucideIcon } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { useRef, type Ref } from "react";

import { Button } from "@/components/ui/button";

export type ContentAction = {
  id: string;
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
  movesFocus?: boolean;
};

const MENU_ITEM =
  "flex min-h-12 cursor-pointer items-center gap-3.5 rounded-full px-4 text-base leading-5 font-semibold outline-none select-none data-[highlighted]:bg-muted data-[highlighted]:outline-3 data-[highlighted]:outline-offset-0 data-[highlighted]:outline-ring [&_svg]:size-icon [&_svg]:shrink-0";

type ContentMenuProps = { label: string; actions: ContentAction[]; triggerRef: Ref<HTMLButtonElement> };

export function ContentMenu({ label, actions, triggerRef }: ContentMenuProps) {
  const focusMovesElsewhere = useRef(false);
  if (actions.length === 0) return null;
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild>
        <Button ref={triggerRef} type="button" variant="quiet" size="icon" aria-label={label}>
          <Ellipsis aria-hidden="true" />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content
        align="end"
        sideOffset={6}
        className="z-30 w-[220px] rounded-card bg-popover p-2 text-foreground shadow-panel data-[state=open]:animate-in data-[state=open]:fade-in-0"
        onCloseAutoFocus={(event) => {
          if (focusMovesElsewhere.current) event.preventDefault();
          focusMovesElsewhere.current = false;
        }}
      >
        {actions.map(({ id, label: actionLabel, icon: Icon, onSelect, movesFocus }) => (
          <DropdownMenu.Item
            key={id}
            className={MENU_ITEM}
            onSelect={() => {
              focusMovesElsewhere.current = Boolean(movesFocus);
              onSelect();
            }}
          >
            <Icon aria-hidden="true" />
            {actionLabel}
          </DropdownMenu.Item>
        ))}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}
