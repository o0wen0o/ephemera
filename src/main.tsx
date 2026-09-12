import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { Lock } from "./features/lock/Lock";
import { lockEnabled } from "./services/lock";
import "./styles/index.css";

function Root() {
    const [unlocked, setUnlocked] = useState(() => !lockEnabled());
    // Lock the moment the app is hidden rather than on return, so the entries
    // never appear in the phone's task switcher preview.
    useEffect(() => {
        if (!unlocked) return;
        const hide = () => {
            if (document.hidden && lockEnabled()) setUnlocked(false);
        };
        document.addEventListener("visibilitychange", hide);
        return () => document.removeEventListener("visibilitychange", hide);
    }, [unlocked]);
    return unlocked ? <App /> : <Lock onUnlock={() => setUnlocked(true)} />;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <Root />
    </React.StrictMode>
);
