(function () {
  const storageKey = 'expense-tracker-theme';

  function getStoredTheme() {
    try {
      return localStorage.getItem(storageKey);
    } catch (error) {
      return null;
    }
  }

  function saveTheme(theme) {
    try {
      localStorage.setItem(storageKey, theme);
    } catch (error) {
      /* ignore */
    }
  }

  function applyTheme(theme) {
    const root = document.documentElement;
    const normalizedTheme = theme === 'dark' ? 'dark' : 'light';
    root.setAttribute('data-theme', normalizedTheme);
    return normalizedTheme;
  }

  function updateThemeToggleLabel(button, theme) {
    if (!button) {
      return;
    }

    const isDark = theme === 'dark';
  button.setAttribute('aria-label', `Switch to ${isDark ? 'light' : 'dark'} mode`);
  button.textContent = isDark ? 'Light' : 'Dark';
  }

  function initThemeToggle() {
    const prefersDark = typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-color-scheme: dark)')
      : { matches: false };
  const storedTheme = getStoredTheme();
    const initialTheme = storedTheme || (prefersDark.matches ? 'dark' : 'light');
    const appliedTheme = applyTheme(initialTheme);
    const themeToggle = document.querySelector('[data-theme-toggle]');

    updateThemeToggleLabel(themeToggle, appliedTheme);

    if (themeToggle) {
      themeToggle.addEventListener('click', () => {
        const nextTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        const normalized = applyTheme(nextTheme);
  saveTheme(normalized);
        updateThemeToggleLabel(themeToggle, normalized);
      });
    }

    const handleSystemThemeChange = (event) => {
  const currentPreference = getStoredTheme();
      if (currentPreference) {
        return;
      }
      const normalized = applyTheme(event.matches ? 'dark' : 'light');
      updateThemeToggleLabel(themeToggle, normalized);
    };

    if (typeof prefersDark.addEventListener === 'function') {
      prefersDark.addEventListener('change', handleSystemThemeChange);
    } else if (typeof prefersDark.addListener === 'function') {
      prefersDark.addListener(handleSystemThemeChange);
    }
  }

  function initNavigationToggle() {
    const navToggle = document.querySelector('[data-nav-toggle]');
    const nav = document.querySelector('[data-nav]');

    if (!navToggle || !nav) {
      return;
    }

    document.body.classList.add('js-nav');

    navToggle.addEventListener('click', () => {
      const isOpen = nav.classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });

    nav.addEventListener('click', (event) => {
      if (event.target.closest('a, button')) {
        nav.classList.remove('is-open');
        navToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    initThemeToggle();
    initNavigationToggle();
  });
}());
