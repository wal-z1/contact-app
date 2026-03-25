import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import { useAppStore } from "../store/useAppStore";
import { nanoid } from "nanoid";
import type { Person, TimelineEvent, Relationship, Tag } from "../models/types";
import SocialHandles from "./SocialHandles";
import EventModal from "./EventModal";
import AddEventForm from "./PersonPanel/AddEventForm";
import SelectTarget from "./PersonPanel/SelectTarget";
import {
	DEFAULT_NODE_COLOR,
	NODE_COLOR_OPTIONS,
	isValidNodeColor,
} from "../utils/nodeColors";

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

// ─── Component ────────────────────────────────────────────────────────────────
export default function PersonPanel() {
	const selectedPersonId = useAppStore((s) => s.selectedPersonId);

	const reviewMode = useAppStore((s) => s.reviewMode);
	const reviewNext = useAppStore((s) => s.reviewNext);

	const SOCIAL_PLATFORMS = [
		["instagram", "Instagram"],
		["linkedin", "LinkedIn"],
		["twitter", "Twitter/X"],
		["github", "GitHub"],
		["mastodon", "Mastodon"],
		["website", "Website"],
	] as const;

	const normalizeTag = (s: string) =>
		String(s ?? "")
			.trim()
			.toLowerCase()
			.replace(/\s+/g, "_");

	// derive location-based tag names from a freeform location string.
	// returns array like ["USA", "USA:TX"] when possible.
	const deriveLocationNames = (loc: string) => {
		const out: string[] = [];
		const raw = String(loc ?? "").trim();
		if (!raw) return out;
		const parts = raw
			.split(",")
			.map((p) => p.trim())
			.filter(Boolean);
		let country: string | undefined;
		let state: string | undefined;
		if (parts.length >= 3) {
			country = parts[parts.length - 1];
			state = parts[parts.length - 2];
		} else if (parts.length === 2) {
			const a = parts[0];
			const b = parts[1];
			if (/^[A-Za-z]{2,3}$/.test(b)) {
				state = b;
				country = "USA";
			} else {
				country = b;
				state = a;
			}
		} else {
			// single-part location — treat as country
			country = parts[0];
		}
		if (country) out.push(country);
		if (country && state) out.push(`${country}:${state}`);
		return out;
	};

	const findOrCreateTag = async (rawName: string) => {
		const name = String(rawName ?? "").trim();
		if (!name) return null;
		const normalized = normalizeTag(name);
		const existing = (tags ?? []).find(
			(t) =>
				(
					String(t.normalized ?? "").trim() || String(t.name ?? "").trim()
				).toLowerCase() === String(normalized).toLowerCase(),
		);
		if (existing) return existing.id;
		const id = nanoid();
		await (db as any).tags.add({ id, name, normalized });
		return id;
	};

	const ensureLocationTagIds = async (loc: string) => {
		const names = deriveLocationNames(loc);
		const ids: string[] = [];
		for (const n of names) {
			const id = await findOrCreateTag(n);
			if (id) ids.push(id);
		}
		return ids;
	};

	const handleLocationChange = (value: string) => {
		setDraft((prev) => (prev ? { ...prev, location: value } : prev));
		commitPatchDebounced("location", { location: value });
		const trimmed = String(value ?? "").trim();
		if (!trimmed) return;

		// debounce tag creation/attachment to avoid immediate DB writes while typing
		const key = "location-tags";
		if (debounceTimers.current[key]) clearTimeout(debounceTimers.current[key]);
		debounceTimers.current[key] = setTimeout(async () => {
			try {
				const ids = await ensureLocationTagIds(trimmed);
				if (!ids || ids.length === 0) return;
				const currentInrete = Array.isArray(draftRef.current?.inrete)
					? (draftRef.current!.inrete as string[])
					: [];
				const next = Array.from(new Set([...(currentInrete ?? []), ...ids]));
				commitPatchDebounced("inrete", { inrete: next }, 2000);
			} catch (e) {
				console.error("Failed ensuring location tags", e);
			}
		}, 2000) as unknown as ReturnType<typeof setTimeout>;
	};

	const handleClearLocation = async () => {
		const prevLoc = String(draft?.location ?? "").trim();
		// cancel pending location/tag timers so we don't re-add after clearing
		if (debounceTimers.current["location-tags"]) {
			clearTimeout(debounceTimers.current["location-tags"] as any);
			delete debounceTimers.current["location-tags"];
		}
		if (debounceTimers.current["inrete"]) {
			clearTimeout(debounceTimers.current["inrete"] as any);
			delete debounceTimers.current["inrete"];
		}
		commitPatch({ location: "" });
		if (!prevLoc) return;
		// find tag ids for the derived location names and remove them from inrete
		const locNames = deriveLocationNames(prevLoc).map((s) =>
			normalizeTag(s).toLowerCase(),
		);
		const locTagIds: string[] = [];
		for (const t of tags ?? []) {
			const n = String(t.normalized ?? normalizeTag(t.name)).toLowerCase();
			if (locNames.includes(n)) locTagIds.push(t.id);
		}
		const remaining = (draft?.inrete ?? []).filter(
			(id) => !locTagIds.includes(id),
		);
		commitPatch({ inrete: remaining });
		setDraft((prev) =>
			prev ? { ...prev, location: "", inrete: remaining } : prev,
		);
	};

	const normalizeHandle = (value: string) => {
		const trimmed = String(value ?? "").trim();
		if (!trimmed) return "";
		const withoutAt = trimmed.replace(/^@/, "");
		const withoutProtocol = withoutAt.replace(/^https?:\/\//i, "");
		const withoutDomain = withoutProtocol.replace(
			/^(?:[a-z0-9-]+\.)+[a-z]{2,}\//i,
			"",
		);
		return withoutDomain.split(/[?#]/)[0].trim();
	};

	const setSelectedPersonId = useAppStore((s) => s.setSelectedPersonId);
	const updatePerson = useAppStore((s) => s.updatePerson);
	const createRelationship = useAppStore((s) => s.createRelationship);
	const relationshipTypes = useAppStore((s) => s.relationshipTypes);
	const addRelationshipType = useAppStore((s) => s.addRelationshipType);

	const person = useLiveQuery<Person | undefined>(
		() => (selectedPersonId ? db.people.get(selectedPersonId) : undefined),
		[selectedPersonId],
	);
	const people = useLiveQuery<Person[]>(() => db.people.toArray(), []);
	const tags = useLiveQuery<Tag[]>(
		() => ((db as any).tags ? (db as any).tags.toArray() : []),
		[],
	);
	const relationships = useLiveQuery<Relationship[]>(
		() => db.relationships.toArray(),
		[],
	);
	const savedEvents = useLiveQuery(() => db.events.toArray(), []);

	// state for empty-state (global) edits
	const [newSavedTitle, setNewSavedTitle] = useState("");
	const [newSavedKind, setNewSavedKind] = useState<"date" | "range">("date");
	const [newSavedDate, setNewSavedDate] = useState("");
	const [newSavedStart, setNewSavedStart] = useState("");
	const [newSavedEnd, setNewSavedEnd] = useState("");
	const [newSavedNote, setNewSavedNote] = useState("");

	const [editingEventId, setEditingEventId] = useState<string | null>(null);
	const [editingEventDraft, setEditingEventDraft] = useState<any>(null);

	const [newTagName, setNewTagName] = useState("");
	const [editingTagId, setEditingTagId] = useState<string | null>(null);
	const [editingTagName, setEditingTagName] = useState("");

	const [draft, setDraft] = useState<Person | null>(null);
	const draftRef = useRef<Person | null>(null);
	const [newInrete, setNewInrete] = useState("");
	const containerRef = useRef<HTMLDivElement | null>(null);
	const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>(
		{},
	);

	useEffect(() => {
		if (!person) {
			setDraft(null);
			return;
		}

		const coerceSocialArray = (value: unknown): string[] => {
			if (Array.isArray(value))
				return value.map((v) => String(v)).filter(Boolean);
			if (typeof value === "string") return value ? [value] : [];
			return [];
		};

		const coerceEvents = (value: unknown): TimelineEvent[] => {
			if (!value || !Array.isArray(value)) return [];
			return value
				.map((e: any) => {
					if (!e || typeof e !== "object") return null;
					const kind = e.kind === "range" ? "range" : "date";
					const id = typeof e.id === "string" ? e.id : nanoid();
					const note = typeof e.note === "string" ? e.note : "";
					const date = typeof e.date === "string" ? e.date : undefined;
					const startDate =
						typeof e.startDate === "string" ? e.startDate : undefined;
					const endDate = typeof e.endDate === "string" ? e.endDate : undefined;
					const sourceId =
						typeof e.sourceId === "string" ? e.sourceId : undefined;
					return { id, kind, date, startDate, endDate, note, sourceId };
				})
				.filter(Boolean) as TimelineEvent[];
		};

		const rawTagIds = Array.isArray((person as any).inrete)
			? (person as any).inrete
			: Array.isArray((person as any).tags)
				? (person as any).tags
				: [];

		const normalizedTags: string[] = Array.from(
			new Set(rawTagIds.map(String).filter(Boolean)),
		);

		// include any existing location-derived tags (do not create yet)
		const locNames = deriveLocationNames(String(person.location ?? ""));
		const locIds: string[] = [];
		for (const n of locNames) {
			const normalized = normalizeTag(n);
			const found = (tags ?? []).find(
				(t) =>
					(
						String(t.normalized ?? "").trim() || String(t.name ?? "").trim()
					).toLowerCase() === String(normalized).toLowerCase(),
			);
			if (found) locIds.push(found.id);
		}

		const makeSocialList = (raw: unknown): string[] =>
			coerceSocialArray(raw).map(normalizeHandle).filter(Boolean);

		setDraft({
			...person,
			nodeColor: isValidNodeColor(person.nodeColor)
				? person.nodeColor
				: DEFAULT_NODE_COLOR,
			lore: person.lore ?? "",
			description: person.description ?? "",
			firstInteraction: person.firstInteraction ?? "",
			lastInteraction: person.lastInteraction ?? "",
			location: person.location ?? "",
			inrete: Array.from(new Set([...(normalizedTags ?? []), ...locIds])),
			socials: {
				instagram: makeSocialList((person.socials as any)?.instagram),
				linkedin: makeSocialList((person.socials as any)?.linkedin),
				twitter: makeSocialList((person.socials as any)?.twitter),
				github: makeSocialList((person.socials as any)?.github),
				mastodon: makeSocialList((person.socials as any)?.mastodon),
				website: makeSocialList((person.socials as any)?.website),
			},
			events: coerceEvents((person as any).events),
		});
	}, [person, tags]);

	useEffect(() => {
		if (!selectedPersonId) return;
		if (containerRef.current) containerRef.current.scrollTop = 0;
	}, [selectedPersonId]);

	const commitPatch = useCallback(
		(patch: Partial<Person>) => {
			if (!selectedPersonId) return;
			setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
			void updatePerson(selectedPersonId, patch);
		},
		[selectedPersonId, updatePerson],
	);

	const commitPatchDebounced = useCallback(
		(key: string, patch: Partial<Person>, delay = 2000) => {
			if (!selectedPersonId) return;
			setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
			if (debounceTimers.current[key]) {
				clearTimeout(debounceTimers.current[key]);
			}
			debounceTimers.current[key] = setTimeout(() => {
				void updatePerson(selectedPersonId, patch);
			}, delay);
		},
		[selectedPersonId, updatePerson],
	);

	useEffect(() => {
		return () => {
			Object.values(debounceTimers.current).forEach(clearTimeout);
			debounceTimers.current = {};
		};
	}, [selectedPersonId]);

	useEffect(() => {
		draftRef.current = draft;
	}, [draft]);

	const handleAddInrete = async () => {
		if (!draft) return;
		const raw = String(newInrete ?? "").trim();
		if (!raw) return;

		const normalized = normalizeTag(raw);
		if (!normalized) return;

		const existing = (tags ?? []).find(
			(t) => (t.normalized ?? normalizeTag(t.name)) === normalized,
		);

		let tagId: string;

		try {
			if (existing) {
				tagId = existing.id;
			} else {
				tagId = nanoid();
				await (db as any).tags.add({ id: tagId, name: raw, normalized });
			}

			if ((draft.inrete ?? []).includes(tagId)) {
				setNewInrete("");
				return;
			}

			commitPatch({ inrete: [...(draft.inrete ?? []), tagId] });
			setNewInrete("");

			const others = (people ?? []).filter((p) => {
				if (p.id === draft.id) return false;
				const pTags = Array.isArray((p as any).inrete) ? (p as any).inrete : [];
				return pTags.includes(tagId);
			});

			if (
				others.length > 0 &&
				confirm(
					`Found ${others.length} people with "${raw}". Link them as "shared_interest"?`,
				)
			) {
				try {
					addRelationshipType?.("shared_interest");
					for (const o of others) {
						await createRelationship(draft.id, o.id, "shared_interest");
					}
				} catch (e) {
					console.error(e);
				}
			}
		} catch (e) {
			console.error("Failed adding tag", e);
		}
	};

	const eventsSorted = useMemo(() => {
		const list = draft?.events ?? [];
		const toKey = (e: TimelineEvent) =>
			e.kind === "range" ? e.startDate || "" : e.date || "";
		return [...list].sort((a, b) => toKey(b).localeCompare(toKey(a)));
	}, [draft?.events]);

	const yearsKnown = useMemo(() => {
		if (!draft) return null;
		const now = new Date().getFullYear();
		const diff = now - (draft.year ?? now);
		return Number.isFinite(diff) ? diff : null;
	}, [draft?.year]);

	const connections = useMemo(() => {
		if (!draft) return [];
		return (relationships ?? [])
			.filter((r) => r.from === draft.id || r.to === draft.id)
			.map((r) => {
				const otherId = r.from === draft.id ? r.to : r.from;
				const other = (people ?? []).find((p) => p.id === otherId);
				return {
					id: r.id,
					otherId,
					otherName: other?.name ?? otherId,
					type: r.type,
				};
			});
	}, [relationships, draft?.id, people]);

	const addTimelineEvent = (
		note: string,
		kind = "date",
		date?: string,
		startDate?: string,
		endDate?: string,
	) => {
		if (!draft || !note.trim()) return;
		const newEvent: TimelineEvent = {
			id: nanoid(),
			kind: kind as any,
			note: note.trim(),
			date: kind === "date" ? date : undefined,
			startDate: kind === "range" ? startDate : undefined,
			endDate: kind === "range" ? endDate : undefined,
		};
		commitPatch({ events: [...(draft.events ?? []), newEvent] });
	};

	const [selectedSavedEventId, setSelectedSavedEventId] = useState("");

	const addSavedEventToPerson = (eventId: string) => {
		if (!draft) return;
		const ev = (savedEvents ?? []).find((e: any) => e.id === eventId);
		if (!ev) return;
		const te: TimelineEvent = {
			id: nanoid(),
			kind: ev.kind,
			note: ev.note ?? ev.title ?? "",
			date: ev.date,
			startDate: ev.startDate,
			endDate: ev.endDate,
			sourceId: ev.id,
		};
		commitPatch({ events: [...(draft.events ?? []), te] });
	};

	const deleteTimelineEvent = (id: string) => {
		if (!draft) return;
		commitPatch({ events: (draft.events ?? []).filter((e) => e.id !== id) });
	};

	if (!draft) {
		return (
			<>
				<style>{PP_STYLES}</style>
				<div className="pp-root">
					<div className="pp-scroll">
						<div className="pp-section">
							<div className="pp-section-header">
								<span className="pp-section-title">Saved events</span>
								<span className="pp-section-count">
									{(savedEvents ?? []).length}
								</span>
							</div>
							<p className="pp-section-note">
								Manage event templates stored in the database.
							</p>
							{(savedEvents ?? []).length === 0 ? (
								<p className="pp-empty">No saved events yet.</p>
							) : (
								<div
									style={{ display: "flex", flexDirection: "column", gap: 8 }}>
									{(savedEvents ?? []).map((ev: any) => (
										<div
											key={ev.id}
											style={{ display: "flex", alignItems: "center", gap: 8 }}>
											<div style={{ flex: 1 }}>
												<strong>{ev.title}</strong>
												<div style={{ fontSize: 12, color: "#9ca3af" }}>
													{ev.kind === "date"
														? ev.date
														: `${ev.startDate ?? ""} → ${ev.endDate ?? ""}`}
												</div>
											</div>
											<button
												className="pp-btn-secondary"
												onClick={() => {
													setEditingEventId(ev.id);
													setEditingEventDraft(ev);
												}}>
												Edit
											</button>
											<button
												className="pp-btn-secondary"
												onClick={() => {
													if (confirm("Delete saved event?"))
														void db.events.delete(ev.id);
												}}>
												Delete
											</button>
										</div>
									))}
								</div>
							)}

							{editingEventId && editingEventDraft && (
								<EventModal
									event={editingEventDraft}
									onClose={() => {
										setEditingEventId(null);
										setEditingEventDraft(null);
									}}
									onSave={async (updated) => {
										try {
											await db.events.update(editingEventId, updated as any);
										} catch (e) {
											console.error(e);
										}
									}}
								/>
							)}

							<div style={{ marginTop: 12 }}>
								<div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
									<input
										className="pp-input"
										placeholder="Title"
										value={newSavedTitle}
										onChange={(e) => setNewSavedTitle(e.target.value)}
									/>
									<select
										className="pp-select"
										value={newSavedKind}
										onChange={(e) => setNewSavedKind(e.target.value as any)}>
										<option value="date">date</option>
										<option value="range">range</option>
									</select>
								</div>
								{newSavedKind === "date" ? (
									<input
										type="date"
										className="pp-input"
										value={newSavedDate}
										onChange={(e) => setNewSavedDate(e.target.value)}
									/>
								) : (
									<div className="pp-grid-2">
										<input
											type="date"
											className="pp-input"
											value={newSavedStart}
											onChange={(e) => setNewSavedStart(e.target.value)}
										/>
										<input
											type="date"
											className="pp-input"
											value={newSavedEnd}
											onChange={(e) => setNewSavedEnd(e.target.value)}
										/>
									</div>
								)}
								<textarea
									className="pp-textarea"
									rows={2}
									placeholder="Note"
									value={newSavedNote}
									onChange={(e) => setNewSavedNote(e.target.value)}
								/>
								<div style={{ display: "flex", gap: 8 }}>
									<button
										className="pp-btn-primary"
										onClick={async () => {
											const ev: any = {
												id: nanoid(),
												title:
													newSavedTitle ||
													(newSavedKind === "date"
														? newSavedDate
														: `${newSavedStart} → ${newSavedEnd}`),
												kind: newSavedKind,
												date:
													newSavedKind === "date" ? newSavedDate : undefined,
												startDate:
													newSavedKind === "range" ? newSavedStart : undefined,
												endDate:
													newSavedKind === "range" ? newSavedEnd : undefined,
												note: newSavedNote || undefined,
											};
											try {
												await db.events.add(ev);
												setNewSavedTitle("");
												setNewSavedDate("");
												setNewSavedStart("");
												setNewSavedEnd("");
												setNewSavedNote("");
											} catch (e) {
												console.error(e);
											}
										}}>
										Add saved event
									</button>
									<button
										className="pp-btn-secondary"
										onClick={() => {
											setNewSavedTitle("");
											setNewSavedDate("");
											setNewSavedStart("");
											setNewSavedEnd("");
											setNewSavedNote("");
										}}>
										Clear
									</button>
								</div>
							</div>
						</div>

						<div className="pp-section" style={{ marginTop: 18 }}>
							<div className="pp-section-header">
								<span className="pp-section-title">Tags</span>
								<span className="pp-section-count">{(tags ?? []).length}</span>
							</div>
							<p className="pp-section-note">
								Manage global tags and their names. Deleting a tag will remove
								it from all people.
							</p>
							{(tags ?? []).length === 0 ? (
								<p className="pp-empty">No tags yet.</p>
							) : (
								<div
									style={{ display: "flex", flexDirection: "column", gap: 8 }}>
									{(tags ?? []).map((t) => (
										<div
											key={t.id}
											style={{ display: "flex", gap: 8, alignItems: "center" }}>
											{editingTagId === t.id ? (
												<>
													<input
														className="pp-input"
														value={editingTagName}
														onChange={(e) => setEditingTagName(e.target.value)}
													/>
													<button
														className="pp-btn-primary"
														onClick={async () => {
															try {
																await db.tags.update(t.id, {
																	name: editingTagName,
																	normalized: String(editingTagName)
																		.trim()
																		.toLowerCase()
																		.replace(/\s+/g, "_"),
																});
															} catch (e) {
																console.error(e);
															}
															setEditingTagId(null);
															setEditingTagName("");
														}}>
														Save
													</button>
													<button
														className="pp-btn-secondary"
														onClick={() => {
															setEditingTagId(null);
															setEditingTagName("");
														}}>
														Cancel
													</button>
												</>
											) : (
												<>
													<div style={{ flex: 1 }}>{t.name}</div>
													<button
														className="pp-btn-secondary"
														onClick={() => {
															setEditingTagId(t.id);
															setEditingTagName(t.name);
														}}>
														Rename
													</button>
													<button
														className="pp-btn-secondary"
														onClick={async () => {
															if (
																!confirm(
																	"Delete this tag and remove it from all people?",
																)
															)
																return;
															try {
																await db.transaction(
																	"rw",
																	db.tags,
																	db.people,
																	async () => {
																		await db.people
																			.toArray()
																			.then(async (peopleList) => {
																				for (const p of peopleList) {
																					const inrete = Array.isArray(
																						(p as any).inrete,
																					)
																						? (p as any).inrete.filter(
																								(id: string) => id !== t.id,
																							)
																						: [];
																					if (
																						inrete.length !==
																						((p as any).inrete ?? []).length
																					) {
																						await db.people.update(p.id, {
																							inrete,
																						});
																					}
																				}
																			});
																		await db.tags.delete(t.id);
																	},
																);
															} catch (e) {
																console.error(e);
															}
														}}>
														Delete
													</button>
												</>
											)}
										</div>
									))}
								</div>
							)}

							<div style={{ marginTop: 8, display: "flex", gap: 8 }}>
								<input
									className="pp-input"
									placeholder="New tag name"
									value={newTagName}
									onChange={(e) => setNewTagName(e.target.value)}
								/>
								<button
									className="pp-btn-primary"
									onClick={async () => {
										const name = String(newTagName ?? "").trim();
										if (!name) return;
										try {
											await (db as any).tags.add({
												id: nanoid(),
												name,
												normalized: name.toLowerCase().replace(/\s+/g, "_"),
											});
											setNewTagName("");
										} catch (e) {
											console.error(e);
										}
									}}>
									Add tag
								</button>
							</div>
						</div>
					</div>
				</div>
			</>
		);
	}

	return (
		<>
			<style>{PP_STYLES}</style>
			<div className="pp-root">
				<div className="pp-scroll" ref={containerRef}>
					<div className="pp-hero">
						<div
							className="pp-avatar"
							style={{
								["--person-color" as any]:
									draft.nodeColor ?? DEFAULT_NODE_COLOR,
							}}>
							{draft.name ? draft.name.charAt(0).toUpperCase() : "?"}
						</div>
						<div className="pp-hero-info">
							<div className="pp-name">{draft.name || "Untitled"}</div>
							{draft.description && (
								<div className="pp-desc">{draft.description}</div>
							)}
							<div className="pp-meta">
								{draft.year && <span className="pp-badge">{draft.year}</span>}
								{yearsKnown != null && (
									<span className="pp-badge">{yearsKnown}y known</span>
								)}
								{(draft.inrete ?? []).map((tagId, i) => {
									const tag = (tags ?? []).find((t) => t.id === tagId);
									const label = tag ? tag.name : tagId;
									return (
										<span
											key={`${tagId}-${i}`}
											className="pp-badge pp-badge-accent">
											{label}
											<button
												type="button"
												className="pp-tag-remove"
												onClick={() =>
													commitPatch({
														inrete: (draft.inrete ?? []).filter(
															(_, idx) => idx !== i,
														),
													})
												}
												aria-label="Remove tag">
												×
											</button>
										</span>
									);
								})}
							</div>
							<div className="pp-tag-input-row">
								<input
									className="pp-tag-input"
									placeholder="Add tag…"
									value={newInrete}
									onChange={(e) => setNewInrete(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === "Enter") {
											e.preventDefault();
											void handleAddInrete();
										}
									}}
								/>
								<button
									type="button"
									className="pp-tag-btn"
									aria-label="Add tag"
									title="Add tag"
									onClick={() => void handleAddInrete()}>
									+
								</button>
							</div>

							<div className="pp-color-row">
								{NODE_COLOR_OPTIONS.map((option) => {
									const active =
										(draft.nodeColor ?? DEFAULT_NODE_COLOR).toLowerCase() ===
										option.color.toLowerCase();
									return (
										<button
											key={option.id}
											type="button"
											title={option.label}
											aria-label={`Node color ${option.label}`}
											className={`pp-color-chip ${active ? "active" : ""}`}
											style={{ backgroundColor: option.color }}
											onClick={() => commitPatch({ nodeColor: option.color })}
										/>
									);
								})}
							</div>

							{(newInrete ?? "").trim().length > 0 &&
								(tags ?? []).length > 0 && (
									<div
										style={{
											marginTop: 6,
											display: "flex",
											gap: 6,
											flexWrap: "wrap",
										}}>
										{(tags ?? [])
											.filter((t) => {
												const q = normalizeTag(newInrete);
												const n = t.normalized ?? normalizeTag(t.name);
												return (
													n.includes(q) || t.name.toLowerCase().includes(q)
												);
											})
											.slice(0, 8)
											.map((t) => (
												<button
													key={t.id}
													type="button"
													className="pp-btn-secondary"
													title={`Add tag ${t.name}`}
													onClick={() => {
														if (!draft) return;
														if ((draft.inrete ?? []).includes(t.id)) {
															setNewInrete("");
															return;
														}
														commitPatch({
															inrete: [...(draft.inrete ?? []), t.id],
														});
														setNewInrete("");
													}}>
													{t.name}
												</button>
											))}
									</div>
								)}
						</div>
						<div className="pp-hero-actions">
							<button
								type="button"
								className="pp-delete-btn"
								onClick={() => {
									if (!confirm("Delete person and all their relationships?")) {
										return;
									}
									void (async () => {
										try {
											await db.transaction(
												"rw",
												db.people,
												db.relationships,
												async () => {
													await db.relationships
														.where("from")
														.equals(draft.id)
														.delete();
													await db.relationships
														.where("to")
														.equals(draft.id)
														.delete();
													await db.people.delete(draft.id);
												},
											);
											setSelectedPersonId(null);
										} catch (e) {
											console.error(e);
										}
									})();
								}}>
								Delete
							</button>
							{reviewMode && (
								<button
									type="button"
									className="pp-btn-primary"
									style={{ marginTop: 6 }}
									onClick={() => reviewNext()}>
									Save & Next
								</button>
							)}
						</div>
					</div>

					<div className="pp-section">
						<div className="pp-section-header">
							<span className="pp-section-title">Details</span>
						</div>
						<div className="pp-section-note">
							Keep this concise so cards and graph labels stay readable.
						</div>
						<div className="pp-fields-stack">
							<div className="pp-grid-2">
								<div className="pp-field">
									<label className="pp-field-label">Name</label>
									<input
										className="pp-input"
										value={draft.name ?? ""}
										onChange={(e) =>
											commitPatchDebounced("name", { name: e.target.value })
										}
									/>
								</div>
								<div className="pp-field">
									<label className="pp-field-label">Year met</label>
									<input
										type="number"
										className="pp-input"
										value={draft.year ?? ""}
										onChange={(e) => {
											const raw = e.target.value;
											if (!raw.trim()) {
												commitPatchDebounced("year", {
													year: undefined as any,
												});
												return;
											}
											const v = Number(raw);
											if (Number.isFinite(v)) {
												commitPatchDebounced("year", { year: v });
											}
										}}
									/>
								</div>
							</div>
							<div className="pp-field">
								<label className="pp-field-label">Description</label>
								<textarea
									className="pp-textarea"
									rows={2}
									value={draft.description ?? ""}
									onChange={(e) =>
										commitPatchDebounced("description", {
											description: e.target.value,
										})
									}
									placeholder="Short note…"
								/>
							</div>
							<div className="pp-field">
								<label className="pp-field-label">Lore</label>
								<textarea
									className="pp-textarea"
									rows={3}
									value={draft.lore ?? ""}
									onChange={(e) =>
										commitPatchDebounced("lore", { lore: e.target.value })
									}
									placeholder="Longer backstory…"
								/>
							</div>
							<div className="pp-grid-2">
								<div className="pp-field">
									<label className="pp-field-label">First interaction</label>
									<textarea
										className="pp-textarea"
										rows={2}
										value={draft.firstInteraction ?? ""}
										onChange={(e) =>
											commitPatchDebounced("firstInteraction", {
												firstInteraction: e.target.value,
											})
										}
									/>
								</div>
								<div className="pp-field">
									<label className="pp-field-label">Last interaction</label>
									<textarea
										className="pp-textarea"
										rows={2}
										value={draft.lastInteraction ?? ""}
										onChange={(e) =>
											commitPatchDebounced("lastInteraction", {
												lastInteraction: e.target.value,
											})
										}
									/>
								</div>
							</div>
						</div>
					</div>

					<div className="pp-section">
						<div className="pp-section-header">
							<span className="pp-section-title">Timeline</span>
							<span className="pp-section-count">
								{(draft.events ?? []).length}
							</span>
						</div>
						<div className="pp-section-note">
							Capture meaningful moments to make relationships easier to review.
						</div>

						{eventsSorted.length === 0 ? (
							<p className="pp-empty">No events recorded yet.</p>
						) : (
							eventsSorted.map((e) => {
								const label =
									e.kind === "range"
										? `${e.startDate ?? ""} → ${e.endDate ?? ""}`
										: (e.date ?? "");
								return (
									<div key={e.id} className="pp-event">
										<div className="pp-event-dot" />
										<div className="pp-event-content">
											<div className="pp-event-date">{label}</div>
											<div className="pp-event-note">{e.note}</div>
										</div>
										<button
											type="button"
											className="pp-event-del"
											onClick={() => deleteTimelineEvent(e.id)}
											aria-label="Delete event">
											×
										</button>
									</div>
								);
							})
						)}

						{(savedEvents ?? []).length > 0 && (
							<div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
								<select
									className="pp-select"
									style={{ flex: 1 }}
									value={selectedSavedEventId}
									onChange={(e) => setSelectedSavedEventId(e.target.value)}>
									<option value="">Add from saved event library…</option>
									{(savedEvents ?? []).map((ev: any) => (
										<option key={ev.id} value={ev.id}>
											{ev.title}{" "}
											{ev.date
												? `(${ev.date})`
												: ev.startDate
													? `(${ev.startDate})`
													: ""}
										</option>
									))}
								</select>
								<button
									type="button"
									className="pp-btn-secondary"
									style={{ padding: "8px 12px" }}
									aria-label="Add selected saved event"
									disabled={!selectedSavedEventId}
									onClick={() => {
										addSavedEventToPerson(selectedSavedEventId);
										setSelectedSavedEventId("");
									}}>
									Add
								</button>
							</div>
						)}

						<AddEventForm
							onAdd={(note, kind, date, start, end) =>
								addTimelineEvent(note, kind, date, start, end)
							}
						/>
					</div>

					<div className="pp-section">
						<div className="pp-section-header">
							<span className="pp-section-title">Contact & Socials</span>
						</div>
						<div className="pp-section-note">
							Store direct channels and keep handles clean for fast lookup.
						</div>
						<div className="pp-fields-stack" style={{ marginBottom: 14 }}>
							<div className="pp-grid-2">
								<div className="pp-field">
									<label className="pp-field-label">Email</label>
									<div className="pp-contact-field">
										<input
											className="pp-input"
											value={draft.email ?? ""}
											onChange={(e) =>
												commitPatchDebounced("email", { email: e.target.value })
											}
											placeholder="name@example.com"
										/>
										{draft.email && (
											<button
												type="button"
												className="pp-clear-btn"
												aria-label="Clear email"
												title="Clear email"
												onClick={() => commitPatch({ email: "" })}>
												✕
											</button>
										)}
									</div>
								</div>
								<div className="pp-field">
									<label className="pp-field-label">Phone</label>
									<div className="pp-contact-field">
										<input
											className="pp-input"
											value={draft.phone ?? ""}
											onChange={(e) =>
												commitPatchDebounced("phone", { phone: e.target.value })
											}
											placeholder="+1 555 000 0000"
										/>
										{draft.phone && (
											<button
												type="button"
												className="pp-clear-btn"
												aria-label="Clear phone"
												title="Clear phone"
												onClick={() => commitPatch({ phone: "" })}>
												✕
											</button>
										)}
									</div>
								</div>
							</div>
							<div className="pp-field">
								<label className="pp-field-label">Location</label>
								<div className="pp-contact-field">
									<input
										className="pp-input"
										value={draft.location ?? ""}
										onChange={(e) => handleLocationChange(e.target.value)}
										placeholder="City, Country"
									/>
									{draft.location && (
										<button
											type="button"
											className="pp-clear-btn"
											aria-label="Clear location"
											title="Clear location"
											onClick={() => handleClearLocation()}>
											✕
										</button>
									)}
								</div>
							</div>
						</div>

						<SocialHandles
							socials={draft.socials as Partial<Record<string, string[]>>}
							platforms={SOCIAL_PLATFORMS as any}
							onAdd={(platform, raw) => {
								const norm = normalizeHandle(raw);
								if (!norm) return;
								const existing = (draft.socials as any)?.[platform] ?? [];
								if (existing.includes(norm)) return;
								commitPatch({
									socials: {
										...(draft.socials as any),
										[platform]: [...existing, norm],
									} as any,
								});
							}}
							onRemove={(platform, idx) => {
								const existing = [
									...((draft.socials as any)?.[platform] ?? []),
								];
								existing.splice(idx, 1);
								commitPatch({
									socials: {
										...(draft.socials as any),
										[platform]: existing,
									} as any,
								});
							}}
						/>
					</div>

					<div className="pp-section">
						<div className="pp-section-header">
							<span className="pp-section-title">Connections</span>
							<span className="pp-section-count">{connections.length}</span>
						</div>
						<div className="pp-section-note">
							View linked people and remove stale relationships safely.
						</div>
						{connections.length === 0 ? (
							<p className="pp-empty">No connections yet.</p>
						) : (
							connections.map((c) => (
								<div key={c.id} className="pp-connection">
									<div className="pp-conn-avatar">
										{c.otherName.charAt(0).toUpperCase()}
									</div>
									<div className="pp-conn-info">
										<div className="pp-conn-name">{c.otherName}</div>
										<div className="pp-conn-type">{c.type}</div>
									</div>
									<div className="pp-conn-actions">
										<button
											type="button"
											className="pp-conn-btn"
											title={`View ${c.otherName}`}
											onClick={() => setSelectedPersonId(c.otherId)}>
											View
										</button>
										<button
											type="button"
											className="pp-conn-btn"
											onClick={async () => {
												if (!draft) return;
												try {
													const existing = await db.relationships
														.where("from")
														.equals(c.otherId)
														.filter((r: any) => r.to === draft.id)
														.first();
													if (existing) {
														if (existing.type === c.type) {
															window.alert("Already bidirectional.");
															return;
														}
														if (
															!confirm(
																`An inverse relationship exists with type "${existing.type}". Create a second inverse relationship with type "${c.type}"?`,
															)
														)
															return;
													}
													await createRelationship(c.otherId, draft.id, c.type);
													window.alert("Bidirectional relationship created.");
												} catch (e) {
													console.error(
														"Failed creating inverse relationship",
														e,
													);
													window.alert(
														"Failed to create bidirectional relationship.",
													);
												}
											}}>
											Make bidirectional
										</button>
										<button
											type="button"
											className="pp-conn-btn danger"
											onClick={() => {
												if (!confirm("Delete this relationship?")) return;
												void db.relationships.delete(c.id);
											}}>
											Remove
										</button>
									</div>
								</div>
							))
						)}
					</div>

					<div className="pp-section">
						<div className="pp-section-header">
							<span className="pp-section-title">Add connection</span>
						</div>
						<div className="pp-section-note">
							Create a new relationship from this person to another contact.
						</div>
						<SelectTarget
							people={people ?? []}
							currentId={draft.id}
							relationshipTypes={relationshipTypes ?? []}
							addRelationshipType={addRelationshipType}
							onCreate={async (toId, type) => {
								if (!selectedPersonId) return;
								try {
									await createRelationship(selectedPersonId, toId, type);
								} catch (e) {
									console.error("createRelationship failed", e);
								}
							}}
						/>
					</div>
				</div>
			</div>
		</>
	);
}
