import { useEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ConsoleBoxProps {
  messages: string[];
}

export function ConsoleBox({ messages }: ConsoleBoxProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <ScrollArea className="h-64 rounded-lg border bg-muted/30 p-3 font-mono text-xs">
      {messages.length === 0 ? (
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
  );
}
