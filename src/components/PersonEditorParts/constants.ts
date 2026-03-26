import { NODE_COLOR_OPTIONS } from "../../utils/nodeColors";

export const SOCIAL_PLATFORMS = [
	["instagram", "Instagram"],
	["linkedin", "LinkedIn"],
	["twitter", "Twitter/X"],
	["github", "GitHub"],
	["mastodon", "Mastodon"],
	["website", "Website"],
] as const;

export { NODE_COLOR_OPTIONS };

export const sectionWrap = "px-5 mt-6";
export const sectionHeader =
	"mb-4 flex items-center justify-between border-b border-[color:var(--border)] pb-2.5";
export const sectionTitle =
	"text-[11px] font-bold uppercase tracking-[0.1em] text-[color:var(--text)]";
export const sectionHint =
	"mb-3 text-[11px] leading-[1.55] text-[color:var(--text)]";

export const labelClass =
	"text-[10px] font-bold uppercase tracking-[0.08em] text-[#6b7280]";
export const fieldBase =
	"w-full min-w-0 rounded-lg border border-[color:var(--border)] bg-white/[0.04] px-3 py-2.5 text-[13px] text-[color:var(--text-h)] transition-all duration-150 placeholder:text-white/20 focus:outline-none focus:border-[color:var(--accent)] focus:bg-[rgba(var(--accent-rgb),0.07)] focus:ring-2 focus:ring-[rgba(var(--accent-rgb),0.12)]";
export const textareaBase = `resize-y ${fieldBase}`;
export const clearBtn =
	"shrink-0 whitespace-nowrap rounded-md border border-[color:var(--border)] bg-transparent px-2.5 py-[7px] text-[11px] text-[#6b7280] transition-all duration-150 hover:border-[#4b5563] hover:text-[color:var(--text-h)]";
export const pillBase =
	"inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px]";
export const mutedPill = `${pillBase} border-[color:var(--border)] bg-white/[0.05] text-[color:var(--text)]`;
export const accentPill = `${pillBase} border-[color:var(--accent-border)] bg-[color:var(--accent-bg)] text-[color:var(--accent)]`;
export const softCard =
	"rounded-xl border border-[color:var(--border)] bg-white/[0.04] px-3.5 py-3 shadow-[0_1px_0_rgba(255,255,255,0.02)_inset]";
export const ghostButton =
	"rounded-md border border-[color:var(--border)] bg-transparent px-2.5 py-1.5 text-[11px] font-semibold text-[color:var(--text)] transition-all duration-150 hover:bg-white/[0.06] hover:text-[color:var(--text-h)]";
export const dangerGhostButton =
	"rounded-md border border-[color:var(--border)] bg-transparent px-2.5 py-1.5 text-[11px] font-semibold text-[color:var(--text)] transition-all duration-150 hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-500";
export const primaryButton =
	"rounded-lg border border-[color:var(--accent-border)] bg-[color:var(--accent-bg)] px-3 py-2 text-xs font-semibold text-[color:var(--accent)] transition-all duration-150 hover:bg-[rgba(var(--accent-rgb),0.24)]";
export const solidAccentButton =
	"w-full rounded-lg border-none bg-[color:var(--accent)] px-4 py-2.5 text-xs font-bold text-white transition-all duration-150 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 disabled:filter-none";
export const countBadge =
	"rounded-full bg-white/[0.05] px-2 py-0.5 text-[11px] text-[#6b7280]";
