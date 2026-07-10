'use client';
import { useEffect, useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL ?? '/api';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

export function usePushNotifications() {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setSupported(true);
      navigator.serviceWorker.register('/sw.js').catch(() => {});
      // Check existing subscription
      navigator.serviceWorker.ready.then(reg => reg.pushManager.getSubscription())
        .then(sub => setSubscribed(!!sub))
        .catch(() => {});
    }
  }, []);

  const subscribe = async () => {
    if (!supported) return;
    setLoading(true);
    try {
      // Get VAPID public key
      const { key } = await fetch(`${API}/settings/vapid-public-key`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('rq.at')}` },
      }).then(r => r.json());

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });

      await fetch(`${API}/settings/push-subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('rq.at')}`,
        },
        body: JSON.stringify(sub.toJSON()),
      });
      setSubscribed(true);
    } catch (e) {
      console.error('Push subscribe failed:', e);
    }
    setLoading(false);
  };

  const unsubscribe = async () => {
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      await sub?.unsubscribe();
      await fetch(`${API}/settings/push-unsubscribe`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('rq.at')}` },
      });
      setSubscribed(false);
    } catch {}
    setLoading(false);
  };

  return { supported, subscribed, loading, subscribe, unsubscribe };
}
