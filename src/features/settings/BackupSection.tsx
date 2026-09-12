import { useRef } from "react";
import { BookOpen, Download, Upload } from "lucide-react";
import { Help } from "../../components/Help";

type Props = {
    storageError: string;
    onExport: (raw?: boolean) => void;
    onImport: (file: File) => void;
};

export function BackupSection({ storageError, onExport, onImport }: Props) {
    const fileRef = useRef<HTMLInputElement>(null);
    return (
        <div className="setting-section">
            <h3>
                <BookOpen size={18} />
                带走你的文字
                <Help label="备份">导出完整备份文件。导入时会与现有日记合并，不会丢失内容。</Help>
            </h3>
            <div className="button-row">
                <button className="outline" onClick={() => onExport()}>
                    <Download size={16} />
                    导出日记
                </button>
                <button className="outline" onClick={() => fileRef.current?.click()}>
                    <Upload size={16} />
                    导入备份
                </button>
                {storageError && (
                    <button className="outline" onClick={() => onExport(true)}>
                        导出原始备份
                    </button>
                )}
            </div>
            <input
                ref={fileRef}
                hidden
                type="file"
                accept="application/json,.json"
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onImport(file);
                    e.target.value = "";
                }}
            />
        </div>
    );
}
