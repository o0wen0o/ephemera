import { Feather, Plus, Settings, Tags } from "lucide-react";
import { Botanical } from "../components/Botanical";
import { VIEWS, VIEW_ORDER, type View } from "./views";

type Props = {
    open: boolean;
    view: View;
    draftCount: number;
    online: boolean;
    onSelectView: (view: View) => void;
    onWrite: () => void;
    onOrganize: () => void;
    onSettings: () => void;
};

export function Sidebar({
    open,
    view,
    draftCount,
    online,
    onSelectView,
    onWrite,
    onOrganize,
    onSettings
}: Props) {
    return (
        <aside className={"sidebar " + (open ? "mobile-open" : "")}>
            <a
                className="brand"
                href="/"
                onClick={(e) => {
                    e.preventDefault();
                    onSelectView("all");
                }}
            >
                <img src="/icon.svg" alt="" />
                <span>
                    <strong>芸窗</strong>
                    <em>Ephemera</em>
                </span>
            </a>
            <div className="sidebar-intro">一扇窗，一本日记，一方心安。</div>
            <button className="new-entry" onClick={onWrite}>
                <Plus size={18} />
                写一篇日记
                <Feather size={17} />
            </button>
            <div className="nav-label">我的书页</div>
            <nav aria-label="主导航">
                {VIEW_ORDER.map((id) => {
                    const Icon = VIEWS[id].icon;
                    return (
                        <button
                            key={id}
                            className={view === id ? "selected" : ""}
                            aria-current={view === id ? "page" : undefined}
                            onClick={() => onSelectView(id)}
                        >
                            <Icon size={18} />
                            <span>
                                {VIEWS[id].title}
                                {id === "drafts" && draftCount > 0 ? " · " + draftCount : ""}
                            </span>
                        </button>
                    );
                })}
            </nav>
            <button className="organize-link" onClick={onOrganize}>
                <Tags size={18} />
                <span>
                    整理书页<small>管理标签与心情</small>
                </span>
            </button>
            <div className="sidebar-poem">
                <Botanical small />
                <p>
                    岁月不声不响，
                    <br />
                    而你落笔有光。
                </p>
                <span>Collect the little things.</span>
            </div>
            <div className="sidebar-bottom">
                <button onClick={onSettings}>
                    <Settings size={18} />
                    <span>
                        设置与备份
                        <small>
                            <i />
                            {online ? "本机保存" : "离线记录中"}
                        </small>
                    </span>
                </button>
            </div>
        </aside>
    );
}
