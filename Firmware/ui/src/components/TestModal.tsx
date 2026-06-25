import { useCallback, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BatteryTestPanel } from '@/components/BatteryTestPanel';
import { MotorRampTestPanel } from '@/components/MotorRampTestPanel';

export type TestTab = 'battery' | 'ramp';

interface TestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TestModal({ isOpen, onClose }: TestModalProps) {
  const [tab, setTab] = useState<TestTab>('battery');
  const [batteryBusy, setBatteryBusy] = useState(false);
  const [rampBusy, setRampBusy] = useState(false);
  const busy = batteryBusy || rampBusy;

  const handleBatteryBusy = useCallback((next: boolean) => {
    setBatteryBusy(next);
  }, []);

  const handleRampBusy = useCallback((next: boolean) => {
    setRampBusy(next);
  }, []);

  const handleTabChange = (value: string) => {
    if (busy) return;
    setTab(value as TestTab);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-hidden p-0">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>Test</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={handleTabChange} className="gap-4 px-6 pb-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="battery" disabled={rampBusy}>
              Battery test
            </TabsTrigger>
            <TabsTrigger value="ramp" disabled={batteryBusy}>
              Motor ramp
            </TabsTrigger>
          </TabsList>

          <div className="max-h-[min(60vh,36rem)] overflow-y-auto pr-2">
            <TabsContent value="battery" className="mt-0">
              <BatteryTestPanel onBusyChange={handleBatteryBusy} />
            </TabsContent>
            <TabsContent value="ramp" className="mt-0">
              <MotorRampTestPanel onBusyChange={handleRampBusy} />
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
