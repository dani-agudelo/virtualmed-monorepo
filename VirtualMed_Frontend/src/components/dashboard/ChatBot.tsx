// src/components/dashboard/ChatBot.tsx
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Loader } from 'lucide-react';
import { MarkdownContent } from '@/components/MarkdownContent';
import { chatbotService } from '@/lib/api/chatbot.service';
import type { ChatMessage, ChatSource } from '@/types';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

const WELCOME_MESSAGE =
  'Hola, soy el Asistente VirtualMed. ¿Cómo puedo ayudarte hoy? Puedo brindarte información basada en protocolos clínicos verificados.';

interface UiMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  sources?: ChatSource[];
  timestamp: Date;
}

function mapApiMessage(message: ChatMessage): UiMessage {
  return {
    id: message.id,
    type: message.role === 'User' ? 'user' : 'assistant',
    content: message.content,
    sources: message.sources ?? undefined,
    timestamp: new Date(message.createdAt),
  };
}

export function ChatBot() {
  const [messages, setMessages] = useState<UiMessage[]>([
    {
      id: 'welcome',
      type: 'assistant',
      content: WELCOME_MESSAGE,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadConversation = useCallback(async () => {
    setIsInitializing(true);
    try {
      const conversation = await chatbotService.getConversation();
      if (conversation.messages.length > 0) {
        setMessages(conversation.messages.map(mapApiMessage));
      } else {
        setMessages([
          {
            id: 'welcome',
            type: 'assistant',
            content: WELCOME_MESSAGE,
            timestamp: new Date(),
          },
        ]);
      }
    } catch (error) {
      console.error('Error cargando conversación:', error);
    } finally {
      setIsInitializing(false);
    }
  }, []);

  useEffect(() => {
    loadConversation();
  }, [loadConversation]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading || isInitializing) return;

    const messageText = input.trim();
    const optimisticId = `temp-${Date.now()}`;

    const userMessage: UiMessage = {
      id: optimisticId,
      type: 'user',
      content: messageText,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const data = await chatbotService.sendMessage(messageText);

      setMessages((prev) => {
        const withoutOptimistic = prev.filter((m) => m.id !== optimisticId);
        return [
          ...withoutOptimistic,
          mapApiMessage(data.userMessage),
          mapApiMessage(data.assistantMessage),
        ];
      });
    } catch (error) {
      console.error('Error enviando mensaje:', error);
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      const errorMessage: UiMessage = {
        id: `error-${Date.now()}`,
        type: 'assistant',
        content: 'Lo siento, hubo un error al procesar tu solicitud. Por favor, intenta de nuevo.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg border border-gray-200 shadow-sm mt-14">
      <div className="border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <h1 className="text-xl font-semibold text-blue-600">Asistente VirtualMed</h1>
        <p className="text-sm text-gray-600 mt-1">
          Información basada en protocolos clínicos verificados
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {isInitializing ? (
          <div className="flex items-center gap-2 text-gray-600">
            <Loader className="w-4 h-4 animate-spin" />
            <span className="text-sm">Cargando conversación...</span>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`flex items-end space-x-3 ${
                  message.type === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                } w-full`}
              >
                <div className="flex-shrink-0">
                  <Avatar>
                    {message.type === 'user' ? (
                      <AvatarFallback>U</AvatarFallback>
                    ) : (
                      <AvatarFallback>VM</AvatarFallback>
                    )}
                  </Avatar>
                </div>

                <div className="max-w-[80%] sm:max-w-[70%] lg:max-w-[60%]">
                  <div
                    className={`px-4 py-3 rounded-lg break-words ${
                      message.type === 'user'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    {message.type === 'user' ? (
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                    ) : (
                      <div className="text-sm leading-relaxed">
                        <MarkdownContent content={message.content} />
                      </div>
                    )}
                  </div>

                  {message.sources && message.sources.length > 0 && (
                    <div className="mt-2 text-xs text-gray-500">
                      {message.sources.map((source, idx) => (
                        <div key={idx} className="opacity-80">
                          <span>📄 {source.fileName}</span>
                          {source.pageLabel && <span> - Página(s): {source.pageLabel}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 text-gray-900 px-4 py-3 rounded-lg flex items-center space-x-2">
              <Loader className="w-4 h-4 animate-spin" />
              <span className="text-sm">Procesando tu pregunta...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-gray-200 p-4 bg-gray-50 flex-shrink-0">
        <div className="flex space-x-2">
          <Input
            type="text"
            placeholder="Escribe tu pregunta aquí..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading || isInitializing}
            className="flex-1"
          />
          <Button
            onClick={sendMessage}
            disabled={isLoading || isInitializing || !input.trim()}
            className="bg-blue-500 hover:bg-blue-600 text-white"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
