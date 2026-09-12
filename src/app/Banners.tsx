import { WifiOff } from "lucide-react";

type Props = {
    storageError: string;
    online: boolean;
    updateApp: ((reload?: boolean) => Promise<void>) | null;
    onExportRaw: () => void;
};

/** The three notices that sit above the desk: storage trouble, offline, new version. */
export function Banners({ storageError, online, updateApp, onExportRaw }: Props) {
    return (
        <>
            {storageError && (
                <div className="storage-warning" role="alert">
                    {storageError}
                    <button onClick={onExportRaw}>导出原始备份</button>
                </div>
            )}
            {!online && (
                <div className="offline-banner">
                    <WifiOff size={14} />
                    此刻离线，日记仍会保存在这台设备。
                </div>
            )}
            {updateApp && (
                <div className="offline-banner">
                    芸窗有新版本。请先收好正在写的日记。
                    <button onClick={() => updateApp(true)}>更新并重新打开</button>
                </div>
            )}
        </>
    );
}
