'use client';

import { useEffect } from 'react';
import { useChat } from './use-chat';
import { ChatThread } from './chat-thread';
import { ChatInput, EmptyState } from './chat-input';
export default function ConversationsPage() {
  const {
    sessions,
    currentSessionId,
    messages,
    isTyping,
    isConnected,
    error,
    loadingSessions,
    loadingMessages,
    loadingMore,
    hasMore,
    selectSession,
    sendMessage,
    loadMore,
  } = useChat();

  // Auto-select the latest session when sessions load
  useEffect(() => {
    if (!loadingSessions && sessions.length > 0 && !currentSessionId) {
      void selectSession(sessions[0]!.id);
    }
  }, [loadingSessions, sessions, currentSessionId, selectSession]);

  const hasConversation = currentSessionId !== null;

  function handleSend(content: string) {
    if (!content.trim()) return;
    sendMessage(content);
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      {error && (
        <div className="mx-6 mt-4 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {hasConversation ? (
        <>
          <ChatThread
            messages={messages}
            isTyping={isTyping}
            loading={loadingMessages}
            loadingMore={loadingMore}
            hasMore={hasMore}
            onLoadMore={loadMore}
          />
          <ChatInput onSend={handleSend} disabled={isTyping} isConnected={isConnected} />
        </>
      ) : (
        <>
          <EmptyState onSelectSuggestion={handleSend} />
          <ChatInput onSend={handleSend} disabled={isTyping} isConnected={isConnected} />
        </>
      )}
    </div>
  );
}
