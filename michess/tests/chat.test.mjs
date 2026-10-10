import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Chat System Logic & Validation', () => {
  // 1. Message Validation
  function validateDirectMessage(content) {
    const trimmed = (content || '').trim();
    if (!trimmed) return { valid: false, error: 'Message cannot be empty' };
    if (trimmed.length > 2000) return { valid: false, error: 'Message is too long (max 2000 characters)' };
    return { valid: true, content: trimmed };
  }

  function validateGameMessage(content) {
    const trimmed = (content || '').trim();
    if (!trimmed) return { valid: false, error: 'Message cannot be empty' };
    if (trimmed.length > 500) return { valid: false, error: 'Message too long (max 500 characters)' };
    return { valid: true, content: trimmed };
  }

  it('rejects empty or whitespace-only direct messages', () => {
    assert.equal(validateDirectMessage('').valid, false);
    assert.equal(validateDirectMessage('   ').valid, false);
    assert.equal(validateDirectMessage(null).valid, false);
  });

  it('enforces character limits for direct and in-game messages', () => {
    const validDm = 'Hello friend!';
    assert.equal(validateDirectMessage(validDm).valid, true);

    const longDm = 'a'.repeat(2001);
    assert.equal(validateDirectMessage(longDm).valid, false);

    const validGameMsg = 'Good luck!';
    assert.equal(validateGameMessage(validGameMsg).valid, true);

    const longGameMsg = 'g'.repeat(501);
    assert.equal(validateGameMessage(longGameMsg).valid, false);
  });

  // 2. Unread Counts Calculation
  function calculateUnreadCounts(messages, currentUserId) {
    const map = {};
    for (const msg of messages) {
      if (msg.receiver_id === currentUserId && !msg.read) {
        map[msg.sender_id] = (map[msg.sender_id] || 0) + 1;
      }
    }
    return map;
  }

  it('correctly calculates unread messages per friend and total', () => {
    const messages = [
      { id: '1', sender_id: 'friendA', receiver_id: 'me', read: false },
      { id: '2', sender_id: 'friendA', receiver_id: 'me', read: false },
      { id: '3', sender_id: 'friendA', receiver_id: 'me', read: true },
      { id: '4', sender_id: 'friendB', receiver_id: 'me', read: false },
      { id: '5', sender_id: 'me', receiver_id: 'friendA', read: false } // outgoing, should not count
    ];

    const unreadMap = calculateUnreadCounts(messages, 'me');
    assert.equal(unreadMap['friendA'], 2);
    assert.equal(unreadMap['friendB'], 1);
    assert.equal(unreadMap['me'], undefined);

    const total = Object.values(unreadMap).reduce((a, b) => a + b, 0);
    assert.equal(total, 3);
  });

  // 3. User Blocking Logic
  function canSendMessage(senderId, receiverId, blockedUserIds) {
    if (blockedUserIds.includes(receiverId)) return { allowed: false, reason: 'You have blocked this user' };
    return { allowed: true };
  }

  it('prevents sending messages to blocked users', () => {
    const blockedList = ['badActor1', 'troll2'];
    assert.equal(canSendMessage('me', 'badActor1', blockedList).allowed, false);
    assert.equal(canSendMessage('me', 'friend1', blockedList).allowed, true);
  });

  // 4. In-Game Chat Unread Tracking
  it('increments in-game unread count only when chat panel is closed and message is from opponent', () => {
    let unreadCount = 0;
    const isChatOpen = false;
    const playerId = 'playerWhite';

    function handleIncomingMessage(msg, isOpen) {
      if (msg.sender_id !== playerId && !isOpen) {
        unreadCount++;
      }
    }

    // Opponent message while closed
    handleIncomingMessage({ sender_id: 'playerBlack', content: 'Good luck' }, isChatOpen);
    assert.equal(unreadCount, 1);

    // My own message while closed (should not increment)
    handleIncomingMessage({ sender_id: 'playerWhite', content: 'Thanks' }, isChatOpen);
    assert.equal(unreadCount, 1);

    // Opponent message while open (should not increment)
    handleIncomingMessage({ sender_id: 'playerBlack', content: 'Nice move' }, true);
    assert.equal(unreadCount, 1);
  });

  // 5. Report Submission Validation
  function normalizeReportPayload(report, reporterId) {
    if (!reporterId) return { valid: false, error: 'Must be logged in to report' };
    const targetUserId = report.reported_user_id || report.reportedUserId;
    if (!targetUserId) return { valid: false, error: 'Reported user missing' };
    if (!report.reason || !report.reason.trim()) return { valid: false, error: 'Reason required' };

    const rawMessageId = report.message_id || report.messageId;
    const isValidUuid = !!(rawMessageId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawMessageId));

    return {
      valid: true,
      data: {
        reporter_id: reporterId,
        reported_user_id: targetUserId,
        message_id: isValidUuid ? rawMessageId : null,
        message_type: report.message_type || report.messageType || 'direct',
        reason: report.reason,
        details: report.details || ''
      }
    };
  }

  it('validates report requests before submission', () => {
    assert.equal(normalizeReportPayload({ reported_user_id: 'user1', reason: 'Spam' }, '').valid, false);
    assert.equal(normalizeReportPayload({ reported_user_id: '', reason: 'Spam' }, 'me').valid, false);
    assert.equal(normalizeReportPayload({ reported_user_id: 'user1', reason: '' }, 'me').valid, false);
    assert.equal(normalizeReportPayload({ reported_user_id: 'user1', reason: 'Harassment' }, 'me').valid, true);
  });

  it('correctly handles both camelCase and snake_case report payloads and sanitizes message IDs', () => {
    // CamelCase payload (as sent from React components)
    const camelResult = normalizeReportPayload({
      reportedUserId: 'friend-123',
      messageId: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
      messageType: 'game',
      reason: 'Spam',
      details: 'Spamming emojis'
    }, 'current-user-uuid');

    assert.equal(camelResult.valid, true);
    assert.equal(camelResult.data.reported_user_id, 'friend-123');
    assert.equal(camelResult.data.message_id, 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d');
    assert.equal(camelResult.data.message_type, 'game');

    // Snake_case payload
    const snakeResult = normalizeReportPayload({
      reported_user_id: 'friend-456',
      message_id: 'b1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6e',
      message_type: 'direct',
      reason: 'Abusive language'
    }, 'current-user-uuid');

    assert.equal(snakeResult.valid, true);
    assert.equal(snakeResult.data.reported_user_id, 'friend-456');
    assert.equal(snakeResult.data.message_id, 'b1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6e');

    // Optimistic temporary message ID (not a UUID) -> converted to null
    const tempIdResult = normalizeReportPayload({
      reportedUserId: 'friend-789',
      messageId: 'temp-1728567890',
      reason: 'Harassment'
    }, 'current-user-uuid');

    assert.equal(tempIdResult.valid, true);
    assert.equal(tempIdResult.data.message_id, null);
  });
});
