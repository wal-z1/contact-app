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

	const snapshot = useLiveQuery(async () => {
		const people = (await db.people.toArray()) as Person[];
		const rels = await db.relationships.toArray();
		const tags = await db.tags.toArray();

		const totalPeople = people.length;

		const tagUsage = new Map<string, { id: string; name: string; count: number }>();
		for (const t of tags)
			tagUsage.set(t.id, { id: t.id, name: t.name ?? String(t.id), count: 0 });

		let totalTagRefs = 0;
		for (const p of people) {
			const list = Array.isArray(p.inrete) ? p.inrete : [];
			totalTagRefs += list.length;
			for (const tid of list) {
				const existing = tagUsage.get(tid);
				if (existing) existing.count++;
				else tagUsage.set(tid, { id: tid, name: tid, count: 1 });
			}
		}

		const tagCounts = Array.from(tagUsage.values()).sort((a, b) => b.count - a.count);

		const personStats = people.map((p) => {
			const tagCount = Array.isArray(p.inrete) ? p.inrete.length : 0;
			const eventCount = Array.isArray(p.events) ? p.events.length : 0;
			const connectionCount = rels.filter((r) => r.from === p.id || r.to === p.id).length;
			return {
				id: p.id,
				name: p.name || "(no name)",
				tagCount,
				eventCount,
				connectionCount,
				tags: Array.isArray(p.inrete) ? p.inrete : [],
			};
		});

		const withTags = personStats.filter((p) => p.tagCount > 0).length;
		const withConnections = personStats.filter((p) => p.connectionCount > 0).length;
		const avgTagsPerPerson = totalPeople ? totalTagRefs / totalPeople : 0;

		const topTags = tagCounts
			.slice(0, 12)
			.map((t) => ({ ...t, pct: totalPeople ? t.count / totalPeople : 0 }));
		const topConnectors = [...personStats]
			.sort((a, b) => b.connectionCount - a.connectionCount)
			.slice(0, 12);

		return {
			totalPeople,
			totalTags: tags.length,
			avgTagsPerPerson,
			withTags,
			withConnections,
			topTags,
			topConnectors,
			personStats,
		};
	}, []);

	if (!snapshot)
		return <div className="px-5 py-3 text-xs text-[color:var(--text)] opacity-50">Loading stats…</div>;

	const {
		totalPeople,
		totalTags,
		avgTagsPerPerson,
		withTags,
		withConnections,
		topTags,
		topConnectors,
		personStats,
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

			{/* Section header — mirrors GlobalSettingsPanel's section headers */}
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
						className="text-[11px] text-[#4b5563] bg-white/5 rounded-[10px] py-[1px] px-[7px] cursor-pointer hover:bg-white/10 transition-colors duration-150"
					>
						{collapsed ? "Show" : "Hide"}
					</button>
				</div>
			</div>

			{/* Summary line — mirrors the <p> description style */}
			<p className="text-[11px] leading-[1.45] text-[color:var(--text)] mb-2.5">
				{totalTags} tags · {avgTagsPerPerson.toFixed(2)} avg tags/person ·{" "}
				{fmtPct(withTags / Math.max(1, totalPeople))} tagged ·{" "}
				{fmtPct(withConnections / Math.max(1, totalPeople))} connected
			</p>

			{!collapsed && (
				<>
					{/* Top tags + Top connectors side by side */}
					<div className="grid grid-cols-2 gap-4 mb-4">

						<div>
							<div className="text-[11px] font-bold tracking-[0.08em] uppercase text-[color:var(--text)] opacity-50 mb-2">
								Top tags
							</div>
							<div className="flex flex-col gap-1">
								{topTags.map((t) => (
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

						<div>
							<div className="text-[11px] font-bold tracking-[0.08em] uppercase text-[color:var(--text)] opacity-50 mb-2">
								Top connectors
							</div>
							<div className="flex flex-col gap-1">
								{topConnectors.map((p) => (
									<div key={p.id} className="flex justify-between items-center gap-2">
										<span className="text-[12px] text-[color:var(--text)] truncate">
											{p.name}
										</span>
										<span className="text-[11px] text-[#4b5563] bg-white/5 rounded-[10px] py-[1px] px-[7px] shrink-0">
											{p.connectionCount}
										</span>
									</div>
								))}
							</div>
						</div>
					</div>

					{/* Sort toolbar */}
					<div className="flex items-center gap-2 mb-2 pt-3 border-t border-(--border)">
						<span className="text-[11px] text-[#4b5563]">Sort</span>
						<select
							value={sortKey}
							onChange={(e) => setSortKey(e.target.value as SortKey)}
							className="appearance-none bg-[rgba(255,255,255,0.03)] border border-[color:var(--border)] rounded-[7px] py-1 pl-2 pr-6 text-[11px] text-[color:var(--text-h)] cursor-pointer bg-[url('data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20width=%2210%22%20height=%226%22%20viewBox=%220%200%2010%206%22%3E%3Cpath%20d=%22M1%201l4%204%204-4%22%20stroke=%22%239ca3af%22%20stroke-width=%221.5%22%20fill=%22none%22%20stroke-linecap=%22round%22/%3E%3C/svg%3E')] bg-no-repeat bg-[position:right_8px_center] focus:outline-none focus:border-[color:var(--accent)]"
						>
							<option value="tags">Tag count</option>
							<option value="connections">Connections</option>
							<option value="events">Events</option>
							<option value="name">Name</option>
						</select>
						<button
							onClick={() => setAsc((s) => !s)}
							className="bg-[rgba(255,255,255,0.04)] border border-[color:var(--border)] rounded-[7px] py-1 px-2.5 text-[11px] text-[color:var(--text)] cursor-pointer hover:bg-[rgba(255,255,255,0.07)] hover:text-[color:var(--text-h)] transition-all duration-150"
						>
							{asc ? "↑ Asc" : "↓ Desc"}
						</button>
					</div>

					{/* Per-person table */}
					<div className="max-h-[200px] overflow-y-auto rounded-[7px] border border-[color:var(--border)] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-(--border) [&::-webkit-scrollbar-thumb]:rounded-sm">
						<div className="grid grid-cols-[1fr_44px_44px_44px] gap-1 px-2.5 py-[5px] bg-white/3 border-b border-[color:var(--border)] sticky top-0 z-10">
							{["Name", "Tags", "Conn", "Evts"].map((h, i) => (
								<div
									key={h}
									className={`text-[10px] font-bold tracking-[0.07em] uppercase text-[#4b5563] ${i > 0 ? "text-right" : ""}`}
								>
									{h}
								</div>
							))}
						</div>
						{sorted.map((s) => (
							<div
								key={s.id}
								className="grid grid-cols-[1fr_44px_44px_44px] gap-1 px-2.5 py-[5px] border-b border-[color:var(--border)] last:border-b-0 hover:bg-white/4 transition-colors duration-100"
							>
								<div className="text-[12px] text-[color:var(--text)] truncate">{s.name}</div>
								<div className="text-[11px] text-[#4b5563] text-right tabular-nums">{s.tagCount}</div>
								<div className="text-[11px] text-[#4b5563] text-right tabular-nums">{s.connectionCount}</div>
								<div className="text-[11px] text-[#4b5563] text-right tabular-nums">{s.eventCount}</div>
							</div>
						))}
					</div>
				</>
			)}
		</div>
	);
}