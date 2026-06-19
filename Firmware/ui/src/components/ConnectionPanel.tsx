import { useMemo, useState } from 'react';
import { useDeviceConnectionContext } from '@/contexts/DeviceConnectionContext';
import { getStoredIP } from '@/hooks/useDeviceConnection';
import { isEmbeddedDeviceUi, isHostedDeviceUi } from '@/types/deviceTransport';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { StatusBadge } from '@/components/StatusBadge';
import { ConsoleBox } from '@/components/ConsoleBox';

interface ConnectionPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConnectionPanel({ open, onOpenChange }: ConnectionPanelProps) {
  const {
    connected,
    transport,
    setTransport,
    connect,
    disconnect,
    reconnect,
    consoleMessages,
    bleSupported,
    bleUnavailableReason,
  } = useDeviceConnectionContext();

  const defaultWifiHost = useMemo(() => {
    const hostname = window.location.hostname;
    if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1') {
      return hostname;
    }
    return getStoredIP();
  }, []);

  const [wifiIp, setWifiIp] = useState(defaultWifiHost);

  const embeddedUi = isEmbeddedDeviceUi();
  const hostedUi = isHostedDeviceUi();

  const handleConnect = () => {
    if (connected) {
      disconnect();
      return;
    }
    if (transport === 'ble') {
      void connect();
      return;
    }
    void connect(wifiIp.trim());
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-[380px]">
        <SheetHeader className="space-y-1 border-b px-4 py-4 pr-12">
          <SheetTitle className="lowercase tracking-tight">caznic connect</SheetTitle>
          <SheetDescription>Connect to your vacuum via WiFi or Bluetooth.</SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-5 px-4 py-4">
          <StatusBadge connected={connected} transport={transport} variant="detail" />

          <div className="space-y-3">
            <Label>Transport</Label>
            <RadioGroup
              value={transport}
              onValueChange={(v) => setTransport(v as 'ble' | 'wifi')}
              className="flex gap-4"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="ble" id="transport-ble" />
                <Label htmlFor="transport-ble" className={!bleSupported ? 'text-muted-foreground' : ''}>
                  Bluetooth
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="wifi" id="transport-wifi" />
                <Label htmlFor="transport-wifi">WiFi</Label>
              </div>
            </RadioGroup>

            {transport === 'ble' && !bleSupported && bleUnavailableReason && (
              <p className="text-xs text-amber-600 dark:text-amber-400">{bleUnavailableReason}</p>
            )}

            {embeddedUi && transport === 'ble' && bleSupported && (
              <p className="text-xs text-muted-foreground">
                BLE from the ESP web page is experimental — hosted UI on localhost is preferred for now.
              </p>
            )}

            {transport === 'wifi' && !embeddedUi && (
              <div className="space-y-2">
                <Label htmlFor="wifi-ip">Vacuum address</Label>
                <Input
                  id="wifi-ip"
                  value={wifiIp}
                  onChange={(e) => setWifiIp(e.target.value)}
                  placeholder="osh-vac.local or 192.168.1.50"
                />
              </div>
            )}

            {transport === 'wifi' && hostedUi && (
              <p className="text-xs text-muted-foreground">
                Hosted UI connects via this server&apos;s WebSocket proxy (not the ESP web UI).
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Button
              variant={connected ? 'destructive' : 'default'}
              onClick={handleConnect}
              className="rounded-full"
            >
              {connected ? 'Disconnect' : transport === 'ble' ? 'Pair via Bluetooth' : 'Connect via WiFi'}
            </Button>
            {!connected && (
              <Button variant="outline" onClick={reconnect} className="rounded-full">
                Reconnect
              </Button>
            )}
          </div>

          <Separator className="-mx-4 w-auto" />

          <div className="space-y-2 pb-2">
            <Label>Console</Label>
            <ConsoleBox messages={consoleMessages} />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
