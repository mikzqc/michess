import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Admin Panel & Moderation System Logic', () => {
  // 1. Admin Authorization Check
  function checkIsAdmin(username) {
    if (!username || typeof username !== 'string') return false;
    return username.trim().toLowerCase() === 'mikzqc';
  }

  it('authorizes only the exact username mikzqc as administrator', () => {
    assert.equal(checkIsAdmin('mikzqc'), true);
    assert.equal(checkIsAdmin('MIKZQC'), true);
    assert.equal(checkIsAdmin('  mikzqc  '), true);

    // Other users must be rejected
    assert.equal(checkIsAdmin('admin'), false);
    assert.equal(checkIsAdmin('mikzqc_fake'), false);
    assert.equal(checkIsAdmin('user123'), false);
    assert.equal(checkIsAdmin('moderator'), false);
    assert.equal(checkIsAdmin(''), false);
    assert.equal(checkIsAdmin(null), false);
    assert.equal(checkIsAdmin(undefined), false);
  });

  // 2. Report Status Transition Logic
  const VALID_STATUSES = ['pending', 'under_review', 'resolved', 'dismissed'];

  function validateStatusTransition(currentStatus, newStatus) {
    if (!VALID_STATUSES.includes(newStatus)) {
      return { valid: false, error: `Invalid status: ${newStatus}` };
    }
    return { valid: true, status: newStatus };
  }

  it('validates report status transitions properly', () => {
    assert.equal(validateStatusTransition('pending', 'under_review').valid, true);
    assert.equal(validateStatusTransition('under_review', 'resolved').valid, true);
    assert.equal(validateStatusTransition('under_review', 'dismissed').valid, true);
    assert.equal(validateStatusTransition('resolved', 'pending').valid, true);
    assert.equal(validateStatusTransition('pending', 'invalid_status').valid, false);
  });

  // 3. User Suspension Calculation
  function calculateSuspensionExpiry(hours, fromDate = new Date()) {
    if (!hours || hours <= 0) return null;
    return new Date(fromDate.getTime() + hours * 3600 * 1000);
  }

  function isUserRestricted(profile, now = new Date()) {
    if (!profile) return { restricted: false };
    if (profile.is_banned) {
      return { restricted: true, reason: profile.banned_reason || 'Permanently Banned', type: 'ban' };
    }
    if (profile.suspended_until && new Date(profile.suspended_until) > now) {
      return { restricted: true, reason: profile.suspension_reason || 'Suspended', type: 'suspension', until: profile.suspended_until };
    }
    return { restricted: false };
  }

  it('correctly calculates suspension expiry and enforces active restrictions', () => {
    const baseTime = new Date('2026-10-10T12:00:00Z');
    const expiry24h = calculateSuspensionExpiry(24, baseTime);
    assert.equal(expiry24h.toISOString(), '2026-10-11T12:00:00.000Z');

    // Active suspension
    const suspendedProfile = {
      is_banned: false,
      suspended_until: '2026-10-11T12:00:00Z',
      suspension_reason: 'Abusive language'
    };
    const checkActive = isUserRestricted(suspendedProfile, new Date('2026-10-10T14:00:00Z'));
    assert.equal(checkActive.restricted, true);
    assert.equal(checkActive.type, 'suspension');

    // Expired suspension
    const checkExpired = isUserRestricted(suspendedProfile, new Date('2026-10-12T12:00:00Z'));
    assert.equal(checkExpired.restricted, false);

    // Banned account
    const bannedProfile = { is_banned: true, banned_reason: 'Cheating' };
    const checkBanned = isUserRestricted(bannedProfile, new Date('2026-10-15T00:00:00Z'));
    assert.equal(checkBanned.restricted, true);
    assert.equal(checkBanned.type, 'ban');
  });

  // 4. Reporter Accountability System (False Reports)
  const REPORTER_ABUSE_REASONS = [
    'Deliberately false report',
    'Report submitted to harass another user',
    'Repeated abusive or malicious reporting',
    'Other misuse of the reporting system'
  ];

  function processReporterWarning(reporterProfile, reason, details) {
    if (!REPORTER_ABUSE_REASONS.includes(reason) && !reason.trim()) {
      return { success: false, error: 'Valid abuse reason required' };
    }

    const currentCount = reporterProfile.reporter_warning_count || 0;
    const updatedCount = currentCount + 1;

    return {
      success: true,
      updatedProfile: {
        ...reporterProfile,
        reporter_warning_count: updatedCount
      },
      auditLogEntry: {
        target_user_id: reporterProfile.id,
        action_type: 'warn_reporter',
        reason,
        details: details || ''
      },
      notification: {
        type: 'reporter_warning',
        message: `Official Notice: Warning issued for reporting misuse: ${reason}`
      }
    };
  }

  function reverseReporterWarning(reporterProfile, reason) {
    if (!reason || !reason.trim()) {
      return { success: false, error: 'Reason for reversal is required' };
    }

    const currentCount = reporterProfile.reporter_warning_count || 0;
    const updatedCount = Math.max(0, currentCount - 1);

    return {
      success: true,
      updatedProfile: {
        ...reporterProfile,
        reporter_warning_count: updatedCount
      },
      auditLogEntry: {
        target_user_id: reporterProfile.id,
        action_type: 'reverse_reporter_warning',
        reason
      }
    };
  }

  it('manages reporter abuse warnings and reversals correctly', () => {
    const reporter = { id: 'user-reporter-1', username: 'troll_reporter', reporter_warning_count: 0 };
    
    // Issue warning
    const warnRes = processReporterWarning(reporter, 'Deliberately false report', 'Fabricated chat snippet');
    assert.equal(warnRes.success, true);
    assert.equal(warnRes.updatedProfile.reporter_warning_count, 1);
    assert.equal(warnRes.notification.type, 'reporter_warning');

    // Reverse warning
    const revRes = reverseReporterWarning(warnRes.updatedProfile, 'Apology accepted / mistake acknowledged');
    assert.equal(revRes.success, true);
    assert.equal(revRes.updatedProfile.reporter_warning_count, 0);
  });

  // 5. Reports Filtering and Search
  function filterReports(reportsList, { status, reason, search }) {
    return reportsList.filter(r => {
      if (status && status !== 'all' && r.status !== status) return false;
      if (reason && reason !== 'All Reasons' && r.reason !== reason) return false;
      if (search && search.trim()) {
        const q = search.trim().toLowerCase();
        const matchesReporter = (r.reporter_username || '').toLowerCase().includes(q);
        const matchesReported = (r.reported_username || '').toLowerCase().includes(q);
        const matchesDetails = (r.details || '').toLowerCase().includes(q);
        const matchesId = r.id.toLowerCase().includes(q);
        if (!matchesReporter && !matchesReported && !matchesDetails && !matchesId) return false;
      }
      return true;
    });
  }

  it('filters reports correctly by status, reason, and text search', () => {
    const sampleReports = [
      { id: 'rep-1', status: 'pending', reason: 'Harassment', reporter_username: 'alice', reported_username: 'bob', details: 'insulted me' },
      { id: 'rep-2', status: 'under_review', reason: 'Cheating', reporter_username: 'charlie', reported_username: 'bob', details: 'engine usage' },
      { id: 'rep-3', status: 'resolved', reason: 'Harassment', reporter_username: 'david', reported_username: 'eve', details: 'swearing' },
      { id: 'rep-4', status: 'dismissed', reason: 'Spam', reporter_username: 'frank', reported_username: 'grace', details: 'advertising' }
    ];

    // Filter by status
    const pendingOnly = filterReports(sampleReports, { status: 'pending' });
    assert.equal(pendingOnly.length, 1);
    assert.equal(pendingOnly[0].id, 'rep-1');

    // Filter by reported username search
    const bobReports = filterReports(sampleReports, { search: 'bob' });
    assert.equal(bobReports.length, 2);

    // Filter by reason
    const harassmentOnly = filterReports(sampleReports, { reason: 'Harassment' });
    assert.equal(harassmentOnly.length, 2);
  });

  // 6. Chat Unread Badge Clearing Logic
  it('clears unread chat badge only when the specific conversation is opened', () => {
    const unreadMessages = [
      { id: 'm1', sender_id: 'friend1', receiver_id: 'me', read: false },
      { id: 'm2', sender_id: 'friend1', receiver_id: 'me', read: false },
      { id: 'm3', sender_id: 'friend2', receiver_id: 'me', read: false }
    ];

    function calculateTotalUnread(messages) {
      return messages.filter(m => !m.read).length;
    }

    assert.equal(calculateTotalUnread(unreadMessages), 3);

    // Opening chat modal without selecting friend does NOT mark anything read
    let activeConversation = null;
    let messagesState = [...unreadMessages];
    if (activeConversation) {
      messagesState = messagesState.map(m => m.sender_id === activeConversation ? { ...m, read: true } : m);
    }
    assert.equal(calculateTotalUnread(messagesState), 3);

    // Opening friend1 conversation marks friend1 messages as read
    activeConversation = 'friend1';
    messagesState = messagesState.map(m => m.sender_id === activeConversation ? { ...m, read: true } : m);
    assert.equal(calculateTotalUnread(messagesState), 1); // only friend2 left

    // Opening friend2 conversation clears the remaining
    activeConversation = 'friend2';
    messagesState = messagesState.map(m => m.sender_id === activeConversation ? { ...m, read: true } : m);
    assert.equal(calculateTotalUnread(messagesState), 0);
  });
});
