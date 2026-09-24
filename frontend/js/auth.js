/**
 * Authentication and Session Management for CodeArena
 */
const Auth = {
  user: null,

  async init() {
    try {
      const res = await API.auth.me();
      if (res.success && res.data.user) {
        this.user = res.data.user;
        window.currentUser = this.user;
        this.updateNavUI();
        return this.user;
      }
    } catch (e) {
      this.user = null;
      window.currentUser = null;
    }
    return null;
  },

  async requireAuth(allowedRoles = []) {
    const user = await this.init();
    if (!user) {
      window.location.href = '/views/login.html?redirect=' + encodeURIComponent(window.location.pathname + window.location.search);
      return null;
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
      alert(`Access restricted. Requires role: ${allowedRoles.join(', ')}`);
      window.location.href = '/views/dashboard.html';
      return null;
    }

    return user;
  },

  async logout() {
    try {
      await API.auth.logout();
    } catch (e) {
      console.warn('Logout error', e);
    }
    window.location.href = '/views/login.html';
  },

  updateNavUI() {
    const userBadge = document.getElementById('user-profile-badge');
    const userRoleBadge = document.getElementById('user-role-badge');
    const userNameEl = document.getElementById('user-display-name');
    const authLinks = document.getElementById('auth-nav-links');
    const userNav = document.getElementById('user-nav-dropdown');

    if (this.user) {
      if (userNameEl) userNameEl.textContent = this.user.name;
      if (userRoleBadge) {
        userRoleBadge.textContent = this.user.role;
        userRoleBadge.className = `px-2 py-0.5 text-xs font-semibold rounded ${
          this.user.role === 'INTERVIEWER' ? 'bg-purple-900/60 text-purple-300 border border-purple-700' :
          this.user.role === 'ADMIN' ? 'bg-rose-900/60 text-rose-300 border border-rose-700' :
          'bg-blue-900/60 text-blue-300 border border-blue-700'
        }`;
      }
      if (authLinks) authLinks.classList.add('hidden');
      if (userNav) userNav.classList.remove('hidden');
    } else {
      if (authLinks) authLinks.classList.remove('hidden');
      if (userNav) userNav.classList.add('hidden');
    }
  }
};

window.Auth = Auth;
