import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { nanoid } from "nanoid";

import { db } from "../db/db";
import { useAppStore } from "../store/useAppStore";
import type { Person, TimelineEvent, Relationship, Tag } from "../models/types";

import HeaderSection from "./PersonEditorParts/HeaderSection";
import DetailsSection from "./PersonEditorParts/DetailsSection";
import TimelineSection from "./PersonEditorParts/TimelineSection";
import ContactSection from "./PersonEditorParts/ContactSection";
import ConnectionsSection from "./PersonEditorParts/ConnectionsSection";
import AddConnectionSection from "./PersonEditorParts/AddConnectionSection";

import { DEFAULT_NODE_COLOR, isValidNodeColor } from "../utils/nodeColors";

import { sectionWrap } from "./PersonEditorParts/constants";
import {
	normalizeTag,
	deriveLocationNames,
	coerceEvents,
	coerceSocialArray,
} from "./PersonEditorParts/utils";

export default function PersonEditor({ person }: { person: Person }) {
	const selectedPersonId = useAppStore((s) => s.selectedPersonId);

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
	const [locationInput, setLocationInput] = useState("");
	const [newInterestInput, setNewInterestInput] = useState("");
	const containerRef = useRef<HTMLDivElement | null>(null);
	const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>(
		{},
	);
	const pendingPatches = useRef<Record<string, Partial<Person>>>({});
	const [selectedSavedEventId, setSelectedSavedEventId] = useState("");

	const findOrCreateTag = useCallback(
		async (rawName: string) => {
			const name = String(rawName ?? "").trim();
			if (!name) return null;

			const normalized = normalizeTag(name);
			const existing = (tags ?? []).find(
				(t) =>
					(
						String(t.normalized ?? "").trim() || String(t.name ?? "").trim()
					).toLowerCase() === normalized.toLowerCase(),
			);

			if (existing) return existing.id;

			const id = nanoid();
			await (db as any).tags.add({ id, name, normalized });
			return id;
		},
		[tags],
	);

	const ensureLocationTagIds = useCallback(
		async (location: string) => {
			const names = deriveLocationNames(location);
			const ids: string[] = [];

			for (const name of names) {
				const id = await findOrCreateTag(name);
				if (id) ids.push(id);
			}

			return ids;
		},
		[findOrCreateTag],
	);

	const commitPatch = useCallback(
		(patch: Partial<Person>) => {
			if (!selectedPersonId) return;

			setDraft((prev) => {
				if (!prev) return prev;

				const next = {
					...prev,
					...patch,
				};

				if (patch.socials) {
					(next as any).socials = {
						...((prev as any).socials ?? {}),
						...(patch.socials as any),
					};
				}

				return next;
			});

			void updatePerson(selectedPersonId, patch);
		},
		[selectedPersonId, updatePerson],
	);

	const commitPatchDebounced = useCallback(
		(key: string, patch: Partial<Person>, delay = 2000) => {
			if (!selectedPersonId) return;

			setDraft((prev) => {
				if (!prev) return prev;

				const next = {
					...prev,
					...patch,
				};

				if (patch.socials) {
					(next as any).socials = {
						...((prev as any).socials ?? {}),
						...(patch.socials as any),
					};
				}

				return next;
			});

			if (debounceTimers.current[key]) {
				clearTimeout(debounceTimers.current[key]);
			}

			pendingPatches.current[key] = patch;

			debounceTimers.current[key] = setTimeout(() => {
				void updatePerson(selectedPersonId, patch);
				delete debounceTimers.current[key];
				delete pendingPatches.current[key];
			}, delay);
		},
		[selectedPersonId, updatePerson],
	);

	const handleLocationChange = useCallback((value: string) => {
		setLocationInput(value);
	}, []);

	const handleSaveLocation = useCallback(async () => {
		try {
			const trimmed = String(locationInput ?? "").trim();
			commitPatch({ location: trimmed });

			if (!trimmed) return;

			const ids = await ensureLocationTagIds(trimmed);
			if (!ids || !ids.length) return;

			const currentInrete = Array.isArray(draftRef.current?.inrete)
				? (draftRef.current?.inrete as string[])
				: [];

			const next = Array.from(new Set([...(currentInrete ?? []), ...ids]));
			commitPatch({ inrete: next });
		} catch (error) {
			console.error("Failed saving location", error);
		}
	}, [locationInput, commitPatch, ensureLocationTagIds]);

	const handleRemoveLocation = useCallback(async () => {
		const previousLocation = String(draft?.location ?? "").trim();

		setLocationInput("");
		commitPatch({ location: "" });
		if (!previousLocation) return;

		const locationNames = deriveLocationNames(previousLocation).map((name) =>
			normalizeTag(name).toLowerCase(),
		);

		const locationTagIds: string[] = [];
		for (const tag of tags ?? []) {
			const normalized = String(
				tag.normalized ?? normalizeTag(tag.name),
			).toLowerCase();
			if (locationNames.includes(normalized)) {
				locationTagIds.push(tag.id);
			}
		}

		const remaining = (draft?.inrete ?? []).filter(
			(id) => !locationTagIds.includes(id),
		);

		commitPatch({ inrete: remaining });
		setDraft((prev) =>
			prev ? { ...prev, location: "", inrete: remaining } : prev,
		);
	}, [commitPatch, draft, tags]);

	useEffect(() => {
		if (!person) {
			setDraft(null);
			return;
		}

		const rawTagIds = Array.isArray((person as any).inrete)
			? (person as any).inrete
			: Array.isArray((person as any).tags)
				? (person as any).tags
				: [];

		const normalizedTags: string[] = Array.from(
			new Set(rawTagIds.map(String).filter(Boolean)),
		);

		const rawSocials =
			typeof (person as any).socials === "object" && (person as any).socials
				? ((person as any).socials as Record<string, unknown>)
				: {};

		const nextSocials: Record<string, string[]> = {};

		for (const [platform, rawValue] of Object.entries(rawSocials)) {
			nextSocials[platform] = coerceSocialArray(rawValue)
				.map((entry) => String(entry ?? "").trim())
				.filter(Boolean);
		}

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
			socials: nextSocials as any,
			events: coerceEvents((person as any).events),
		});
	}, [person]);

	useEffect(() => {
		if (!selectedPersonId) return;
		if (containerRef.current) {
			containerRef.current.scrollTop = 0;
		}
	}, [selectedPersonId]);

	useEffect(() => {
		const currentPersonId = selectedPersonId;
		return () => {
			const pendingEntries = Object.entries(debounceTimers.current);
			for (const [key, timer] of pendingEntries) {
				clearTimeout(timer);
				const patch = pendingPatches.current[key];
				if (currentPersonId && patch) {
					void updatePerson(currentPersonId, patch);
				}
			}
			debounceTimers.current = {};
			pendingPatches.current = {};
		};
	}, [selectedPersonId, updatePerson]);

	useEffect(() => {
		draftRef.current = draft;
	}, [draft]);

	useEffect(() => {
		setLocationInput(draft?.location ?? "");
	}, [draft?.location]);

	const handleAddInterest = useCallback(async () => {
		if (!draft) return;

		const raw = String(newInterestInput ?? "").trim();
		if (!raw) return;

		const normalized = normalizeTag(raw);
		if (!normalized) return;

		const existing = (tags ?? []).find(
			(tag) => (tag.normalized ?? normalizeTag(tag.name)) === normalized,
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
				setNewInterestInput("");
				return;
			}

			commitPatch({ inrete: [...(draft.inrete ?? []), tagId] });
			setNewInterestInput("");

			const others = (people ?? []).filter((p) => {
				if (p.id === draft.id) return false;
				const personTags = Array.isArray((p as any).inrete)
					? (p as any).inrete
					: [];
				return personTags.includes(tagId);
			});

			if (
				others.length > 0 &&
				confirm(
					`Found ${others.length} people with "${raw}". Link them as "shared_interest"?`,
				)
			) {
				try {
					addRelationshipType?.("shared_interest");
					for (const other of others) {
						await createRelationship(draft.id, other.id, "shared_interest");
					}
				} catch (error) {
					console.error(error);
				}
			}
		} catch (error) {
			console.error("Failed adding tag", error);
		}
	}, [
		addRelationshipType,
		commitPatch,
		createRelationship,
		draft,
		newInterestInput,
		people,
		tags,
	]);

	const eventsSorted = useMemo(() => {
		const list = draft?.events ?? [];
		const toKey = (event: TimelineEvent) =>
			event.kind === "range" ? event.startDate || "" : event.date || "";

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
			.filter((relationship) => {
				return relationship.from === draft.id || relationship.to === draft.id;
			})
			.map((relationship) => {
				const otherId =
					relationship.from === draft.id ? relationship.to : relationship.from;

				const other = (people ?? []).find((p) => p.id === otherId);

				return {
					id: relationship.id,
					otherId,
					otherName: other?.name ?? otherId,
					type: relationship.type,
				};
			});
	}, [relationships, draft?.id, people]);

	const addTimelineEvent = useCallback(
		(
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
		},
		[commitPatch, draft],
	);

	const addSavedEventToPerson = useCallback(
		(eventId: string) => {
			if (!draft) return;

			const event = (savedEvents ?? []).find((e: any) => e.id === eventId);
			if (!event) return;

			const timelineEvent: TimelineEvent = {
				id: nanoid(),
				kind: event.kind,
				note: event.note ?? event.title ?? "",
				date: event.date,
				startDate: event.startDate,
				endDate: event.endDate,
				sourceId: event.id,
			};

			commitPatch({ events: [...(draft.events ?? []), timelineEvent] });
		},
		[commitPatch, draft, savedEvents],
	);

	const deleteTimelineEvent = useCallback(
		(id: string) => {
			if (!draft) return;
			commitPatch({
				events: (draft.events ?? []).filter((event) => event.id !== id),
			});
		},
		[commitPatch, draft],
	);

	const removeTagAtIndex = useCallback(
		(index: number) => {
			if (!draft) return;
			commitPatch({
				inrete: (draft.inrete ?? []).filter((_, idx) => idx !== index),
			});
		},
		[commitPatch, draft],
	);

	const addSuggestedTag = useCallback(
		(tagId: string) => {
			if (!draft) return;
			if ((draft.inrete ?? []).includes(tagId)) {
				setNewInterestInput("");
				return;
			}

			commitPatch({
				inrete: [...(draft.inrete ?? []), tagId],
			});
			setNewInterestInput("");
		},
		[commitPatch, draft],
	);

	const handleDeletePerson = useCallback(() => {
		if (!draft) return;
		if (!confirm("Delete person and all their relationships?")) return;

		void (async () => {
			try {
				await db.transaction("rw", db.people, db.relationships, async () => {
					await db.relationships.where("from").equals(draft.id).delete();
					await db.relationships.where("to").equals(draft.id).delete();
					await db.people.delete(draft.id);
				});

				setSelectedPersonId(null);
			} catch (error) {
				console.error(error);
			}
		})();
	}, [draft, setSelectedPersonId]);

	const makeBidirectional = useCallback(
		async (otherId: string, type: string) => {
			if (!draft) return;

			try {
				const existing = await db.relationships
					.where("from")
					.equals(otherId)
					.filter((r: any) => r.to === draft.id)
					.first();

				if (existing) {
					if (existing.type === type) {
						window.alert("Already bidirectional.");
						return;
					}

					if (
						!confirm(
							`An inverse relationship exists with type "${existing.type}". Create a second inverse relationship with type "${type}"?`,
						)
					) {
						return;
					}
				}

				await createRelationship(otherId, draft.id, type);
				window.alert("Bidirectional relationship created.");
			} catch (error) {
				console.error("Failed creating inverse relationship", error);
				window.alert("Failed to create bidirectional relationship.");
			}
		},
		[createRelationship, draft],
	);

	const removeRelationship = useCallback((relationshipId: string) => {
		if (!confirm("Delete this relationship?")) return;
		void db.relationships.delete(relationshipId);
	}, []);

	if (!draft) return null;

	return (
		<div className="flex h-full w-full flex-col overflow-hidden text-[14px] text-[color:var(--text)]">
			<div
				ref={containerRef}
				className="flex-1 overflow-y-auto pb-8 [scrollbar-color:var(--border)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[color:var(--border)]">
				<HeaderSection
					draft={draft}
					tags={tags ?? []}
					yearsKnown={yearsKnown}
					newInterestInput={newInterestInput}
					setNewInterestInput={setNewInterestInput}
					onAddInterest={() => void handleAddInterest()}
					onRemoveTagAtIndex={removeTagAtIndex}
					onAddSuggestedTag={addSuggestedTag}
					onChangeNodeColor={(color) => commitPatch({ nodeColor: color })}
					onDeletePerson={handleDeletePerson}
				/>

				<div className={sectionWrap}>
					<DetailsSection draft={draft} onPatch={commitPatchDebounced} />
				</div>

				<div className={sectionWrap}>
					<TimelineSection
						events={eventsSorted}
						savedEvents={savedEvents ?? []}
						selectedSavedEventId={selectedSavedEventId}
						setSelectedSavedEventId={setSelectedSavedEventId}
						onDeleteEvent={deleteTimelineEvent}
						onAddSavedEvent={addSavedEventToPerson}
						onAddEvent={addTimelineEvent}
					/>
				</div>

				<div className={sectionWrap}>
					<ContactSection
						draft={draft}
						onPatch={commitPatchDebounced}
						onCommitPatch={commitPatch}
						onLocationChange={handleLocationChange}
						locationInput={locationInput}
						onSaveLocation={() => void handleSaveLocation()}
						onRemoveLocation={() => void handleRemoveLocation()}
						onAddSocial={(platform, raw) => {
							const key = String(platform ?? "").trim();
							const value = String(raw ?? "").trim();

							if (!key || !value) return;

							const currentSocials =
								(draftRef.current?.socials as Record<string, string[]>) ?? {};
							const existing = Array.isArray(currentSocials[key])
								? currentSocials[key]
								: [];

							if (
								existing.some(
									(entry: string) =>
										String(entry ?? "").trim().toLowerCase() ===
										value.toLowerCase(),
								)
							) {
								return;
							}

							commitPatch({
								socials: {
									...currentSocials,
									[key]: [...existing, value],
								} as any,
							});
						}}
						onRemoveSocial={(platform, index) => {
							const key = String(platform ?? "").trim();
							if (!key) return;

							const currentSocials =
								(draftRef.current?.socials as Record<string, string[]>) ?? {};
							const existing = Array.isArray(currentSocials[key])
								? [...currentSocials[key]]
								: [];

							if (index < 0 || index >= existing.length) return;

							existing.splice(index, 1);

							commitPatch({
								socials: {
									...currentSocials,
									[key]: existing,
								} as any,
							});
						}}
					/>
				</div>

				<div className={sectionWrap}>
					<ConnectionsSection
						connections={connections}
						onViewPerson={setSelectedPersonId}
						onMakeBidirectional={makeBidirectional}
						onRemoveRelationship={removeRelationship}
					/>
				</div>

				<div className={sectionWrap}>
					<AddConnectionSection
						people={people ?? []}
						currentId={draft.id}
						relationshipTypes={relationshipTypes ?? []}
						addRelationshipType={addRelationshipType}
						onCreate={async (toId, type) => {
							if (!selectedPersonId) return;
							try {
								await createRelationship(selectedPersonId, toId, type);
							} catch (error) {
								console.error("createRelationship failed", error);
							}
						}}
					/>
				</div>
			</div>
		</div>
	);
}