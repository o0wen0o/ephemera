import { useEffect, useRef, type ReactNode } from "react";
export function Modal({
    children,
    onClose,
    label,
    wide = false
}: {
    children: ReactNode;
    onClose: () => void;
    label: string;
    wide?: boolean;
}) {
    const ref = useRef<HTMLDivElement>(null);
    // Held in a ref so the focus trap arms once per dialog; re-running it would steal focus mid-edit.
    const closeRef = useRef(onClose);
    closeRef.current = onClose;
    useEffect(() => {
        const prev = document.activeElement as HTMLElement;
        const old = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        if (!ref.current?.contains(document.activeElement)) ref.current?.focus();
        const key = (e: KeyboardEvent) => {
            if (e.key !== "Escape" && e.key !== "Tab") return;
            if (
                e.defaultPrevented ||
                Array.from(document.querySelectorAll('[role="dialog"]')).at(-1) !== ref.current
            )
                return;
            if (e.key === "Escape") closeRef.current();
            if (e.key === "Tab") {
                const nodes = Array.from(
                    ref.current?.querySelectorAll<HTMLElement>(
                        'button,input,textarea,select,a[href],[tabindex="0"]'
                    ) || []
                ).filter(
                    (el) =>
                        !el.hasAttribute("disabled") && el.offsetParent !== null && el.tabIndex >= 0
                );
                const first = nodes[0],
                    last = nodes.at(-1);
                if (
                    e.shiftKey &&
                    (document.activeElement === first || document.activeElement === ref.current)
                ) {
                    e.preventDefault();
                    last?.focus();
                } else if (
                    !e.shiftKey &&
                    (document.activeElement === last || document.activeElement === ref.current)
                ) {
                    e.preventDefault();
                    first?.focus();
                }
            }
        };
        document.addEventListener("keydown", key);
        return () => {
            document.body.style.overflow = old;
            document.removeEventListener("keydown", key);
            prev?.focus();
        };
    }, []);
    return (
        <div
            className="modal-backdrop"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div
                ref={ref}
                className={"modal " + (wide ? "wide" : "")}
                role="dialog"
                aria-modal="true"
                aria-label={label}
                tabIndex={-1}
            >
                {children}
            </div>
        </div>
    );
}
