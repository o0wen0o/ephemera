import { Trash2 } from "lucide-react";
import { Help } from "../../components/Help";
import type { Entry } from "../../data/data";
import type { Tombstone } from "../../data/journal";

type Props = {
    trash: Tombstone[];
    busy: boolean;
    onEmptyTrash: () => void;
    onRestore: (entry: Entry) => void;
};

/** Deleted entries keep their full text here until the trash is emptied on this device. */
export function TrashSection({ trash, busy, onEmptyTrash, onRestore }: Props) {
    return (
        <div className="setting-section">
            <h3>
                <Trash2 size={18} />
                回收站 <small>{trash.length}</small>
                <Help label="回收站">删除只收起书页，完整内容保留，恢复后会同步。</Help>
            </h3>
            <button
                className="text-btn empty-trash"
                disabled={!trash.length || busy}
                onClick={onEmptyTrash}
            >
                清空回收站
            </button>
            <div className="recycle-list">
                {trash.length ? (
                    trash.map((t) => (
                        <div className="recycle-row" key={t.entry.id}>
                            <div>
                                <strong>{t.entry.title || "无题"}</strong>
                                <small>{t.entry.date}</small>
                            </div>
                            <button className="outline" onClick={() => onRestore(t.entry)}>
                                恢复
                            </button>
                        </div>
                    ))
                ) : (
                    <p>暂无收起的书页</p>
                )}
            </div>
        </div>
    );
}
