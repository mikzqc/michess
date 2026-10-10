import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  X, Send, User, Search, MoreVertical, Ban, Check, CheckCheck, 
  Swords, Flag, ArrowLeft, MessageSquare, AlertCircle
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useSocial } from '../hooks/useSocial';
import { useDirectChat } from '../hooks/useDirectChat';
import type { DirectMessage } from '../types/chat';
import { ReportModal } from './ReportModal';
import { useToast } from './Toast';

interface FriendsChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialFriendId?: string | null;
  onChallengeFriend?: (friendId: string) => void;
  onViewProfile?: (username: string) => void;
}

export const FriendsChatModal: React.FC<FriendsChatModalProps> = ({
  isOpen,
  onClose,
  initialFriendId = null,
  onChallengeFriend,
  onViewProfile
}) => {
  const { user } = useAuth();
  const { friends } = useSocial();
  const { addToast } = useToast();
  
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(initialFriendId);
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [reportingMessage, setReportingMessage] = useState<DirectMessage | null>(null);
  const [reportingUser, setReportingUser] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    loading: messagesLoading,
    error: chatError,
    unreadCounts,
    lastMessages,
    blockedUserIds,
    sendMessage,
    blockUser,
    unblockUser,
    reportMessage,
    markConversationAsRead
  } = useDirectChat(selectedFriendId);

  // Accepted friends list
  const acceptedFriends = useMemo(() => {
    return friends.filter(f => f.status === 'accepted' && f.friend_profile);
  }, [friends]);

  // Synchronize initialFriendId when prop changes
  useEffect(() => {
    if (initialFriendId) {
      setSelectedFriendId(initialFriendId);
      setMobileView('chat');
    }
  }, [initialFriendId]);

  // Close actions menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  // Auto-scroll to bottom of conversation
  useEffect(() => {
    if (selectedFriendId) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, selectedFriendId]);

  // Filtered friends by search query
  const filteredFriends = useMemo(() => {
    if (!searchQuery.trim()) return acceptedFriends;
    const q = searchQuery.toLowerCase();
    return acceptedFriends.filter(f => 
      f.friend_profile?.username?.toLowerCase().includes(q)
    );
  }, [acceptedFriends, searchQuery]);

  // Get active friend profile
  const selectedFriendship = useMemo(() => {
    if (!selectedFriendId) return null;
    return acceptedFriends.find(f => {
      const fId = f.user_id === user?.id ? f.friend_id : f.user_id;
      return fId === selectedFriendId;
    });
  }, [acceptedFriends, selectedFriendId, user]);

  const activeFriendProfile = selectedFriendship?.friend_profile;
  const isBlocked = selectedFriendId ? blockedUserIds.includes(selectedFriendId) : false;

  const handleSelectFriend = (friendId: string) => {
    setSelectedFriendId(friendId);
    setMobileView('chat');
    markConversationAsRead(friendId);
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!selectedFriendId || !inputText.trim() || isBlocked) return;

    const textToSend = inputText;
    setInputText('');

    const res = await sendMessage(selectedFriendId, textToSend);
    if (!res.success) {
      addToast(res.error || 'Failed to send message', 'error');
    }
  };

  const handleToggleBlock = async () => {
    if (!selectedFriendId) return;
    setShowMenu(false);
    if (isBlocked) {
      const res = await unblockUser(selectedFriendId);
      if (res.success) addToast('User unblocked', 'info');
      else addToast(res.error || 'Failed to unblock user', 'error');
    } else {
      const res = await blockUser(selectedFriendId);
      if (res.success) addToast('User blocked', 'info');
      else addToast(res.error || 'Failed to block user', 'error');
    }
  };

  const formatMessageTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatLastMessageDate = (isoString?: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-xs animate-fade-in">
        <div className="bg-surface-2 border border-border-1 rounded-2xl w-full max-w-4xl h-[620px] max-h-[92vh] overflow-hidden shadow-2xl flex flex-col animate-scale-in">
          
          {/* Main Container */}
          <div className="flex-1 flex overflow-hidden">
            
            {/* Friends Sidebar (List View) */}
            <div className={`w-full sm:w-80 border-r border-border-1 flex flex-col bg-surface-2/60 shrink-0 ${
              mobileView === 'chat' ? 'hidden sm:flex' : 'flex'
            }`}>
              
              {/* Sidebar Header */}
              <div className="p-3.5 border-b border-border-1 flex items-center justify-between bg-surface-3/30">
                <div className="flex items-center gap-2">
                  <MessageSquare size={18} className="text-accent" />
                  <h3 className="font-bold text-content-1 text-base">Friends Chat</h3>
                </div>
                <button
                  onClick={onClose}
                  className="sm:hidden text-content-3 hover:text-content-1 p-1 rounded-lg hover:bg-surface-3 transition-colors cursor-pointer"
                  title="Close"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Search Friends */}
              <div className="p-3 border-b border-border-1/60">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-content-3" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search friends..."
                    className="w-full bg-surface-1 border border-border-1 rounded-lg pl-8 pr-3 py-1.5 text-xs text-content-1 placeholder:text-content-3 focus:outline-none focus:border-accent transition-colors"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-content-3 hover:text-content-1"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>

              {/* Friends List */}
              <div className="flex-1 overflow-y-auto divide-y divide-border-1/30">
                {filteredFriends.length === 0 ? (
                  <div className="p-6 text-center text-content-3 text-xs flex flex-col items-center gap-2">
                    <User size={28} className="opacity-40" />
                    <span>
                      {searchQuery ? 'No friends match your search' : 'No friends yet. Add friends to start chatting!'}
                    </span>
                  </div>
                ) : (
                  filteredFriends.map((friend) => {
                    const friendId = friend.user_id === user?.id ? friend.friend_id : friend.user_id;
                    const isSelected = selectedFriendId === friendId;
                    const unread = unreadCounts[friendId] || 0;
                    const lastMsg = lastMessages[friendId];
                    const profile = friend.friend_profile;
                    const isUserBlocked = blockedUserIds.includes(friendId);

                    return (
                      <button
                        key={friendId}
                        onClick={() => handleSelectFriend(friendId)}
                        className={`w-full p-3 flex items-center gap-3 text-left transition-colors cursor-pointer ${
                          isSelected 
                            ? 'bg-accent/15 border-l-3 border-accent' 
                            : 'hover:bg-surface-3/50'
                        }`}
                      >
                        {/* Avatar */}
                        <div className="relative shrink-0">
                          <div className="w-10 h-10 rounded-full bg-surface-3 flex items-center justify-center overflow-hidden border border-border-1">
                            {profile?.avatar_url ? (
                              <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span className="font-bold text-content-2 text-sm">
                                {profile?.username?.[0]?.toUpperCase() || '?'}
                              </span>
                            )}
                          </div>
                          {unread > 0 && (
                            <span className="absolute -top-1 -right-1 w-4 h-4 bg-error text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-xs">
                              {unread > 9 ? '9+' : unread}
                            </span>
                          )}
                        </div>

                        {/* Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1 mb-0.5">
                            <span className="font-bold text-sm text-content-1 truncate">
                              {profile?.username || 'Player'}
                            </span>
                            {lastMsg && (
                              <span className="text-[10px] text-content-3 shrink-0">
                                {formatLastMessageDate(lastMsg.created_at)}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center justify-between gap-1">
                            <p className="text-xs text-content-3 truncate">
                              {isUserBlocked ? (
                                <span className="text-error/80 italic flex items-center gap-1">
                                  <Ban size={10} /> Blocked
                                </span>
                              ) : lastMsg ? (
                                `${lastMsg.sender_id === user?.id ? 'You: ' : ''}${lastMsg.content}`
                              ) : (
                                <span className="italic text-content-3/60">No messages yet</span>
                              )}
                            </p>
                            {unread > 0 && (
                              <span className="w-2 h-2 rounded-full bg-accent shrink-0" />
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Chat Pane (Active Conversation) */}
            <div className={`flex-1 flex flex-col bg-surface-1/40 ${
              mobileView === 'list' ? 'hidden sm:flex' : 'flex'
            }`}>
              {selectedFriendId && activeFriendProfile ? (
                <>
                  {/* Chat Header */}
                  <div className="p-3 border-b border-border-1 flex items-center justify-between bg-surface-2/80">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setMobileView('list')}
                        className="sm:hidden p-1 text-content-3 hover:text-content-1 rounded-lg hover:bg-surface-3 transition-colors cursor-pointer"
                        title="Back to friends"
                      >
                        <ArrowLeft size={18} />
                      </button>

                      <div 
                        className="flex items-center gap-2.5 cursor-pointer group"
                        onClick={() => onViewProfile && onViewProfile(activeFriendProfile.username)}
                      >
                        <div className="w-9 h-9 rounded-full bg-surface-3 flex items-center justify-center overflow-hidden border border-border-1">
                          {activeFriendProfile.avatar_url ? (
                            <img src={activeFriendProfile.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="font-bold text-content-2 text-sm">
                              {activeFriendProfile.username?.[0]?.toUpperCase() || '?'}
                            </span>
                          )}
                        </div>
                        <div>
                          <h4 className="font-bold text-content-1 text-sm group-hover:text-accent transition-colors flex items-center gap-1.5">
                            {activeFriendProfile.username}
                          </h4>
                          <span className="text-[11px] text-content-3">
                            {activeFriendProfile.highest_rating || 1200} ELO
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions & Menu */}
                    <div className="flex items-center gap-1">
                      {onChallengeFriend && (
                        <button
                          onClick={() => onChallengeFriend(selectedFriendId)}
                          className="px-2.5 py-1.5 rounded-lg bg-surface-3 hover:bg-surface-2 text-content-2 hover:text-accent text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                          title="Challenge to Game"
                        >
                          <Swords size={14} />
                          <span className="hidden md:inline">Challenge</span>
                        </button>
                      )}

                      <div className="relative" ref={menuRef}>
                        <button
                          onClick={() => setShowMenu(!showMenu)}
                          className="p-1.5 text-content-3 hover:text-content-1 hover:bg-surface-3 rounded-lg transition-colors cursor-pointer"
                          title="Options"
                        >
                          <MoreVertical size={16} />
                        </button>

                        {showMenu && (
                          <div className="absolute right-0 top-full mt-1 w-44 bg-surface-2 border border-border-1 rounded-xl shadow-xl z-20 py-1 overflow-hidden animate-scale-in">
                            <button
                              onClick={() => {
                                setShowMenu(false);
                                onViewProfile && onViewProfile(activeFriendProfile.username);
                              }}
                              className="w-full px-3 py-2 text-left text-xs text-content-2 hover:text-content-1 hover:bg-surface-3 flex items-center gap-2 cursor-pointer"
                            >
                              <User size={14} /> View Profile
                            </button>
                            <button
                              onClick={handleToggleBlock}
                              className="w-full px-3 py-2 text-left text-xs text-error hover:bg-error/10 flex items-center gap-2 cursor-pointer"
                            >
                              <Ban size={14} /> {isBlocked ? 'Unblock User' : 'Block User'}
                            </button>
                            <button
                              onClick={() => {
                                setShowMenu(false);
                                setReportingUser(selectedFriendId);
                              }}
                              className="w-full px-3 py-2 text-left text-xs text-warning hover:bg-warning/10 flex items-center gap-2 cursor-pointer"
                            >
                              <Flag size={14} /> Report User
                            </button>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={onClose}
                        className="text-content-3 hover:text-content-1 p-1.5 rounded-lg hover:bg-surface-3 transition-colors cursor-pointer ml-1"
                        title="Close"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  </div>

                  {/* Messages Feed */}
                  <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                    {chatError && (
                      <div className="p-3 bg-error/10 border border-error/20 text-error rounded-lg text-xs flex items-center gap-2">
                        <AlertCircle size={14} />
                        <span>{chatError}</span>
                      </div>
                    )}

                    {isBlocked && (
                      <div className="p-3 bg-error/15 border border-error/30 text-error rounded-lg text-xs text-center font-medium">
                        You have blocked this player. You cannot send or view new messages until you unblock them.
                      </div>
                    )}

                    {messagesLoading ? (
                      <div className="flex items-center justify-center h-full text-content-3 text-xs gap-2">
                        <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                        <span>Loading messages...</span>
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-content-3 gap-2">
                        <MessageSquare size={32} className="opacity-30" />
                        <p className="text-sm font-semibold text-content-2">No messages yet</p>
                        <p className="text-xs">Start a conversation with {activeFriendProfile.username}!</p>
                      </div>
                    ) : (
                      messages.map((msg, idx) => {
                        const isMe = msg.sender_id === user?.id;

                        return (
                          <div
                            key={msg.id || idx}
                            className={`flex flex-col group ${isMe ? 'items-end' : 'items-start'}`}
                          >
                            <div className="flex items-end gap-1.5 max-w-[80%]">
                              {!isMe && (
                                <button
                                  onClick={() => setReportingMessage(msg)}
                                  className="opacity-0 group-hover:opacity-100 p-1 text-content-3 hover:text-warning transition-opacity rounded hover:bg-surface-3 cursor-pointer"
                                  title="Report message"
                                >
                                  <Flag size={12} />
                                </button>
                              )}

                              <div
                                className={`rounded-2xl px-3.5 py-2 text-sm break-words shadow-xs ${
                                  isMe
                                    ? 'bg-accent text-white rounded-br-xs'
                                    : 'bg-surface-2 border border-border-1 text-content-1 rounded-bl-xs'
                                }`}
                              >
                                <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 text-[10px] text-content-3 mt-1 px-1">
                              <span>{formatMessageTime(msg.created_at)}</span>
                              {isMe && (
                                <span>
                                  {msg.read ? (
                                    <CheckCheck size={12} className="text-accent" />
                                  ) : (
                                    <Check size={12} className="opacity-60" />
                                  )}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Input Footer */}
                  <form onSubmit={handleSend} className="p-3 border-t border-border-1 bg-surface-2/60 flex items-center gap-2">
                    <input
                      type="text"
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder={isBlocked ? "Cannot send messages while user is blocked" : "Type a message..."}
                      disabled={isBlocked}
                      maxLength={2000}
                      className="flex-1 bg-surface-1 border border-border-1 rounded-xl px-4 py-2.5 text-sm text-content-1 placeholder:text-content-3 focus:outline-none focus:border-accent transition-colors disabled:opacity-50"
                    />
                    <button
                      type="submit"
                      disabled={!inputText.trim() || isBlocked}
                      className="p-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0"
                      title="Send"
                    >
                      <Send size={16} />
                    </button>
                  </form>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-content-3 gap-3">
                  <div className="w-16 h-16 rounded-full bg-surface-3 flex items-center justify-center text-content-3">
                    <MessageSquare size={28} />
                  </div>
                  <h4 className="text-base font-bold text-content-1">Your Messages</h4>
                  <p className="text-xs text-content-3 max-w-sm">
                    Select a friend on the left to start a private conversation, send game invitations, or chat!
                  </p>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* Report Message Modal */}
      {reportingMessage && activeFriendProfile && (
        <ReportModal
          reportedUserName={activeFriendProfile.username}
          reportedUserId={reportingMessage.sender_id || activeFriendProfile.id || selectedFriendId || ''}
          messageId={reportingMessage.id}
          messageType="direct"
          onClose={() => setReportingMessage(null)}
          onSubmit={async (rep) => {
            const res = await reportMessage(rep);
            if (res.success) addToast('Report submitted. Thank you for helping keep Michess safe.', 'success');
            return res;
          }}
        />
      )}

      {/* Report User Modal */}
      {reportingUser && activeFriendProfile && (
        <ReportModal
          reportedUserName={activeFriendProfile.username}
          reportedUserId={reportingUser || activeFriendProfile.id || selectedFriendId || ''}
          messageType="direct"
          onClose={() => setReportingUser(null)}
          onSubmit={async (rep) => {
            const res = await reportMessage(rep);
            if (res.success) addToast('User reported to moderation.', 'success');
            return res;
          }}
        />
      )}
    </>
  );
};
