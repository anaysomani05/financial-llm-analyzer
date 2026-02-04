import React, { useState, useRef, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MessageCircle, Send, Loader2 } from 'lucide-react';

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

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

  const premadeQuestions = [
    'Expected revenue growth in coming quarters?',
    'Main risk factors for creditworthiness?',
    "Company's financial health and debt position?",
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: '1',
          type: 'assistant',
          content: `Ask anything about ${companyName}'s report — financials, risks, or management commentary.`,
          timestamp: new Date(),
        },
      ]);
    }
  }, [companyName, messages.length]);

  const handleAskQuestion = async (question: string) => {
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
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleAskQuestion(currentQuestion);
  };

  if (isLoading) {
    return (
      <Card className="p-8 rounded-2xl border border-slate-200 bg-white">
        <div className="text-center py-8">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-slate-400" />
          <p className="text-slate-600 text-sm">Preparing chat…</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="bg-slate-100 p-2.5 rounded-xl">
          <MessageCircle className="h-5 w-5 text-slate-600" />
        </div>
        <h2 className="text-lg font-semibold text-slate-900">Ask about {companyName}</h2>
      </div>

      {/* Quick questions – pills */}
      <div className="flex flex-wrap gap-2">
        {premadeQuestions.map((q, i) => (
          <button
            key={i}
            type="button"
            onClick={() => handleAskQuestion(q)}
            disabled={isAsking}
            className="text-left text-sm px-4 py-2.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/80 transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Messages */}
      <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="h-[22rem] overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] sm:max-w-md rounded-2xl px-4 py-3 ${
                  message.type === 'user'
                    ? 'bg-slate-800 text-white rounded-br-md'
                    : 'bg-slate-50 text-slate-800 border border-slate-200/80 rounded-bl-md'
                }`}
              >
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                <p
                  className={`text-xs mt-2 ${
                    message.type === 'user' ? 'text-slate-300' : 'text-slate-400'
                  }`}
                >
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}

          {isAsking && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-md px-4 py-3 bg-slate-50 border border-slate-200/80 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
                <span className="text-sm text-slate-600">Looking up in report…</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input – grouped */}
        <form
          onSubmit={handleSubmit}
          className="flex gap-2 p-3 border-t border-slate-100 bg-slate-50/50"
        >
          <Input
            value={currentQuestion}
            onChange={(e) => setCurrentQuestion(e.target.value)}
            placeholder="Ask a question…"
            disabled={isAsking}
            className="flex-1 h-11 rounded-xl border-slate-200 bg-white focus-visible:ring-2 focus-visible:ring-slate-400"
          />
          <Button
            type="submit"
            disabled={!currentQuestion.trim() || isAsking}
            className="h-11 w-11 rounded-xl bg-slate-800 hover:bg-slate-900 shrink-0 focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
          >
            {isAsking ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
      </Card>
    </div>
  );
};
