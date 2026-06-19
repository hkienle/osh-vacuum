import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useDeviceSettings } from '@/hooks/useDeviceSettings';
import { SettingsField } from '@/components/settings/SettingsField';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { ready, schema, values, setField } = useDeviceSettings();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg">
        <DialogHeader>
          <DialogTitle>Device Settings</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-4">
          {!ready || !schema ? (
            <p className="text-sm text-muted-foreground">Waiting for device settings…</p>
          ) : (
            schema.entries
              .filter((entry) => entry.visible)
              .map((entry) => (
                <SettingsField
                  key={entry.key}
                  descriptor={entry}
                  value={values[entry.key] ?? 0}
                  onChange={(v) => setField(entry.key, v)}
                />
              ))
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
