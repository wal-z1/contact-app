import type { Person, Relationship, Tag } from "../models/types";
import dagre from "dagre";

// UPDATED TYPES
export type PersonNodeData = {
	personId: string;
	name: string;
	label: string;
	year: number;
	// inrete are tag display names (not ids) for rendering
	inrete: string[];
	initial: string;
};

export type GraphPathOptions = {
	borderRadius?: number;
	offset?: number;
};

export type GraphEdge = {
	id: string;
	source: string;
	target: string;
	label?: string;
	type?: string;
	pathOptions?: GraphPathOptions;
	style?: Record<string, string | number>;
};

export type GraphNode<T = unknown> = {
	id: string;
	type?: string;
	position: { x: number; y: number };
	data: T;
};

// ---------------- GRAPH UTILS ----------------
export function buildGraph(
	people: Person[],
	relationships: Relationship[],
	tags: Tag[] | undefined,
	view: "relationships" | "tags",
	opts: {
		selectedPersonId: string | null;
		activeYear: number | "all";
		themeAccent: string;
	},
): { nodes: GraphNode<any>[]; edges: GraphEdge[] } {
	const filteredPeople =
		typeof opts.activeYear === "number"
			? people.filter((p) => p.year === opts.activeYear)
			: people;

	// helper: map tag ids to display names
	const tagNameById = new Map<string, string>();
	(tags ?? []).forEach((t) => tagNameById.set(t.id, t.name));

	const personNodes: GraphNode<PersonNodeData>[] = filteredPeople.map((p) => ({
		id: p.id,
		type: "person",
		// position will be set by layout
		position: { x: 0, y: 0 },
		data: {
			personId: p.id,
			name: p.name,
			label:
				String(p.name ?? "")
					.trim()
					.split(/\s+/)[0] || p.name,
			year: p.year,
			inrete: Array.isArray((p as any).inrete)
				? (p as any).inrete.map((tid: string) => tagNameById.get(tid) ?? tid)
				: [],
			initial: p.name?.[0]?.toUpperCase() ?? "?",
		},
	}));

	const visibleRelationships = relationships.filter(
		(r) =>
			filteredPeople.some((p) => p.id === r.from) &&
			filteredPeople.some((p) => p.id === r.to),
	);

	// Merge duplicate relationship edges for the same direction to reduce visual stacking.
	const relByDirectedPair = new Map<
		string,
		{ from: string; to: string; types: Set<string>; idSeed: string }
	>();
	for (const r of visibleRelationships) {
		const key = `${r.from}->${r.to}`;
		const existing = relByDirectedPair.get(key);
		if (!existing) {
			relByDirectedPair.set(key, {
				from: r.from,
				to: r.to,
				types: new Set([r.type]),
				idSeed: r.id,
			});
			continue;
		}
		existing.types.add(r.type);
	}

	const relEdges: GraphEdge[] = Array.from(relByDirectedPair.values()).map(
		(v) => ({
			id: `rel:${v.idSeed}`,
			source: v.from,
			target: v.to,
			label: Array.from(v.types).join(", "),
			type: "smoothstep",
			pathOptions: { borderRadius: 24, offset: 20 },
		}),
	);

	// Add implicit links between people who share one or more tags.
	const peopleById = new Map(filteredPeople.map((p) => [p.id, p] as const));
	const sharedTagsByPair = new Map<string, Set<string>>();
	for (const p of filteredPeople) {
		const rawTags = Array.isArray((p as any).inrete) ? (p as any).inrete : [];
		const normalizedTags = rawTags
			.map((raw: unknown) => {
				const v = String(raw ?? "").trim();
				if (!v) return "";
				const byId = tagNameById.get(v);
				if (byId) return byId.toLowerCase();
				return v.toLowerCase().replace(/\s+/g, "_");
			})
			.filter(Boolean);
		for (const tag of normalizedTags) {
			for (const other of filteredPeople) {
				if (other.id === p.id) continue;
				const otherTags = Array.isArray((other as any).inrete)
					? (other as any).inrete
					: [];
				const otherHasTag = otherTags.some((raw: unknown) => {
					const v = String(raw ?? "").trim();
					if (!v) return false;
					const byId = tagNameById.get(v);
					const norm = (byId ? byId : v).toLowerCase().replace(/\s+/g, "_");
					return norm === tag;
				});
				if (!otherHasTag) continue;
				const a = p.id < other.id ? p.id : other.id;
				const b = p.id < other.id ? other.id : p.id;
				const key = `${a}__${b}`;
				if (!sharedTagsByPair.has(key)) sharedTagsByPair.set(key, new Set());
				sharedTagsByPair.get(key)!.add(tag);
			}
		}
	}

	const sharedTagEdges: GraphEdge[] = [];
	const sharedTagByUndirectedPair = new Map<string, string[]>();
	for (const [key, tagSet] of sharedTagsByPair) {
		const [a, b] = key.split("__");
		if (!peopleById.has(a) || !peopleById.has(b)) continue;
		const labels = Array.from(tagSet).slice(0, 2);
		sharedTagByUndirectedPair.set(key, labels);
		const hasRelationship = relEdges.some((e) => {
			const s = String(e.source);
			const t = String(e.target);
			return (s === a && t === b) || (s === b && t === a);
		});
		if (hasRelationship) continue;
		const label =
			labels.length > 1
				? `shared: ${labels.join(", ")}`
				: `shared: ${labels[0]}`;
		sharedTagEdges.push({
			id: `shared-tags:${a}:${b}`,
			source: a,
			target: b,
			label,
			type: "smoothstep",
			pathOptions: { borderRadius: 26, offset: 24 },
			style: { strokeDasharray: "6 5", opacity: 0.72 },
		});
	}

	// Annotate explicit relationship edges with shared tags when applicable.
	const relEdgesWithTags = relEdges.map((e) => {
		const s = String(e.source);
		const t = String(e.target);
		const key = s < t ? `${s}__${t}` : `${t}__${s}`;
		const shared = sharedTagByUndirectedPair.get(key);
		if (!shared || shared.length === 0) return e;
		const tagPart = shared.join(", ");
		return {
			...e,
			label: `${String(e.label ?? "")} | tags: ${tagPart}`,
		};
	});

	// Layout helper using dagre
	const applyLayout = (
		nodes: GraphNode<any>[],
		edges: GraphEdge[],
		direction: "LR" | "TB" = "TB",
		nodeSep = 170,
		rankSep = 240,
	) => {
		const g = new dagre.graphlib.Graph();
		g.setGraph({
			rankdir: direction,
			nodesep: nodeSep,
			ranksep: rankSep,
			marginx: 40,
			marginy: 40,
		});
		g.setDefaultEdgeLabel(() => ({}));

		// set node sizes by type for better spacing
		for (const n of nodes) {
			let w = 84;
			let h = 84;
			if (n.type === "tag") {
				w = 140;
				h = 50;
			}
			g.setNode(n.id, { width: w, height: h });
		}

		for (const e of edges) {
			try {
				g.setEdge(e.source, e.target);
			} catch {
				/* ignore */
			}
		}

		// run layout
		dagre.layout(g as any);

		// deterministic jitter so nodes look organic but remain stable between renders
		const hash01 = (value: string) => {
			let h = 2166136261;
			for (let i = 0; i < value.length; i += 1) {
				h ^= value.charCodeAt(i);
				h = Math.imul(h, 16777619);
			}
			return ((h >>> 0) % 1000) / 1000;
		};

		// apply positions and add slight jitter so nodes don't align perfectly
		const positioned = nodes.map((n) => {
			const v = g.node(n.id as string) as
				| { x: number; y: number; width: number; height: number }
				| undefined;
			if (!v) return n;
			const nodeW = v.width ?? (n.type === "tag" ? 140 : 84);
			const nodeH = v.height ?? (n.type === "tag" ? 50 : 84);
			const jitterX = (hash01(String(n.id)) - 0.5) * 40;
			const jitterY = (hash01(`${String(n.id)}:y`) - 0.5) * 24;
			return {
				...n,
				position: {
					x: Math.round(v.x - nodeW / 2 + jitterX),
					y: Math.round(v.y - nodeH / 2 + jitterY),
				},
			};
		});

		// spread disconnected components so the graph feels like separate clusters in space
		const adjacency = new Map<string, Set<string>>();
		for (const n of positioned) adjacency.set(String(n.id), new Set());
		for (const e of edges) {
			const s = String(e.source);
			const t = String(e.target);
			if (!adjacency.has(s) || !adjacency.has(t)) continue;
			adjacency.get(s)!.add(t);
			adjacency.get(t)!.add(s);
		}
		const seen = new Set<string>();
		const componentByNode = new Map<string, number>();
		let comp = 0;
		for (const n of positioned) {
			const id = String(n.id);
			if (seen.has(id)) continue;
			const stack = [id];
			while (stack.length) {
				const cur = stack.pop()!;
				if (seen.has(cur)) continue;
				seen.add(cur);
				componentByNode.set(cur, comp);
				for (const nxt of adjacency.get(cur) ?? []) {
					if (!seen.has(nxt)) stack.push(nxt);
				}
			}
			comp += 1;
		}
		const componentShiftX = 720;
		const componentShiftY = 460;
		const withClusterOffsets = positioned.map((n) => {
			const i = componentByNode.get(String(n.id)) ?? 0;
			return {
				...n,
				position: {
					x: n.position.x + (i % 3) * componentShiftX,
					y: n.position.y + Math.floor(i / 3) * componentShiftY,
				},
			};
		});

		// improve edge appearance and separate parallel edges so they don't stack.
		const edgesByPair = new Map<string, GraphEdge[]>();
		for (const e of edges) {
			const s = String(e.source);
			const t = String(e.target);
			const key = s < t ? `${s}__${t}` : `${t}__${s}`;
			if (!edgesByPair.has(key)) edgesByPair.set(key, []);
			edgesByPair.get(key)!.push(e);
		}

		const styledEdges: GraphEdge[] = [];
		for (const pair of edgesByPair.values()) {
			const c = pair.length;
			for (let i = 0; i < c; i += 1) {
				const e = pair[i];
				const lane = i - (c - 1) / 2;
				const offset = 22 + Math.abs(lane) * 20;
				styledEdges.push({
					...e,
					type: "smoothstep",
					pathOptions: {
						borderRadius: 24 + Math.abs(lane) * 6,
						offset,
					},
					style: {
						stroke: opts.themeAccent,
						strokeWidth: 1.2,
						opacity: 0.95,
						...(e.style ?? {}),
					},
				});
			}
		}

		return { nodes: withClusterOffsets, edges: styledEdges };
	};

	// User asked for a single people network graph (no standalone tag nodes view).
	void view;
	return applyLayout(
		personNodes,
		[...relEdgesWithTags, ...sharedTagEdges],
		"TB",
		170,
		240,
	);
}
