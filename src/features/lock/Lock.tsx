import { useState } from "react";
import { Feather } from "lucide-react";
import { Confirm } from "../../components/Confirm";
import { verifyPassword } from "../../services/lock";
import { detachAccount, readJournal } from "../../data/journal";
import { isSample } from "../../data/data";
import { readDrafts } from "../../data/drafts";
import { forgetPhotos } from "../../services/photos";
import { supabase } from "../../services/supabase";

type Step = "idle" | "explain" | "unsynced";

/** Counts what a wipe would destroy for good: anything the cloud does not already hold. */
function unsyncedSummary() {
    const journal = readJournal();
    const entries = detachAccount(journal).entries.filter((e) => !isSample(e.id)).length;
    // Unreadable drafts are already lost, so they are not worth warning about.
    let drafts = 0;
    try {
        drafts = readDrafts().length;
    } catch {
        drafts = 0;
    }
    const parts: string[] = [];
    if (entries) parts.push(`${entries} 篇日记`);
    if (drafts) parts.push(`${drafts} 篇草稿`);
    return { total: entries + drafts, text: parts.join("、") };
}

/**
 * Wipes every local trace and the signed-in session. Keeping the session would let
 * anyone holding the phone pull the whole journal back down from the cloud.
 */
async function wipeDevice() {
    try {
        await supabase?.auth.signOut({ scope: "local" });
    } catch {
        // A failed sign-out still leaves the token for the key sweep below.
    }
    forgetPhotos();
    try {
        for (const key of Object.keys(localStorage))
            if (key.startsWith("ephemera-") || key.startsWith("sb-")) localStorage.removeItem(key);
    } catch {
        // Nothing left to do; the reload below shows whatever survived.
    }
    location.reload();
}

export function Lock({ onUnlock }: { onUnlock: () => void }) {
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const [step, setStep] = useState<Step>("idle");
    const [loss, setLoss] = useState("");
    return (
        <div className="lock-screen">
            <form
                className="lock-card"
                onSubmit={(e) => {
                    e.preventDefault();
                    setBusy(true);
                    void verifyPassword(password)
                        .then((ok) => {
                            if (ok) return onUnlock();
                            setError("密码不对，再试一次。");
                            setPassword("");
                        })
                        .finally(() => setBusy(false));
                }}
            >
                <Feather size={22} />
                <h1>芸窗</h1>
                <p>输入密码，翻开你的书页。</p>
                <input
                    type="password"
                    required
                    autoFocus
                    aria-label="密码"
                    placeholder="密码"
                    value={password}
                    onChange={(e) => {
                        setPassword(e.target.value);
                        setError("");
                    }}
                />
                <button className="primary" disabled={busy || !password}>
                    解锁
                </button>
                {error && (
                    <p className="lock-error" role="alert">
                        {error}
                    </p>
                )}
            </form>
            <button className="text-btn lock-forgot" onClick={() => setStep("explain")}>
                忘记密码？
            </button>
            {step === "explain" && (
                <Confirm
                    label="解除密码锁"
                    title="忘记密码了？"
                    cancel="返回"
                    confirm="清空本机并解除密码锁"
                    disabled={busy}
                    onCancel={() => setStep("idle")}
                    onConfirm={() => {
                        const { total, text } = unsyncedSummary();
                        if (!total) {
                            setBusy(true);
                            return void wipeDevice();
                        }
                        setLoss(text);
                        setStep("unsynced");
                    }}
                >
                    解除密码锁需要清空这台设备上的日记。已同步到云端的，重新登录就能取回。
                </Confirm>
            )}
            {step === "unsynced" && (
                <Confirm
                    label="清空本机"
                    title="有内容还没有同步"
                    cancel="取消"
                    confirm="仍然清空"
                    disabled={busy}
                    onCancel={() => setStep("idle")}
                    onConfirm={() => {
                        setBusy(true);
                        void wipeDevice();
                    }}
                >
                    这台设备上有 {loss}还没有同步到云端，清空后无法找回。
                </Confirm>
            )}
        </div>
    );
}
