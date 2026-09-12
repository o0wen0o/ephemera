import { useEffect, useState } from "react";

/** A single transient message line; every notice clears itself after a few seconds. */
export function useToast() {
    const [toast, setToast] = useState("");
    useEffect(() => {
        if (toast) {
            const timer = setTimeout(() => setToast(""), 4500);
            return () => clearTimeout(timer);
        }
    }, [toast]);
    return { toast, setToast };
}
