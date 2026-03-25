import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import { useAppStore } from "../store/useAppStore";
import { nanoid } from "nanoid";
import type { Person, TimelineEvent, Relationship, Tag } from "../models/types";
import SocialHandles from "./SocialHandles";
import AddEventForm from "./PersonPanel/AddEventForm";
import SelectTarget from "./PersonPanel/SelectTarget";
import {
	DEFAULT_NODE_COLOR,
	NODE_COLOR_OPTIONS,
	isValidNodeColor,
} from "../utils/nodeColors";

const SOCIAL_PLATFORMS = [
	["instagram", "Instagram"],
	["linkedin", "LinkedIn"],
	["twitter", "Twitter/X"],
	["github", "GitHub"],
	["mastodon", "Mastodon"],
	["website", "Website"],
] as const;

export default function PersonEditor({ person }: { person: Person }) {
	const selectedPersonId = useAppStore((s) => s.selectedPersonId);
	const reviewMode = useAppStore((s) => s.reviewMode);
	const reviewNext = useAppStore((s) => s.reviewNext);

	const setSelectedPersonId = useAppStore((s) => s.setSelectedPersonId);
	const updatePerson = useAppStore((s) => s.updatePerson);
	const createRelationship = useAppStore((s) => s.createRelationship);
	const relationshipTypes = useAppStore((s) => s.relationshipTypes);
	const addRelationshipType = useAppStore((s) => s.addRelationshipType);

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

	const [draft, setDraft] = useState<Person | null>(null);
	const draftRef = useRef<Person | null>(null);
	const [newInrete, setNewInrete] = useState("");
	const containerRef = useRef<HTMLDivElement | null>(null);
	const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>(
		{},
	);
	const [selectedSavedEventId, setSelectedSavedEventId] = useState("");

	const normalizeTag = (s: string) =>
		String(s ?? "")
			.trim()
			.toLowerCase()
			.replace(/\s+/g, "_");

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

	const handleLocationChange = (value: string) => {
		setDraft((prev) => (prev ? { ...prev, location: value } : prev));
		commitPatchDebounced("location", { location: value });
		const trimmed = String(value ?? "").trim();
		if (!trimmed) return;

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
			inrete: normalizedTags,
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

	if (!draft) return null;

	return (
		<div className="pp-root">
			<div className="pp-scroll" ref={containerRef}>
				<div className="pp-hero">
					<div
						className="pp-avatar"
						style={{
							["--person-color" as any]: draft.nodeColor ?? DEFAULT_NODE_COLOR,
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

						{(newInrete ?? "").trim().length > 0 && (tags ?? []).length > 0 && (
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
										return n.includes(q) || t.name.toLowerCase().includes(q);
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
											commitPatchDebounced("year", { year: undefined as any });
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
							const existing = [...((draft.socials as any)?.[platform] ?? [])];
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
	);
}
