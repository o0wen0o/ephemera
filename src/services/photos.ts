import { supabase } from "./supabase";

export const PHOTO_BUCKET = "journal-images";
export const MAX_PHOTOS = 3;

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
            const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", quality));
            if (blob && blob.size <= 400 * 1024) return blob;
        }
        throw Error("图片压缩后仍过大，请选择尺寸更小的图片。");
    } finally { bitmap.close(); }
}

export async function uploadPhoto(file: File, userId: string): Promise<string> {
    if (!supabase || !navigator.onLine) throw Error("请登录并联网后添加图片。");
    const blob = await compressPhoto(file);
    const { data } = await supabase.auth.getSession();
    if (data.session?.user.id !== userId) throw Error("登录状态已变化，请重新打开日记。");
    const path = `${userId}/${crypto.randomUUID()}.jpg`;
    const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, blob, {
        contentType: "image/jpeg", upsert: false
    });
    if (error) throw Error("图片上传失败，请检查网络、存储额度和图片配置脚本。文字草稿仍保留。");
    return path;
}
