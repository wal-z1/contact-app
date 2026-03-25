import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import { useAppStore } from "../store/useAppStore";
import type { Person } from "../models/types";
import GlobalSettingsPanel from "./GlobalSettingsPanel";
import PersonEditor from "./PersonEditor";

// ─── Shared styles injected once ─────────────────────────────────────────────
const PP_STYLES = `
.pp-root {
	height: 100%; width: 100%;
	display: flex; flex-direction: column;
	overflow: hidden;
	font-size: 14px;
	color: var(--text);
}
.pp-scroll {
	flex: 1; overflow-y: auto;
	padding: 0 0 32px;
}
.pp-scroll::-webkit-scrollbar { width: 4px; }
.pp-scroll::-webkit-scrollbar-track { background: transparent; }
.pp-scroll::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }

/* ── Hero ── */
.pp-hero {
	padding: 20px 20px 16px;
	display: flex;
	align-items: flex-start;
	gap: 14px;
	border-bottom: 1px solid var(--border);
}
.pp-avatar {
	width: 44px; height: 44px; border-radius: 50%;
	background: linear-gradient(135deg, var(--person-color, #7c3aed), #c026d3);
	display: flex; align-items: center; justify-content: center;
	font-size: 18px; font-weight: 700; color: #fff;
	flex-shrink: 0;
	box-shadow: 0 0 0 2px rgba(192,132,252,0.25);
	user-select: none;
}
.pp-hero-info { flex: 1; min-width: 0; }
.pp-name {
	font-size: 15px; font-weight: 700;
	color: var(--text-h);
	letter-spacing: -0.01em;
	line-height: 1.3;
	white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.pp-desc {
	font-size: 12px; color: var(--text);
	margin-top: 2px;
	white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.pp-meta {
	display: flex; align-items: center; gap: 8px;
	margin-top: 8px; flex-wrap: wrap;
}
.pp-badge {
	display: inline-flex; align-items: center;
	background: rgba(255,255,255,0.05);
	border: 1px solid var(--border);
	border-radius: 20px;
	padding: 2px 8px;
	font-size: 11px; color: var(--text);
	gap: 4px;
}
.pp-badge-accent {
	background: var(--accent-bg);
	border-color: var(--accent-border);
	color: var(--accent);
}
.pp-tag-remove {
	background: none; border: none; cursor: pointer;
	color: currentColor; opacity: 0.5;
	font-size: 13px; line-height: 1;
	padding: 0; margin: 0;
	transition: opacity 0.1s;
}
.pp-tag-remove:hover { opacity: 1; }
.pp-hero-actions { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; flex-shrink: 0; }
.pp-delete-btn {
	background: none; border: 1px solid transparent;
	border-radius: 6px; padding: 4px 8px;
	font-size: 11px; font-weight: 600; color: #6b7280;
	cursor: pointer; transition: all 0.15s;
	white-space: nowrap;
}
.pp-delete-btn:hover { color: #ef4444; border-color: rgba(239,68,68,0.3); background: rgba(239,68,68,0.07); }

/* ── Tag input ── */
.pp-tag-input-row { display: flex; gap: 6px; align-items: center; margin-top: 6px; }
.pp-tag-input {
	flex: 1; min-width: 0;
	background: rgba(255,255,255,0.03);
	border: 1px solid var(--border);
	border-radius: 6px;
	padding: 5px 10px;
	font-size: 12px; color: var(--text-h);
	font-family: inherit;
	transition: border-color 0.15s;
}
.pp-tag-input::placeholder { color: rgba(255,255,255,0.2); }
.pp-tag-input:focus { outline: none; border-color: var(--accent); }
.pp-tag-btn {
	background: var(--accent-bg);
	border: 1px solid var(--accent-border);
	color: var(--accent);
	border-radius: 6px; padding: 5px 11px;
	font-size: 11px; font-weight: 700;
	cursor: pointer; flex-shrink: 0;
	transition: background 0.15s;
}
.pp-tag-btn:hover { background: rgba(var(--accent-rgb),0.22); }

.pp-color-row {
	display: flex;
	gap: 6px;
	flex-wrap: wrap;
	margin-top: 8px;
}

.pp-color-chip {
	width: 20px;
	height: 20px;
	border-radius: 999px;
	border: 1px solid rgba(255, 255, 255, 0.28);
	cursor: pointer;
	padding: 0;
	transition: transform 0.12s ease, box-shadow 0.12s ease;
}

.pp-color-chip:hover {
	transform: translateY(-1px);
}

.pp-color-chip.active {
	box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.22);
}

/* ── Section ── */
.pp-section { padding: 0 20px; margin-top: 20px; }
.pp-section-header {
	display: flex; align-items: center; justify-content: space-between;
	padding-bottom: 8px;
	border-bottom: 1px solid var(--border);
	margin-bottom: 12px;
}
.pp-section-title {
	font-size: 11px; font-weight: 700;
	letter-spacing: 0.08em; text-transform: uppercase;
	color: var(--text);
}
.pp-section-note {
	font-size: 11px;
	line-height: 1.45;
	color: var(--text);
	margin-bottom: 10px;
}
.pp-section-count {
	font-size: 11px; color: #4b5563;
	background: rgba(255,255,255,0.04);
	border-radius: 10px; padding: 1px 7px;
}

/* ── Form fields ── */
.pp-field { display: flex; flex-direction: column; gap: 4px; }
.pp-field-label {
	font-size: 10px; font-weight: 700;
	letter-spacing: 0.07em; text-transform: uppercase;
	color: #6b7280;
}
.pp-input, .pp-textarea {
	background: rgba(255,255,255,0.03);
	border: 1px solid var(--border);
	border-radius: 7px;
	padding: 8px 10px;
	font-size: 13px; color: var(--text-h);
	width: 100%; box-sizing: border-box;
	font-family: inherit;
	transition: border-color 0.15s, background 0.15s;
}
.pp-textarea { resize: vertical; }
.pp-input::placeholder, .pp-textarea::placeholder { color: rgba(255,255,255,0.18); }
.pp-input:focus, .pp-textarea:focus {
	outline: none;
	border-color: var(--accent);
	background: rgba(var(--accent-rgb),0.05);
}
.pp-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.pp-fields-stack { display: flex; flex-direction: column; gap: 10px; }

/* ── Contact row ── */
.pp-contact-field { display: flex; gap: 6px; align-items: center; }
.pp-contact-field .pp-input { flex: 1; min-width: 0; }
.pp-clear-btn {
	background: none;
	border: 1px solid var(--border);
	border-radius: 6px;
	padding: 7px 10px;
	font-size: 11px;
	color: #6b7280;
	cursor: pointer;
	flex-shrink: 0;
	transition: all 0.15s;
	white-space: nowrap;
}
.pp-clear-btn:hover { color: var(--text-h); border-color: #4b5563; }

/* ── Timeline ── */
.pp-event {
	border: 1px solid var(--border);
	border-radius: 8px;
	padding: 10px 12px;
	background: rgba(255,255,255,0.02);
	display: flex; align-items: flex-start;
	gap: 10px;
	margin-bottom: 6px;
}
.pp-event-dot {
	width: 6px; height: 6px; border-radius: 50%;
	background: var(--accent);
	flex-shrink: 0; margin-top: 5px;
}
.pp-event-content { flex: 1; min-width: 0; }
.pp-event-date { font-size: 11px; color: var(--accent); font-weight: 600; margin-bottom: 2px; }
.pp-event-note { font-size: 12px; color: var(--text-h); white-space: pre-wrap; line-height: 1.5; }
.pp-event-del {
	background: none; border: none;
	color: #4b5563; cursor: pointer;
	font-size: 16px; line-height: 1;
	padding: 0; flex-shrink: 0;
	transition: color 0.1s;
}
.pp-event-del:hover { color: #ef4444; }

/* ── Connections ── */
.pp-connection {
	display: flex; align-items: center;
	gap: 10px;
	padding: 8px 10px;
	border: 1px solid var(--border);
	border-radius: 8px;
	background: rgba(255,255,255,0.02);
	margin-bottom: 6px;
}
.pp-conn-avatar {
	width: 28px; height: 28px; border-radius: 50%;
	background: linear-gradient(135deg, #1e3a5f, #3b0764);
	display: flex; align-items: center; justify-content: center;
	font-size: 11px; font-weight: 700; color: #93c5fd;
	flex-shrink: 0;
}
.pp-conn-info { flex: 1; min-width: 0; }
.pp-conn-name { font-size: 12px; font-weight: 600; color: var(--text-h); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pp-conn-type { font-size: 10px; color: #6b7280; margin-top: 1px; }
.pp-conn-actions { display: flex; gap: 5px; flex-shrink: 0; }
.pp-conn-btn {
	background: none;
	border: 1px solid var(--border);
	border-radius: 5px; padding: 3px 8px;
	font-size: 11px; font-weight: 600;
	cursor: pointer; transition: all 0.15s;
	color: var(--text);
}
.pp-conn-btn:hover { background: rgba(255,255,255,0.05); color: var(--text-h); }
.pp-conn-btn.danger:hover { color: #ef4444; border-color: rgba(239,68,68,0.3); background: rgba(239,68,68,0.06); }

/* ── Selects ── */
.pp-select {
	appearance: none;
	background: rgba(255,255,255,0.03);
	border: 1px solid var(--border);
	border-radius: 7px;
	padding: 8px 30px 8px 10px;
	font-size: 13px; color: var(--text-h);
	width: 100%; cursor: pointer;
	font-family: inherit;
	background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%239ca3af' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
	background-repeat: no-repeat;
	background-position: right 10px center;
	transition: border-color 0.15s;
}
.pp-select:focus { outline: none; border-color: var(--accent); }

/* ── Buttons ── */
.pp-btn-primary {
	background: var(--accent);
	border: none; border-radius: 7px;
	padding: 9px 16px;
	font-size: 12px; font-weight: 700; color: #fff;
	cursor: pointer; width: 100%;
	transition: filter 0.15s;
	font-family: inherit;
}
.pp-btn-primary:hover { filter: brightness(1.1); }
.pp-btn-primary:disabled { opacity: 0.4; cursor: not-allowed; filter: none; }
.pp-btn-secondary {
	background: rgba(255,255,255,0.04);
	border: 1px solid var(--border);
	border-radius: 7px;
	padding: 8px 14px;
	font-size: 12px; font-weight: 600; color: var(--text);
	cursor: pointer;
	transition: all 0.15s;
	font-family: inherit;
}
.pp-btn-secondary:hover { background: rgba(255,255,255,0.07); color: var(--text-h); }
.pp-btn-secondary:disabled { opacity: 0.4; cursor: not-allowed; }

/* ── Misc ── */
.pp-empty { font-size: 12px; color: #4b5563; font-style: italic; padding: 4px 0; }
.pp-radio-group { display: flex; gap: 14px; }
.pp-radio-label { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text); cursor: pointer; }
.pp-radio-label input { accent-color: var(--accent); }
.pp-checkbox-label { display: flex; align-items: center; gap: 7px; font-size: 12px; color: var(--text); cursor: pointer; }
.pp-checkbox-label input { accent-color: var(--accent); }
.pp-new-type-row { display: flex; gap: 6px; margin-top: 8px; }
.pp-new-type-row .pp-input { flex: 1; }
.pp-add-type-btn {
	background: var(--accent-bg);
	border: 1px solid var(--accent-border);
	color: var(--accent);
	border-radius: 7px; padding: 8px 12px;
	font-size: 11px; font-weight: 700;
	cursor: pointer; flex-shrink: 0;
	transition: background 0.15s;
	font-family: inherit;
}
.pp-add-type-btn:hover { background: rgba(var(--accent-rgb),0.22); }
.pp-add-type-btn:disabled { opacity: 0.4; cursor: not-allowed; }

/* Empty state */
.pp-empty-state {
	height: 100%; display: flex;
	flex-direction: column;
	align-items: center; justify-content: center;
	gap: 8px; padding: 24px;
}
.pp-empty-icon { font-size: 32px; opacity: 0.3; }
.pp-empty-text { font-size: 13px; color: #4b5563; text-align: center; }
`;

export default function PersonPanel() {
	const selectedPersonId = useAppStore((s) => s.selectedPersonId);
	const person = useLiveQuery<Person | undefined>(
		() => (selectedPersonId ? db.people.get(selectedPersonId) : undefined),
		[selectedPersonId],
	);

	return (
		<>
			<style>{PP_STYLES}</style>
			{!selectedPersonId || !person ? (
				<GlobalSettingsPanel />
			) : (
				<PersonEditor person={person} />
			)}
		</>
	);
}
