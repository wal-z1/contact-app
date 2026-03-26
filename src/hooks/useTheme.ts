import { useEffect } from "react";
import { useAppStore } from "../store/useAppStore";

const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
	try {
		const normalized = hex.replace("#", "").trim();
		const full =
			normalized.length === 3
				? normalized
						.split("")
						.map((c) => c + c)
						.join("")
				: normalized;
		const num = parseInt(full, 16);
		// eslint-disable-next-line no-bitwise
		return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
	} catch {
		return null;
	}
};

export function useTheme() {
	const theme = useAppStore((s) => s.theme);

	useEffect(() => {
		const el = document.documentElement;
		el.style.setProperty("--bg", theme.bg);
		el.style.setProperty("--border", theme.border);
		el.style.setProperty("--text", theme.textMuted);
		el.style.setProperty("--text-h", theme.text);
		el.style.setProperty("--accent", theme.accent);
		el.style.setProperty("--panel-bg", theme.panelBg);

		const rgb = hexToRgb(theme.accent);
		if (rgb) {
			const rgbString = `${rgb.r}, ${rgb.g}, ${rgb.b}`;
			el.style.setProperty("--accent-rgb", rgbString);
			el.style.setProperty("--accent-bg", `rgba(${rgbString}, 0.15)`);
			el.style.setProperty("--accent-border", `rgba(${rgbString}, 0.5)`);
		}
	}, [theme]);
}
