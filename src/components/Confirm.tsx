import type { ReactNode } from "react";
import { Trash2 } from "lucide-react";
import { Modal } from "./Modal";
export function Confirm({
    label,
    title,
    cancel,
    confirm,
    onCancel,
    onConfirm,
    disabled = false,
    children
}: {
    label: string;
    title: string;
    cancel: string;
    confirm: string;
    onCancel: () => void;
    onConfirm: () => void;
    disabled?: boolean;
    children: ReactNode;
}) {
    return (
        <Modal label={label} onClose={onCancel}>
            <div className="confirm-dialog">
                <div className="confirm-heading">
                    <Trash2 size={22} />
                    <h2>{title}</h2>
                </div>
                <p>{children}</p>
                <div className="button-row">
                    <button className="outline" onClick={onCancel}>
                        {cancel}
                    </button>
                    <button className="danger" disabled={disabled} onClick={onConfirm}>
                        {confirm}
                    </button>
                </div>
            </div>
        </Modal>
    );
}
