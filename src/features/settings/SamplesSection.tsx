import { Sprout } from "lucide-react";
import { Help } from "../../components/Help";

export function SamplesSection({ onClear }: { onClear: () => void }) {
    return (
        <div className="setting-section">
            <h3>
                <Sprout size={18} />
                从自己的故事开始
                <Help label="示例">书桌上的几篇文字是示例，帮助你感受芸窗。</Help>
            </h3>
            <button className="text-btn" onClick={onClear}>
                清除示例日记
            </button>
        </div>
    );
}
