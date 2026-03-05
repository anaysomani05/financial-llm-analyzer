import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Send,
  Loader2,
  RotateCcw,
  TrendingUp,
  ShieldAlert,
  BarChart3,
  HelpCircle,
} from 'lucide-react';

const chatMdComponents = {
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="text-sm leading-[1.7] mb-2 last:mb-0">{children}</p>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="space-y-1 my-2">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="space-y-1 my-2 list-decimal list-inside">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="flex gap-2 text-sm leading-[1.7]">
      <span className="mt-[9px] w-1 h-1 rounded-full bg-[#d4d4d4] shrink-0" />
      <span>{children}</span>
    </li>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-semibold text-[#171717]">{children}</strong>
  ),
  em: ({ children }: { children?: React.ReactNode }) => (
    <em className="italic text-[#6b7280]">{children}</em>
  ),
};

const TypingIndicator: React.FC = () => (
  <div className="flex justify-start">
    <div className="flex flex-col gap-1">
      <span className="text-[10px] text-[#9ca3af] pl-1">Assistant</span>
      <p className="text-sm text-[#9ca3af] italic pl-1">Thinking...</p>
    </div>
  </div>
);

interface SuggestedQuestion {
  icon: React.FC<{ className?: string }>;
  label: string;
  question: string;
}

const SUGGESTED_QUESTIONS: SuggestedQuestion[] = [
  { icon: TrendingUp, label: 'Revenue & growth outlook', question: 'What is the expected revenue growth in coming quarters?' },
  { icon: ShieldAlert, label: 'Key risk factors', question: 'What are the main risk factors for creditworthiness?' },
  { icon: BarChart3, label: 'Financial health', question: "What is the company's financial health and debt position?" },
  { icon: HelpCircle, label: 'Strategic priorities', question: "What are management's key strategic priorities going forward?" },
];

const WelcomeState: React.FC<{
  companyName: string;
  onAsk: (q: string) => void;
  disabled: boolean;
}> = ({ companyName, onAsk, disabled }) => (
  <div className="chat-welcome flex-1 flex flex-col items-center justify-center px-4 py-8">
    <h3 className="text-base font-semibold text-[#171717] mb-1 text-center">
      What would you like to know?
    </h3>
    <p className="text-sm text-[#6b7280] mb-6 text-center max-w-sm">
      Ask anything about <strong className="text-[#171717] font-medium">{companyName}</strong>.
    </p>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md">
      {SUGGESTED_QUESTIONS.map((sq) => {
        const Icon = sq.icon;
        return (
          <button
            key={sq.label}
            type="button"
            onClick={() => onAsk(sq.question)}
            disabled={disabled}
            className="
              chat-suggestion flex items-center gap-3 px-3.5 py-2.5 rounded
              border border-[#e5e7eb] text-left
              hover:bg-[#f9fafb] transition-colors
              disabled:opacity-50 disabled:pointer-events-none
            "
          >
            <Icon className="h-3.5 w-3.5 text-[#9ca3af] shrink-0" />
            <span className="text-sm text-[#374151]">{sq.label}</span>
          </button>
        );
      })}
    </div>
  </div>
);

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const MessageBubble: React.FC<{ message: ChatMessage; companyName: string }> = ({ message, companyName }) => {
  const isUser = message.type === 'user';

  return (
    <div className={`chat-message flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
      <span className="text-[10px] text-[#9ca3af] mb-1 px-1">
        {isUser ? 'You' : companyName}
      </span>
      <div
        className={`max-w-[80%] sm:max-w-lg rounded px-4 py-3 ${
          isUser
            ? 'bg-[#171717] text-white'
            : 'bg-[#f9fafb] text-[#374151]'
        }`}
      >
        {isUser ? (
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
        ) : (
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={chatMdComponents as any}>
            {message.content}
          </ReactMarkdown>
        )}
        <p className={`text-[0.65rem] mt-2 ${isUser ? 'text-white/40' : 'text-[#9ca3af]'}`}>
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  );
};

interface ChatInterfaceProps {
  companyName: string;
  onAskQuestion: (question: string) => Promise<string>;
  onAskQuestionStream?: (question: string, onChunk: (chunk: string) => void) => Promise<string>;
  isLoading?: boolean;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  companyName,
  onAskQuestion,
  onAskQuestionStream,
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

      const assistantId = (Date.now() + 1).toString();

      setMessages((prev) => [...prev, userMessage]);
      setCurrentQuestion('');
      setIsAsking(true);

      try {
        if (onAskQuestionStream) {
          setMessages((prev) => [
            ...prev,
            { id: assistantId, type: 'assistant', content: '', timestamp: new Date() },
          ]);

          await onAskQuestionStream(question.trim(), (chunk) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: m.content + chunk } : m
              )
            );
          });
        } else {
          const answer = await onAskQuestion(question.trim());
          setMessages((prev) => [
            ...prev,
            { id: assistantId, type: 'assistant', content: answer, timestamp: new Date() },
          ]);
        }
      } catch {
        setMessages((prev) => {
          const existing = prev.find((m) => m.id === assistantId);
          if (existing) {
            return prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: m.content || 'Something went wrong. Please try again.' }
                : m
            );
          }
          return [
            ...prev,
            { id: assistantId, type: 'assistant', content: 'Something went wrong. Please try again.', timestamp: new Date() },
          ];
        });
      } finally {
        setIsAsking(false);
      }
    },
    [isAsking, onAskQuestion, onAskQuestionStream]
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
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center py-12">
          <Loader2 className="h-5 w-5 animate-spin mx-auto mb-3 text-[#9ca3af]" />
          <p className="text-[#9ca3af] text-sm">Preparing chat...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="pb-3 border-b border-[#e5e7eb] shrink-0">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-[#171717] text-sm">Ask about {companyName}</h3>
          {hasConversation && (
            <Button
              onClick={handleClear}
              variant="ghost"
              size="sm"
              className="text-[#9ca3af] hover:text-[#171717] gap-1.5 h-7"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline text-xs">Clear</span>
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto report-scroll">
        {!hasConversation ? (
          <WelcomeState companyName={companyName} onAsk={handleAskQuestion} disabled={isAsking} />
        ) : (
          <div className="py-4 space-y-4">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} companyName={companyName} />
            ))}
            {isAsking && !onAskQuestionStream && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {hasConversation && !isAsking && (
        <div className="pt-2 pb-1 border-t border-[#e5e7eb] shrink-0">
          <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {SUGGESTED_QUESTIONS.map((sq) => (
              <button
                key={sq.label}
                type="button"
                onClick={() => handleAskQuestion(sq.question)}
                className="whitespace-nowrap text-xs px-3 py-1.5 rounded-full border border-[#e5e7eb] text-[#6b7280] hover:bg-[#f9fafb] transition-colors shrink-0"
              >
                {sq.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-center gap-2 pt-3 border-t border-[#e5e7eb] shrink-0">
        <Input
          value={currentQuestion}
          onChange={(e) => setCurrentQuestion(e.target.value)}
          placeholder="Ask a question..."
          disabled={isAsking}
          className="flex-1 h-9 rounded border-[#e5e7eb] text-[#171717] placeholder:text-[#9ca3af] text-sm"
        />
        <Button
          type="submit"
          disabled={!currentQuestion.trim() || isAsking}
          className="h-9 w-9 rounded bg-[#171717] hover:bg-[#333] shrink-0"
        >
          {isAsking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  );
};
