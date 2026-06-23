import { BookOpen } from 'lucide-react';
import { FormRow } from '@/components/ui/form-row';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useWebUiSettings } from '@/hooks/useWebUiSettings';
import { DEFAULT_VACUUM_HOST, supportsWifiTransport } from '@/types/deviceTransport';

interface WebUiSettingsPanelProps {
  onShowOnboarding?: () => void;
}

export function WebUiSettingsPanel({ onShowOnboarding }: WebUiSettingsPanelProps) {
  const {
    mounted,
    theme,
    setTheme,
    transport,
    setDefaultTransport,
    vacuumHost,
    setVacuumHost,
    bleSupported,
    bleUnavailableReason,
    embeddedUi,
    hostedUi,
    wifiAvailable,
  } = useWebUiSettings();

  if (!mounted) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="space-y-1">
      <FormRow label="Theme" subline="Appearance of this web app">
        <Select value={theme} onValueChange={setTheme}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper" className="z-[100]">
            <SelectItem value="system">System</SelectItem>
            <SelectItem value="light">Light</SelectItem>
            <SelectItem value="dark">Dark</SelectItem>
          </SelectContent>
        </Select>
      </FormRow>

      {!embeddedUi && (
        <>
          {wifiAvailable ? (
            <FormRow label="Default transport" subline="Used when you open caznic connect">
              <RadioGroup
                value={transport}
                onValueChange={(v) => setDefaultTransport(v as 'wifi' | 'ble')}
                className="flex flex-col gap-2 sm:flex-row sm:gap-4"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="wifi" id="webui-transport-wifi" />
                  <Label htmlFor="webui-transport-wifi">WiFi</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="ble" id="webui-transport-ble" />
                  <Label
                    htmlFor="webui-transport-ble"
                    className={!bleSupported ? 'text-muted-foreground' : ''}
                  >
                    Bluetooth
                  </Label>
                </div>
              </RadioGroup>
            </FormRow>
          ) : (
            <FormRow label="Connection" subline="This hosted app connects via Bluetooth only">
              <p className="text-sm text-muted-foreground">Bluetooth (Chrome or Edge)</p>
            </FormRow>
          )}

          {!bleSupported && transport === 'ble' && bleUnavailableReason && (
            <p className="pb-2 text-xs text-amber-600 dark:text-amber-400">{bleUnavailableReason}</p>
          )}

          {wifiAvailable && hostedUi && (
            <FormRow label="Vacuum address" subline="Default host for WiFi connection">
              <Input
                className="w-48 font-mono text-sm"
                value={vacuumHost}
                onChange={(e) => setVacuumHost(e.target.value)}
                placeholder={DEFAULT_VACUUM_HOST}
              />
            </FormRow>
          )}
        </>
      )}

      {embeddedUi && (
        <p className="py-4 text-sm text-muted-foreground">
          This app is served from the vacuum — connection uses the device address automatically.
        </p>
      )}

      {onShowOnboarding && (
        <FormRow label="Tutorial" subline="Walk through connection and main features">
          <Button type="button" variant="outline" size="sm" onClick={onShowOnboarding}>
            <BookOpen className="size-4" />
            Show onboarding tour
          </Button>
        </FormRow>
      )}
    </div>
  );
}
