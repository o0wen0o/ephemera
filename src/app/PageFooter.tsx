import { Cloud } from "lucide-react";

type Props = {
    signedIn: boolean;
    online: boolean;
    pendingSync: number;
    accountAllowed: boolean;
};

export function PageFooter({ signedIn, online, pendingSync, accountAllowed }: Props) {
    return (
        <footer className="page-footer">
            <span>芸窗 Ephemera</span>
            <span>让每一个平凡的日子，有迹可循。</span>
            <span>
                <Cloud size={13} />
                {signedIn
                    ? online
                        ? pendingSync
                            ? `${pendingSync} 项待同步`
                            : accountAllowed
                              ? "云端已同步"
                              : "同步已暂停"
                        : "离线记录中"
                    : "文字存于本机"}
            </span>
        </footer>
    );
}
