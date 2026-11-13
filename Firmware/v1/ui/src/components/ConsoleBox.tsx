import { useEffect, useRef } from 'react';
import './ConsoleBox.css';

interface ConsoleBoxProps {
  messages: string[];
}

export function ConsoleBox({ messages }: ConsoleBoxProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="console-box" ref={scrollRef}>
      {messages.length === 0 ? (
        <div className="console-empty">No messages yet...</div>
      ) : (
        messages.map((message, index) => (
          <div key={index} className="console-message">
            {message}
          </div>
        ))
      )}
    </div>
  );
}

