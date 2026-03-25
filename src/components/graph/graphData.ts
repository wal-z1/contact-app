import type { Event, Person, Relationship, Tag } from "../../models/types";
import type { EventOption, GraphLink, GraphNode } from "./types";
import { DEFAULT_NODE_COLOR } from "../../utils/nodeColors";

const inlineEventKey = (event: Record<string, unknown>) =>
	`inline:${String(event.kind ?? "date")}:${String(event.date ?? "")}:${String(event.startDate ?? "")}:${String(event.endDate ?? "")}:${String(event.note ?? "")}`;

const normalizeText = (value: unknown) => String(value ?? "").trim();

const normalizeTagName = (value: string) =>
	value.trim().toLowerCase().replace(/\s+/g, "_");

const resolveTagRecord = (
	rawTag: unknown,
	tagById: Map<string, Tag>,
): { id: string; name: string; normalized: string } | null => {
	const value = normalizeText(rawTag);
	if (!value) return null;

	const tag = tagById.get(value);
	const name = normalizeText(tag?.name) || value;
	const normalized = normalizeText(tag?.normalized) || normalizeTagName(name);
	const id = normalizeText(tag?.id) || normalized;

	return { id, name, normalized };
};

export function buildEventOptions(
	savedEvents: Event[],
	people: Person[],
): EventOption[] {
	const map = new Map<string, EventOption>();
	const seenLabels = new Set<string>();

	for (const event of savedEvents) {
		const title = String(event.title ?? "Saved event").trim();
		const dateKey = String(event.date ?? event.startDate ?? "").trim();
		const labelKey = `${title}||${dateKey}`.toLowerCase();
		if (seenLabels.has(labelKey)) continue;
		seenLabels.add(labelKey);
		map.set(`saved:${event.id}`, {
			id: `saved:${event.id}`,
			title,
		});
	}

	for (const person of people) {
		const events = Array.isArray(person.events) ? person.events : [];
		for (const event of events) {
			const base =
				event.kind === "range"
					? `${event.startDate ?? ""} -> ${event.endDate ?? ""}`
					: (event.date ?? "");
			const label = `${base} ${event.note ?? ""}`.trim() || "Event";

			if (event.sourceId) {
				const key = `saved:${event.sourceId}`;
				if (!map.has(key)) {
					// avoid showing duplicates by label if we already added a saved event
					const labelKey =
						`${label}||${event.date ?? event.startDate ?? ""}`.toLowerCase();
					if (!seenLabels.has(labelKey)) {
						seenLabels.add(labelKey);
						map.set(key, { id: key, title: label });
					}
				}
				continue;
			}

			const id = inlineEventKey(event as unknown as Record<string, unknown>);
			map.set(id, { id, title: label });
		}
	}

	return Array.from(map.values()).sort((a, b) =>
		a.title.localeCompare(b.title),
	);
}

export function buildGraphData(
	people: Person[],
	relationships: Relationship[],
	tags: Tag[],
	savedEvents: Event[],
	filters: { filterEventKey: string; filterTagId: string },
	nodeSizeCap = 100,
): { nodes: GraphNode[]; links: GraphLink[] } {
	let sourcePeople = people;

	if (filters.filterEventKey) {
		sourcePeople = sourcePeople.filter((person) => {
			const events = Array.isArray(person.events) ? person.events : [];
			return events.some((event) =>
				filters.filterEventKey.startsWith("saved:")
					? `saved:${event.sourceId ?? ""}` === filters.filterEventKey
					: inlineEventKey(event as unknown as Record<string, unknown>) ===
						filters.filterEventKey,
			);
		});
	}

	const tagById = new Map(tags.map((tag) => [tag.id, tag] as const));

	if (filters.filterTagId) {
		const selectedTag = tags.find((tag) => tag.id === filters.filterTagId);
		const selectedName = normalizeText(selectedTag?.name).toLowerCase();
		const selectedNormalized = normalizeText(
			selectedTag?.normalized ?? normalizeTagName(selectedName),
		).toLowerCase();

		sourcePeople = sourcePeople.filter((person) => {
			const personTags = Array.isArray(person.inrete) ? person.inrete : [];
			return personTags.some((rawTag) => {
				const value = normalizeText(rawTag);
				if (!value) return false;
				if (value === filters.filterTagId) return true;

				const lower = value.toLowerCase();
				if (lower === selectedName || lower === selectedNormalized) return true;

				const resolved = resolveTagRecord(rawTag, tagById);
				if (!resolved) return false;

				return (
					resolved.id === filters.filterTagId ||
					resolved.normalized === selectedNormalized ||
					resolved.name.toLowerCase() === selectedName
				);
			});
		});
	}

	const peopleMap = new Map(
		sourcePeople.map((person) => [person.id, person] as const),
	);
	const savedEventById = new Map(
		savedEvents.map((event) => [event.id, event] as const),
	);

	const personNodes: GraphNode[] = sourcePeople.map((person) => {
		const fullName = normalizeText(person.name);
		const firstName = fullName.split(/\s+/)[0] || fullName || "Unknown";
		const initial = firstName[0] ? firstName[0].toUpperCase() : "?";

		return {
			id: person.id,
			label: firstName,
			fullName,
			initial,
			color:
				typeof person.nodeColor === "string"
					? person.nodeColor
					: DEFAULT_NODE_COLOR,
			isTag: false,
			nodeType: "person",
			size: 24,
		};
	});

	const tagNodes = new Map<string, GraphNode>();
	const eventNodes = new Map<string, GraphNode>();
	const personIdsByTag = new Map<string, Set<string>>();
	const personIdsByEvent = new Map<string, Set<string>>();
	const links: GraphLink[] = [];
	const seenLinks = new Set<string>();

	for (const relationship of relationships) {
		if (!peopleMap.has(relationship.from) || !peopleMap.has(relationship.to)) {
			continue;
		}

		const key = `${relationship.from}->${relationship.to}:relationship`;
		if (seenLinks.has(key)) continue;
		seenLinks.add(key);

		links.push({
			source: relationship.from,
			target: relationship.to,
			kind: "relationship",
		});
	}

	for (const person of sourcePeople) {
		const rawTags = Array.isArray(person.inrete) ? person.inrete : [];
		const personSeenTags = new Set<string>();

		for (const rawTag of rawTags) {
			const resolved = resolveTagRecord(rawTag, tagById);
			if (!resolved) continue;

			const tagNodeId = `tag:${resolved.id}`;
			if (personSeenTags.has(tagNodeId)) continue;
			personSeenTags.add(tagNodeId);

			if (!tagNodes.has(tagNodeId)) {
				tagNodes.set(tagNodeId, {
					id: tagNodeId,
					label: resolved.name,
					fullName: resolved.name,
					initial: "#",
					isTag: true,
					nodeType: "tag",
					size: 18,
					connectedPersonIds: [],
				});
			}

			if (!personIdsByTag.has(tagNodeId)) {
				personIdsByTag.set(tagNodeId, new Set());
			}
			personIdsByTag.get(tagNodeId)?.add(person.id);

			const key = `${person.id}->${tagNodeId}:tag`;
			if (seenLinks.has(key)) continue;
			seenLinks.add(key);

			links.push({
				source: person.id,
				target: tagNodeId,
				kind: "tag",
			});
		}

		const events = Array.isArray(person.events) ? person.events : [];
		const personSeenEvents = new Set<string>();
		for (const event of events) {
			const eventKey = event.sourceId
				? `saved:${event.sourceId}`
				: inlineEventKey(event as unknown as Record<string, unknown>);
			const eventNodeId = `event:${eventKey}`;
			if (personSeenEvents.has(eventNodeId)) continue;
			personSeenEvents.add(eventNodeId);

			if (!eventNodes.has(eventNodeId)) {
				const saved = event.sourceId
					? savedEventById.get(event.sourceId)
					: undefined;
				const rangeLabel =
					event.kind === "range"
						? `${event.startDate ?? ""} - ${event.endDate ?? ""}`.trim()
						: String(event.date ?? "").trim();
				const inlineLabel = `${rangeLabel} ${event.note ?? ""}`.trim();
				const title =
					String(saved?.title ?? "").trim() || inlineLabel || "Event";

				eventNodes.set(eventNodeId, {
					id: eventNodeId,
					label: title,
					fullName: title,
					initial: "E",
					isTag: true,
					nodeType: "event",
					size: 18,
					connectedPersonIds: [],
				});
			}

			if (!personIdsByEvent.has(eventNodeId)) {
				personIdsByEvent.set(eventNodeId, new Set());
			}
			personIdsByEvent.get(eventNodeId)?.add(person.id);

			const linkKey = `${person.id}->${eventNodeId}:event`;
			if (seenLinks.has(linkKey)) continue;
			seenLinks.add(linkKey);
			links.push({
				source: person.id,
				target: eventNodeId,
				kind: "event",
			});
		}
	}

	const connectionCount = new Map<string, number>();
	for (const link of links) {
		connectionCount.set(
			link.source,
			(connectionCount.get(link.source) ?? 0) + 1,
		);
		connectionCount.set(
			link.target,
			(connectionCount.get(link.target) ?? 0) + 1,
		);
	}

	const sizedPersonNodes = personNodes.map((node) => {
		const c = connectionCount.get(node.id) ?? 0;
		return {
			...node,
			// allow nodes to grow larger when they have many connections
			size: Math.round(20 + Math.min(nodeSizeCap, c * 1.7)),
		};
	});

	const sizedTagNodes = Array.from(tagNodes.values())
		.map((node) => {
			const peopleCount = personIdsByTag.get(node.id)?.size ?? 0;
			return {
				...node,
				connectedPersonIds: Array.from(personIdsByTag.get(node.id) ?? []),
				// increase upper bound so tag nodes can become larger with more members
				size: Math.round(14 + Math.min(nodeSizeCap, peopleCount * 2.6)),
			};
		})
		.sort((a, b) => a.label.localeCompare(b.label));

	const sizedEventNodes = Array.from(eventNodes.values())
		.map((node) => {
			const peopleCount = personIdsByEvent.get(node.id)?.size ?? 0;
			return {
				...node,
				connectedPersonIds: Array.from(personIdsByEvent.get(node.id) ?? []),
				// increase upper bound so event nodes can become larger with more attendees
				size: Math.round(14 + Math.min(nodeSizeCap, peopleCount * 2.6)),
			};
		})
		.sort((a, b) => a.label.localeCompare(b.label));

	return {
		nodes: [...sizedPersonNodes, ...sizedTagNodes, ...sizedEventNodes],
		links,
	};
}
