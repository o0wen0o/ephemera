import { useEffect, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { Modal } from "../../components/Modal";
import { Help } from "../../components/Help";
import { supabase } from "../../services/supabase";
import { MAX_PHOTOS, PHOTO_BUCKET, uploadPhoto } from "../../services/photos";

function Photo({ path, userId }: { path: string; userId?: string }) {
    const [url, setUrl] = useState("");
    const [error, setError] = useState("");
    const [retry, setRetry] = useState(0);
    const [expanded, setExpanded] = useState(false);
    useEffect(() => {
        let active = true;
        setUrl("");
        setError("");
        if (!supabase || !userId || !path.startsWith(userId + "/")) {
            setError("登录所属账号后查看图片");
            return;
        }
        supabase.storage.from(PHOTO_BUCKET).download(path).then(({ data, error }) => {
            if (!active) return;
            if (error || !data) setError("图片暂不可用，点击重试");
            else { objectUrl = URL.createObjectURL(data); setUrl(objectUrl); }
        }).catch(() => { if (active) setError("图片加载失败，点击重试"); });
        let objectUrl = "";
        return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
    }, [path, userId, retry]);
    return <>
        <button type="button" className="photo-preview" onClick={() => url ? setExpanded(true) : setRetry(retry + 1)} aria-label={url ? "放大图片" : error || "图片加载中"}>
            {url ? <img src={url} alt="日记照片" /> : <span>{error || "图片加载中…"}</span>}
        </button>
        {expanded && url && <Modal label="查看图片" onClose={() => setExpanded(false)} wide>
            <div className="photo-viewer">
                <button type="button" className="text-btn photo-viewer-close" onClick={() => setExpanded(false)}><X size={18} />关闭图片</button>
                <img className="photo-expanded" src={url} alt="日记照片" />
            </div>
        </Modal>}
    </>;
}

export function Photos({ paths = [], userId, onChange, onBusy }: {
    paths?: string[]; userId?: string; onBusy?: (busy: boolean) => void; onChange?: (paths: string[]) => void;
}) {
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState("");
    const input = useRef<HTMLInputElement>(null);
    const latest = useRef({ paths, onChange, userId });
    latest.current = { paths, onChange, userId };
    const active = useRef(true);
    const inFlight = useRef(false);
    useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
    const add = async (file?: File) => {
        if (!file || !userId || inFlight.current || paths.length >= MAX_PHOTOS) return;
        inFlight.current = true;
        setUploading(true); onBusy?.(true); setError("");
        try {
            const path = await uploadPhoto(file, userId);
            if (active.current && latest.current.userId === userId) {
                latest.current.onChange?.([...latest.current.paths, path]);
            }
        } catch (e) { if (active.current) setError(e instanceof Error ? e.message : "图片上传失败，请重试。"); }
        finally { inFlight.current = false; onBusy?.(false); if (active.current) setUploading(false); }
    };
    if (!onChange && !paths.length) return null;
    return <section className="journal-photos" aria-label="日记图片">
        {onChange && <div className="photo-heading"><span>日常留影 · {paths.length} / {MAX_PHOTOS}</span>
            <Help label="图片">登录并联网后可添加最多 3 张照片，会自动压缩。备份文件不含图片。上传时请勿关闭页面。</Help>
            <button type="button" className="text-btn" disabled={!userId || uploading || paths.length >= MAX_PHOTOS} onClick={() => input.current?.click()}><ImagePlus size={17} />{uploading ? "上传中…" : "添加图片"}</button>
            <input ref={input} type="file" hidden accept="image/jpeg,image/png,image/webp" onChange={e => { void add(e.target.files?.[0]); e.target.value = ""; }} />
        </div>}
        <div className="photo-grid">{paths.map(path => <div className="photo-item" key={path}>
            <Photo path={path} userId={userId} />
            {onChange && <button type="button" className="photo-remove" aria-label="移除图片" disabled={uploading} onClick={() => onChange(paths.filter(p => p !== path))}><X size={16} /></button>}
        </div>)}</div>
        {error && <p className="field-error" role="alert">{error}</p>}
    </section>;
}
