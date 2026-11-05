"use client";

import { cn } from "cn";
import { useRouter } from "next/navigation";
import { useActionState, useState, type ChangeEvent } from "react";

import { CommunityMemberBadge } from "@/components/community-member-badge";
import { FormError } from "@/components/form-error";
import { FormField } from "@/components/form-field";
import { LogoTile } from "@/components/logo-tile";
import { useIsDarkTheme } from "@/components/shell/use-theme";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MAXIMUM_COMMUNITY_NAME_LENGTH, MAXIMUM_DESCRIPTOR_LENGTH } from "@/platform/branding/branding-api";
import { ACCEPTED_LOGO_TYPES } from "@/platform/branding/logo-rules";
import { removeLogo, uploadLogo } from "@/lib/branding/logo-upload";
import {
  ACCENT_PRESETS,
  describeButtonContrast,
  parseAccentColor,
  toAccentVariables,
} from "@/platform/design/accent";
import { API_ROUTES } from "@/platform/http/routes";
import { acknowledgedResponseSchema } from "@/platform/http/contract";
import { postNetworkRequest } from "@/platform/http/post-request";

import { BRAND_NAME_INPUT_ID } from "./brand-fields";
import type { CommunityLogo } from "@/platform/branding/branding";

type BrandState = { errorMessage: string | null };

const INITIAL_STATE: BrandState = { errorMessage: null };
const LOGO_INPUT_ID = "brand-logo";
const HEX_INPUT_ID = "brand-accent-hex";
const ACCENT_FIELD = "accentColor";

async function submitBrand(_previousState: BrandState, formData: FormData): Promise<BrandState> {
  try {
    await postNetworkRequest(API_ROUTES.branding, Object.fromEntries(formData), acknowledgedResponseSchema);
    window.location.assign(window.location.pathname);
    return INITIAL_STATE;
  } catch (error) {
    return { errorMessage: error instanceof Error ? error.message : "Saving failed. Try again." };
  }
}

type LogoAction = () => Promise<unknown>;
type LogoFeedback = { setError: (message: string | null) => void; setBusy: (isBusy: boolean) => void; refresh: () => void };

async function runLogoAction(action: LogoAction, { setError, setBusy, refresh }: LogoFeedback) {
  setError(null);
  setBusy(true);
  try {
    await action();
    refresh();
  } catch (error) {
    setError(error instanceof Error ? error.message : "That failed. Try again.");
  } finally {
    setBusy(false);
  }
}

function readSelectedFile(event: ChangeEvent<HTMLInputElement>) {
  const file = event.target.files?.[0] ?? null;
  event.target.value = "";
  return file;
}

type BrandCardProps = {
  name: string;
  descriptor: string;
  accentColor: string;
  logo: CommunityLogo | null;
  isSaved: boolean;
  isCurrentStep: boolean;
};

export function BrandCard({ name, descriptor, accentColor, logo, isSaved, isCurrentStep }: BrandCardProps) {
  const router = useRouter();
  const isDark = useIsDarkTheme();
  const [state, formAction, isPending] = useActionState(submitBrand, INITIAL_STATE);
  const [previewName, setPreviewName] = useState(name);
  const [hexDraft, setHexDraft] = useState(accentColor);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [isLogoBusy, setIsLogoBusy] = useState(false);

  const typedColor = parseAccentColor(hexDraft);
  const color = typedColor ?? accentColor;
  const { textColorName, ratio } = describeButtonContrast(color);
  const logoFeedback = { setError: setLogoError, setBusy: setIsLogoBusy, refresh: router.refresh };

  return (
    <section
      id="brand"
      aria-labelledby="brand-title"
      className={cn(
        "rounded-card bg-card p-5 shadow-panel sm:rounded-panel sm:p-[22px]",
        isCurrentStep && "shadow-[inset_0_0_0_2.5px_var(--brand-emphasis),var(--elevation-panel)]",
      )}
    >
      <h2 id="brand-title" className="type-h3">
        Your brand
      </h2>
      <p className="type-small mt-1 text-foreground-soft">Add your name, logo and color. We handle the contrast.</p>

      <form action={formAction} className="mt-4 grid gap-4">
        <FormError message={state.errorMessage} />
        <FormField
          name={BRAND_NAME_INPUT_ID}
          label="Community name"
          defaultValue={isSaved ? name : ""}
          maxLength={MAXIMUM_COMMUNITY_NAME_LENGTH}
          placeholder="Northwind Ventures"
          className="min-h-12"
          onChange={(event) => setPreviewName(event.target.value || name)}
          required
        />
        <FormField
          name="descriptor"
          label="Short descriptor"
          defaultValue={descriptor}
          maxLength={MAXIMUM_DESCRIPTOR_LENGTH}
          placeholder="Founder community"
          className="min-h-12"
        />

        <div className="grid gap-2">
          <div className="flex flex-wrap items-center gap-3 rounded-field bg-muted p-2.5 pl-3">
            <LogoTile name={previewName} logo={logo} />
            <div className="min-w-0 flex-[1_1_60px]">
              <div className="type-label">Logo</div>
              <div className="type-micro font-medium text-muted-foreground">PNG, JPEG or WebP</div>
            </div>
            <label
              htmlFor={LOGO_INPUT_ID}
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "ml-auto has-focus-visible:outline-3 has-focus-visible:outline-offset-3 has-focus-visible:outline-ring",
              )}
            >
              {isLogoBusy ? "Saving…" : logo ? "Replace" : "Upload"}
              <input
                id={LOGO_INPUT_ID}
                type="file"
                accept={ACCEPTED_LOGO_TYPES.join(",")}
                disabled={isLogoBusy}
                className="sr-only"
                onChange={(event) => {
                  const file = readSelectedFile(event);
                  if (file) void runLogoAction(() => uploadLogo(file), logoFeedback);
                }}
              />
            </label>
          </div>
          {logo ? (
            <div>
              <Button
                type="button"
                variant="link"
                size="sm"
                disabled={isLogoBusy}
                onClick={() => runLogoAction(removeLogo, logoFeedback)}
              >
                Remove logo
              </Button>
            </div>
          ) : null}
          <FormError message={logoError} />
        </div>

        <fieldset className="grid gap-2">
          <legend className="mb-2 type-label">Accent color</legend>
          <div className="-mx-1 flex flex-wrap gap-1">
            {ACCENT_PRESETS.map((preset) => (
              <label key={preset.color} className="relative flex size-12 items-center justify-center rounded-full">
                <input
                  type="radio"
                  name="accentPreset"
                  value={preset.color}
                  checked={color === preset.color}
                  onChange={() => setHexDraft(preset.color)}
                  className="peer sr-only"
                />
                <span className="absolute inset-0 rounded-full peer-checked:shadow-[inset_0_0_0_2.5px_var(--foreground)] peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring" />
                <span
                  style={{ backgroundColor: preset.color }}
                  className="block size-[34px] rounded-full shadow-[0_0_0_1.5px_var(--input)]"
                />
                <span className="sr-only">{preset.name}</span>
              </label>
            ))}
          </div>
          <label htmlFor={HEX_INPUT_ID} className="sr-only">
            Or type a hex color
          </label>
          <div className="relative">
            <span
              aria-hidden="true"
              style={{ backgroundColor: color }}
              className="absolute top-[13px] left-4 block size-icon rounded-full shadow-[inset_0_0_0_1.5px_rgb(0_0_0/0.16)]"
            />
            <Input
              id={HEX_INPUT_ID}
              name={ACCENT_FIELD}
              value={hexDraft}
              onChange={(event) => setHexDraft(event.target.value)}
              placeholder="Or type a hex color"
              aria-invalid={typedColor === null}
              aria-describedby="brand-contrast"
              spellCheck={false}
              className="min-h-12 pl-12"
            />
          </div>
        </fieldset>

        <p id="brand-contrast" role="status" className="type-small rounded-small bg-muted px-3.5 py-3 text-foreground-soft">
          {typedColor === null ? (
            <strong className="font-bold text-destructive-text">Use six digits, like #0f7f86.</strong>
          ) : (
            <>
              <strong className="font-bold text-foreground">
                {textColorName} button text, {ratio}:1.
              </strong>{" "}
              Passes AA. We picked it for you.
            </>
          )}
        </p>

        <div
          data-accent-scope=""
          style={toAccentVariables(color, isDark ? "dark" : "light")}
          className="rounded-field bg-background p-card-phone"
        >
          <p className="sr-only">Preview</p>
          <div className="mb-3.5 flex items-center gap-2.5 type-label">
            <LogoTile name={previewName} logo={logo} sizePx={36} />
            <span className="min-w-0">{previewName}</span>
          </div>
          <span className={cn(buttonVariants(), "flex w-full")}>Say hello</span>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <CommunityMemberBadge />
          </div>
        </div>

        <Button type="submit" disabled={isPending || typedColor === null}>
          {isPending ? "Saving…" : "Save brand"}
        </Button>
      </form>
    </section>
  );
}
