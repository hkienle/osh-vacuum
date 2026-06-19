import { useState, useEffect } from 'react';
import { Battery, Settings } from 'lucide-react';
import { ControlPanel } from '@/components/ControlPanel';
import { ConnectionPanel } from '@/components/ConnectionPanel';
import { BatteryTestModal } from '@/components/BatteryTestModal';
import { SettingsModal } from '@/components/settings/SettingsModal';
import { StatusBadge } from '@/components/StatusBadge';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useDeviceConnectionContext } from '@/contexts/DeviceConnectionContext';

export default function App() {
  const [connectionOpen, setConnectionOpen] = useState(false);
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { connected, transport } = useDeviceConnectionContext();

  useEffect(() => {
    if (!connected) {
      setTestModalOpen(false);
      setSettingsOpen(false);
    }
  }, [connected]);

  return (
    <TooltipProvider>
      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
            <h1 className="flex min-w-0 flex-1 items-baseline gap-2">
              <span className="text-xl font-bold tracking-tight lowercase leading-none">caznic</span>
              <span className="hidden text-sm font-normal tracking-widest text-muted-foreground uppercase leading-none sm:inline">
                connect
              </span>
            </h1>

            <StatusBadge
              connected={connected}
              transport={transport}
              variant="header"
              onClick={() => setConnectionOpen(true)}
            />

            {connected && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="hidden rounded-full sm:inline-flex"
                  onClick={() => setTestModalOpen(true)}
                >
                  <Battery className="size-4" />
                  Battery Test
                </Button>

                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-full sm:hidden"
                  onClick={() => setTestModalOpen(true)}
                  aria-label="Battery Test"
                >
                  <Battery className="size-4" />
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="hidden rounded-full sm:inline-flex"
                  onClick={() => setSettingsOpen(true)}
                >
                  <Settings className="size-4" />
                  Settings
                </Button>

                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-full sm:hidden"
                  onClick={() => setSettingsOpen(true)}
                  aria-label="Settings"
                >
                  <Settings className="size-4" />
                </Button>
              </>
            )}

            <ThemeToggle />
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
          <ControlPanel onConnect={() => setConnectionOpen(true)} />
        </main>

        <footer className="border-t py-4 text-center text-xs text-muted-foreground">
          <a href="https://caznic.xyz/" target="_blank" rel="noopener noreferrer" className="hover:text-foreground">
            caznic.xyz
          </a>
          {' · '}
          Open hardware vacuum
        </footer>
      </div>

      <ConnectionPanel open={connectionOpen} onOpenChange={setConnectionOpen} />
      <BatteryTestModal isOpen={testModalOpen} onClose={() => setTestModalOpen(false)} />
      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <Toaster />
    </TooltipProvider>
  );
}
