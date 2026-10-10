import React, { useState, useRef, useEffect } from 'react';
import { Send, Flag, MessageSquare, AlertCircle } from 'lucide-react';
import { useGameChat } from '../hooks/useGameChat';
import type { GameMessage } from '../types/chat';
import { ReportModal } from './ReportModal';
import { useToast } from './Toast';

interface InGameChatProps {
  gameId: string | undefined;
  playerId: string;
  playerName: string;
  opponentName: string;
  opponentId: string | undefined;
  isChatOpen: boolean;
  onUnreadCountChange?: (count: number) => void;
}

const QUICK_CHATS = [
  'Good luck, have fun!',
  'Nice move!',
  'Thanks for the game!',
  'Well played!'
];

export const InGameChat: React.FC<InGameChatProps> = ({
  gameId,
  playerId,
  playerName,
  opponentName,
  opponentId,
  isChatOpen,
  onUnreadCountChange
}) => {
  const [inputText, setInputText] = useState('');
  const [reportingMessage, setReportingMessage] = useState<GameMessage | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { addToast } = useToast();

  const {
    messages,
    loading,
    error,
    unreadCount,
    sendMessage,
    reportGameMessage
  } = useGameChat({
    gameId,
    playerId,
    playerName,
    isChatOpen
  });

  useEffect(() => {
    onUnreadCountChange?.(unreadCount);
  }, [unreadCount, onUnreadCountChange]);

  useEffect(() => {
    if (isChatOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isChatOpen]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim()) return;

    const textToSend = inputText;
    setInputText('');

    const res = await sendMessage(textToSend);
    if (!res.success) {
      addToast(res.error || 'Failed to send message', 'error');
    }
  };

  const handleQuickChat = async (text: string) => {
    const res = await sendMessage(text);
    if (!res.success) {
      addToast(res.error || 'Failed to send message', 'error');
    }
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-surface-2 border border-border-1 rounded-xl overflow-hidden shadow-xs">
      
      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 min-h-[220px]">
        {error && (
          <div className="p-2 bg-error/10 border border-error/20 text-error rounded-lg text-xs flex items-center gap-1.5">
            <AlertCircle size={14} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading && messages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-content-3 text-xs gap-2">
            <div className="w-3.5 h-3.5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            <span>Loading match chat...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-4 text-content-3 gap-1.5">
            <MessageSquare size={24} className="opacity-30" />
            <p className="text-xs font-semibold text-content-2">Match chat is open</p>
            <p className="text-[11px] text-content-3">Be friendly and respectful to your opponent.</p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isMe = msg.sender_id === playerId;

            return (
              <div
                key={msg.id || idx}
                className={`flex flex-col group ${isMe ? 'items-end' : 'items-start'}`}
              >
                <div className="flex items-center gap-1.5 mb-0.5 px-1">
                  <span className="text-[10px] font-bold text-content-3">
                    {isMe ? 'You' : (msg.sender_name || opponentName || 'Opponent')}
                  </span>
                  <span className="text-[9px] text-content-3/60">
                    {formatTime(msg.created_at)}
                  </span>
                </div>

                <div className="flex items-end gap-1 max-w-[85%]">
                  {!isMe && (
                    <button
                      onClick={() => setReportingMessage(msg)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-content-3 hover:text-warning transition-opacity rounded hover:bg-surface-3 cursor-pointer"
                      title="Report message"
                    >
                      <Flag size={11} />
                    </button>
                  )}

                  <div
                    className={`rounded-xl px-3 py-1.5 text-xs break-words shadow-2xs ${
                      isMe
                        ? 'bg-accent text-white rounded-br-xs'
                        : 'bg-surface-3 border border-border-1 text-content-1 rounded-bl-xs'
                    }`}
                  >
                    <p className="leading-snug">{msg.content}</p>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Chat Chips */}
      <div className="px-2.5 py-1.5 bg-surface-3/30 border-t border-border-1/50 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        {QUICK_CHATS.map((qc) => (
          <button
            key={qc}
            onClick={() => handleQuickChat(qc)}
            className="px-2 py-0.5 rounded-full bg-surface-1 hover:bg-surface-3 text-content-3 hover:text-content-1 text-[11px] font-medium border border-border-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {qc}
          </button>
        ))}
      </div>

      {/* Input Footer */}
      <form onSubmit={handleSend} className="p-2 border-t border-border-1 bg-surface-2 flex items-center gap-1.5">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Message opponent..."
          maxLength={500}
          className="flex-1 bg-surface-1 border border-border-1 rounded-lg px-3 py-1.5 text-xs text-content-1 placeholder:text-content-3 focus:outline-none focus:border-accent transition-colors"
        />
        <button
          type="submit"
          disabled={!inputText.trim()}
          className="p-1.5 rounded-lg bg-accent hover:bg-accent-hover text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0"
          title="Send"
        >
          <Send size={14} />
        </button>
      </form>

      {/* Report Modal */}
      {reportingMessage && (
        <ReportModal
          reportedUserName={reportingMessage.sender_name || opponentName || 'Opponent'}
          reportedUserId={reportingMessage.sender_id || opponentId || 'unknown'}
          messageId={reportingMessage.id}
          messageType="game"
          onClose={() => setReportingMessage(null)}
          onSubmit={async (rep) => {
            const res = await reportGameMessage(rep);
            if (res.success) addToast('In-game chat reported.', 'success');
            return res;
          }}
        />
      )}
    </div>
  );
};
