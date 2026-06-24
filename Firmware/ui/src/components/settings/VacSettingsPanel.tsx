import { Loader2, RotateCcw } from 'lucide-react';
import type { SettingsSchema, SettingsValues } from '@/types/settings';
import { SettingsField } from '@/components/settings/SettingsField';
import { Button } from '@/components/ui/button';
import { InfoBox } from '@/components/ui/info-box';

interface VacSettingsPanelProps {
  connected: boolean;
  ready: boolean;
  loadError: boolean;
  dirty: boolean;
  schema: SettingsSchema | null;
  values: SettingsValues;
  onFieldChange: (key: string, value: number) => void;
  onSave: () => void;
  onResetToDefault: () => void;
  onRetry: () => void;
}

export function VacSettingsPanel({
  connected,
  ready,
  loadError,
  dirty,
  schema,
  values,
  onFieldChange,
  onSave,
  onResetToDefault,
  onRetry,
}: VacSettingsPanelProps) {
  if (!connected) {
    return (
      <InfoBox role="status">
        Connect your vacuum to view and edit device settings.
      </InfoBox>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-destructive">Could not load settings from the device.</p>
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          Retry
        </Button>
      </div>
    );
  }

  if (!ready || !schema) {
    return (
      <div
        className="flex h-full min-h-[min(50vh,28rem)] flex-col items-center justify-center gap-3"
        role="status"
        aria-live="polite"
      >
        <Loader2 className="size-12 shrink-0 animate-spin text-primary" aria-hidden="true" />
        <span className="text-sm text-muted-foreground">Loading device settings…</span>
      </div>
    );
  }

  const visible = schema.entries.filter((entry) => entry.visible);

  if (visible.length === 0) {
    return <p className="text-sm text-muted-foreground">No settings available for this motor type.</p>;
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1">
        {visible.map((entry) => (
          <SettingsField
            key={entry.key}
            descriptor={entry}
            value={values[entry.key] ?? entry.allowed_values?.[0] ?? entry.range_min ?? 0}
            onChange={(v) => onFieldChange(entry.key, v)}
          />
        ))}
      </div>

      <div className="sticky bottom-0 mt-4 flex items-center justify-between gap-3 border-t bg-background pt-3">
        <Button type="button" variant="ghost" size="sm" onClick={onResetToDefault}>
          <RotateCcw className="size-4" aria-hidden="true" />
          Reset to defaults
        </Button>
        <Button type="button" size="sm" onClick={onSave} disabled={!dirty}>
          {dirty ? 'Save changes' : 'Saved'}
        </Button>
      </div>
    </div>
  );
}
