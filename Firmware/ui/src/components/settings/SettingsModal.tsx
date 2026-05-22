import { Modal } from '../ui/Modal';
import { Card } from '../ui/Card';
import { useDeviceSettings } from '../../hooks/useDeviceSettings';
import { SettingsField } from './SettingsField';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { ready, schema, values, setField } = useDeviceSettings();
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Device Settings">
      <Card>
        {!ready || !schema ? (
          <p>Waiting for device settings...</p>
        ) : (
          schema.entries
            .filter((entry) => entry.visible)
            .map((entry) => (
              <SettingsField
                key={entry.key}
                descriptor={entry}
                value={values[entry.key] ?? 0}
                onChange={(value) => setField(entry.key, value)}
              />
            ))
        )}
      </Card>
    </Modal>
  );
}
