import { useState } from "react";
import { Lock as LockIcon } from "lucide-react";
import { Help } from "../../components/Help";
import { clearLock, lockEnabled, setPassword } from "../../services/lock";

/** The device password. It never leaves this browser, so it is set and cleared here. */
export function LockSection({ notify }: { notify: (message: string) => void }) {
    const [hasLock, setHasLock] = useState(lockEnabled);
    const [newPassword, setNewPassword] = useState("");
    return (
        <div className="setting-section">
            <h3>
                <LockIcon size={18} />
                密码锁
                <Help label="密码锁">
                    打开芸窗时需要输入密码。密码只存在这台设备，忘记后可清除浏览器数据重来。日记本身仍是明文保存，密码锁防的是随手翻看。
                </Help>
            </h3>
            <div className="connection-status">
                <i />
                {hasLock ? "已开启密码锁" : "尚未设置密码"}
            </div>
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    void setPassword(newPassword).then(() => {
                        setHasLock(true);
                        setNewPassword("");
                        notify(hasLock ? "密码已更改。" : "密码已设置，下次打开需要输入。");
                    });
                }}
            >
                <input
                    type="password"
                    required
                    aria-label={hasLock ? "新密码" : "设置密码"}
                    placeholder={hasLock ? "新密码" : "设置一个密码"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                />
                <button className="primary" disabled={!newPassword}>
                    {hasLock ? "更改密码" : "设置密码"}
                </button>
            </form>
            {hasLock && (
                <button
                    className="text-btn"
                    onClick={() => {
                        clearLock();
                        setHasLock(false);
                        notify("密码锁已关闭。");
                    }}
                >
                    关闭密码锁
                </button>
            )}
        </div>
    );
}
