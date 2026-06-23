import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WebUiSettingsPanel } from '@/components/settings/WebUiSettingsPanel';
import { WifiProvisionPanel } from '@/components/settings/WifiProvisionPanel';
import { VacSettingsPanel } from '@/components/settings/VacSettingsPanel';
import { useDeviceSettings } from '@/hooks/useDeviceSettings';
import { useDeviceConnectionContext } from '@/contexts/DeviceConnectionContext';
import { getStoredSettingsTab, SETTINGS_TAB_KEY, type SettingsTab } from '@/hooks/useWebUiSettings';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowOnboarding?: () => void;
}

export function SettingsModal({ isOpen, onClose, onShowOnboarding }: SettingsModalProps) {
  const [tab, setTab] = useState<SettingsTab>(() => getStoredSettingsTab());
  const { connected } = useDeviceConnectionContext();
  const vacSettings = useDeviceSettings({ enabled: isOpen && connected });

  useEffect(() => {
    if (isOpen) {
      setTab(getStoredSettingsTab());
    }
  }, [isOpen]);

  const handleTabChange = (value: string) => {
    const next = value === 'webui' ? 'webui' : 'vac';
    setTab(next);
    localStorage.setItem(SETTINGS_TAB_KEY, next);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={handleTabChange} className="gap-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="webui">WebUI Settings</TabsTrigger>
            <TabsTrigger value="vac">Vac Settings</TabsTrigger>
          </TabsList>

          <div className="h-[min(60vh,32rem)] overflow-y-auto pr-2">
            <TabsContent value="webui" className="mt-0 h-full">
              <WebUiSettingsPanel onShowOnboarding={onShowOnboarding} />
              <WifiProvisionPanel />
            </TabsContent>
            <TabsContent value="vac" className="mt-0 h-full">
              <VacSettingsPanel
                connected={connected}
                ready={vacSettings.ready}
                loadError={vacSettings.loadError}
                schema={vacSettings.schema}
                values={vacSettings.values}
                onFieldChange={vacSettings.setField}
                onRetry={vacSettings.retry}
              />
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
