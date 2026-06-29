'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Bot,
  ChevronDown,
  Loader2,
  Send,
  Sparkles,
  Wrench,
  X,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import {
  copilotApi,
  type CopilotMessage,
  type ProposedAction,
  type ToolTraceEntry,
} from '@/lib/api';

/** A rendered chat turn. Assistant turns carry the tool trace + any proposals. */
interface ChatTurn {
  role: 'user' | 'assistant';
  text: string;
  toolTrace?: ToolTraceEntry[];
  proposedActions?: ProposedAction[];
  pending?: boolean;
  error?: boolean;
}

const SUGGESTIONS = [
  'Ποιες πτήσεις είναι ενεργές τώρα;',
  'Which drones are in maintenance?',
  'Show me the active conflicts',
  'Καιρός για ATH-HUB — go ή no-go;',
];

export function CopilotWidget() {
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [input, setInput] = useState('');
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Keep the transcript pinned to the latest turn.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns, open]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    const history: ChatTurn[] = [...turns, { role: 'user', text: trimmed }];
    setTurns([...history, { role: 'assistant', text: '', pending: true }]);
    setInput('');
    setSending(true);

    // Resend prior text turns as the model's context (v1: no server persistence).
    const payload: CopilotMessage[] = history.map((t) => ({ role: t.role, content: t.text }));

    try {
      const { data } = await copilotApi.chat(payload);
      if (!data.enabled) setEnabled(false);
      setTurns([
        ...history,
        {
          role: 'assistant',
          text:
            data.reply ||
            (data.enabled
              ? 'No answer was returned.'
              : 'The Operations Copilot is offline (no API key configured).'),
          toolTrace: data.toolTrace,
          proposedActions: data.proposedActions,
        },
      ]);
    } catch {
      setTurns([
        ...history,
        { role: 'assistant', text: 'Request failed. Please try again.', error: true },
      ]);
    } finally {
      setSending(false);
    }
  };

  const confirmAction = async (action: ProposedAction, key: string) => {
    setConfirming(key);
    try {
      await copilotApi.runAction(action);
      toast({ title: 'Action executed', description: action.label });
      // Surface the outcome to the model so it can follow up in-context.
      void send(`I confirmed and executed: ${action.label}.`);
    } catch (e) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'The endpoint rejected the action.';
      toast({ title: 'Action failed', description: msg, variant: 'destructive' });
    } finally {
      setConfirming(null);
    }
  };

  return (
    <>
      {/* Floating toggle */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Operations Copilot"
        className={cn(
          'fixed bottom-5 right-5 z-50 flex h-12 w-12 items-center justify-center rounded-full',
          'bg-primary text-primary-foreground shadow-[0_0_20px_hsl(185_80%_45%/0.4)]',
          'transition-all duration-200 hover:scale-105 hover:shadow-[0_0_28px_hsl(185_80%_45%/0.6)]',
        )}
      >
        {open ? <X className="h-5 w-5" /> : <Bot className="h-6 w-6" />}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          className={cn(
            'fixed bottom-20 right-5 z-50 flex w-[min(26rem,calc(100vw-2.5rem))] flex-col',
            'h-[min(34rem,calc(100vh-7rem))] overflow-hidden rounded-lg border border-border',
            'bg-card/95 backdrop-blur-md shadow-2xl',
          )}
        >
          {/* Header */}
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <Sparkles className="h-4 w-4 text-primary" />
            <div className="flex-1">
              <p className="text-sm font-bold uppercase tracking-wide">Operations Copilot</p>
              <p className="text-xs text-muted-foreground">Live UTM data · Ελληνικά / English</p>
            </div>
            {turns.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setTurns([])}
              >
                Clear
              </Button>
            )}
          </div>

          {/* Transcript */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {turns.length === 0 && (
              <div className="space-y-3 pt-2">
                <p className="text-sm text-muted-foreground">
                  Ask about flights, drones, conflicts, weather, NOTAMs or live traffic. I can also
                  propose actions for you to confirm.
                </p>
                <div className="flex flex-col gap-1.5">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="rounded border border-border bg-background/40 px-3 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {turns.map((turn, i) => (
              <TurnView
                key={i}
                turn={turn}
                onConfirm={(a, ai) => confirmAction(a, `${i}-${ai}`)}
                confirming={confirming}
                turnIndex={i}
              />
            ))}
          </div>

          {/* Composer */}
          <div className="border-t border-border p-3">
            {!enabled && (
              <p className="mb-2 text-xs text-destructive">
                Copilot is offline — ANTHROPIC_API_KEY is not configured on the server.
              </p>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              className="flex items-end gap-2"
            >
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                rows={1}
                disabled={!enabled || sending}
                placeholder="Ask the copilot…"
                className="max-h-28 min-h-[2.25rem] flex-1 resize-none rounded border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50 disabled:opacity-50"
              />
              <Button type="submit" size="icon" className="h-9 w-9 shrink-0" disabled={!enabled || sending || !input.trim()}>
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function TurnView({
  turn,
  onConfirm,
  confirming,
  turnIndex,
}: {
  turn: ChatTurn;
  onConfirm: (action: ProposedAction, actionIndex: number) => void;
  confirming: string | null;
  turnIndex: number;
}) {
  if (turn.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-lg rounded-br-sm bg-primary/15 px-3 py-2 text-sm">
          {turn.text}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="max-w-[90%] rounded-lg rounded-bl-sm border border-border bg-background/50 px-3 py-2 text-sm">
        {turn.pending ? (
          <span className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
          </span>
        ) : turn.error ? (
          <p className="whitespace-pre-wrap text-destructive">{turn.text}</p>
        ) : (
          <Markdown>{turn.text}</Markdown>
        )}
      </div>

      {turn.toolTrace && turn.toolTrace.length > 0 && <ToolTrace trace={turn.toolTrace} />}

      {turn.proposedActions?.map((action, ai) => {
        const key = `${turnIndex}-${ai}`;
        return (
          <div
            key={ai}
            className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 text-sm"
          >
            <p className="font-semibold text-amber-500">{action.label}</p>
            {action.rationale && (
              <p className="mt-1 text-xs text-muted-foreground">{action.rationale}</p>
            )}
            <Button
              size="sm"
              className="mt-2 h-7 text-xs"
              disabled={confirming !== null}
              onClick={() => onConfirm(action, ai)}
            >
              {confirming === key ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : null}
              Confirm
            </Button>
          </div>
        );
      })}
    </div>
  );
}

/** Renders the assistant's markdown reply, styled on-theme (tables, code, lists). */
function Markdown({ children }: { children: string }) {
  return (
    <div className="space-y-2 text-sm leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="my-1">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2">
              {children}
            </a>
          ),
          ul: ({ children }) => <ul className="my-1 list-disc space-y-0.5 pl-4">{children}</ul>,
          ol: ({ children }) => <ol className="my-1 list-decimal space-y-0.5 pl-4">{children}</ol>,
          li: ({ children }) => <li className="marker:text-muted-foreground">{children}</li>,
          h1: ({ children }) => <h3 className="mt-2 mb-1 text-sm font-bold uppercase tracking-wide">{children}</h3>,
          h2: ({ children }) => <h3 className="mt-2 mb-1 text-sm font-bold uppercase tracking-wide">{children}</h3>,
          h3: ({ children }) => <h4 className="mt-2 mb-1 text-sm font-semibold">{children}</h4>,
          hr: () => <hr className="my-2 border-border" />,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-primary/40 pl-2 text-muted-foreground">{children}</blockquote>
          ),
          code: ({ children }) => (
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs text-foreground">{children}</code>
          ),
          pre: ({ children }) => (
            <pre className="my-1 overflow-x-auto rounded bg-muted p-2 font-mono text-xs [&_code]:bg-transparent [&_code]:p-0">
              {children}
            </pre>
          ),
          table: ({ children }) => (
            <div className="my-1 overflow-x-auto rounded border border-border">
              <table className="w-full border-collapse text-xs">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-muted/50">{children}</thead>,
          th: ({ children }) => (
            <th className="border-b border-border px-2 py-1 text-left font-semibold">{children}</th>
          ),
          td: ({ children }) => <td className="border-b border-border/40 px-2 py-1 align-top">{children}</td>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

function ToolTrace({ trace }: { trace: ToolTraceEntry[] }) {
  const [openTrace, setOpenTrace] = useState(false);
  return (
    <div className="text-xs">
      <button
        onClick={() => setOpenTrace((o) => !o)}
        className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
      >
        <Wrench className="h-3 w-3" />
        {trace.length} tool {trace.length === 1 ? 'call' : 'calls'}
        <ChevronDown className={cn('h-3 w-3 transition-transform', openTrace && 'rotate-180')} />
      </button>
      {openTrace && (
        <ul className="mt-1 space-y-0.5 pl-4">
          {trace.map((t, i) => (
            <li key={i} className="font-mono text-muted-foreground">
              <span className={cn(t.ok ? 'text-primary' : 'text-destructive')}>
                {t.kind === 'action' ? '✎' : '→'}
              </span>{' '}
              {t.tool}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
