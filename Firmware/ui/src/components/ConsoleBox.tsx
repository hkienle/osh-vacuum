import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Copy, Download } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ConsoleBoxProps {
  messages: string[];
}

function formatConsoleLog(messages: string[]): string {
  return messages.join('\n');
}

function consoleLogFilename(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `caznic-connect-console-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.txt`;
}

export function ConsoleBox({ messages }: ConsoleBoxProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const logText = useMemo(() => formatConsoleLog(messages), [messages]);
  const hasMessages = messages.length > 0;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const copyLog = useCallback(async () => {
    if (!hasMessages) {
      return;
    }
    try {
      await navigator.clipboard.writeText(logText);
      toast.success('Console copied to clipboard');
    } catch {
      toast.error('Could not copy to clipboard');
    }
  }, [hasMessages, logText]);

  const downloadLog = useCallback(() => {
    if (!hasMessages) {
      return;
    }
    const blob = new Blob([logText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = consoleLogFilename();
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [hasMessages, logText]);

  return (
    <div className="space-y-2">
      <ScrollArea className="h-64 rounded-lg border bg-muted/30 p-3 font-mono text-xs">
        {!hasMessages ? (
          <p className="text-muted-foreground italic">No messages yet…</p>
        ) : (
          <div className="space-y-1">
            {messages.map((message, index) => (
              <div key={index} className="break-words text-foreground/90">
                {message}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </ScrollArea>

      <div className="flex justify-start gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5"
          disabled={!hasMessages}
          onClick={() => void copyLog()}
        >
          <Copy className="size-3.5" aria-hidden />
          Copy
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5"
          disabled={!hasMessages}
          onClick={downloadLog}
        >
          <Download className="size-3.5" aria-hidden />
          Download
        </Button>
      </div>
    </div>
  );
}
