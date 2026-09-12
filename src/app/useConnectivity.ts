import { useEffect, useState } from "react";

export type InstallEvent = Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: string }>;
};

/**
 * Network state, the install prompt and the "try syncing again" pulse all come from
 * the same window events, so one listener set covers them.
 */
export function useConnectivity() {
    const [online, setOnline] = useState(navigator.onLine);
    const [syncPulse, setSyncPulse] = useState(0);
    const [install, setInstall] = useState<InstallEvent | null>(null);
    useEffect(() => {
        const onlineFn = () => {
            setOnline(navigator.onLine);
            if (navigator.onLine) setSyncPulse((n) => n + 1);
        };
        const focusFn = () => {
            if (document.visibilityState === "visible") setSyncPulse((n) => n + 1);
        };
        const installFn = (e: Event) => {
            e.preventDefault();
            setInstall(e as InstallEvent);
        };
        window.addEventListener("online", onlineFn);
        window.addEventListener("offline", onlineFn);
        window.addEventListener("focus", focusFn);
        window.addEventListener("beforeinstallprompt", installFn);
        const done = () => setInstall(null);
        window.addEventListener("appinstalled", done);
        return () => {
            window.removeEventListener("online", onlineFn);
            window.removeEventListener("offline", onlineFn);
            window.removeEventListener("focus", focusFn);
            window.removeEventListener("beforeinstallprompt", installFn);
            window.removeEventListener("appinstalled", done);
        };
    }, []);
    return { online, syncPulse, install, setInstall };
}
