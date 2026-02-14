import { describe, it, expect } from 'vitest';
import { notificationKeys } from '../use-notifications';

describe('notificationKeys', () => {
  it('generates base key', () => {
    expect(notificationKeys.all).toEqual(['notifications']);
  });

  it('generates lists key', () => {
    expect(notificationKeys.lists()).toEqual(['notifications', 'list']);
  });

  it('generates list key with params', () => {
    const params = { isRead: false, type: 'ORDER' };
    expect(notificationKeys.list(params)).toEqual(['notifications', 'list', params]);
  });

  it('generates list key without params', () => {
    expect(notificationKeys.list()).toEqual(['notifications', 'list', undefined]);
  });

  it('generates unreadCount key', () => {
    expect(notificationKeys.unreadCount()).toEqual(['notifications', 'unread-count']);
  });
});
