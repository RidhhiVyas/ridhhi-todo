// Helper functions for registering the browser for web push notifications.
import { supabase } from './supabase.js';

// Your VAPID PUBLIC key goes here. You'll generate this in the setup steps.
// It is safe to expose publicly (it's the public half of the key pair).
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

// Converts the base64 VAPID key into the format the browser push API expects.
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Returns true if this browser can do web push at all.
export function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

// Registers the service worker, asks permission, subscribes to push,
// and saves the subscription to Supabase so the backend can send to it.
export async function enablePush(userId) {
  if (!isPushSupported()) {
    throw new Error('This browser does not support push notifications.');
  }
  if (!VAPID_PUBLIC_KEY) {
    throw new Error('Missing VITE_VAPID_PUBLIC_KEY. Add it in Vercel env vars.');
  }

  // 1. Register the service worker
  const registration = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;

  // 2. Ask the user for notification permission
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notification permission was not granted.');
  }

  // 3. Subscribe to push
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });

  // 4. Save the subscription to Supabase (upsert so re-enabling doesn't duplicate)
  const subJson = subscription.toJSON();
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint: subJson.endpoint,
      p256dh: subJson.keys.p256dh,
      auth: subJson.keys.auth,
    },
    { onConflict: 'endpoint' }
  );
  if (error) throw error;

  return true;
}

// Returns the current push permission/subscription status.
export async function getPushStatus() {
  if (!isPushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission === 'default') return 'default';
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return 'default';
    const sub = await registration.pushManager.getSubscription();
    return sub ? 'granted' : 'default';
  } catch {
    return 'default';
  }
}
