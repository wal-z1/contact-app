import { create } from "zustand";
import { nanoid } from "nanoid";
import type {
	Event,
	Person,
	Relationship,
	RelationshipType,
	Socials,
	TimelineEvent,
	Tag,
} from "../models/types";
import { db } from "../db/db";
import { DEFAULT_NODE_COLOR, isValidNodeColor } from "../utils/nodeColors";

type ActiveYear = number | "all";

export type Theme = {
	accent: string;
	bg: string;
	panelBg: string;
	border: string;
	text: string;
	textMuted: string;
};

// This type is derived from the form state in the original component
export type PersonFormData = Omit<Person, "id" | "inrete"> & {
	inrete: string; // Raw comma-separated tags
};

type AppState = {
	selectedPersonId: string | null;
	activeYear: ActiveYear;
	theme: Theme;

	relationshipTypes: RelationshipType[];
	addRelationshipType: (type: RelationshipType) => void;

	setSelectedPersonId: (id: string | null) => void;
	setActiveYear: (year: ActiveYear) => void;
	setTheme: (patch: Partial<Theme>) => void;

	addPerson: (overrides?: Partial<Omit<Person, "id">>) => Promise<string>;
	// NEW: Abstracted person creation logic
	createPerson: (formData: PersonFormData) => Promise<string>;
	// NEW: Abstracted export logic
	exportBackup: () => Promise<string>;
	updatePerson: (id: string, patch: Partial<Person>) => Promise<void>;
	createRelationship: (
		from: string,
		to: string,
		type: RelationshipType,
	) => Promise<string>;
	importPeopleFromJson: (raw: unknown) => Promise<{
		added: number;
		updated: number;
		skipped: number;
		relationshipsImported: number;
		eventsImported: number;
		tagsImported: number;
	}>;

	rightPanelWidth: number;
	setRightPanelWidth: (w: number) => void;

	// Manual review mode: walk through people sequentially
	reviewMode: boolean;
	reviewList: string[];
	startManualReview: () => Promise<void>;
	stopManualReview: () => void;
	reviewNext: () => void;

	// UI toggles
	showLeftPanel: boolean;
	setShowLeftPanel: (v: boolean) => void;
	showRightPanel: boolean;
	setShowRightPanel: (v: boolean) => void;
	showGraphControls: boolean;
	setShowGraphControls: (v: boolean) => void;
};

const defaultSocials = (): Socials => ({
	instagram: [],
	linkedin: [],
	twitter: [],
	github: [],
	mastodon: [],
	website: [],
});

const normalizeTag = (value: string) =>
	String(value ?? "")
		.trim()
		.toLowerCase()
		.replace(/\s+/g, "_");

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null;

const toStringValue = (value: unknown) =>
	typeof value === "string" ? value : "";

const parseStringList = (value: unknown): string[] => {
	if (Array.isArray(value)) {
		return value.map((entry) => String(entry ?? "").trim()).filter(Boolean);
	}
	if (typeof value === "string") {
		return value
			.split(",")
			.map((entry) => entry.trim())
			.filter(Boolean);
	}
	return [];
};

const parseSocials = (value: unknown): Socials => {
	const base = defaultSocials();
	if (!isRecord(value)) return base;
	return {
		instagram: parseStringList(value.instagram),
		linkedin: parseStringList(value.linkedin),
		twitter: parseStringList(value.twitter),
		github: parseStringList(value.github),
		mastodon: parseStringList(value.mastodon),
		website: parseStringList(value.website),
	};
};

const parseEvents = (value: unknown): TimelineEvent[] => {
	if (!Array.isArray(value)) return [];
	const parsed: TimelineEvent[] = [];
	for (const entry of value) {
		if (!isRecord(entry)) continue;
		const kind = entry.kind === "range" ? "range" : "date";
		const note = toStringValue(entry.note).trim();
		const date = toStringValue(entry.date).trim();
		const startDate = toStringValue(entry.startDate).trim();
		const endDate = toStringValue(entry.endDate).trim();
		const sourceId = toStringValue(entry.sourceId).trim();
		if (kind === "date" && !date && !note) continue;
		if (kind === "range" && !startDate && !endDate && !note) continue;
		parsed.push({
			id: toStringValue(entry.id).trim() || nanoid(),
			kind,
			note,
			date: kind === "date" ? date : undefined,
			startDate: kind === "range" ? startDate : undefined,
			endDate: kind === "range" ? endDate : undefined,
			sourceId: sourceId || undefined,
		});
	}
	return parsed;
};

const toImportRecords = (raw: unknown): Record<string, unknown>[] => {
	if (Array.isArray(raw)) return raw.filter(isRecord);
	if (!isRecord(raw)) return [];
	const people = raw.people;
	if (Array.isArray(people)) return people.filter(isRecord);
	return [];
};

const parseRelationships = (raw: unknown): Relationship[] => {
	if (!isRecord(raw) || !Array.isArray(raw.relationships)) return [];
	const parsed: Relationship[] = [];
	for (const entry of raw.relationships) {
		if (!isRecord(entry)) continue;
		const from = toStringValue(entry.from).trim();
		const to = toStringValue(entry.to).trim();
		const type = toStringValue(entry.type).trim();
		if (!from || !to || !type) continue;
		parsed.push({
			id: toStringValue(entry.id).trim() || nanoid(),
			from,
			to,
			type,
		});
	}
	return parsed;
};

const parseSavedEvents = (raw: unknown): Event[] => {
	if (!isRecord(raw) || !Array.isArray(raw.events)) return [];
	const parsed: Event[] = [];
	for (const entry of raw.events) {
		if (!isRecord(entry)) continue;
		const title = toStringValue(entry.title).trim();
		const kind = entry.kind === "range" ? "range" : "date";
		const date = toStringValue(entry.date).trim();
		const startDate = toStringValue(entry.startDate).trim();
		const endDate = toStringValue(entry.endDate).trim();
		if (!title && !date && !startDate && !endDate) continue;
		parsed.push({
			id: toStringValue(entry.id).trim() || nanoid(),
			title: title || "Event",
			kind,
			date: date || undefined,
			startDate: startDate || undefined,
			endDate: endDate || undefined,
			note: toStringValue(entry.note).trim() || undefined,
		});
	}
	return parsed;
};

const parseTags = (raw: unknown): Tag[] => {
	if (!isRecord(raw) || !Array.isArray(raw.tags)) return [];
	const parsed: Tag[] = [];
	for (const entry of raw.tags) {
		if (typeof entry === "string") {
			const name = entry.trim();
			if (!name) continue;
			parsed.push({
				id: nanoid(),
				name,
				normalized: normalizeTag(name),
			});
			continue;
		}
		if (!isRecord(entry)) continue;
		const name = toStringValue(entry.name).trim();
		if (!name) continue;
		const normalized = normalizeTag(
			toStringValue(entry.normalized).trim() || name,
		);
		parsed.push({
			id: toStringValue(entry.id).trim() || nanoid(),
			name,
			normalized,
		});
	}
	return parsed;
};

const getDefaultPersonValues = (activeYear: ActiveYear): Omit<Person, "id"> => {
	const year =
		typeof activeYear === "number" ? activeYear : new Date().getFullYear();
	return {
		name: "New Person",
		nodeColor: DEFAULT_NODE_COLOR,
		description: "",
		lore: "",
		firstInteraction: "",
		lastInteraction: "",
		inrete: [],
		year,
		email: "",
		phone: "",
		location: "",
		socials: defaultSocials(),
		events: [],
	};
};

function debounce<T extends (...args: any[]) => any>(fn: T, ms: number) {
	let timer: ReturnType<typeof setTimeout> | null = null;
	return (...args: Parameters<T>) => {
		if (timer) clearTimeout(timer);
		timer = setTimeout(() => {
			timer = null;
			fn(...args);
		}, ms);
	};
}

const updateDebounceMap = new Map<string, ReturnType<typeof debounce>>();

const getDebouncedUpdate = (id: string) => {
	if (!updateDebounceMap.has(id)) {
		updateDebounceMap.set(
			id,
			debounce(
				(patch: Partial<Person>) =>
					db.people.update(id, patch as Partial<Person>),
				350,
			),
		);
	}
	return updateDebounceMap.get(id)!;
};

// Helper to trigger browser download
const downloadJson = (fileName: string, payload: unknown) => {
	const blob = new Blob([JSON.stringify(payload, null, 2)], {
		type: "application/json",
	});
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = fileName;
	a.click();
	URL.revokeObjectURL(url);
};

export const useAppStore = create<AppState>((set, get) => ({
	selectedPersonId: null,
	activeYear: (() => {
		if (typeof window === "undefined") return "all";
		const raw = window.localStorage.getItem("relationship-map.startYear");
		if (!raw) return "all";
		const num = Number(raw);
		return Number.isFinite(num) ? num : "all";
	})(),
	theme: (() => {
		const defaults = {
			accent: "#c084fc",
			bg: "#0b1020",
			panelBg: "rgba(11,16,32,0.7)",
			border: "#2e303a",
			text: "#f3f4f6",
			textMuted: "#9ca3af",
		};
		if (typeof window === "undefined") return defaults;
		try {
			const raw = window.localStorage.getItem("relationship-map.theme");
			if (!raw) return defaults;
			const parsed = JSON.parse(raw) as Partial<Theme>;
			return {
				accent:
					typeof parsed.accent === "string" ? parsed.accent : defaults.accent,
				bg: typeof parsed.bg === "string" ? parsed.bg : defaults.bg,
				panelBg:
					typeof parsed.panelBg === "string"
						? parsed.panelBg
						: defaults.panelBg,
				border:
					typeof parsed.border === "string" ? parsed.border : defaults.border,
				text: typeof parsed.text === "string" ? parsed.text : defaults.text,
				textMuted:
					typeof parsed.textMuted === "string"
						? parsed.textMuted
						: defaults.textMuted,
			};
		} catch {
			return defaults;
		}
	})(),

	setSelectedPersonId: (id) => set({ selectedPersonId: id }),
	setActiveYear: (year) => {
		if (typeof window !== "undefined") {
			if (year === "all")
				window.localStorage.removeItem("relationship-map.startYear");
			else
				window.localStorage.setItem("relationship-map.startYear", String(year));
		}
		set({ activeYear: year });
	},

	setTheme: (patch) => {
		const next = { ...get().theme, ...(patch ?? {}) };
		set({ theme: next });
		if (typeof window !== "undefined") {
			window.localStorage.setItem(
				"relationship-map.theme",
				JSON.stringify(next),
			);
		}
	},

	relationshipTypes: (() => {
		const defaults: RelationshipType[] = [
			"friend",
			"studied_with",
			"met_at",
			"colleague",
			"family",
		];
		if (typeof window === "undefined") return defaults;
		try {
			const raw = window.localStorage.getItem(
				"relationship-map.relationshipTypes",
			);
			if (!raw) return defaults;
			const parsed = JSON.parse(raw);
			if (!Array.isArray(parsed)) return defaults;
			return parsed.map((v: any) => String(v));
		} catch {
			return defaults;
		}
	})(),

	addRelationshipType: (type) => {
		const t = String(type).trim();
		if (!t) return;
		set((state) => {
			if (state.relationshipTypes.includes(t)) return {};
			const next = [...state.relationshipTypes, t];
			if (typeof window !== "undefined") {
				try {
					window.localStorage.setItem(
						"relationship-map.relationshipTypes",
						JSON.stringify(next),
					);
				} catch {}
			}
			return { relationshipTypes: next };
		});
	},

	addPerson: async (overrides) => {
		const id = nanoid();
		const values = getDefaultPersonValues(get().activeYear);
		const person: Person = { id, ...values, ...(overrides ?? {}) };
		await db.people.add(person);
		set({ selectedPersonId: id });
		return id;
	},

	createPerson: async (formData: PersonFormData) => {
		const activeYear = get().activeYear;
		const initialYear =
			typeof activeYear === "number" ? activeYear : new Date().getFullYear();

		// Logic for finding or creating tags
		const requestedTags = formData.inrete
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean);

		const existingTags = await db.tags.toArray();
		const tagIds: string[] = [];

		for (const raw of requestedTags) {
			const normalized = normalizeTag(raw);
			const found = existingTags.find(
				(t) => (t.normalized ?? normalizeTag(t.name)) === normalized,
			);

			if (found) {
				tagIds.push(found.id);
				continue;
			}

			const id = nanoid();
			try {
				await db.tags.add({ id, name: raw, normalized });
			} catch {
				// ignore duplicate write race
			}
			tagIds.push(id);
		}

		// Create the final person object
		const personPayload: Omit<Person, "id"> = {
			name: formData.name.trim(),
			year: Number(formData.year) || initialYear,
			description: formData.description.trim(),
			firstInteraction: formData.firstInteraction.trim(),
			lastInteraction: formData.lastInteraction.trim(),
			lore: formData.lore.trim(),
			email: formData.email.trim(),
			phone: formData.phone.trim(),
			location: (formData.location ?? "").trim(),
			socials: formData.socials,
			inrete: tagIds,
			// Defaults for fields not in form
			nodeColor: DEFAULT_NODE_COLOR,
			events: [],
		};

		const personId = nanoid();
		await db.people.add({ id: personId, ...personPayload });
		set({ selectedPersonId: personId });
		return personId;
	},

	exportBackup: async () => {
		const [allPeople, allRelationships, allTags, allEvents] = await Promise.all(
			[
				db.people.toArray(),
				db.relationships.toArray(),
				db.tags.toArray(),
				db.events.toArray(),
			],
		);

		const tagsById = new Map<string, string>();
		for (const tag of allTags) {
			if (!tag?.id) continue;
			const normalized = String(tag.normalized ?? "").trim();
			const name = String(tag.name ?? "").trim();
			tagsById.set(tag.id, normalized || name);
		}

		const peopleForBackup = allPeople.map((person) => {
			const inreteIds = Array.isArray(person.inrete) ? person.inrete : [];
			const inrete = inreteIds
				.map((tagId) => tagsById.get(tagId) ?? String(tagId ?? "").trim())
				.filter(Boolean);
			return { ...person, inrete };
		});

		downloadJson("relationship-map-backup.json", {
			version: 1,
			exportedAt: new Date().toISOString(),
			people: peopleForBackup,
			relationships: allRelationships,
			tags: allTags,
			events: allEvents,
		});

		return `Backup exported: ${allPeople.length} people, ${allRelationships.length} relationships.`;
	},

	// Debounced at store level as a safety net; primary debouncing is in PersonPanel
	updatePerson: async (id, patch) => {
		const debouncedWrite = getDebouncedUpdate(id);
		debouncedWrite(patch);
	},

	createRelationship: async (from, to, type) => {
		const id = nanoid();
		const relationship: Relationship = { id, from, to, type };
		await db.relationships.add(relationship);
		return id;
	},

	importPeopleFromJson: async (raw) => {
		const records = toImportRecords(raw);
		if (records.length === 0) {
			throw new Error(
				"JSON must be an array of people or an object with a people array.",
			);
		}

		const activeYear = get().activeYear;
		const currentYear: number =
			typeof activeYear === "number" ? activeYear : new Date().getFullYear();

		let added = 0;
		let updated = 0;
		let skipped = 0;
		let relationshipsImported = 0;
		let eventsImported = 0;
		let tagsImported = 0;

		await db.transaction(
			"rw",
			db.people,
			db.tags,
			db.relationships,
			db.events,
			async () => {
				const tagsTable = db.tags;
				const existingTags = await tagsTable.toArray();
				const tagByNormalized = new Map<string, Tag>();
				const tagById = new Map<string, Tag>();
				const importedTagIdToResolvedId = new Map<string, string>();
				for (const tag of existingTags) {
					tagByNormalized.set(normalizeTag(tag.normalized ?? tag.name), tag);
					tagById.set(tag.id, tag);
				}

				const importedTags = parseTags(raw);
				for (const tag of importedTags) {
					const normalized = normalizeTag(tag.normalized ?? tag.name);
					if (!normalized) continue;
					const byNormalized = tagByNormalized.get(normalized);
					if (byNormalized) {
						if (tag.id) importedTagIdToResolvedId.set(tag.id, byNormalized.id);
						continue;
					}

					let nextId = tag.id || nanoid();
					if (tagById.has(nextId)) {
						nextId = nanoid();
					}

					const created: Tag = {
						id: nextId,
						name: tag.name,
						normalized,
					};
					await tagsTable.add(created);
					tagByNormalized.set(normalized, created);
					tagById.set(created.id, created);
					if (tag.id) importedTagIdToResolvedId.set(tag.id, created.id);
					tagsImported += 1;
				}

				for (const entry of records) {
					const name = toStringValue(entry.name).trim();
					if (!name) {
						skipped += 1;
						continue;
					}

					const rawId = toStringValue(entry.id).trim();
					const personId = rawId || nanoid();

					const parsedYear = Number(entry.year);
					const year = Number.isFinite(parsedYear) ? parsedYear : currentYear;

					const tagsInput = [
						...parseStringList(entry.inrete),
						...parseStringList(entry.tags),
					];
					const nextTagIds = new Set<string>();
					for (const rawTagRef of tagsInput) {
						const tagRef = String(rawTagRef ?? "").trim();
						if (!tagRef) continue;

						const resolvedImportedId = importedTagIdToResolvedId.get(tagRef);
						if (resolvedImportedId) {
							nextTagIds.add(resolvedImportedId);
							continue;
						}

						const byId = tagById.get(tagRef);
						if (byId) {
							nextTagIds.add(byId.id);
							continue;
						}

						const normalized = normalizeTag(tagRef);
						if (!normalized) continue;
						const existing = tagByNormalized.get(normalized);
						if (existing) {
							nextTagIds.add(existing.id);
							continue;
						}

						const id = nanoid();
						const created: Tag = { id, name: tagRef, normalized };
						await tagsTable.add(created);
						tagByNormalized.set(normalized, created);
						tagById.set(id, created);
						nextTagIds.add(id);
						tagsImported += 1;
					}

					const person: Person = {
						id: personId,
						name,
						nodeColor: isValidNodeColor(entry.nodeColor)
							? entry.nodeColor
							: DEFAULT_NODE_COLOR,
						year,
						description: toStringValue(entry.description).trim(),
						firstInteraction: toStringValue(entry.firstInteraction).trim(),
						lastInteraction: toStringValue(entry.lastInteraction).trim(),
						lore: toStringValue(entry.lore).trim(),
						email: toStringValue(entry.email).trim(),
						phone: toStringValue(entry.phone).trim(),
						location: toStringValue(entry.location).trim(),
						inrete: Array.from(nextTagIds),
						socials: parseSocials(entry.socials),
						events: parseEvents(entry.events),
					};

					const exists = await db.people.get(personId);
					if (exists) {
						await db.people.update(personId, person);
						updated += 1;
					} else {
						await db.people.add(person);
						added += 1;
					}
				}

				const importedEvents = parseSavedEvents(raw);
				for (const event of importedEvents) {
					const exists = await db.events.get(event.id);
					if (exists) {
						await db.events.update(event.id, event);
					} else {
						await db.events.add(event);
					}
					eventsImported += 1;
				}

				const importedRelationships = parseRelationships(raw);
				for (const relationship of importedRelationships) {
					const exists = await db.relationships.get(relationship.id);
					if (exists) {
						await db.relationships.update(relationship.id, relationship);
					} else {
						await db.relationships.add(relationship);
					}
					relationshipsImported += 1;
				}
			},
		);

		return {
			added,
			updated,
			skipped,
			relationshipsImported,
			eventsImported,
			tagsImported,
		};
	},

	rightPanelWidth: (() => {
		if (typeof window === "undefined") return 360;
		try {
			const raw = window.localStorage.getItem(
				"relationship-map.rightPanelWidth",
			);
			if (!raw) return 360;
			const n = Number(raw);
			return Number.isFinite(n) ? n : 360;
		} catch {
			return 360;
		}
	})(),

	setRightPanelWidth: (w) => {
		const next = Math.max(200, Math.min(900, Math.round(Number(w) || 360)));
		set({ rightPanelWidth: next });
		if (typeof window !== "undefined") {
			try {
				window.localStorage.setItem(
					"relationship-map.rightPanelWidth",
					String(next),
				);
			} catch {}
		}
	},

	// Manual review implementation
	reviewMode: false,
	reviewList: [],
	startManualReview: async () => {
		const people = await db.people.orderBy("name").toArray();
		const ids = people.map((p) => p.id).filter(Boolean);
		if (!ids.length) {
			if (typeof window !== "undefined") window.alert("No people to review.");
			return;
		}
		set({ reviewMode: true, reviewList: ids, selectedPersonId: ids[0] });
	},
	stopManualReview: () => {
		set({ reviewMode: false, reviewList: [], selectedPersonId: null });
	},
	reviewNext: () => {
		const state = get();
		const list = state.reviewList ?? [];
		const current = state.selectedPersonId;
		if (!current) return;
		const idx = list.findIndex((id) => id === current);
		if (idx < 0) return;
		if (idx + 1 < list.length) {
			set({ selectedPersonId: list[idx + 1] });
			return;
		}
		// finished
		set({ reviewMode: false, reviewList: [], selectedPersonId: null });
	},

	// UI toggles default to true
	showLeftPanel: true,
	setShowLeftPanel: (v: boolean) => set({ showLeftPanel: Boolean(v) }),
	showRightPanel: true,
	setShowRightPanel: (v: boolean) => set({ showRightPanel: Boolean(v) }),
	showGraphControls: true,
	setShowGraphControls: (v: boolean) => set({ showGraphControls: Boolean(v) }),
}));
