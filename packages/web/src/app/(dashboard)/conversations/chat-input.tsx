'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Bot, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

/* ------------------------------------------------------------------ */
/*  Suggestion data                                                    */
/* ------------------------------------------------------------------ */

const suggestions = [
  {
    title: 'Analyze market trends',
    description: 'for AI orchestration platforms',
  },
  {
    title: 'Review pull request',
    description: 'with security-focused analysis',
  },
  {
    title: 'Create a deployment plan',
    description: 'for Docker Compose setup',
  },
  {
    title: 'Explain container isolation',
    description: 'in multi-agent systems',
  },
];

/* ------------------------------------------------------------------ */
/*  SuggestionCard                                                     */
/* ------------------------------------------------------------------ */

function SuggestionCard({
  title,
  description,
  onClick,
}: {
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-start justify-center rounded-lg border border-border p-4 text-left transition-colors hover:bg-muted/50"
    >
      <span className="text-sm font-semibold">{title}</span>
      <span className="text-sm text-muted-foreground">{description}</span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  EmptyState                                                         */
/* ------------------------------------------------------------------ */

export function EmptyState({
  onSelectSuggestion,
}: {
  onSelectSuggestion: (text: string) => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8">
      <div className="flex size-12 items-center justify-center rounded-full border border-foreground/20 bg-muted">
        <Bot className="size-6" />
      </div>
      <div className="grid w-full max-w-[768px] grid-cols-2 gap-2">
        {suggestions.map((s) => (
          <SuggestionCard
            key={s.title}
            title={s.title}
            description={s.description}
            onClick={() => {
              onSelectSuggestion(`${s.title} ${s.description}`);
            }}
          />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ChatInput                                                          */
/* ------------------------------------------------------------------ */

export function ChatInput({
  onSend,
  disabled,
  isConnected,
}: {
  onSend: (content: string) => void;
  disabled: boolean;
  isConnected: boolean;
}) {
  const [value, setValue] = useState('');
  const [mounted, setMounted] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { setMounted(true); }, []);

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, []);

  function handleSend() {
    const trimmed = value.trim();
    if (!trimmed || disabled || !isConnected) return;
    onSend(trimmed);
    setValue('');
    // Reset textarea height after send
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }

  return (
    <div className="px-6 pb-2">
      <div className="mx-auto max-w-[768px]">
        <div className="flex items-end gap-2 rounded-3xl bg-muted p-2">
          <textarea
            ref={textareaRef}
            rows={1}
            placeholder="Send a message to your agent..."
            className="flex-1 resize-none bg-transparent px-2 py-1 text-sm outline-none placeholder:text-muted-foreground"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              autoResize();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <Button
            size="icon"
            className="size-8 shrink-0 rounded-full"
            disabled={!value.trim() || disabled || !isConnected}
            onClick={handleSend}
          >
            <Send className="size-4" />
          </Button>
        </div>
        {mounted && (
          <p className="py-2 text-center text-xs text-muted-foreground">
            <span
              className={cn(
                'mr-1 inline-block size-2 rounded-full',
                isConnected ? 'animate-pulse bg-green-500' : 'bg-red-500',
              )}
            />
            {isConnected ? 'Connected' : 'Disconnected'} &mdash; Clawix agents
            can make errors.
          </p>
        )}
      </div>
    </div>
  );
}
