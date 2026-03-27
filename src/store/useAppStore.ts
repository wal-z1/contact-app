import { create } from "zustand";
import { nanoid } from "nanoid";
import JSZip from "jszip";
import type {
	Event,
	Person,
	Relationship,
	RelationshipType,
	Socials,
	Tag,
} from "../models/types";
import { db } from "../db/db";
import { DEFAULT_NODE_COLOR } from "../utils/nodeColors";

type ActiveYear = number | "all";

export type Theme = {
	accent: string;
	bg: string;
	panelBg: string;
	border: string;
	text: string;
	textMuted: string;
};

export type PersonFormData = Omit<Person, "id" | "inrete"> & {
	inrete: string; // Raw comma-separated tags
};

// --- Formalized Backup Data Structures ---
interface SingleFileBackupV1 {
	version: 1;
	exportedAt: string;
	people: Person[];
	relationships: Relationship[];
	tags: Tag[];
	events: Event[];
}

// Updated AppState with smarter import/export signatures
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
	createPerson: (formData: PersonFormData) => Promise<string>;
	updatePerson: (id: string, patch: Partial<Person>) => Promise<void>;
	createRelationship: (
		from: string,
		to: string,
		type: RelationshipType,
	) => Promise<string>;

	// ENHANCED: New signatures for export/import
	exportBackup: (format?: "single-file" | "multi-file-zip") => Promise<string>;
	importBackup: (
		files: (Record<string, unknown> | SingleFileBackupV1)[],
	) => Promise<{
		added: number;
		updated: number;
		skipped: number;
		relationshipsImported: number;
		eventsImported: number;
		tagsImported: number;
	}>;

	rightPanelWidth: number;
	setRightPanelWidth: (w: number) => void;

	reviewMode: boolean;
	reviewList: string[];
	startManualReview: () => Promise<boolean>;
	stopManualReview: () => void;
	reviewPrev: () => void;
	reviewNext: () => void;

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

const deriveLocationNames = (location: string) => {
	const output: string[] = [];
	const raw = String(location ?? "").trim();
	if (!raw) return output;

	const parts = raw
		.split(",")
		.map((part) => part.trim())
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

	if (country) output.push(country);
	if (country && state) output.push(`${country}:${state}`);
	return output;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null;

const downloadBlob = (fileName: string, blob: Blob) => {
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = fileName;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
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

// --- Decomposed & Efficient Import Logic Helpers ---

async function importTags(
	importedTags: Tag[],
	tagsTable: typeof db.tags,
): Promise<{ idMap: Map<string, string>; stats: { added: number } }> {
	if (!importedTags.length) return { idMap: new Map(), stats: { added: 0 } };

	const existingTags = await tagsTable.toArray();
	const existingByNormalized = new Map(
		existingTags.map((t) => [t.normalized, t]),
	);
	const idMap = new Map<string, string>();
	const tagsToAdd: Tag[] = [];

	for (const tag of importedTags) {
		const existing = existingByNormalized.get(tag.normalized);
		if (existing) {
			idMap.set(tag.id, existing.id);
		} else {
			const newId = nanoid();
			idMap.set(tag.id, newId);
			tagsToAdd.push({ ...tag, id: newId });
			existingByNormalized.set(tag.normalized, { ...tag, id: newId });
		}
	}

	if (tagsToAdd.length > 0) {
		await tagsTable.bulkAdd(tagsToAdd);
	}

	return { idMap, stats: { added: tagsToAdd.length } };
}

async function importPeople(
	importedPeople: Person[],
	tagIdMap: Map<string, string>,
	peopleTable: typeof db.people,
): Promise<{ added: number; updated: number }> {
	if (!importedPeople.length) return { added: 0, updated: 0 };

	const peopleToPut = importedPeople.map((person) => ({
		...person,
		inrete: person.inrete
			.map((oldId) => tagIdMap.get(oldId))
			.filter((newId): newId is string => !!newId),
	}));

	const existingIds = new Set(
		(await peopleTable.bulkGet(peopleToPut.map((p) => p.id)))
			.filter(Boolean)
			.map((p) => p!.id),
	);

	await peopleTable.bulkPut(peopleToPut);

	const added = peopleToPut.filter((p) => !existingIds.has(p.id)).length;
	return { added, updated: peopleToPut.length - added };
}

async function importGeneric<T extends { id: string }>(
	items: T[],
	table: { bulkPut: (items: T[]) => any },
): Promise<{ imported: number }> {
	if (!items.length) return { imported: 0 };
	await table.bulkPut(items);
	return { imported: items.length };
}

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
		const trimmedLocation = String(formData.location ?? "").trim();

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

		for (const locationTagName of deriveLocationNames(trimmedLocation)) {
			const normalized = normalizeTag(locationTagName);
			const found = existingTags.find(
				(t) => (t.normalized ?? normalizeTag(t.name)) === normalized,
			);

			if (found) {
				tagIds.push(found.id);
				continue;
			}

			const id = nanoid();
			try {
				await db.tags.add({ id, name: locationTagName, normalized });
				existingTags.push({ id, name: locationTagName, normalized });
			} catch {
				// ignore duplicate write race
			}
			tagIds.push(id);
		}

		const uniqueTagIds = Array.from(new Set(tagIds));

		const personPayload: Omit<Person, "id"> = {
			name: formData.name.trim(),
			year: Number(formData.year) || initialYear,
			description: formData.description.trim(),
			firstInteraction: formData.firstInteraction.trim(),
			lastInteraction: formData.lastInteraction.trim(),
			lore: formData.lore.trim(),
			email: formData.email.trim(),
			phone: formData.phone.trim(),
			location: trimmedLocation,
			socials: formData.socials,
			inrete: uniqueTagIds,
			nodeColor: DEFAULT_NODE_COLOR,
			events: [],
		};

		const personId = nanoid();
		await db.people.add({ id: personId, ...personPayload });
		set({ selectedPersonId: personId });
		return personId;
	},

	exportBackup: async (format = "single-file") => {
		const [people, relationships, tags, events] = await Promise.all([
			db.people.toArray(),
			db.relationships.toArray(),
			db.tags.toArray(),
			db.events.toArray(),
		]);

		if (format === "multi-file-zip") {
			const zip = new JSZip();
			zip.file(
				"tags.json",
				JSON.stringify({ type: "tags", version: 1, data: tags }, null, 2),
			);
			zip.file(
				"people.json",
				JSON.stringify({ type: "people", version: 1, data: people }, null, 2),
			);
			zip.file(
				"relationships.json",
				JSON.stringify(
					{ type: "relationships", version: 1, data: relationships },
					null,
					2,
				),
			);
			zip.file(
				"events.json",
				JSON.stringify({ type: "events", version: 1, data: events }, null, 2),
			);

			const blob = await zip.generateAsync({ type: "blob" });
			downloadBlob("relationship-map-backup.zip", blob);
		} else {
			const backupData: SingleFileBackupV1 = {
				version: 1,
				exportedAt: new Date().toISOString(),
				people,
				relationships,
				tags,
				events,
			};
			const blob = new Blob([JSON.stringify(backupData, null, 2)], {
				type: "application/json",
			});
			downloadBlob("relationship-map-backup.json", blob);
		}

		return `Backup exported: ${people.length} people, ${relationships.length} relationships.`;
	},

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

	importBackup: async (files) => {
		let data: {
			people: Person[];
			relationships: Relationship[];
			tags: Tag[];
			events: Event[];
		} = { people: [], relationships: [], tags: [], events: [] };

		if (files.length === 1 && "people" in files[0] && "version" in files[0]) {
			const backup = files[0] as SingleFileBackupV1;
			data = {
				people: backup.people || [],
				relationships: backup.relationships || [],
				tags: backup.tags || [],
				events: backup.events || [],
			};
		} else {
			for (const file of files) {
				if (
					isRecord(file) &&
					typeof file.type === "string" &&
					Array.isArray(file.data)
				) {
					switch (file.type) {
						case "tags":
							data.tags = file.data as Tag[];
							break;
						case "people":
							data.people = file.data as Person[];
							break;
						case "relationships":
							data.relationships = file.data as Relationship[];
							break;
						case "events":
							data.events = file.data as Event[];
							break;
					}
				}
			}
		}

		if (
			data.people.length === 0 &&
			data.tags.length === 0 &&
			data.relationships.length === 0 &&
			data.events.length === 0
		) {
			throw new Error("No valid data found in the provided file(s).");
		}

		const stats = {
			added: 0,
			updated: 0,
			skipped: 0,
			relationshipsImported: 0,
			eventsImported: 0,
			tagsImported: 0,
		};

		await db.transaction(
			"rw",
			db.people,
			db.tags,
			db.relationships,
			db.events,
			async () => {
				const { idMap, stats: tagStats } = await importTags(data.tags, db.tags);
				stats.tagsImported = tagStats.added;

				const peopleStats = await importPeople(data.people, idMap, db.people);
				stats.added = peopleStats.added;
				stats.updated = peopleStats.updated;

				const relStats = await importGeneric(
					data.relationships,
					db.relationships,
				);
				stats.relationshipsImported = relStats.imported;

				const eventStats = await importGeneric(data.events, db.events);
				stats.eventsImported = eventStats.imported;
			},
		);

		return stats;
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

	reviewMode: false,
	reviewList: [],
	startManualReview: async () => {
		const people = await db.people.orderBy("name").toArray();
		const ids = people.map((p) => p.id).filter(Boolean);
		if (!ids.length) {
			return false;
		}
		set({ reviewMode: true, reviewList: ids, selectedPersonId: ids[0] });
		return true;
	},
	stopManualReview: () => {
		set({ reviewMode: false, reviewList: [], selectedPersonId: null });
	},
	reviewPrev: () => {
		const state = get();
		const list = state.reviewList ?? [];
		const current = state.selectedPersonId;
		if (!current) return;
		const idx = list.findIndex((id) => id === current);
		if (idx > 0) {
			set({ selectedPersonId: list[idx - 1] });
		}
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
		set({ reviewMode: false, reviewList: [], selectedPersonId: null });
	},

	showLeftPanel: true,
	setShowLeftPanel: (v: boolean) => set({ showLeftPanel: Boolean(v) }),
	showRightPanel: true,
	setShowRightPanel: (v: boolean) => set({ showRightPanel: Boolean(v) }),
	showGraphControls: true,
	setShowGraphControls: (v: boolean) => set({ showGraphControls: Boolean(v) }),
}));
