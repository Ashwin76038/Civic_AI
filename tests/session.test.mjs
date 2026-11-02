import test from 'node:test';
import assert from 'node:assert/strict';
import { clearSession, saveSession } from '../src/lib/session.mjs';

function storage() {
  const values = new Map();
  return { getItem: k => values.get(k), setItem: (k,v) => values.set(k,v), removeItem: k => values.delete(k) };
}
test('switching from admin to user removes all stale admin credentials', () => {
  const s = storage();
  s.setItem('adminToken', 'old-admin');
  s.setItem('isAdmin', 'true');
  s.setItem('adminUser', '{}');
  saveSession(s, 'new-user', 'user');
  assert.equal(s.getItem('token'), 'new-user');
  assert.equal(s.getItem('role'), 'user');
  for (const k of ['adminToken', 'isAdmin', 'adminUser']) assert.equal(s.getItem(k), undefined);
});
test('admin login and logout use the same session keys', () => {
  const s = storage();
  saveSession(s, 'admin-token', 'admin');
  assert.equal(s.getItem('role'), 'admin');
  clearSession(s);
  assert.equal(s.getItem('token'), undefined);
  assert.equal(s.getItem('role'), undefined);
});
