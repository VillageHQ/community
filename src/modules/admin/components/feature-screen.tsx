"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SetRow } from "@/components/ui/rows";
import { Switch } from "@/components/ui/switch";

import { setModuleStateRequest } from "../queries-modules";
import { ConfirmDialog } from "./confirm-dialog";

export type Feature = {
  id: string;
  label: string;
  description: string;
  icon: ReactNode;
  needsVillage: boolean;
  turnOffNote: string | null;
  isOn: boolean;
  missingRequirement: { id: string; label: string } | null;
  dependentLabels: string[];
};

type CoreModule = { id: string; label: string; description: string; icon: ReactNode };

function toCardId(moduleId: string) {
  return `feature-card-${moduleId}`;
}

type ChangeHandler = (moduleId: string, message: string) => void;

function TurnOffSwitch({ feature, onChanged }: { feature: Feature; onChanged: ChangeHandler }) {
  const { id, label, dependentLabels, turnOffNote } = feature;
  return (
    <ConfirmDialog
      trigger={<Switch checked aria-label={label} />}
      title={`Turn off ${label}?`}
      confirmLabel={`Turn off ${label}`}
      pendingLabel="Turning off…"
      fallbackFocusId={toCardId(id)}
      action={() => setModuleStateRequest({ moduleId: id, isOn: false })}
      onDone={({ message }) => onChanged(id, message)}
    >
      <p>Members won&apos;t see it anymore. Nothing is deleted, and it all comes back when you turn it on again.</p>
      {dependentLabels.length > 0 ? <p>This also pauses {dependentLabels.join(" and ")}, which needs {label}.</p> : null}
      {turnOffNote ? <p>{turnOffNote}</p> : null}
    </ConfirmDialog>
  );
}

function useTurnOn(moduleId: string, onChanged: ChangeHandler) {
  return useMutation({
    mutationFn: () => setModuleStateRequest({ moduleId, isOn: true }),
    onSuccess: ({ message }) => onChanged(moduleId, message),
  });
}

function TurnOnSwitch({ feature, onChanged }: { feature: Feature; onChanged: ChangeHandler }) {
  const turnOn = useTurnOn(feature.id, onChanged);
  return (
    <div className="grid justify-items-end gap-2">
      <Switch checked={false} aria-label={feature.label} disabled={turnOn.isPending} onCheckedChange={() => turnOn.mutate()} />
      <FormError message={turnOn.error?.message ?? null} />
    </div>
  );
}

function TurnOnRequirementButton({ requirement, onChanged }: { requirement: { id: string; label: string }; onChanged: ChangeHandler }) {
  const turnOn = useTurnOn(requirement.id, onChanged);
  return (
    <div className="grid justify-items-end gap-2">
      <Button type="button" variant="secondary" size="sm" className="whitespace-nowrap" disabled={turnOn.isPending} onClick={() => turnOn.mutate()}>
        {turnOn.isPending ? "Turning on…" : `Turn on ${requirement.label}`}
      </Button>
      <FormError message={turnOn.error?.message ?? null} />
    </div>
  );
}

function FeatureAction({ feature, onChanged }: { feature: Feature; onChanged: ChangeHandler }) {
  if (feature.missingRequirement) return <TurnOnRequirementButton requirement={feature.missingRequirement} onChanged={onChanged} />;
  return feature.isOn ? <TurnOffSwitch feature={feature} onChanged={onChanged} /> : <TurnOnSwitch feature={feature} onChanged={onChanged} />;
}

// One Founderhall setting row per feature (crop setrow.png): its name and one line left, its switch right. A feature
// paused because what it needs is off says so, and offers to turn that on instead of a switch.
function FeatureRow({ feature, onChanged }: { feature: Feature; onChanged: ChangeHandler }) {
  const { id, label, description, needsVillage, missingRequirement } = feature;
  return (
    <li id={toCardId(id)} tabIndex={-1} className="rounded-sm border-b border-rule outline-offset-2 last:border-b-0 [&_.fh-setrow]:border-b-0">
      <SetRow
        label={label}
        hint={
          <>
            {description}
            {needsVillage ? " Needs a Village account." : null}
            {missingRequirement ? <span className="mt-0.5 font-semibold text-ribbon">Paused: needs {missingRequirement.label}</span> : null}
          </>
        }
        control={<FeatureAction feature={feature} onChanged={onChanged} />}
      />
    </li>
  );
}

export function FeatureScreen({ features, coreModules }: { features: Feature[]; coreModules: CoreModule[] }) {
  const router = useRouter();
  const [announcement, setAnnouncement] = useState("");

  function handleChanged(moduleId: string, message: string) {
    setAnnouncement(message);
    document.getElementById(toCardId(moduleId))?.focus();
    router.refresh();
  }

  return (
    <div className="fh-grid">
      <p role="status" className="sr-only">
        {announcement}
      </p>
      <div className="fh-c7 fh-stack">
        <Card className="fh-sheet">
          <h2 className="type-h3">Switches</h2>
          <p className="fh-small fh-muted mt-1.5">Off hides a feature from members and keeps its data; on brings it all back.</p>
          <ul aria-label="Features you can turn on and off" className="mt-1.5">
            {features.map((feature) => (
              <FeatureRow key={feature.id} feature={feature} onChanged={handleChanged} />
            ))}
          </ul>
        </Card>
      </div>
      <div className="fh-c5 fh-stack max-lg:mt-4">
        <Card className="fh-sheet">
          <section aria-labelledby="always-on-title">
            <h2 id="always-on-title" className="type-h3">
              Always on
            </h2>
            <ul className="mt-1.5">
              {coreModules.map(({ id, label, description }) => (
                <li key={id} className="border-b border-rule last:border-b-0 [&_.fh-setrow]:border-b-0">
                  <SetRow label={label} hint={description} control={null} />
                </li>
              ))}
            </ul>
          </section>
        </Card>
      </div>
    </div>
  );
}
