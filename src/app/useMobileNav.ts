import { useLayoutEffect, useState } from "react";

/**
 * The mobile drawer freezes the page behind it. Fixing the body loses the scroll
 * position, so remember it and restore it when the drawer closes.
 */
export function useMobileNav() {
    const [mobileNav, setMobileNav] = useState(false);
    useLayoutEffect(() => {
        if (!mobileNav) return;
        const body = document.body;
        const { position, top, width } = body.style;
        const scrollY = window.scrollY;
        body.style.position = "fixed";
        body.style.top = `-${scrollY}px`;
        body.style.width = "100%";
        const close = (event: KeyboardEvent) => {
            if (event.key === "Escape") setMobileNav(false);
        };
        const media = window.matchMedia("(max-width: 760px)");
        const resize = () => {
            if (!media.matches) setMobileNav(false);
        };
        document.addEventListener("keydown", close);
        media.addEventListener("change", resize);
        return () => {
            body.style.position = position;
            body.style.top = top;
            body.style.width = width;
            window.scrollTo({ top: scrollY, behavior: "instant" });
            document.removeEventListener("keydown", close);
            media.removeEventListener("change", resize);
        };
    }, [mobileNav]);
    return { mobileNav, setMobileNav };
}
