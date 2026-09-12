import { BookOpen, Bookmark, CalendarDays, Pencil, type LucideIcon } from "lucide-react";

export type View = "all" | "drafts" | "calendar" | "favorites";

export type ViewCopy = {
    icon: LucideIcon;
    title: string;
    crumb: string;
    h1: string;
    sub: string;
    section: string;
    emptyHead: string;
    emptyBody: string;
    emptyAction: string;
};

// One table per view so adding or renaming a view is a single edit instead of six parallel ternaries.
export const VIEWS: Record<View, ViewCopy> = {
    all: {
        icon: BookOpen,
        title: "日记",
        crumb: "我的日记",
        h1: "日子，慢慢写。",
        sub: "把平凡留在心里。",
        section: "我的日记",
        emptyHead: "故事，从今天开始",
        emptyBody: "给今天留几句话，往后翻起，便是回忆。",
        emptyAction: "写第一篇日记"
    },
    drafts: {
        icon: Pencil,
        title: "草稿",
        crumb: "我的草稿",
        h1: "未完的文字，留待下次。",
        sub: "那些还在酝酿的日子。",
        section: "我的草稿",
        emptyHead: "暂无草稿",
        emptyBody: "",
        emptyAction: "写日记"
    },
    calendar: {
        icon: CalendarDays,
        title: "回顾",
        crumb: "日历回顾",
        h1: "沿着日历，遇见从前。",
        sub: "选一个日子，翻开那天的书页。",
        section: "这个月的书页",
        emptyHead: "这个月还没有书页",
        emptyBody: "试试另一个月份，看看那些有记录的日子。",
        emptyAction: "回到本月"
    },
    favorites: {
        icon: Bookmark,
        title: "珍藏",
        crumb: "我的珍藏",
        h1: "值得留下的片刻。",
        sub: "你收藏的文字，都在这里。",
        section: "我的珍藏",
        emptyHead: "还没有珍藏的片刻",
        emptyBody: "点击日记上的书签，就能把喜欢的文字放在这里。",
        emptyAction: "浏览日记"
    }
};

export const VIEW_ORDER = Object.keys(VIEWS) as View[];

// Intl construction is expensive and the value only changes at midnight, so build it once.
export const HEADING_FMT = new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "long"
});
