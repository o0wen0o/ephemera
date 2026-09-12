export type Entry = {
    id: string;
    title: string;
    body: string;
    date: string;
    mood: string;
    weather: string;
    tags: string[];
    favorite: boolean;
    cover?: boolean;
    images?: string[];
    /** When the entry was first written. Set once and never rewritten; absent on older entries. */
    created_at?: string;
    updated_at: string;
};
export const localDate = (date = new Date()) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
// Noon anchoring keeps a date string from shifting a day when it crosses a timezone offset.
export const asDate = (value: string) => new Date(value + "T12:00:00");
export const monthStart = (year: number, monthIndex: number) => new Date(year, monthIndex, 1, 12);
export const thisMonth = () => {
    const now = new Date();
    return monthStart(now.getFullYear(), now.getMonth());
};
export const displayDate = (date: string) => date.replaceAll("-", " / ");
/** Reads an instant stored as ISO text back as a local date and time, for the "written at" line. */
export const displayStamp = (iso: string) => {
    const at = new Date(iso);
    if (Number.isNaN(at.getTime())) return "";
    return `${displayDate(localDate(at))} ${at.toTimeString().slice(0, 5)}`;
};
// Samples pretend to have been written at a plausible hour of their own day, never after now.
const daysAgo = (n: number, hour: number, minute: number) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    d.setHours(hour, minute, 0, 0);
    return { date: localDate(d), created_at: new Date(Math.min(d.getTime(), Date.now())).toISOString() };
};
export const moods = ["开心", "期待", "低落", "焦虑", "疲惫", "复杂"];
export const defaultTags = ["生活碎片", "埋头做事", "读写之间", "人与人", "独处时光", "沿途风景"];
// Seed entries are display-only samples: they never enter the sync queue.
export const SAMPLE_PREFIX = "sample-";
export const isSample = (id: string) => id.startsWith(SAMPLE_PREFIX);
// One field list so a blanked tombstone cannot silently retain content when Entry grows.
export const blankEntryFields = () => ({
    title: "",
    body: "",
    mood: "",
    weather: "",
    tags: [] as string[],
    favorite: false,
    images: [] as string[],
    cover: false
});
export const countWords = (body: string) => body.replace(/\s/g, "").length;
export const seeds: Entry[] = [
    {
        id: "sample-1",
        title: "日子很慢，阳光很暖",
        body: "午后的阳光穿过窗帘，在桌上落下一小片金色。\n\n泡了一杯茶，翻开读到一半的书。窗外的树影轻轻晃动，突然觉得，什么也不做的时光，也值得被认真收藏。\n\n今天没有什么特别的事。可这份平常，就是生活给我的小小礼物。",
        ...daysAgo(0, 14, 20),
        mood: "",
        weather: "晴天",
        tags: ["生活碎片", "独处时光"],
        favorite: true,
        cover: true,
        updated_at: new Date().toISOString()
    },
    {
        id: "sample-2",
        title: "在雨声里，给自己留一盏灯",
        body: "下班的时候突然下起了雨。没有带伞，索性在街角的旧书店多待了一会儿。\n\n店主正在整理一摞旧诗集，空气里是纸张和雨水的气味。买下一本扉页写着陌生人名字的书，像接住了一段未曾谋面的时光。",
        ...daysAgo(1, 18, 40),
        mood: "",
        weather: "小雨",
        tags: ["读写之间"],
        favorite: false,
        updated_at: new Date().toISOString()
    },
    {
        id: "sample-3",
        title: "原来快乐可以这么小",
        body: "路过花店，买了一小束洋甘菊。回家的路上一直抱着它，连脚步都变轻了。\n\n把花插进空玻璃瓶，放在窗边。房间没有变大，生活却好像宽阔了一点。",
        ...daysAgo(3, 17, 5),
        mood: "开心",
        weather: "晴天",
        tags: ["生活碎片"],
        favorite: true,
        updated_at: new Date().toISOString()
    },
    {
        id: "sample-4",
        title: "散步，是和自己重新见面",
        body: "傍晚沿河走了很远。没有听歌，也没有看手机，只是慢慢地走。\n\n看见一只白鹭站在水边，看见晚风把芦苇吹成一片温柔的海。心里那些没想明白的事，似乎也不急着有答案了。",
        ...daysAgo(5, 19, 10),
        mood: "复杂",
        weather: "多云",
        tags: ["沿途风景", "独处时光"],
        favorite: false,
        updated_at: new Date().toISOString()
    },
    {
        id: "sample-5",
        title: "九月，愿我们从容一些",
        body: "换了一本新笔记本。在第一页写下：允许自己慢慢来。\n\n不必把每一天都过成答案。种一株植物，认真吃饭，记住路过的云。",
        ...daysAgo(7, 8, 30),
        mood: "",
        weather: "多云",
        tags: ["生活碎片"],
        favorite: false,
        updated_at: new Date().toISOString()
    }
];
export const entryValid = (e: unknown): e is Entry => {
    if (!e || typeof e !== "object") return false;
    const v = e as Entry;
    return (
        typeof v.id === "string" &&
        typeof v.title === "string" &&
        typeof v.body === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(v.date) &&
        typeof v.mood === "string" &&
        typeof v.weather === "string" &&
        Array.isArray(v.tags) &&
        v.tags.every((t) => typeof t === "string") &&
        (v.images === undefined || (Array.isArray(v.images) && v.images.length <= 3 &&
            new Set(v.images).size === v.images.length &&
            v.images.every(path => typeof path === "string" && /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.jpg$/i.test(path)))) &&
        typeof v.favorite === "boolean" &&
        // A cloud row leaves this column null while older entries simply omit it.
        (v.created_at == null || !Number.isNaN(Date.parse(v.created_at))) &&
        typeof v.updated_at === "string"
    );
};
