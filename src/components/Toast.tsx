import { Check, X } from "lucide-react";

export function Toast({ message, onClose }: { message: string; onClose: () => void }) {
    return (
        <div className="toast" role="status">
            <Check size={17} />
            {message}
            <button className="icon-btn" aria-label="关闭提示" onClick={onClose}>
                <X size={14} />
            </button>
        </div>
    );
}
