import { memo, useEffect, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { Modal } from "../../components/Modal";
import { Help } from "../../components/Help";
import { MAX_PHOTOS, cachedPhoto, loadPhoto, ownsPhoto, uploadPhoto } from "../../services/photos";

function usePhoto(path: string, userId: string | undefined, enabled: boolean) {
    const [url, setUrl] = useState(() => cachedPhoto(path) || "");
    const [error, setError] = useState("");
    const [attempt, setAttempt] = useState(0);
    useEffect(() => {
        if (!enabled) return;
        let active = true;
        setError("");
        if (!userId || !ownsPhoto(path, userId)) {
            setError("登录所属账号后查看图片");
            return;
        }
        loadPhoto(path, userId).then(
            (loaded) => { if (active) setUrl(loaded); },
            () => { if (active) setError("图片暂不可用，点击重试"); }
        );
        return () => { active = false; };
    }, [path, userId, enabled, attempt]);
    return { url, error, again: () => setAttempt(a => a + 1) };
}

// Compact thumbnails wait until they scroll near: a long list would otherwise
// download every photo it holds before the reader asks for any of them. One
// observer serves the whole page rather than one per thumbnail.
let watcher: IntersectionObserver | null = null;
const watched = new Map<Element, () => void>();
function watchForView(box: Element, onSeen: () => void) {
    watcher ||= new IntersectionObserver(
        seen => { for (const { target, isIntersecting } of seen) if (isIntersecting) watched.get(target)?.(); },
        { rootMargin: "250px" }
    );
    watched.set(box, onSeen);
    watcher.observe(box);
    return () => { watched.delete(box); watcher?.unobserve(box); };
}

function Viewer({ url, onClose }: { url: string; onClose: () => void }) {
    return <Modal label="查看图片" onClose={onClose} wide>
        <div className="photo-viewer">
            <button type="button" className="text-btn photo-viewer-close" onClick={onClose}><X size={18} />关闭图片</button>
            <img className="photo-expanded" src={url} alt="日记照片" />
        </div>
    </Modal>;
}

// Compact is the card-strip form: 26px, lazily loaded, too small for placeholder
// text. The editor and reader grid is eager and captions its loading and errors.
function PhotoButton({ path, userId, compact = false, onOpen }: {
    path: string; userId?: string; compact?: boolean; onOpen: (url: string) => void;
}) {
    const box = useRef<HTMLButtonElement>(null);
    const [near, setNear] = useState(!compact);
    useEffect(() => {
        if (near || !box.current) return;
        return watchForView(box.current, () => setNear(true));
    }, [near]);
    const { url, error, again } = usePhoto(path, userId, near);
    return <button ref={box} type="button" className={compact ? "photo-thumb" : "photo-preview"}
        onClick={() => url ? onOpen(url) : again()} aria-label={url ? "放大日记照片" : error || "图片加载中"}>
        {url ? <img src={url} alt="" /> : compact ? null : <span>{error || "图片加载中…"}</span>}
    </button>;
}

export const PhotoStrip = memo(function PhotoStrip({ paths = [], userId }: { paths?: string[]; userId?: string }) {
    const [expanded, setExpanded] = useState("");
    if (!paths.length) return null;
    return <>
        <span className="photo-strip">
            {paths.slice(0, MAX_PHOTOS).map(path => <PhotoButton key={path} path={path} userId={userId} compact onOpen={setExpanded} />)}
        </span>
        {expanded && <Viewer url={expanded} onClose={() => setExpanded("")} />}
    </>;
});

export function Photos({ paths = [], userId, onChange, onBusy }: {
    paths?: string[]; userId?: string; onBusy?: (busy: boolean) => void; onChange?: (paths: string[]) => void;
}) {
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState("");
    const [expanded, setExpanded] = useState("");
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
            <PhotoButton path={path} userId={userId} onOpen={setExpanded} />
            {onChange && <button type="button" className="photo-remove" aria-label="移除图片" disabled={uploading} onClick={() => onChange(paths.filter(p => p !== path))}><X size={16} /></button>}
        </div>)}</div>
        {error && <p className="field-error" role="alert">{error}</p>}
        {expanded && <Viewer url={expanded} onClose={() => setExpanded("")} />}
    </section>;
}
