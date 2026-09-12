import { supabase } from "./supabase";

const PHOTO_BUCKET = "journal-images";
export const MAX_PHOTOS = 3;

// Photos are stored under `${userId}/`, so the prefix is what makes one yours.
export const ownsPhoto = (path: string, userId: string) => path.startsWith(userId + "/");

// Cards and the reader share one blob per path: a list of entries would otherwise
// re-download the same photo for every card that shows it.
const cache = new Map<string, string>();
const inFlight = new Map<string, Promise<string>>();
const CACHE_LIMIT = 30;

export function cachedPhoto(path: string) {
    return cache.get(path);
}

export function loadPhoto(path: string, userId: string): Promise<string> {
    const hit = cache.get(path);
    if (hit) {
        // Re-insert so the newest use sits at the end of the eviction order.
        cache.delete(path);
        cache.set(path, hit);
        return Promise.resolve(hit);
    }
    const pending = inFlight.get(path);
    if (pending) return pending;
    const job = (async () => {
        if (!supabase || !ownsPhoto(path, userId)) throw Error("图片不可用");
        const { data, error } = await supabase.storage.from(PHOTO_BUCKET).download(path);
        if (error || !data) throw Error("图片不可用");
        const url = URL.createObjectURL(data);
        cache.set(path, url);
        // One entry goes in per miss, so at most one falls out.
        if (cache.size > CACHE_LIMIT) {
            const oldest = cache.keys().next().value!;
            URL.revokeObjectURL(cache.get(oldest)!);
            cache.delete(oldest);
        }
        return url;
    })();
    inFlight.set(path, job);
    const settled = () => inFlight.delete(path);
    job.then(settled, settled);
    return job;
}

export function forgetPhotos() {
    for (const url of cache.values()) URL.revokeObjectURL(url);
    cache.clear();
}

export async function compressPhoto(file: File): Promise<Blob> {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
        throw Error("请选择 JPG、PNG 或 WebP 图片。");
    if (file.size > 20 * 1024 * 1024) throw Error("请选择小于 20 MB 的图片。");
    const bitmap = await createImageBitmap(file);
    try {
        const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        const context = canvas.getContext("2d");
        if (!context) throw Error("当前浏览器无法处理图片。");
        context.fillStyle = "#fffef9";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        for (const quality of [0.82, 0.68, 0.5, 0.35]) {
            const blob = await new Promise<Blob | null>((resolve) =>
                canvas.toBlob(resolve, "image/jpeg", quality)
            );
            if (blob && blob.size <= 400 * 1024) return blob;
        }
        throw Error("图片压缩后仍过大，请选择尺寸更小的图片。");
    } finally {
        bitmap.close();
    }
}

export async function uploadPhoto(file: File, userId: string): Promise<string> {
    if (!supabase || !navigator.onLine) throw Error("请登录并联网后添加图片。");
    const blob = await compressPhoto(file);
    const { data } = await supabase.auth.getSession();
    if (data.session?.user.id !== userId) throw Error("登录状态已变化，请重新打开日记。");
    const path = `${userId}/${crypto.randomUUID()}.jpg`;
    const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, blob, {
        contentType: "image/jpeg",
        upsert: false
    });
    if (error) throw Error("图片上传失败，请检查网络后重试。文字仍会保留。");
    return path;
}
