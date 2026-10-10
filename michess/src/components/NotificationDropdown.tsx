import React, { useState, useRef, useEffect } from 'react';
import { Bell, Check, X, Play } from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';
import type { AppNotification } from '../hooks/useNotifications';
import { useChallenges } from '../hooks/useChallenges';
import type { Challenge } from '../hooks/useChallenges';
import { useSocial } from '../hooks/useSocial';
import { Button } from './ui/Button';

interface Props {
  onViewProfile: (username: string) => void;
  onJoinGame: (gameId: string) => void;
  onAcceptChallenge?: (challenge: Challenge) => void;
}

export const NotificationDropdown: React.FC<Props> = ({ onViewProfile, onJoinGame, onAcceptChallenge }) => {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
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

  const totalCount = unreadCount + challenges.length;

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
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg transition-colors text-content-3 hover:text-content-1 hover:bg-surface-3 active:scale-95 cursor-pointer"
        aria-label="Notifications"
        title="Notifications"
      >
        <Bell size={20} />
        {totalCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-error text-white text-[10px] font-bold flex items-center justify-center rounded-full pointer-events-none">
            {totalCount > 9 ? '9+' : totalCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-surface-2 border border-border-1 rounded-xl shadow-xl z-50 overflow-hidden flex flex-col max-h-[80vh]">
          <div className="p-3 border-b border-border-1 flex items-center justify-between bg-surface-3">
            <h3 className="font-bold text-content-1">Notifications</h3>
            {totalCount > 0 && (
              <button 
                onClick={markAllAsRead}
                className="text-xs text-accent hover:text-accent-hover font-medium"
              >
                Clear all
              </button>
            )}
          </div>
          
          <div className="overflow-y-auto flex-1 p-2 flex flex-col gap-1">
            {challenges.map(challenge => (
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

            {notifications.map(notif => (
              <div 
                key={notif.id} 
                className={`p-3 rounded-lg border flex flex-col gap-2 transition-colors cursor-pointer ${
                  notif.read ? 'bg-surface-2 border-transparent hover:bg-surface-3' : 'bg-surface-1 border-border-1 hover:bg-surface-3'
                }`}
                onClick={() => handleNotificationClick(notif)}
              >
                <div className="flex items-start gap-3">
                  {notif.sender_profile?.avatar_url ? (
                    <img src={notif.sender_profile.avatar_url} className="w-8 h-8 rounded-full object-cover" alt="" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-surface-3 flex items-center justify-center text-content-2 font-bold text-sm">
                      {notif.sender_profile?.username?.[0]?.toUpperCase() || '?'}
                    </div>
                  )}
                  <div className="flex-1 text-sm">
                    <p className="text-content-1">
                      <span className="font-bold cursor-pointer hover:underline" onClick={(e) => { e.stopPropagation(); notif.sender_profile && onViewProfile(notif.sender_profile.username); }}>
                        {notif.sender_profile?.username || 'Someone'}
                      </span>
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
                    <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); markAsRead(notif.id); }}>
                      <X size={14} className="mr-1" /> Dismiss
                    </Button>
                  </div>
                )}
              </div>
            ))}

            {challenges.length === 0 && notifications.length === 0 && (
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
