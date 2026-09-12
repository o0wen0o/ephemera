import { useState } from "react";
import { MonitorSmartphone, Plus } from "lucide-react";
import { Help } from "../../components/Help";
import type { InstallEvent } from "../../app/useConnectivity";

type Props = {
    install: InstallEvent | null;
    onInstalled: () => void;
};

/** Browsers that offer an install prompt get the button; the rest get the instructions. */
export function InstallSection({ install, onInstalled }: Props) {
    const [installMessage, setInstallMessage] = useState("");
    const installApp = async () => {
        if (install) {
            await install.prompt();
            await install.userChoice;
            onInstalled();
        } else {
            setInstallMessage(
                "电脑：在浏览器菜单中选择「安装芸窗」。iPhone：用 Safari 打开，点分享，选「添加到主屏幕」。"
            );
        }
    };
    return (
        <div className="setting-section">
            <h3>
                <MonitorSmartphone size={18} />
                随时打开芸窗
                <Help label="安装">
                    支持电脑和手机。首次打开后即可离线使用。iPhone 请在 Safari
                    分享菜单中选择「添加到主屏幕」。
                </Help>
            </h3>
            <button className="outline" onClick={() => void installApp()}>
                <Plus size={16} />
                {install ? "安装芸窗" : "查看安装方式"}
            </button>
            {installMessage && (
                <p className="cloud-message" role="status">
                    {installMessage}
                </p>
            )}
        </div>
    );
}
