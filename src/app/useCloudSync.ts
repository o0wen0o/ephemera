import { useCallback, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { accountMatches, cloudError } from "../services/account";
import { forgetPhotos } from "../services/photos";
import { supabase } from "../services/supabase";
import {
    journalFromCloud,
    planSync,
    syncSignature,
    validateCloudRows,
    type SyncPlan
} from "../services/sync";
import { STORE, detachAccount, readJournal } from "../data/journal";
import { isSample } from "../data/data";
import type { JournalStore } from "./useJournal";

type Options = {
    journal: JournalStore;
    notify: (message: string) => void;
    online: boolean;
    syncPulse: number;
};

/**
 * Everything that talks to the cloud: the signed-in account, the account the local
 * journal belongs to, and the three ways rows move — automatic sync, manual sync and
 * a full overwrite from the cloud.
 */
export function useCloudSync({ journal, notify, online, syncPulse }: Options) {
    const { entries, catalog, syncMeta, storageError, persist, revisionRef } = journal;
    const [session, setSession] = useState<Session | null>(null);
    const [email, setEmail] = useState("");
    const [owner, setOwner] = useState<string | null>(() => {
        try {
            return localStorage.getItem(STORE + "-owner");
        } catch {
            return null;
        }
    });
    const [busy, setBusy] = useState(false);
    const [cloudMessage, setCloudMessage] = useState("");
    const [bindAccount, setBindAccount] = useState(false);
    const [signingOut, setSigningOut] = useState(false);
    const [confirmSignOut, setConfirmSignOut] = useState(false);
    const [replaceLocal, setReplaceLocal] = useState(false);
    const [hasLocalBackup, setHasLocalBackup] = useState(() => {
        try {
            return !!localStorage.getItem(STORE + "-before-cloud");
        } catch {
            return false;
        }
    });
    const signingOutRef = useRef(false);
    const activeUserRef = useRef<string | null>(null);
    const autoAttemptRef = useRef("");
    const accountAllowed = !!session && accountMatches(owner, session.user.id);
    const ensureAccount = (userId: string) => {
        if (activeUserRef.current !== userId || localStorage.getItem(STORE + "-owner") !== userId)
            throw new Error("账号已变化，同步已停止，本机内容保留。");
    };

    useEffect(() => {
        if (!supabase) return;
        let authChanged = false;
        supabase.auth
            .getSession()
            .then(({ data, error }) => {
                if (authChanged) return;
                if (error) setCloudMessage(cloudError(error));
                else {
                    activeUserRef.current = data.session?.user.id ?? null;
                    setSession(data.session);
                }
            })
            .catch((error) => setCloudMessage(cloudError(error)));
        const { data } = supabase.auth.onAuthStateChange((_event, s) => {
            authChanged = true;
            activeUserRef.current = s?.user.id ?? null;
            setSession(s);
        });
        return () => data.subscription.unsubscribe();
    }, []);

    const auth = async () => {
        if (!supabase) return;
        if (!email.includes("@")) {
            setCloudMessage("请输入有效的邮箱地址。");
            return;
        }
        setBusy(true);
        try {
            const { error } = await supabase.auth.signInWithOtp({
                email,
                options: { emailRedirectTo: location.origin }
            });
            setCloudMessage(error ? cloudError(error) : "登录链接已发送，请到邮箱中打开。");
        } catch {
            setCloudMessage("连接失败，请检查网络后重试。");
        } finally {
            setBusy(false);
        }
    };

    /** Signing out drops the account link and the cloud baselines, back to plain local mode. */
    const releaseAccount = () => {
        let cleared = true;
        try {
            localStorage.removeItem(STORE + "-owner");
        } catch {
            cleared = false;
        }
        setOwner(null);
        setBindAccount(false);
        autoAttemptRef.current = "";
        // Cached photo blobs belong to the account that just left.
        forgetPhotos();
        // A sync may have landed while signing out, so detach from stored state, not this closure.
        const current = readJournal();
        const next = detachAccount(current);
        const left = next.entries.filter((e) => !isSample(e.id)).length;
        const saved = !current.error && persist(next.entries, next.catalog, next.sync);
        if (!cleared || !saved) return "已退出，但本机数据未清理干净，请检查浏览器设置。";
        return left
            ? `已退出，已同步的日记已从这台设备移除，云端仍保留。${left} 篇未同步的日记留在本机。`
            : "已退出，已同步的日记已从这台设备移除，云端仍保留。";
    };

    const signOutNow = async () => {
        if (signingOutRef.current) return;
        signingOutRef.current = true;
        setSigningOut(true);
        try {
            const { error } = await supabase!.auth.signOut();
            setCloudMessage(error ? cloudError(error) : releaseAccount());
        } catch (error) {
            setCloudMessage(cloudError(error));
        } finally {
            signingOutRef.current = false;
            setSigningOut(false);
            setConfirmSignOut(false);
        }
    };

    /** Marks the local journal as belonging to the account that is signed in now. */
    const linkAccount = () => {
        if (!session) return;
        try {
            localStorage.setItem(STORE + "-owner", session.user.id);
            setOwner(session.user.id);
            setBindAccount(false);
            setCloudMessage("已关联当前账号。");
        } catch {
            setCloudMessage("无法保存账号关联，请检查浏览器存储权限。");
        }
    };

    const overwriteFromCloud = async () => {
        if (
            !supabase ||
            !session ||
            !online ||
            busy ||
            signingOutRef.current ||
            !accountAllowed ||
            storageError
        )
            return;
        const revision = revisionRef.current;
        setBusy(true);
        try {
            const rows: unknown[] = [];
            // Fetch every page: Supabase applies a default result limit.
            for (let offset = 0; ; offset += 500) {
                const { data, error } = await supabase
                    .from("entries")
                    .select("*")
                    .eq("user_id", session.user.id)
                    .order("id")
                    .range(offset, offset + 499);
                if (error) throw error;
                rows.push(...(data || []));
                if (!data || data.length < 500) break;
            }
            ensureAccount(session.user.id);
            const next = journalFromCloud(rows, catalog);
            if (revision !== revisionRef.current)
                throw new Error("本机日记刚有改动，请重新确认覆盖。");
            localStorage.setItem(
                STORE + "-before-cloud",
                JSON.stringify({ version: 3, entries, catalog, sync: syncMeta })
            );
            setHasLocalBackup(true);
            if (!persist(next.entries, next.catalog, next.sync)) return;
            autoAttemptRef.current = syncSignature(session.user.id, syncPulse, next);
            setReplaceLocal(false);
            setCloudMessage("已用云端覆盖本机，覆盖前的备份已保存。");
        } catch (error) {
            setReplaceLocal(false);
            setCloudMessage(cloudError(error));
        } finally {
            setBusy(false);
        }
    };

    const exportLocalBackup = () => {
        try {
            const body = localStorage.getItem(STORE + "-before-cloud");
            if (!body) return;
            const url = URL.createObjectURL(new Blob([body], { type: "application/json" }));
            const link = document.createElement("a");
            link.href = url;
            link.download = "芸窗-覆盖前本机备份.json";
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch {
            notify("备份读取失败，请重试。");
        }
    };

    const cloudSync = useCallback(
        async (silent = false) => {
            if (
                !supabase ||
                !session ||
                !online ||
                busy ||
                signingOutRef.current ||
                !accountAllowed
            )
                return;
            const revision = revisionRef.current;
            setBusy(true);
            if (!silent) setCloudMessage("正在核对本机与云端书页…");
            try {
                ensureAccount(session.user.id);
                let plan: SyncPlan | undefined;
                for (let attempt = 0; attempt < 2; attempt++) {
                    const { data, error } = await supabase
                        .from("entries")
                        .select("*")
                        .eq("user_id", session.user.id);
                    if (error) throw error;
                    plan = planSync(
                        { entries, catalog, sync: syncMeta },
                        validateCloudRows(data || [])
                    );
                    const userId = session.user.id;
                    let raced = false;
                    const newRows = plan.uploads
                        .filter((u) => !u.expectedUpdatedAt)
                        .map((u) => ({ ...u.row, user_id: userId }));
                    const edits = plan.uploads.filter((u) => u.expectedUpdatedAt);
                    // One insert for every new row, then the compare-and-set edits together: they target distinct ids.
                    ensureAccount(userId);
                    if (newRows.length) {
                        const { error: insertError } = await supabase
                            .from("entries")
                            .insert(newRows);
                        if (insertError) {
                            if (insertError.code === "23505") raced = true;
                            else throw insertError;
                        }
                    }
                    ensureAccount(userId);
                    if (!raced && edits.length) {
                        const db = supabase;
                        const results = await Promise.all(
                            edits.map((u) =>
                                db
                                    .from("entries")
                                    .update({ ...u.row, user_id: userId })
                                    .eq("id", u.row.id)
                                    .eq("user_id", userId)
                                    .eq("updated_at", u.expectedUpdatedAt!)
                                    .select("id")
                            )
                        );
                        for (const result of results) {
                            if (result.error) throw result.error;
                            if (!result.data?.length) raced = true;
                        }
                    }
                    if (!raced) break;
                    if (attempt === 1)
                        throw new Error("云端刚刚发生了新的修改，本机内容已保留，请再次同步。");
                }
                ensureAccount(session.user.id);
                if (!plan) throw new Error("同步失败，请稍后再试。");
                if (revisionRef.current !== revision) {
                    setCloudMessage("同步期间又有新的本机改动，已保留并会在下一轮继续同步。");
                    return;
                }
                autoAttemptRef.current = syncSignature(session.user.id, syncPulse, plan.journal);
                if (!persist(plan.journal.entries, plan.journal.catalog, plan.journal.sync)) return;
                const notes = [
                    `已同步 ${plan.journal.entries.filter((e) => !isSample(e.id)).length} 篇日记`
                ];
                if (plan.conflicts) notes.push(`${plan.conflicts} 处冲突已另存副本`);
                const message = notes.join("，") + "。";
                setCloudMessage(message);
                if (silent && plan.conflicts) notify(message);
            } catch (e) {
                setCloudMessage(cloudError(e));
            } finally {
                setBusy(false);
            }
        },
        [session, online, busy, entries, catalog, syncMeta, storageError, syncPulse, accountAllowed]
    );

    useEffect(() => {
        if (
            !supabase ||
            !session ||
            !online ||
            busy ||
            signingOut ||
            !accountAllowed ||
            replaceLocal
        )
            return;
        const signature = syncSignature(session.user.id, syncPulse, { entries, sync: syncMeta });
        if (autoAttemptRef.current === signature) return;
        autoAttemptRef.current = signature;
        const timer = setTimeout(() => void cloudSync(true), 1200);
        return () => clearTimeout(timer);
    }, [
        session,
        online,
        busy,
        syncMeta,
        entries,
        cloudSync,
        syncPulse,
        replaceLocal,
        accountAllowed,
        signingOut
    ]);

    return {
        session,
        email,
        setEmail,
        owner,
        accountAllowed,
        busy,
        cloudMessage,
        bindAccount,
        setBindAccount,
        linkAccount,
        signingOut,
        confirmSignOut,
        setConfirmSignOut,
        replaceLocal,
        setReplaceLocal,
        hasLocalBackup,
        auth,
        signOutNow,
        cloudSync,
        overwriteFromCloud,
        exportLocalBackup
    };
}
