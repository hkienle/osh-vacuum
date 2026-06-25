import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { FormRow } from '@/components/ui/form-row';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InfoBox } from '@/components/ui/info-box';
import { useDeviceConnectionContext } from '@/contexts/DeviceConnectionContext';

export function WifiProvisionPanel() {
  const { connected, lastMessage, sendMessage } = useDeviceConnectionContext();
  const [ssid, setSsid] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const wifiRole = lastMessage?.wifi_role;
  const apSsid = typeof lastMessage?.ap_ssid === 'string' ? lastMessage.ap_ssid : undefined;
  const isApMode = wifiRole === 'ap';

  useEffect(() => {
    if (!connected || !isApMode) {
      setSubmitting(false);
    }
  }, [connected, isApMode]);

  useEffect(() => {
    const ack = lastMessage?.ack;
    const ok = lastMessage?.ok;
    if (ack !== 'set_wifi' || !submitting) {
      return;
    }
    if (ok) {
      toast.info('WiFi saved. The vacuum is restarting…');
      return;
    }
    setSubmitting(false);
    const error = typeof lastMessage?.error === 'string' ? lastMessage.error : 'unknown';
    const message =
      error === 'not_ap_mode'
        ? 'WiFi can only be changed while the vacuum is in setup (AP) mode.'
        : error === 'invalid_ssid'
          ? 'Enter a valid network name (1–32 characters).'
          : error === 'invalid_password'
            ? 'Password is too long (max 63 characters).'
            : 'Could not save WiFi credentials. Try again.';
    toast.error(message);
  }, [lastMessage?.ack, lastMessage?.error, lastMessage?.ok, submitting]);

  if (!connected || !isApMode) {
    return null;
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedSsid = ssid.trim();
    if (!trimmedSsid) {
      toast.error('Enter your WiFi network name.');
      return;
    }
    setSubmitting(true);
    sendMessage({ command: 'set_wifi', ssid: trimmedSsid, password });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 border-t pt-4">
      <InfoBox>
        The vacuum is in setup mode{apSsid ? ` (${apSsid})` : ''}. Enter your home WiFi credentials
        below. It will restart and try to join that network. If connection fails within about 30
        seconds, it returns to setup mode so you can try again.
      </InfoBox>

      <FormRow label="WiFi network" subline="SSID of your home router">
        <Input
          className="font-mono text-sm"
          value={ssid}
          onChange={(e) => setSsid(e.target.value)}
          placeholder="MyNetwork"
          autoComplete="off"
          disabled={submitting}
        />
      </FormRow>

      <FormRow label="WiFi password" subline="Leave empty for open networks">
        <Input
          type="password"
          className="font-mono text-sm"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          autoComplete="new-password"
          disabled={submitting}
        />
      </FormRow>

      <Button type="submit" disabled={submitting || !ssid.trim()}>
        {submitting ? 'Saving…' : 'Save & restart'}
      </Button>
    </form>
  );
}
