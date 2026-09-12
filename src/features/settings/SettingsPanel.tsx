import { X } from "lucide-react";
import { BackupSection } from "./BackupSection";
import { CloudSection } from "./CloudSection";
import { InstallSection } from "./InstallSection";
import { LockSection } from "./LockSection";
import { SamplesSection } from "./SamplesSection";
import { TrashSection } from "./TrashSection";
import type { InstallEvent } from "../../app/useConnectivity";
import type { Entry } from "../../data/data";
import type { Tombstone } from "../../data/journal";
import type { Session } from "@supabase/supabase-js";

type Props = {
    onClose: () => void;
    notify: (message: string) => void;
    // Cloud
    session: Session | null;
    owner: string | null;
    accountAllowed: boolean;
    online: boolean;
    busy: boolean;
    signingOut: boolean;
    pendingSync: number;
    cloudMessage: string;
    hasLocalBackup: boolean;
    email: string;
    onEmailChange: (email: string) => void;
    onAuth: () => void;
    onSignOut: () => void;
    onBindAccount: () => void;
    onSync: () => void;
    onReplaceLocal: () => void;
    onExportLocalBackup: () => void;
    // Backup
    storageError: string;
    onExport: (raw?: boolean) => void;
    onImport: (file: File) => void;
    // Install
    install: InstallEvent | null;
    onInstalled: () => void;
    // Samples and trash
    hasSamples: boolean;
    onClearSamples: () => void;
    trash: Tombstone[];
    onEmptyTrash: () => void;
    onRestore: (entry: Entry) => void;
};

/** The settings sheet: one section per thing a reader can change or take away. */
export function SettingsPanel(props: Props) {
    return (
        <section className="settings-panel">
            <div className="dialog-heading">
                <h2>设置</h2>
                <button className="icon-btn" aria-label="关闭设置" onClick={props.onClose}>
                    <X size={20} />
                </button>
            </div>
            <CloudSection
                session={props.session}
                owner={props.owner}
                accountAllowed={props.accountAllowed}
                online={props.online}
                busy={props.busy}
                signingOut={props.signingOut}
                storageError={props.storageError}
                pendingSync={props.pendingSync}
                cloudMessage={props.cloudMessage}
                hasLocalBackup={props.hasLocalBackup}
                email={props.email}
                onEmailChange={props.onEmailChange}
                onAuth={props.onAuth}
                onSignOut={props.onSignOut}
                onBindAccount={props.onBindAccount}
                onSync={props.onSync}
                onReplaceLocal={props.onReplaceLocal}
                onExportLocalBackup={props.onExportLocalBackup}
            />
            <BackupSection
                storageError={props.storageError}
                onExport={props.onExport}
                onImport={props.onImport}
            />
            <LockSection notify={props.notify} />
            <InstallSection install={props.install} onInstalled={props.onInstalled} />
            {props.hasSamples && <SamplesSection onClear={props.onClearSamples} />}
            <TrashSection
                trash={props.trash}
                busy={props.busy}
                onEmptyTrash={props.onEmptyTrash}
                onRestore={props.onRestore}
            />
            <div className="settings-signature">
                芸窗 · Ephemera <span>版本 0.2</span>
            </div>
        </section>
    );
}
