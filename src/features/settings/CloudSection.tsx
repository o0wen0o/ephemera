import { Cloud, Download, LogOut, Mail, Upload } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { Help } from "../../components/Help";
import { supabase } from "../../services/supabase";

type Props = {
    session: Session | null;
    owner: string | null;
    accountAllowed: boolean;
    online: boolean;
    busy: boolean;
    signingOut: boolean;
    storageError: string;
    pendingSync: number;
    cloudMessage: string;
    hasLocalBackup: boolean;
    email: string;
    onEmailChange: (email: string) => void;
    onAuth: () => void;
    onSignOut: () => void;
    onBindAccount: () => void;
    onSync: () => void;
    onReplaceLocal: () => void;
    onExportLocalBackup: () => void;
};

/** Account, sync state and the two buttons that move rows between device and cloud. */
export function CloudSection({
    session,
    owner,
    accountAllowed,
    online,
    busy,
    signingOut,
    storageError,
    pendingSync,
    cloudMessage,
    hasLocalBackup,
    email,
    onEmailChange,
    onAuth,
    onSignOut,
    onBindAccount,
    onSync,
    onReplaceLocal,
    onExportLocalBackup
}: Props) {
    return (
        <div className="setting-section">
            <h3>
                <Cloud size={18} />
                云端同步
            </h3>
            {!supabase ? (
                <>
                    <Help label="本机模式">
                        日记只保存在这个浏览器。清除浏览器数据会一并删除，请定期导出备份。
                    </Help>
                    <div className="connection-status">
                        <i />
                        尚未连接云端
                    </div>
                </>
            ) : session ? (
                <>
                    <div className="account-row">
                        <span>{session.user.email}</span>
                        <button
                            className="text-btn signout"
                            disabled={busy || signingOut}
                            onClick={onSignOut}
                        >
                            <LogOut size={14} />
                            {signingOut ? "正在退出…" : "退出登录"}
                        </button>
                    </div>
                    {!accountAllowed && (
                        <div className="cloud-message" role="status">
                            {owner
                                ? "本机日记已关联其他账号。请登录原账号后同步，本机内容仍可编辑。"
                                : "请确认本机日记属于当前账号，再开启同步。"}
                            {!owner && (
                                <button className="text-btn" onClick={onBindAccount}>
                                    关联当前账号
                                </button>
                            )}
                        </div>
                    )}
                    <Help label="同步">
                        联网时自动同步。离线时的改动会在联网后上传；同一篇在两台设备都改过，本机版本会另存为「冲突副本」。
                    </Help>
                    <div className="connection-status">
                        <i />
                        {online
                            ? pendingSync
                                ? `${pendingSync} 项改动等待同步`
                                : "暂无待上传改动"
                            : `离线中 · ${pendingSync} 项改动待同步`}
                    </div>
                    <div className="button-row">
                        <button
                            className="outline"
                            disabled={busy || !online || signingOut || !accountAllowed}
                            onClick={onSync}
                        >
                            <Upload size={15} />
                            {busy ? "正在同步…" : "立即同步"}
                        </button>
                        <button
                            className="outline"
                            disabled={
                                busy || !online || signingOut || !accountAllowed || !!storageError
                            }
                            onClick={onReplaceLocal}
                        >
                            <Download size={15} />
                            用云端覆盖本机
                        </button>
                    </div>
                </>
            ) : (
                <>
                    <Help label="登录">使用邮箱登录；登录后，日记会在自己的设备间自动同步。</Help>
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            onAuth();
                        }}
                    >
                        <input
                            type="email"
                            required
                            aria-label="登录邮箱"
                            placeholder="你的邮箱地址"
                            value={email}
                            onChange={(e) => onEmailChange(e.target.value)}
                        />
                        <button className="primary" disabled={busy || !online}>
                            <Mail size={16} />
                            {busy ? "正在发送…" : "发送登录链接"}
                        </button>
                    </form>
                </>
            )}
            {hasLocalBackup && (
                <button className="text-btn" onClick={onExportLocalBackup}>
                    导出覆盖前备份
                </button>
            )}
            {cloudMessage && (
                <p className="cloud-message" role="status">
                    {cloudMessage}
                </p>
            )}
        </div>
    );
}
