import { BookOpen, Menu, Search, X } from "lucide-react";
import { VIEWS, type View } from "./views";

type Props = {
    view: View;
    query: string;
    onQueryChange: (query: string) => void;
    onOpenNav: () => void;
};

export function Topbar({ view, query, onQueryChange, onOpenNav }: Props) {
    return (
        <header className="topbar">
            <div className="breadcrumb">
                <button className="icon-btn mobile-menu" aria-label="打开导航" onClick={onOpenNav}>
                    <Menu size={21} />
                </button>
                <BookOpen size={16} />
                <span>{VIEWS[view].crumb}</span>
                <span className="breadcrumb-slash">/</span>
                <span className="topbar-sub">记录生活，也照见自己</span>
            </div>
            <div className="topbar-actions">
                <label className="search">
                    <Search size={16} />
                    <input
                        aria-label="搜索日记"
                        placeholder="寻找一段回忆…"
                        value={query}
                        onChange={(e) => onQueryChange(e.target.value)}
                    />
                    {query && (
                        <button aria-label="清除搜索" onClick={() => onQueryChange("")}>
                            <X size={13} />
                        </button>
                    )}
                </label>
            </div>
        </header>
    );
}
