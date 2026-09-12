import { useEffect, useRef, useState } from "react";
import { registerSW } from "virtual:pwa-register";

const UPDATE_CHECK_INTERVAL = 30 * 60 * 1000;

/** Watches for a new deploy and hands back the function that swaps the app over. */
export function useAppUpdate(notify: (message: string) => void) {
    const [updateApp, setUpdateApp] = useState<((reload?: boolean) => Promise<void>) | null>(null);
    const notifyRef = useRef(notify);
    notifyRef.current = notify;
    useEffect(() => {
        let stopWatching: (() => void) | null = null;
        let disposed = false;
        const update = registerSW({
            onNeedRefresh() {
                setUpdateApp(() => update);
            },
            onOfflineReady() {
                notifyRef.current("离线书页已备好，断网也可以写日记。");
            },
            onRegisteredSW(_swUrl, registration) {
                if (!registration || disposed) return;
                // The browser only looks for a new service worker on navigation, so a
                // long-lived tab or an installed PWA never notices a deploy. Poll instead.
                const check = () => {
                    if (document.visibilityState !== "visible" || !navigator.onLine) return;
                    registration.update().catch(() => {});
                };
                const timer = window.setInterval(check, UPDATE_CHECK_INTERVAL);
                document.addEventListener("visibilitychange", check);
                window.addEventListener("online", check);
                stopWatching = () => {
                    window.clearInterval(timer);
                    document.removeEventListener("visibilitychange", check);
                    window.removeEventListener("online", check);
                };
                check();
            }
        });
        return () => {
            disposed = true;
            stopWatching?.();
        };
    }, []);
    return updateApp;
}
