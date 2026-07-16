/**
 * auth.js - Authentication module for Control de Canastas PWA
 * Hardcoded admin users, session via sessionStorage
 */

const AUTH = (() => {
  const SESSION_KEY = 'canastas_session';

  const USERS = {
    admin1: 'admin123',
    admin2: 'admin456',
    admin3: 'admin789',
  };

  function login(username, password) {
    const trimUser = (username || '').trim();
    const trimPass = (password || '').trim();

    if (!trimUser || !trimPass) {
      throw new Error('Ingrese usuario y contraseña');
    }

    if (USERS[trimUser] && USERS[trimUser] === trimPass) {
      const session = {
        username: trimUser,
        loginTime: new Date().toISOString(),
      };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
      return session;
    }

    throw new Error('Usuario o contraseña incorrectos');
  }

  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
  }

  function getSession() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function isLoggedIn() {
    return getSession() !== null;
  }

  function getCurrentUser() {
    const session = getSession();
    return session ? session.username : null;
  }

  return {
    login,
    logout,
    getSession,
    isLoggedIn,
    getCurrentUser,
  };
})();
