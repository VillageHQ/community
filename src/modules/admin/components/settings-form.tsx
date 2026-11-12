"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState, type ChangeEvent, type ReactNode } from "react";

import { FLASH_KINDS, useFlash } from "@/components/flash";
import { Field } from "@/components/form-field";
import { LogoTile } from "@/components/logo-tile";
import { VillageSetsUp } from "@/components/plumbing-notes";
import { Button, ButtonRow } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ACCEPTED_LOGO_TYPES } from "@/platform/branding/logo-rules";
import type { CommunityLogo } from "@/platform/branding/branding";
import { contrastRatio, DEFAULT_ACCENT_COLOR, deriveFundColors, LEAF, parseAccentColor, toAccentVariables } from "@/platform/design/accent";
import { postRequest } from "@/platform/http/post-request";
import { HOSTED_BY, PLANS } from "@/platform/settings/plan-api";
import { MESSAGE_POLICY_DEFAULTS, SETTINGS_API_ROUTE, settingsResponseSchema, type SettingsField, type SettingsValues } from "@/modules/admin/contract-settings";
import { removeLogo, uploadLogo } from "@/modules/admin/components/logo-upload";

type SettingsFormProps = {
  saved: SettingsValues;
  uploadedLogo: CommunityLogo | null;
  isMailOn: boolean;
  // The plan this server runs as when none is picked (Founderhall: "As this server is set up (self-host)").
  serverPlan: string;
  managedBy: string | null;
  // The right column: the mail checklist, Village and the audit log (rendered on the server).
  aside: ReactNode;
};

// "Buttons, links and the path line. Passes 8.5 : 1 on white.", or the darker shade the fund colour was moved to so
// text passes.
// A colour that doesn't parse is measured on the last good one (the picker's).
function readContrastLine(accent: string, fallback: string) {
  const use = "Buttons, links and the path line.";
  if (!accent) return `${use} Empty: the default colour.`;
  const { fund, isAdjusted } = deriveFundColors(parseAccentColor(accent) ?? fallback);
  const ratio = Math.round(contrastRatio(fund, LEAF) * 10) / 10;
  return `${use} ${isAdjusted ? `Darkened to ${fund.toUpperCase()} so text passes` : "Passes"} ${ratio} : 1 on white.`;
}

function isPreviewableLogo(url: string) {
  return url.startsWith("https://") || (url.startsWith("/") && !url.startsWith("//"));
}

// Set up › Settings (Founderhall's settingsPage): one form, one save. Changes are written to the audit log.
export function SettingsForm({ saved, uploadedLogo, isMailOn, serverPlan, managedBy, aside }: SettingsFormProps) {
  const router = useRouter();
  const flash = useFlash();
  const [values, setValues] = useState(saved);
  const [errors, setErrors] = useState<Partial<Record<SettingsField, string>>>({});
  const [logoNote, setLogoNote] = useState<string | null>(null);
  const isManaged = (values.plan || serverPlan) === PLANS.managed;

  const save = useMutation({
    mutationFn: (body: SettingsValues) => postRequest(SETTINGS_API_ROUTE, body, settingsResponseSchema),
    onSuccess: ({ saved: isSaved, errors: fieldErrors }) => {
      setErrors(fieldErrors);
      if (isSaved) {
        flash("Settings saved.");
        router.refresh();
      } else flash("Some settings need a fix.", { kind: FLASH_KINDS.needs });
      window.scrollTo({ top: 0 });
    },
    onError: (error) => flash(error.message, { kind: FLASH_KINDS.needs }),
  });

  const change = (field: SettingsField) => (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setValues((current) => ({ ...current, [field]: event.target.value }));
  const describedBy = (field: SettingsField, hasHint = true) => [hasHint ? `s-${field}-hint` : "", errors[field] ? `s-${field}-error` : ""].filter(Boolean).join(" ") || undefined;
  const input = (field: SettingsField, label: string, hint: ReactNode, props: Partial<React.ComponentProps<typeof Input>> = {}) => (
    <Field htmlFor={`s-${field}`} label={label} hint={hint} error={errors[field]} className="fh-field">
      <Input id={`s-${field}`} name={field} value={values[field]} onChange={change(field)} aria-invalid={errors[field] ? true : undefined} aria-describedby={describedBy(field, Boolean(hint))} {...props} />
    </Field>
  );

  const previewColor = parseAccentColor(values.accent) ?? parseAccentColor(saved.accent) ?? DEFAULT_ACCENT_COLOR;
  const previewName = values.name.trim() || saved.name;
  const previewLogo = values.logoUrl && isPreviewableLogo(values.logoUrl) ? { url: values.logoUrl, backdrop: "light" as const } : values.logoUrl ? null : uploadedLogo;
  const hostedByLine = `Hosted by ${values.hostingBy === HOSTED_BY.managed ? "Village (managed)" : saved.name}${values.region.trim() ? `, ${values.region.trim()}` : ""}`;

  async function runLogo(action: () => Promise<unknown>) {
    setLogoNote(null);
    try {
      await action();
      router.refresh();
    } catch (error) {
      setLogoNote(error instanceof Error ? error.message : "That failed. Try again.");
    }
  }

  return (
    <form
      className="fh-grid"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate(values);
      }}
    >
      <div className="fh-c7 fh-stack">
        <section className="fh-sheet">
          <h2 className="fh-h3">Branding</h2>
          {input("name", "Community name", "Shown at the top of every page and in every email.", { maxLength: 80, required: true })}
          {input("logoUrl", "Logo URL", "A square image, https:// or a path on this server. Empty: your initials on your colour.", { maxLength: 500, placeholder: "e.g. https://fund.example/logo.svg" })}
          <Field htmlFor="s-accent" label="Brand colour" hint={readContrastLine(values.accent, previewColor)} error={errors.accent} className="fh-field">
            <div className="fh-colorrow">
              <input
                type="color"
                id="s-accent-pick"
                aria-label="Pick a colour"
                value={previewColor}
                onChange={(event) => setValues((current) => ({ ...current, accent: event.target.value.toUpperCase() }))}
              />
              <Input
                id="s-accent"
                name="accent"
                // Founderhall keeps the field's own border on a refused colour; the error line says what is wrong.
                className="fh-mono aria-invalid:border-input"
                value={values.accent}
                maxLength={20}
                placeholder="e.g. #24525A"
                onChange={change("accent")}
                aria-invalid={errors.accent ? true : undefined}
                aria-describedby={describedBy("accent")}
              />
            </div>
          </Field>
          <div className="fh-setrow" style={{ marginTop: 12, borderBottom: 0 }}>
            <div>
              <b>Preview</b>
              <span>The header, as members see it</span>
            </div>
            {/* The colour as members see it in each look: the light one, or the dark one in dark mode. */}
            <span className="fh-fundmark min-w-0 dark:hidden!" style={toAccentVariables(previewColor, "light")}>
              <LogoTile name={previewName} logo={previewLogo} />
              <b className="min-w-0 whitespace-normal break-words">{previewName}</b>
            </span>
            <span className="fh-fundmark min-w-0 hidden! dark:flex!" style={toAccentVariables(previewColor, "dark")} aria-hidden="true">
              <LogoTile name={previewName} logo={previewLogo} />
              <b className="min-w-0 whitespace-normal break-words">{previewName}</b>
            </span>
          </div>
          {/* Community's own: the line under the name in the sidebar, and a logo file instead of an address. */}
          {input("descriptor", "Short descriptor", "A few words under the name on the sign-in page. Optional.", { maxLength: 80 })}
          <div className="fh-field">
            <span className="fh-label">Logo file</span>
            <ButtonRow>
              <label className="fh-btn fh-btn-secondary fh-btn-sm has-focus-visible:outline-3 has-focus-visible:outline-ring">
                {uploadedLogo ? "Replace the logo file" : "Upload a logo file"}
                <input
                  type="file"
                  accept={ACCEPTED_LOGO_TYPES.join(",")}
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file) void runLogo(() => uploadLogo(file));
                  }}
                />
              </label>
              {uploadedLogo && !saved.logoUrl ? (
                <Button type="button" variant="quiet" size="sm" onClick={() => runLogo(removeLogo)}>
                  Remove the logo file
                </Button>
              ) : null}
            </ButtonRow>
            <p className="fh-hint">PNG, JPEG or WebP, kept on this server. A Logo URL above is used first.</p>
            {logoNote ? (
              <p role="alert" className="fh-hint fh-err">
                {logoNote}
              </p>
            ) : null}
          </div>
        </section>

        <section className="fh-sheet" id="mail">
          <h2 className="fh-h3">Mail</h2>
          {input("fromName", "From name", `For example: ${saved.name}. Empty: the community name.`, { maxLength: 80 })}
          {isManaged && !saved.mailDomain ? (
            <VillageSetsUp what="your sending domain" by={managedBy} />
          ) : (
            input("mailDomain", "Sending domain", "A subdomain of yours, for example mail.fund.example. Mail goes out from hello@ this domain.", { maxLength: 120, placeholder: "e.g. mail.fund.example" })
          )}
          {isManaged && !isMailOn ? null : (
            <p className="fh-small fh-muted" style={{ marginTop: 12 }}>
              The mail service itself is set on the server by whoever runs it: now <b>{isMailOn ? "set" : "not set"}</b>.
            </p>
          )}
        </section>

        <section className="fh-sheet" id="hosting">
          <h2 className="fh-h3">Hosting &amp; data</h2>
          <p className="fh-small" style={{ marginTop: 6 }}>
            Shown to members on their Your data page, and on the sign-in page: “{hostedByLine}”.
          </p>
          <Field htmlFor="s-hostingBy" label="Hosted by" hint={`Ourselves: ${saved.name} runs the server. Members see the line on their Your data page.`} className="fh-field">
            <Select id="s-hostingBy" name="hostingBy" value={values.hostingBy} onChange={change("hostingBy")} aria-describedby="s-hostingBy-hint">
              <option value={HOSTED_BY.ourselves}>Ourselves</option>
              <option value={HOSTED_BY.managed}>Village (managed plan)</option>
            </Select>
          </Field>
          {input("region", "Region", "Where the server and its database are, for example EU (Frankfurt). Empty: not shown.", { maxLength: 120, placeholder: "e.g. EU (Frankfurt)" })}
          {input("contactEmail", "Data-protection contact", "Who members write to about their data. Shown on their Your data page.", { maxLength: 160, type: "email", placeholder: "e.g. privacy@fund.example" })}
          {input("contactName", "Who handles data requests", "A name or a role, shown with the contact. Optional.", { maxLength: 80 })}
          <Field htmlFor="s-messagePolicy" label="Who can message a member, unless they choose" hint="Each member can change it for themselves on Your data. Admins can always write." className="fh-field">
            <Select id="s-messagePolicy" name="messagePolicy" value={values.messagePolicy} onChange={change("messagePolicy")} aria-describedby="s-messagePolicy-hint">
              <option value={MESSAGE_POLICY_DEFAULTS.anyone}>Anyone in the community</option>
              <option value={MESSAGE_POLICY_DEFAULTS.introduced}>Only people they were introduced to</option>
            </Select>
          </Field>
        </section>

        <section className="fh-sheet" id="plan">
          <h2 className="fh-h3">Plan</h2>
          <Field htmlFor="s-plan" label="Your plan" hint="Sets the words on the launch checklist on Home." className="fh-field">
            <Select id="s-plan" name="plan" value={values.plan} onChange={change("plan")} aria-describedby="s-plan-hint">
              <option value="">As this server is set up ({serverPlan})</option>
              <option value={PLANS.managed}>Managed: Village sets up mail and the network</option>
              <option value={PLANS.selfHost}>Self-host: you set up mail and the network</option>
            </Select>
          </Field>
          {input("managedSetupBy", "Village sets up mail and the network by", "Managed plan: the date Village gave you. Empty: the checklist says Village sets it up, with no date.", { type: "date" })}
        </section>

        <ButtonRow>
          <Button type="submit" disabled={save.isPending}>
            Save settings
          </Button>
        </ButtonRow>
      </div>
      <div className="fh-c5 fh-stack">{aside}</div>
    </form>
  );
}
