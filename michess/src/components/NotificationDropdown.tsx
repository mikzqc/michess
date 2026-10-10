import React, { useState, useRef, useEffect } from 'react';
import { Bell, Check, X, Play, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';
import type { AppNotification } from '../hooks/useNotifications';
import { useChallenges } from '../hooks/useChallenges';
import type { Challenge } from '../hooks/useChallenges';
import { useSocial } from '../hooks/useSocial';
import { useAuth } from '../hooks/useAuth';
import { Button } from './ui/Button';

interface Props {
  onViewProfile: (username: string) => void;
  onJoinGame: (gameId: string) => void;
  onAcceptChallenge?: (challenge: Challenge) => void;
  isNotFound?: boolean;
}

export const NotificationDropdown: React.FC<Props> = ({ onViewProfile, onJoinGame, onAcceptChallenge, isNotFound }) => {
  const { user } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification, deleteAllNotifications } = useNotifications();
  const { challenges, respondToChallenge } = useChallenges();
  const { acceptRequest } = useSocial();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const incomingChallenges = user 
    ? challenges.filter(c => c.receiver_id === user.id && c.status === 'pending')
    : [];

  const displayNotifications = notifications.filter(notif => 
    !(notif.type === 'challenge' && incomingChallenges.some(c => c.id === notif.related_id))
  );

  const totalCount = unreadCount;

  const handleToggle = () => {
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);
    if (nextOpen && unreadCount > 0) {
      markAllAsRead();
    }
  };

  const handleClearAll = async () => {
    await deleteAllNotifications();
    for (const challenge of incomingChallenges) {
      await respondToChallenge(challenge.id, false);
    }
  };

  const handleNotificationClick = async (notification: AppNotification) => {
    markAsRead(notification.id);
    if (notification.type === 'challenge_accepted' && notification.related_id) {
      onJoinGame(notification.related_id);
    }
  };

  const handleFriendAccept = async (e: React.MouseEvent, senderId: string, notifId: string) => {
    e.stopPropagation();
    await acceptRequest(senderId);
    markAsRead(notifId);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={handleToggle}
        className={`relative p-2 rounded-lg transition-colors active:scale-95 cursor-pointer ${
          isNotFound
            ? 'text-red-900 hover:text-red-500 hover:bg-red-950/30'
            : 'text-content-3 hover:text-content-1 hover:bg-surface-3'
        }`}
        aria-label="Notifications"
        title="Notifications"
      >
        <Bell size={18} />
        {totalCount > 0 && (
          <span className={`absolute top-1 right-1 w-4 h-4 text-white text-[10px] font-bold flex items-center justify-center rounded-full pointer-events-none ${
            isNotFound ? 'bg-red-700 animate-pulse shadow-[0_0_8px_rgba(255,0,0,0.6)]' : 'bg-error'
          }`}>
            {totalCount > 9 ? '9+' : totalCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className={`absolute top-full right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] border rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[80vh] animate-scale-in ${
          isNotFound 
            ? 'bg-black/95 border-red-900/60 shadow-[0_0_25px_rgba(255,0,0,0.2)] text-red-100' 
            : 'bg-surface-2 border-border-1'
        }`}>
          <div className={`p-3 border-b flex items-center justify-between ${
            isNotFound ? 'bg-red-950/40 border-red-900/40' : 'bg-surface-3 border-border-1'
          }`}>
            <h3 className={`font-bold ${isNotFound ? 'text-red-500' : 'text-content-1'}`}>Notifications</h3>
            {(displayNotifications.length > 0 || incomingChallenges.length > 0) && (
              <button 
                onClick={handleClearAll}
                className={`text-xs font-medium cursor-pointer ${isNotFound ? 'text-red-400 hover:text-red-300' : 'text-accent hover:text-accent-hover'}`}
              >
                Clear all
              </button>
            )}
          </div>
          
          <div className="overflow-y-auto flex-1 p-2 flex flex-col gap-1">
            {incomingChallenges.map(challenge => (
              <div key={challenge.id} className="p-3 rounded-lg border flex flex-col gap-2 bg-accent/5 border-accent/20">
                <div className="flex items-start gap-3">
                  {challenge.sender_profile?.avatar_url ? (
                    <img src={challenge.sender_profile.avatar_url} className="w-8 h-8 rounded-full object-cover" alt="" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-surface-3 flex items-center justify-center text-content-2 font-bold text-sm">
                      {challenge.sender_profile?.username?.[0]?.toUpperCase() || '?'}
                    </div>
                  )}
                  <div className="flex-1 text-sm">
                    <p className="text-content-1">
                      <span className="font-bold cursor-pointer hover:underline" onClick={(e) => { e.stopPropagation(); challenge.sender_profile && onViewProfile(challenge.sender_profile.username); }}>
                        {challenge.sender_profile?.username || 'Someone'}
                      </span>
                      {' '}challenged you to a {challenge.time_control} game.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <Button size="sm" onClick={() => onAcceptChallenge && onAcceptChallenge(challenge)}>
                    <Check size={14} className="mr-1" /> Accept
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => respondToChallenge(challenge.id, false)}>
                    <X size={14} className="mr-1" /> Decline
                  </Button>
                </div>
              </div>
            ))}

            {displayNotifications.map(notif => (
              <div 
                key={notif.id} 
                className={`p-3 rounded-lg border flex flex-col gap-2 transition-colors cursor-pointer ${
                  notif.read ? 'bg-surface-2 border-transparent hover:bg-surface-3' : 'bg-surface-1 border-border-1 hover:bg-surface-3'
                }`}
                onClick={() => handleNotificationClick(notif)}
              >
                <div className="flex items-start gap-3">
                  {notif.type.startsWith('moderation_') || notif.type.startsWith('reporter_') ? (
                    <div className="w-8 h-8 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                      <ShieldAlert size={16} />
                    </div>
                  ) : notif.type.startsWith('report_') ? (
                    <div className="w-8 h-8 rounded-full bg-accent/15 border border-accent/30 flex items-center justify-center text-accent shrink-0">
                      <ShieldCheck size={16} />
                    </div>
                  ) : notif.sender_profile?.avatar_url ? (
                    <img src={notif.sender_profile.avatar_url} className="w-8 h-8 rounded-full object-cover" alt="" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-surface-3 flex items-center justify-center text-content-2 font-bold text-sm">
                      {notif.sender_profile?.username?.[0]?.toUpperCase() || '?'}
                    </div>
                  )}
                  <div className="flex-1 text-sm">
                    <p className="text-content-1">
                      {notif.type.startsWith('moderation_') || notif.type.startsWith('reporter_') ? (
                        <span className="font-bold text-amber-400">Moderation Notice:</span>
                      ) : notif.type.startsWith('report_') ? (
                        <span className="font-bold text-accent">Report Update:</span>
                      ) : (
                        <span className="font-bold cursor-pointer hover:underline" onClick={(e) => { e.stopPropagation(); notif.sender_profile && onViewProfile(notif.sender_profile.username); }}>
                          {notif.sender_profile?.username || 'Someone'}
                        </span>
                      )}
                      {' '}{notif.message}
                    </p>
                    <p className="text-xs text-content-3 mt-1">
                      {new Date(notif.created_at).toLocaleDateString()} at {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                
                {notif.type === 'challenge_accepted' && notif.related_id && (
                  <Button size="sm" className="w-full mt-1" onClick={(e) => { e.stopPropagation(); onJoinGame(notif.related_id!); }}>
                    <Play size={14} className="mr-1" /> Join Game
                  </Button>
                )}

                {notif.type === 'friend_request' && !notif.read && notif.sender_id && (
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <Button size="sm" onClick={(e) => handleFriendAccept(e, notif.sender_id!, notif.id)}>
                      <Check size={14} className="mr-1" /> Accept
                    </Button>
                    <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); deleteNotification(notif.id); }}>
                      <X size={14} className="mr-1" /> Dismiss
                    </Button>
                  </div>
                )}
              </div>
            ))}

            {incomingChallenges.length === 0 && displayNotifications.length === 0 && (
              <div className="p-4 text-center text-content-3 text-sm">
                No new notifications
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
