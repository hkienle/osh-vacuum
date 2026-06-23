import type { SettingsSchema, SettingsValues } from '@/types/settings';
import { SettingsField } from '@/components/settings/SettingsField';
import { Button } from '@/components/ui/button';
import { InfoBox } from '@/components/ui/info-box';

interface VacSettingsPanelProps {
  connected: boolean;
  ready: boolean;
  loadError: boolean;
  schema: SettingsSchema | null;
  values: SettingsValues;
  onFieldChange: (key: string, value: number) => void;
  onRetry: () => void;
}

export function VacSettingsPanel({
  connected,
  ready,
  loadError,
  schema,
  values,
  onFieldChange,
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
    return <p className="text-sm text-muted-foreground">Waiting for device settings…</p>;
  }

  const visible = schema.entries.filter((entry) => entry.visible);

  if (visible.length === 0) {
    return <p className="text-sm text-muted-foreground">No settings available for this motor type.</p>;
  }

  return (
    <>
      {visible.map((entry) => (
        <SettingsField
          key={entry.key}
          descriptor={entry}
          value={values[entry.key] ?? entry.allowed_values?.[0] ?? entry.range_min ?? 0}
          onChange={(v) => onFieldChange(entry.key, v)}
        />
      ))}
    </>
  );
}
