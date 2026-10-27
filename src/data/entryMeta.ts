import { Cloud, CloudRain, CloudRainWind, Sun, type LucideIcon } from "lucide-react";

// One vocabulary for the weather and mood glyphs so cards and the editor cannot drift apart.
export const weatherOptions: { name: string; icon: LucideIcon }[] = [
    { name: "晴天", icon: Sun },
    { name: "小雨", icon: CloudRain },
    { name: "暴雨", icon: CloudRainWind },
    { name: "阴天", icon: Cloud }
];
const weatherIcons = new Map(weatherOptions.map((w) => [w.name, w.icon]));
export const weatherIcon = (name: string) => weatherIcons.get(name) ?? Sun;
const moodGlyphs: Record<string, string> = {
    平静: "◡",
    开心: "☀",
    期待: "✧",
    焦虑: "≈",
    复杂: "☯",
    感恩: "♡",
    低落: "☂",
    疲惫: "☾"
};
export const moodGlyph = (mood: string) => moodGlyphs[mood] ?? "◦";
