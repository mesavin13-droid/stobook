// Telegram WebApp Client Integration

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string;
        initDataUnsafe?: {
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
            photo_url?: string;
          };
          auth_date?: number;
          hash?: string;
        };
        colorScheme: 'light' | 'dark';
        themeParams: Record<string, string>;
        isExpanded: boolean;
        viewportHeight: number;
        viewportStableHeight: number;
        expand: () => void;
        close: () => void;
        ready: () => void;
        setHeaderColor: (color: string) => void;
        setBackgroundColor: (color: string) => void;
        BackButton: {
          isVisible: boolean;
          show: () => void;
          hide: () => void;
          onClick: (cb: () => void) => void;
          offClick: (cb: () => void) => void;
        };
        MainButton: {
          text: string;
          color: string;
          textColor: string;
          isVisible: boolean;
          isActive: boolean;
          isProgressVisible: boolean;
          setText: (text: string) => void;
          onClick: (cb: () => void) => void;
          show: () => void;
          hide: () => void;
          enable: () => void;
          disable: () => void;
          showProgress: (leaveActive: boolean) => void;
          hideProgress: () => void;
        };
        HapticFeedback: {
          impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
          notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
          selectionChanged: () => void;
        };
      };
    };
  }
}

export function isTelegramWebApp(): boolean {
  return typeof window !== 'undefined' && Boolean(window.Telegram?.WebApp?.initData);
}

export function getTelegramInitData(): string | null {
  if (typeof window === 'undefined') return null;
  return window.Telegram?.WebApp?.initData || null;
}

export function getTelegramUser() {
  if (typeof window === 'undefined') return null;
  return window.Telegram?.WebApp?.initDataUnsafe?.user || null;
}

export function triggerHaptic(type: 'success' | 'warning' | 'error' | 'selection' | 'impact') {
  if (typeof window === 'undefined' || !window.Telegram?.WebApp?.HapticFeedback) return;
  try {
    if (type === 'selection') {
      window.Telegram.WebApp.HapticFeedback.selectionChanged();
    } else if (type === 'impact') {
      window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
    } else {
      window.Telegram.WebApp.HapticFeedback.notificationOccurred(type);
    }
  } catch (err) {
    // Ignore in unsupported environments
  }
}

export function initTelegramUI() {
  if (typeof window === 'undefined' || !window.Telegram?.WebApp) return;
  try {
    const webApp = window.Telegram.WebApp;
    webApp.ready();
    webApp.expand();
    webApp.setHeaderColor('#0f172a');
    webApp.setBackgroundColor('#f8fafc');
  } catch (err) {
    console.error('Error initializing Telegram WebApp UI:', err);
  }
}
