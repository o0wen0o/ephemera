import { useMemo } from "react";
import { Botanical } from "../components/Botanical";
import { HEADING_FMT, VIEWS, type View } from "./views";

export function DeskHeading({ view }: { view: View }) {
    const headingDate = useMemo(() => HEADING_FMT.format(new Date()), []);
    return (
        <header className="desk-heading">
            <div>
                <p>{headingDate}</p>
                <h1>{VIEWS[view].h1}</h1>
                <span>{VIEWS[view].sub}</span>
            </div>
            <div className="desk-heading-art" aria-hidden="true">
                <Botanical />
                <span>芸窗手记</span>
            </div>
        </header>
    );
}
