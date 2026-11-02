// The server remains authoritative; these values only drive UI navigation.
export function clearSession(storage) {
  for (const key of ['token', 'role', 'adminToken', 'adminUser', 'isAdmin']) {
    storage.removeItem(key);
  }
}

export function saveSession(storage, token, role) {
  clearSession(storage);
  storage.setItem('token', token);
  storage.setItem('role', role);
}
