// Web Push Notification Helper

export interface PushSubscriptionPayload {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    return reg;
  } catch (err) {
    console.error('Service worker registration failed:', err);
    return null;
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function subscribeToWebPush(userId: string): Promise<boolean> {
  if (typeof window === 'undefined' || !('PushManager' in window)) {
    console.warn('Push notifications not supported in this browser');
    return false;
  }

  try {
    const reg = await registerServiceWorker();
    if (!reg) return false;

    const vapidKey =
      (import.meta as any).env?.VITE_VAPID_PUBLIC_KEY ||
      'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBKr3qBUYIHBQFLXYp5Nksh8U';

    const convertedVapidKey = urlBase64ToUint8Array(vapidKey);

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey as any
      });
    }

    const rawSub = sub.toJSON();
    if (!rawSub.endpoint || !rawSub.keys) return false;

    // Send to backend
    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        endpoint: rawSub.endpoint,
        p256dh: rawSub.keys.p256dh,
        auth: rawSub.keys.auth,
        userAgent: navigator.userAgent
      })
    });

    return res.ok;
  } catch (err) {
    console.error('Failed to subscribe to Web Push:', err);
    return false;
  }
}
