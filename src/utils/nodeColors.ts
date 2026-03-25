export const NODE_COLOR_OPTIONS = [
	{ id: "violet", label: "Violet", color: "#7c3aed" },
	{ id: "blue", label: "Blue", color: "#2563eb" },
	{ id: "teal", label: "Teal", color: "#0f766e" },
	{ id: "emerald", label: "Emerald", color: "#059669" },
	{ id: "amber", label: "Amber", color: "#d97706" },
	{ id: "rose", label: "Rose", color: "#e11d48" },
	{ id: "slate", label: "Slate", color: "#475569" },
] as const;

export const DEFAULT_NODE_COLOR = NODE_COLOR_OPTIONS[0].color;

export const isValidNodeColor = (value: unknown): value is string => {
	if (typeof value !== "string") return false;
	const normalized = value.trim().toLowerCase();
	return NODE_COLOR_OPTIONS.some(
		(option) => option.color.toLowerCase() === normalized,
	);
};
