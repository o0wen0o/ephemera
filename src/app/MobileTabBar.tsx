import { Plus } from "lucide-react";
import { VIEWS, VIEW_ORDER, type View } from "./views";

type Props = {
    view: View;
    onSelectView: (view: View) => void;
    onWrite: () => void;
};

export function MobileTabBar({ view, onSelectView, onWrite }: Props) {
    return (
        <nav className="mobile-bottom" aria-label="手机导航">
            {VIEW_ORDER.map((id) => {
                const Icon = VIEWS[id].icon;
                const button = (
                    <button
                        key={id}
                        className={view === id ? "active" : ""}
                        aria-current={view === id ? "page" : undefined}
                        onClick={() => onSelectView(id)}
                    >
                        <Icon size={19} />
                        {VIEWS[id].title}
                    </button>
                );
                // Keep two destinations on each side of the central write button.
                return id === "drafts"
                    ? [
                          button,
                          <button
                              key="write"
                              className="mobile-write"
                              aria-label="写日记"
                              onClick={onWrite}
                          >
                              <Plus size={24} />
                          </button>
                      ]
                    : button;
            })}
        </nav>
    );
}
