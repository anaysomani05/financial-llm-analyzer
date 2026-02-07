import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  MessageCircle,
  Send,
  Loader2,
  Sparkles,
  User,
  RotateCcw,
  TrendingUp,
  ShieldAlert,
  BarChart3,
  HelpCircle,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Markdown components for assistant answers                          */
/* ------------------------------------------------------------------ */

const chatMdComponents = {
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="text-sm leading-relaxed mb-2 last:mb-0">{children}</p>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="space-y-1 my-2">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="space-y-1 my-2 list-decimal list-inside">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="flex gap-2 text-sm leading-relaxed">
      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
      <span>{children}</span>
    </li>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-semibold text-slate-900">{children}</strong>
  ),
  em: ({ children }: { children?: React.ReactNode }) => (
    <em className="italic opacity-80">{children}</em>
  ),
};

/* ------------------------------------------------------------------ */
/*  Typing indicator (animated dots)                                   */
/* ------------------------------------------------------------------ */

const TypingIndicator: React.FC = () => (
  <div className="flex justify-start">
    <div className="flex items-start gap-2.5">
      <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 mt-0.5">
        <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
      </div>
      <div className="rounded-2xl rounded-tl-md px-4 py-3 bg-white border border-slate-200 flex items-center gap-1.5">
        <span className="typing-dot w-1.5 h-1.5 rounded-full bg-slate-400" />
        <span
          className="typing-dot w-1.5 h-1.5 rounded-full bg-slate-400"
          style={{ animationDelay: '150ms' }}
        />
        <span
          className="typing-dot w-1.5 h-1.5 rounded-full bg-slate-400"
          style={{ animationDelay: '300ms' }}
        />
      </div>
    </div>
  </div>
);

/* ------------------------------------------------------------------ */
/*  Welcome state (shown before first user message)                    */
/* ------------------------------------------------------------------ */

interface SuggestedQuestion {
  icon: React.FC<{ className?: string }>;
  label: string;
  question: string;
}

const SUGGESTED_QUESTIONS: SuggestedQuestion[] = [
  {
    icon: TrendingUp,
    label: 'Revenue & growth outlook',
    question: 'What is the expected revenue growth in coming quarters?',
  },
  {
    icon: ShieldAlert,
    label: 'Key risk factors',
    question: 'What are the main risk factors for creditworthiness?',
  },
  {
    icon: BarChart3,
    label: 'Financial health',
    question: "What is the company's financial health and debt position?",
  },
  {
    icon: HelpCircle,
    label: 'Strategic priorities',
    question: "What are management's key strategic priorities going forward?",
  },
];

const WelcomeState: React.FC<{
  companyName: string;
  onAsk: (q: string) => void;
  disabled: boolean;
}> = ({ companyName, onAsk, disabled }) => (
  <div className="chat-welcome flex-1 flex flex-col items-center justify-center px-4 py-8">
    <div className="w-14 h-14 rounded-2xl bg-indigo-100 flex items-center justify-center mb-5">
      <Sparkles className="h-7 w-7 text-indigo-600" />
    </div>
    <h3 className="text-lg font-semibold text-slate-900 mb-1 text-center">
      What would you like to know?
    </h3>
    <p className="text-sm text-slate-500 mb-6 text-center max-w-sm">
      Ask anything about <strong className="text-slate-700">{companyName}</strong>'s
      financials, risks, strategy, or management commentary.
    </p>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-md">
      {SUGGESTED_QUESTIONS.map((sq) => {
        const Icon = sq.icon;
        return (
          <button
            key={sq.label}
            type="button"
            onClick={() => onAsk(sq.question)}
            disabled={disabled}
            className="
              chat-suggestion flex items-center gap-3 px-4 py-3 rounded-xl
              bg-white border border-slate-200 text-left
              hover:border-indigo-200 hover:bg-indigo-50/50
              transition-all duration-150
              disabled:opacity-50 disabled:pointer-events-none
              focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2
            "
          >
            <Icon className="h-4 w-4 text-indigo-500 shrink-0" />
            <span className="text-sm text-slate-700 font-medium">{sq.label}</span>
          </button>
        );
      })}
    </div>
  </div>
);

/* ------------------------------------------------------------------ */
/*  Message bubble                                                     */
/* ------------------------------------------------------------------ */

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const MessageBubble: React.FC<{ message: ChatMessage }> = ({ message }) => {
  const isUser = message.type === 'user';

  return (
    <div className={`chat-message flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex items-start gap-2.5 ${isUser ? 'flex-row-reverse' : ''}`}>
        {/* Avatar */}
        <div
          className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
            isUser ? 'bg-slate-800' : 'bg-indigo-100'
          }`}
        >
          {isUser ? (
            <User className="h-3.5 w-3.5 text-white" />
          ) : (
            <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
          )}
        </div>

        {/* Bubble */}
        <div
          className={`max-w-[80%] sm:max-w-lg rounded-2xl px-4 py-3 ${
            isUser
              ? 'bg-slate-800 text-white rounded-tr-md'
              : 'bg-white text-slate-800 border border-slate-200 rounded-tl-md'
          }`}
        >
          {isUser ? (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {message.content}
            </p>
          ) : (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={chatMdComponents as any}
            >
              {message.content}
            </ReactMarkdown>
          )}
          <p
            className={`text-[0.65rem] mt-2 ${
              isUser ? 'text-slate-400' : 'text-slate-400'
            }`}
          >
            {message.timestamp.toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

interface ChatInterfaceProps {
  companyName: string;
  onAskQuestion: (question: string) => Promise<string>;
  isLoading?: boolean;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  companyName,
  onAskQuestion,
  isLoading = false,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const hasConversation = messages.length > 0;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleAskQuestion = useCallback(
    async (question: string) => {
      if (!question.trim() || isAsking) return;

      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        type: 'user',
        content: question.trim(),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setCurrentQuestion('');
      setIsAsking(true);

      try {
        const answer = await onAskQuestion(question.trim());
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            type: 'assistant',
            content: answer,
            timestamp: new Date(),
          },
        ]);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            type: 'assistant',
            content: 'Something went wrong. Please try again.',
            timestamp: new Date(),
          },
        ]);
      } finally {
        setIsAsking(false);
      }
    },
    [isAsking, onAskQuestion]
  );

  const handleClear = () => {
    setMessages([]);
    setCurrentQuestion('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleAskQuestion(currentQuestion);
  };

  if (isLoading) {
    return (
      <Card className="flex-1 flex items-center justify-center rounded-xl border border-slate-200 bg-white">
        <div className="text-center py-12">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-indigo-400" />
          <p className="text-slate-600 text-sm">Preparing chat…</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="flex-1 flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* ── Accent bar ── */}
      <div className="h-1 bg-gradient-to-r from-indigo-500 to-indigo-400" />

      {/* ── Header ── */}
      <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/30 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-100">
              <MessageCircle className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-sm">
                Ask about {companyName}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                AI-powered Q&A from the uploaded report
              </p>
            </div>
          </div>
          {hasConversation && (
            <Button
              onClick={handleClear}
              variant="ghost"
              size="sm"
              className="text-slate-400 hover:text-slate-600 gap-1.5 h-8"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline text-xs">Clear</span>
            </Button>
          )}
        </div>
      </div>

      {/* ── Messages area ── */}
      <div className="flex-1 overflow-y-auto report-scroll">
        {!hasConversation ? (
          <WelcomeState
            companyName={companyName}
            onAsk={handleAskQuestion}
            disabled={isAsking}
          />
        ) : (
          <div className="p-4 space-y-4">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}

            {isAsking && <TypingIndicator />}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* ── Quick questions (compact, shown during conversation) ── */}
      {hasConversation && !isAsking && (
        <div className="px-4 pt-2 pb-1 border-t border-slate-100 bg-slate-50/30 shrink-0">
          <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {SUGGESTED_QUESTIONS.map((sq) => (
              <button
                key={sq.label}
                type="button"
                onClick={() => handleAskQuestion(sq.question)}
                className="
                  whitespace-nowrap text-xs px-3 py-1.5 rounded-full
                  bg-white border border-slate-200 text-slate-600
                  hover:border-indigo-200 hover:text-indigo-700 hover:bg-indigo-50/50
                  transition-colors shrink-0
                "
              >
                {sq.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Input ── */}
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2.5 p-3 border-t border-slate-200 bg-white shrink-0"
      >
        <Input
          value={currentQuestion}
          onChange={(e) => setCurrentQuestion(e.target.value)}
          placeholder="Ask a question about the report…"
          disabled={isAsking}
          className="flex-1 h-12 rounded-xl border-slate-200 bg-slate-50 text-sm focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:bg-white"
        />
        <Button
          type="submit"
          disabled={!currentQuestion.trim() || isAsking}
          className="h-12 w-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 shrink-0 focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2"
        >
          {isAsking ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </form>
    </Card>
  );
};
