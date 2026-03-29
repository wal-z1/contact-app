import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import type { Person } from "../models/types";

type SortKey = "tags" | "connections" | "events" | "name";

function fmtPct(n: number) {
	return `${(n * 100).toFixed(1)}%`;
}

export default function StatsPanel() {
	const [collapsed, setCollapsed] = useState(false);
	const [sortKey, setSortKey] = useState<SortKey>("tags");
	const [asc, setAsc] = useState(false);
	const [openConnectorId, setOpenConnectorId] = useState<string | null>(null);

	const snapshot = useLiveQuery<Record<string, any>>(async (): Promise<
		Record<string, any>
	> => {
		const people = (await db.people.toArray()) as Person[];
		const rels = await db.relationships.toArray();
		const tags = await db.tags.toArray();

		const totalPeople = people.length;
		const totalRelationships = rels.length;

		// ---------- Graph structure (connected components) ----------
		const adjacency = new Map<string, Set<string>>();
		for (const p of people) adjacency.set(p.id, new Set());
		for (const r of rels) {
			adjacency.get(r.from)?.add(r.to);
			adjacency.get(r.to)?.add(r.from);
		}

		const visited = new Set<string>();
		const components: Set<string>[] = [];
		for (const p of people) {
			if (!visited.has(p.id)) {
				const comp = new Set<string>();
				const stack = [p.id];
				visited.add(p.id);
				while (stack.length) {
					const current = stack.pop()!;
					comp.add(current);
					for (const neighbor of adjacency.get(current) || []) {
						if (!visited.has(neighbor)) {
							visited.add(neighbor);
							stack.push(neighbor);
						}
					}
				}
				components.push(comp);
			}
		}
		const componentCount = components.length;
		const largestComponentSize = Math.max(...components.map((c) => c.size), 0);
		const largestComponentPct = totalPeople
			? largestComponentSize / totalPeople
			: 0;

		// ---------- Tag usage ----------
		const tagUsage = new Map<
			string,
			{ id: string; name: string; count: number; people: Set<string> }
		>();
		for (const t of tags) {
			tagUsage.set(t.id, {
				id: t.id,
				name: t.name ?? String(t.id),
				count: 0,
				people: new Set(),
			});
		}

		let totalTagRefs = 0;
		for (const p of people) {
			const list = Array.isArray(p.inrete) ? p.inrete : [];
			totalTagRefs += list.length;
			for (const tid of list) {
				const entry = tagUsage.get(tid);
				if (entry) {
					entry.count++;
					entry.people.add(p.id);
				} else {
					tagUsage.set(tid, {
						id: tid,
						name: tid,
						count: 1,
						people: new Set([p.id]),
					});
				}
			}
		}

		const tagCounts = Array.from(tagUsage.values()).sort(
			(a, b) => b.count - a.count,
		);
		const unusedTags = Array.from(tagUsage.values()).filter(
			(t) => t.count === 0,
		).length;

		// ---------- Person stats ----------
		const personStats = people.map((p) => {
			const tagCount = Array.isArray(p.inrete) ? p.inrete.length : 0;
			const eventCount = Array.isArray(p.events) ? p.events.length : 0;
			const connectionCount = rels.filter(
				(r) => r.from === p.id || r.to === p.id,
			).length;
			// Relationship type diversity for this person
			const types = new Set(
				rels
					.filter((r) => r.from === p.id || r.to === p.id)
					.map((r) => r.type || "unknown"),
			);
			return {
				id: p.id,
				name: p.name || "(no name)",
				tagCount,
				eventCount,
				connectionCount,
				tags: Array.isArray(p.inrete) ? p.inrete : [],
				typeDiversity: types.size,
				year: p.year,
			};
		});

		const withTags = personStats.filter((p) => p.tagCount > 0).length;
		const withConnections = personStats.filter(
			(p) => p.connectionCount > 0,
		).length;
		const withEvents = personStats.filter((p) => p.eventCount > 0).length;
		const isolated = totalPeople - withConnections;
		const isolatedPct = totalPeople ? isolated / totalPeople : 0;

		const avgTagsPerPerson = totalPeople ? totalTagRefs / totalPeople : 0;
		const avgConnectionsPerPerson = totalPeople
			? (totalRelationships * 2) / totalPeople
			: 0;

		// Median degree
		const degrees = personStats
			.map((p) => p.connectionCount)
			.sort((a, b) => a - b);
		const medianDegree =
			degrees.length === 0
				? 0
				: degrees.length % 2
					? degrees[Math.floor(degrees.length / 2)]
					: (degrees[degrees.length / 2 - 1] + degrees[degrees.length / 2]) / 2;

		// Graph density
		const possibleRelationships =
			totalPeople > 1 ? (totalPeople * (totalPeople - 1)) / 2 : 0;
		const density = possibleRelationships
			? totalRelationships / possibleRelationships
			: 0;

		// Tag coverage concentration
		const top3Tags = tagCounts.slice(0, 3);
		const top10Tags = tagCounts.slice(0, 10);
		const peopleWithTop3Tags = new Set<string>();
		for (const tag of top3Tags) {
			tag.people.forEach((pid) => peopleWithTop3Tags.add(pid));
		}
		const top3Coverage = totalPeople
			? peopleWithTop3Tags.size / totalPeople
			: 0;
		const peopleWithTop10Tags = new Set<string>();
		for (const tag of top10Tags) {
			tag.people.forEach((pid) => peopleWithTop10Tags.add(pid));
		}
		const top10Coverage = totalPeople
			? peopleWithTop10Tags.size / totalPeople
			: 0;

		// Data completeness
		const unnamed = personStats.filter((p) => p.name === "(no name)").length;
		const missingYear = personStats.filter((p) => !p.year).length;
		const noEvents = totalPeople - withEvents;
		const unknownRelationshipTypes = rels.filter(
			(r) => !r.type || r.type === "unknown",
		).length;
		const danglingRelationships = rels.filter((r) => {
			const fromExists = people.some((p) => p.id === r.from);
			const toExists = people.some((p) => p.id === r.to);
			return !fromExists || !toExists;
		}).length;

		// Relationship type breakdown
		const typeCounts = new Map<string, number>();
		for (const r of rels) {
			const type = r.type || "unknown";
			typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
		}
		const relationshipTypes = Array.from(typeCounts.entries())
			.map(([type, count]) => ({ type, count }))
			.sort((a, b) => b.count - a.count);

		// Year distribution
		const yearCounts = new Map<number, number>();
		for (const p of people) {
			const year = p.year;
			if (year) yearCounts.set(year, (yearCounts.get(year) || 0) + 1);
		}
		const years = Array.from(yearCounts.entries())
			.map(([year, count]) => ({ year, count }))
			.sort((a, b) => b.year - a.year);

		// Top tags, connectors, events
		const topTags = tagCounts.slice(0, 12).map((t) => ({
			...t,
			pct: totalPeople ? t.count / totalPeople : 0,
		}));

		const topConnectors = [...personStats]
			.sort((a, b) => b.connectionCount - a.connectionCount)
			.slice(0, 12);

		// Build a plain object mapping person id -> list of connected people ({id,name,type})
		const connectionsByPerson: Record<
			string,
			{ id: string; name: string; type?: string }[]
		> = {};
		for (const p of people) connectionsByPerson[p.id] = [];
		for (const r of rels) {
			const type = r.type || "unknown";
			const fromName = people.find((x) => x.id === r.from)?.name || "(no name)";
			const toName = people.find((x) => x.id === r.to)?.name || "(no name)";
			if (!connectionsByPerson[r.from]) connectionsByPerson[r.from] = [];
			if (!connectionsByPerson[r.to]) connectionsByPerson[r.to] = [];
			connectionsByPerson[r.from].push({ id: r.to, name: toName, type });
			connectionsByPerson[r.to].push({ id: r.from, name: fromName, type });
		}

		const topEvents = [...personStats]
			.sort((a, b) => b.eventCount - a.eventCount)
			.slice(0, 12)
			.filter((p) => p.eventCount > 0);

		// Potential bridges: people with high degree and high diversity
		const bridgeCandidates = [...personStats]
			.sort(
				(a, b) =>
					b.typeDiversity +
					b.connectionCount -
					(a.typeDiversity + a.connectionCount),
			)
			.slice(0, 6);

		const tagCountsList = personStats.map((p) => p.tagCount);
		const maxTagsPerPerson = Math.max(...tagCountsList, 0);
		const minTagsPerPerson = Math.min(...tagCountsList, 0);

		const eventCountsList = personStats.map((p) => p.eventCount);
		const maxEventsPerPerson = Math.max(...eventCountsList, 0);
		const avgEventsPerPerson = totalPeople
			? eventCountsList.reduce((a, b) => a + b, 0) / totalPeople
			: 0;

		return {
			totalPeople,
			totalTags: tags.length,
			totalRelationships,
			isolated,
			isolatedPct,
			componentCount,
			largestComponentSize,
			largestComponentPct,
			density,
			medianDegree,
			avgTagsPerPerson,
			avgConnectionsPerPerson,
			withTags,
			withConnections,
			withEvents,
			topTags,
			topConnectors,
			topEvents,
			personStats,
			relationshipTypes,
			years,
			maxTagsPerPerson,
			minTagsPerPerson,
			maxEventsPerPerson,
			avgEventsPerPerson,
			unusedTags,
			peopleWithNoTags: totalPeople - withTags,
			avgUniqueTagsPerTaggedPerson: withTags ? totalTagRefs / withTags : 0,
			top3Coverage,
			top10Coverage,
			unnamed,
			missingYear,
			noRelationships: isolated,
			noEvents,
			unknownRelationshipTypes,
			danglingRelationships,
			bridgeCandidates,
			connectionsByPerson,
		};
	}, []);

	if (!snapshot) {
		return (
			<div className="px-5 py-3 text-xs text-[color:var(--text)] opacity-50">
				Loading stats…
			</div>
		);
	}

	const {
		totalPeople,
		totalTags,
		totalRelationships,
		isolated,
		isolatedPct,
		componentCount,
		largestComponentSize,
		largestComponentPct,
		density,
		medianDegree,
		avgTagsPerPerson,
		avgConnectionsPerPerson,
		withTags,
		withConnections,
		withEvents,
		topTags,
		topConnectors,
		topEvents,
		personStats,
		relationshipTypes,
		years,
		maxTagsPerPerson,
		minTagsPerPerson,
		maxEventsPerPerson,
		avgEventsPerPerson,
		unusedTags,
		peopleWithNoTags,
		avgUniqueTagsPerTaggedPerson,
		top3Coverage,
		top10Coverage,
		unnamed,
		missingYear,
		noRelationships,
		noEvents,
		unknownRelationshipTypes,
		danglingRelationships,
		bridgeCandidates,
		connectionsByPerson,
	} = snapshot;

	const maxTagCount = topTags[0]?.count ?? 1;

	const sorted = [...personStats].sort((a, b) => {
		let v = 0;
		if (sortKey === "tags") v = a.tagCount - b.tagCount;
		if (sortKey === "connections") v = a.connectionCount - b.connectionCount;
		if (sortKey === "events") v = a.eventCount - b.eventCount;
		if (sortKey === "name") v = a.name.localeCompare(b.name || "");
		return asc ? v : -v;
	});

	return (
		<div className="px-5 mt-[18px] pb-6 text-[14px] text-(--text)">
			{/* Header */}
			<div className="flex items-center justify-between pb-2 border-b border-(--border) mb-3">
				<span className="text-[11px] font-bold tracking-[0.08em] uppercase text-[color:var(--text)]">
					Node stats
				</span>
				<div className="flex items-center gap-2">
					<span className="text-[11px] text-[#4b5563] bg-white/5 rounded-[10px] py-[1px] px-[7px]">
						{totalPeople} people
					</span>
					<button
						onClick={() => setCollapsed((s) => !s)}
						className="text-[11px] text-[#4b5563] bg-white/5 rounded-[10px] py-[1px] px-[7px] cursor-pointer hover:bg-white/10 transition-colors duration-150">
						{collapsed ? "Show" : "Hide"}
					</button>
				</div>
			</div>

			{/* Summary line */}
			<p className="text-[11px] leading-[1.45] text-[color:var(--text)] mb-2.5">
				{totalTags} tags · {totalRelationships} relationships ·{" "}
				{avgTagsPerPerson.toFixed(2)} avg tags/person ·{" "}
				{avgConnectionsPerPerson.toFixed(2)} avg connections/person ·{" "}
				{fmtPct(withTags / Math.max(1, totalPeople))} tagged ·{" "}
				{fmtPct(withConnections / Math.max(1, totalPeople))} connected ·{" "}
				{fmtPct(withEvents / Math.max(1, totalPeople))} with events
			</p>

			{!collapsed && (
				<>
					{/* Graph Structure & Data Quality cards */}
					<div className="grid grid-cols-2 gap-4 mb-4 text-[11px]">
						{/* Graph Structure */}
						<div className="bg-white/3 p-2 rounded-md border border-(--border)">
							<div className="text-[10px] uppercase text-[#4b5563] mb-1">
								Graph Structure
							</div>
							<div className="flex flex-col gap-1">
								<div className="flex justify-between">
									<span>Isolated</span>
									<span>
										{isolated} · {fmtPct(isolatedPct)}
									</span>
								</div>
								<div className="flex justify-between">
									<span>Components</span>
									<span>{componentCount}</span>
								</div>
								<div className="flex justify-between">
									<span>Largest cluster</span>
									<span>
										{largestComponentSize} · {fmtPct(largestComponentPct)}
									</span>
								</div>
								<div className="flex justify-between">
									<span>Density</span>
									<span>{density.toFixed(3)}</span>
								</div>
								<div className="flex justify-between">
									<span>Median degree</span>
									<span>{medianDegree}</span>
								</div>
							</div>
						</div>

						{/* Data Quality */}
						<div className="bg-white/3 p-2 rounded-md border border-(--border)">
							<div className="text-[10px] uppercase text-[#4b5563] mb-1">
								Data Quality
							</div>
							<div className="flex flex-col gap-1">
								<div className="flex justify-between">
									<span>Unnamed</span>
									<span>{unnamed}</span>
								</div>
								<div className="flex justify-between">
									<span>Missing year</span>
									<span>{missingYear}</span>
								</div>
								<div className="flex justify-between">
									<span>No tags</span>
									<span>{peopleWithNoTags}</span>
								</div>
								<div className="flex justify-between">
									<span>No relations</span>
									<span>{noRelationships}</span>
								</div>
								<div className="flex justify-between">
									<span>No events</span>
									<span>{noEvents}</span>
								</div>
								<div className="flex justify-between">
									<span>Unknown rel type</span>
									<span>{unknownRelationshipTypes}</span>
								</div>
								<div className="flex justify-between">
									<span>Dangling rels</span>
									<span>{danglingRelationships}</span>
								</div>
							</div>
						</div>
					</div>

					{/* Tag Coverage & Concentration */}
					<div className="grid grid-cols-2 gap-4 mb-4 text-[11px]">
						<div className="bg-white/3 p-2 rounded-md border border-(--border)">
							<div className="text-[10px] uppercase text-[#4b5563] mb-1">
								Tag Coverage
							</div>
							<div className="flex justify-between">
								<span>Unused tags</span>
								<span>{unusedTags}</span>
							</div>
							<div className="flex justify-between">
								<span>Avg tags (tagged)</span>
								<span>{avgUniqueTagsPerTaggedPerson.toFixed(1)}</span>
							</div>
							<div className="flex justify-between">
								<span>Top 3 tags cover</span>
								<span>{fmtPct(top3Coverage)}</span>
							</div>
							<div className="flex justify-between">
								<span>Top 10 tags cover</span>
								<span>{fmtPct(top10Coverage)}</span>
							</div>
						</div>

						{/* Potential Bridges */}
						<div className="bg-white/3 p-2 rounded-md border border-(--border)">
							<div className="text-[10px] uppercase text-[#4b5563] mb-1">
								Potential Bridges
							</div>
							<div className="flex flex-col gap-1">
								{bridgeCandidates.map((p: any) => (
									<div
										key={p.id}
										className="flex justify-between items-center gap-2">
										<span className="text-[12px] text-[color:var(--text)] truncate">
											{p.name}
										</span>
										<span className="text-[11px] text-[#4b5563] bg-white/5 rounded-[10px] py-[1px] px-[7px] shrink-0">
											{p.connectionCount} conn / {p.typeDiversity} types
										</span>
									</div>
								))}
								{bridgeCandidates.length === 0 && (
									<div className="text-[11px] text-[#4b5563]">
										No bridges yet
									</div>
								)}
							</div>
						</div>
					</div>

					{/* Tag distribution mini-stats */}
					<div className="grid grid-cols-2 gap-4 mb-4 text-[11px]">
						<div className="bg-white/3 p-2 rounded-md border border-(--border)">
							<div className="text-[10px] uppercase text-[#4b5563] mb-1">
								Tag range
							</div>
							<div className="flex justify-between">
								<span>Min: {minTagsPerPerson}</span>
								<span>Max: {maxTagsPerPerson}</span>
								<span>Avg: {avgTagsPerPerson.toFixed(1)}</span>
							</div>
						</div>
						<div className="bg-white/3 p-2 rounded-md border border-(--border)">
							<div className="text-[10px] uppercase text-[#4b5563] mb-1">
								Event range
							</div>
							<div className="flex justify-between">
								<span>Min: 0</span>
								<span>Max: {maxEventsPerPerson}</span>
								<span>Avg: {avgEventsPerPerson.toFixed(1)}</span>
							</div>
						</div>
					</div>

					{/* Three‑column layout for top tags, top connectors, top events */}
					<div className="grid grid-cols-3 gap-4 mb-4">
						{/* Top tags */}
						<div>
							<div className="text-[11px] font-bold tracking-[0.08em] uppercase text-[color:var(--text)] opacity-50 mb-2">
								Top tags
							</div>
							<div className="flex flex-col gap-1">
								{topTags.map((t: any) => (
									<div key={t.id} className="flex flex-col gap-[2px]">
										<div className="flex justify-between items-baseline gap-1">
											<span className="text-[12px] text-[color:var(--text)] truncate">
												{t.name}
											</span>
											<span className="text-[11px] text-[#4b5563] shrink-0">
												{t.count} · {fmtPct(t.pct)}
											</span>
										</div>
										<div className="h-[2px] rounded-full bg-white/8 overflow-hidden">
											<div
												className="h-full rounded-full bg-[color:var(--accent)] opacity-60"
												style={{ width: `${(t.count / maxTagCount) * 100}%` }}
											/>
										</div>
									</div>
								))}
							</div>
						</div>

						{/* Top connectors */}
						<div>
							<div className="flex items-center gap-2">
								<div className="text-[11px] font-bold tracking-[0.08em] uppercase text-[color:var(--text)] opacity-50 mb-2">
									Top connectors
								</div>
								{/* Small help indicator explaining the number shown (no logic or CSS changes) */}
								<span
									className="text-[11px] text-[#9ca3af] cursor-help mb-2"
									title={
										"Shown number = number of connections (relationships) this person has."
									}
									aria-label="Top connectors explanation">
									?
								</span>
							</div>
							<div className="flex flex-col gap-1">
								{topConnectors.map((p: any) => (
									<div key={p.id} className="relative">
										<div
											onClick={() =>
												setOpenConnectorId((s) => (s === p.id ? null : p.id))
											}
											role="button"
											aria-expanded={openConnectorId === p.id}
											className="flex justify-between items-center gap-2 cursor-pointer select-none">
											<span className="text-[12px] text-[color:var(--text)] truncate">
												{p.name}
											</span>
											<span className="text-[11px] text-[#4b5563] bg-white/5 rounded-[10px] py-[1px] px-[7px] shrink-0">
												{p.connectionCount}
											</span>
										</div>
										{openConnectorId === p.id && (
											<div className="mt-1 p-2 bg-white/3 rounded-md border border-[color:var(--border)] text-[11px] z-20">
												{(connectionsByPerson?.[p.id] || []).length === 0 ? (
													<div className="text-[#9ca3af]">No connections</div>
												) : (
													<div className="flex flex-col gap-1 max-h-[200px] overflow-y-auto">
														{(connectionsByPerson[p.id] || []).map((c: any) => (
															<div
																key={c.id}
																className="flex justify-between items-center gap-2">
																<span className="truncate">{c.name}</span>
																<span className="text-[#9ca3af] text-[11px]">
																	{c.type}
																</span>
															</div>
														))}
													</div>
												)}
											</div>
										)}
									</div>
								))}
							</div>
						</div>

						{/* Top events */}
						<div>
							<div className="text-[11px] font-bold tracking-[0.08em] uppercase text-[color:var(--text)] opacity-50 mb-2">
								Top events
							</div>
							<div className="flex flex-col gap-1">
								{topEvents.length > 0 ? (
									topEvents.map((p: any) => (
										<div
											key={p.id}
											className="flex justify-between items-center gap-2">
											<span className="text-[12px] text-[color:var(--text)] truncate">
												{p.name}
											</span>
											<span className="text-[11px] text-[#4b5563] bg-white/5 rounded-[10px] py-[1px] px-[7px] shrink-0">
												{p.eventCount}
											</span>
										</div>
									))
								) : (
									<div className="text-[11px] text-[#4b5563]">
										No events yet
									</div>
								)}
							</div>
						</div>
					</div>

					{/* Relationship types and Year distribution side by side */}
					<div className="grid grid-cols-2 gap-4 mb-4">
						<div>
							<div className="text-[11px] font-bold tracking-[0.08em] uppercase text-[color:var(--text)] opacity-50 mb-2">
								Relationship types
							</div>
							<div className="flex flex-col gap-1">
								{relationshipTypes.map(
									({ type, count }: { type: string; count: number }) => (
										<div
											key={type}
											className="flex justify-between items-center gap-2">
											<span className="text-[12px] text-[color:var(--text)] truncate">
												{type}
											</span>
											<span className="text-[11px] text-[#4b5563] bg-white/5 rounded-[10px] py-[1px] px-[7px] shrink-0">
												{count}
											</span>
										</div>
									),
								)}
								{relationshipTypes.length === 0 && (
									<div className="text-[11px] text-[#4b5563]">
										No relationships yet
									</div>
								)}
							</div>
						</div>
						<div>
							<div className="text-[11px] font-bold tracking-[0.08em] uppercase text-[color:var(--text)] opacity-50 mb-2">
								Years distribution
							</div>
							<div className="flex flex-col gap-1">
								{years.map(
									({ year, count }: { year: number; count: number }) => (
										<div
											key={year}
											className="flex justify-between items-center gap-2">
											<span className="text-[12px] text-[color:var(--text)] truncate">
												{year}
											</span>
											<span className="text-[11px] text-[#4b5563] bg-white/5 rounded-[10px] py-[1px] px-[7px] shrink-0">
												{count}
											</span>
										</div>
									),
								)}
								{years.length === 0 && (
									<div className="text-[11px] text-[#4b5563]">No year data</div>
								)}
							</div>
						</div>
					</div>

					{/* Sort toolbar */}
					<div className="flex items-center gap-2 mb-2 pt-3 border-t border-(--border)">
						<span className="text-[11px] text-[#4b5563]">Sort</span>
						<select
							value={sortKey}
							onChange={(e) => setSortKey(e.target.value as SortKey)}
							className="appearance-none bg-[rgba(255,255,255,0.03)] border border-[color:var(--border)] rounded-[7px] py-1 pl-2 pr-6 text-[11px] text-[color:var(--text-h)] cursor-pointer bg-[url('data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20width=%2210%22%20height=%226%22%20viewBox=%220%200%2010%206%22%3E%3Cpath%20d=%22M1%201l4%204%204-4%22%20stroke=%22%239ca3af%22%20stroke-width=%221.5%22%20fill=%22none%22%20stroke-linecap=%22round%22/%3E%3C/svg%3E')] bg-no-repeat bg-[position:right_8px_center] focus:outline-none focus:border-[color:var(--accent)]">
							<option value="tags">Tag count</option>
							<option value="connections">Connections</option>
							<option value="events">Events</option>
							<option value="name">Name</option>
						</select>
						<button
							onClick={() => setAsc((s) => !s)}
							className="bg-[rgba(255,255,255,0.04)] border border-[color:var(--border)] rounded-[7px] py-1 px-2.5 text-[11px] text-[color:var(--text)] cursor-pointer hover:bg-[rgba(255,255,255,0.07)] hover:text-[color:var(--text-h)] transition-all duration-150">
							{asc ? "↑ Asc" : "↓ Desc"}
						</button>
					</div>

					{/* Per‑person table */}
					<div className="max-h-[200px] overflow-y-auto rounded-[7px] border border-[color:var(--border)] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-(--border) [&::-webkit-scrollbar-thumb]:rounded-sm">
						<div className="grid grid-cols-[1fr_44px_44px_44px] gap-1 px-2.5 py-[5px] bg-white/3 border-b border-[color:var(--border)] sticky top-0 z-10">
							{["Name", "Tags", "Conn", "Evts"].map((h, i) => (
								<div
									key={h}
									className={`text-[10px] font-bold tracking-[0.07em] uppercase text-[#4b5563] ${i > 0 ? "text-right" : ""}`}>
									{h}
								</div>
							))}
						</div>
						{sorted.map((s) => (
							<div
								key={s.id}
								className="grid grid-cols-[1fr_44px_44px_44px] gap-1 px-2.5 py-[5px] border-b border-[color:var(--border)] last:border-b-0 hover:bg-white/4 transition-colors duration-100">
								<div className="text-[12px] text-[color:var(--text)] truncate">
									{s.name}
								</div>
								<div className="text-[11px] text-[#4b5563] text-right tabular-nums">
									{s.tagCount}
								</div>
								<div className="text-[11px] text-[#4b5563] text-right tabular-nums">
									{s.connectionCount}
								</div>
								<div className="text-[11px] text-[#4b5563] text-right tabular-nums">
									{s.eventCount}
								</div>
							</div>
						))}
					</div>
				</>
			)}
		</div>
	);
}
