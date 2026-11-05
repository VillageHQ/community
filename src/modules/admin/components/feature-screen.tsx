"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";

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

function FeatureIcon({ children }: { children: ReactNode }) {
  return <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground [&_svg]:size-icon">{children}</span>;
}

function TurnOffButton({ feature }: { feature: Feature }) {
  const router = useRouter();
  const { id, label, dependentLabels, turnOffNote } = feature;
  return (
    <ConfirmDialog
      trigger={
        <Button type="button" variant="outline" size="lg" className="max-sm:w-full" aria-label={`Turn off ${label}`}>
          Turn off
        </Button>
      }
      title={`Turn off ${label}?`}
      confirmLabel={`Turn off ${label}`}
      pendingLabel="Turning off…"
      action={() => setModuleStateRequest({ moduleId: id, isOn: false })}
      onDone={() => router.refresh()}
    >
      <p>Members won&apos;t see it anymore. Nothing is deleted, and it all comes back when you turn it on again.</p>
      {dependentLabels.length > 0 ? <p>This also pauses {dependentLabels.join(" and ")}, which needs {label}.</p> : null}
      {turnOffNote ? <p>{turnOffNote}</p> : null}
    </ConfirmDialog>
  );
}

function TurnOnButton({ moduleId, label, name }: { moduleId: string; label: string; name: string }) {
  const router = useRouter();
  const turnOn = useMutation({
    mutationFn: () => setModuleStateRequest({ moduleId, isOn: true }),
    onSuccess: () => router.refresh(),
  });
  return (
    <div className="grid justify-items-start gap-2 max-sm:w-full">
      <Button type="button" size="lg" className="max-sm:w-full" aria-label={name} disabled={turnOn.isPending} onClick={() => turnOn.mutate()}>
        {turnOn.isPending ? "Turning on…" : label}
      </Button>
      <FormError message={turnOn.error?.message ?? null} />
    </div>
  );
}

function FeatureAction({ feature }: { feature: Feature }) {
  const { id, label, isOn, missingRequirement } = feature;
  if (missingRequirement) {
    return <TurnOnButton moduleId={missingRequirement.id} label={`Turn on ${missingRequirement.label}`} name={`Turn on ${missingRequirement.label}`} />;
  }
  return isOn ? <TurnOffButton feature={feature} /> : <TurnOnButton moduleId={id} label="Turn on" name={`Turn on ${label}`} />;
}

function FeatureStatus({ feature }: { feature: Feature }) {
  const { isOn, missingRequirement } = feature;
  if (missingRequirement) return <Tag tone="gold">Paused: needs {missingRequirement.label}</Tag>;
  return isOn ? <Tag tone="sage">On</Tag> : <Tag>Off</Tag>;
}

function FeatureCard({ feature }: { feature: Feature }) {
  const { label, description, icon, needsVillage } = feature;
  return (
    <li>
      <Card className="grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
        <FeatureIcon>{icon}</FeatureIcon>
        <div className="grid gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>{label}</CardTitle>
            <FeatureStatus feature={feature} />
            {needsVillage ? <Tag>Needs a Village account</Tag> : null}
          </div>
          <CardDescription>{description}</CardDescription>
        </div>
        <FeatureAction feature={feature} />
      </Card>
    </li>
  );
}

export function FeatureScreen({ features, coreModules }: { features: Feature[]; coreModules: CoreModule[] }) {
  return (
    <div className="grid gap-6">
      <ul aria-label="Features you can turn on and off" className="grid gap-3.5">
        {features.map((feature) => (
          <FeatureCard key={feature.id} feature={feature} />
        ))}
      </ul>
      <section aria-labelledby="always-on-title" className="grid gap-3">
        <h2 id="always-on-title" className="type-h3">
          Always on
        </h2>
        <ul className="grid gap-2.5 sm:grid-cols-2">
          {coreModules.map(({ id, label, description, icon }) => (
            <li key={id} className="flex items-center gap-3.5 rounded-card bg-muted p-4">
              <FeatureIcon>{icon}</FeatureIcon>
              <div>
                <p className="type-label">{label}</p>
                <p className="type-small text-foreground-soft">{description}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
