import { useMemo, useState } from "react";
import type { Tag } from "../../models/types";
import type { EventOption } from "./types";

type ActiveYear = number | "all";

type GraphControlsProps = {
	tags: Tag[];
	eventOptions: EventOption[];
	nodeOptions: Array<{ id: string; label: string }>;
	activeYear: ActiveYear;
	yearOptions: number[];
	filterTagId: string;
	filterEventKey: string;
	selectedNodeId: string;
	setActiveYear: (value: ActiveYear) => void;
	linkDistance: number;
	setFilterTagId: (value: string) => void;
	setFilterEventKey: (value: string) => void;
	onSelectNode: (value: string) => void;
	setLinkDistance: (value: number) => void;
	physics: {
		personCharge: number;
		auxCharge: number;
		chargeDistanceMax: number;
		collisionPerson: number;
		collisionAux: number;
		alphaDecay: number;
		velocityDecay: number;
		linkIterations: number;
	};
	setPhysicsValue: <K extends keyof GraphControlsProps["physics"]>(
		key: K,
		value: number,
	) => void;
	onRecenter: () => void;
	onZoomIn: () => void;
	onZoomOut: () => void;
	isTouchDevice: boolean;
};

export default function GraphControls({
	tags,
	eventOptions,
	nodeOptions,
	activeYear,
	yearOptions,
	filterTagId,
	filterEventKey,
	selectedNodeId,
	setActiveYear,
	linkDistance,
	setFilterTagId,
	setFilterEventKey,
	onSelectNode,
	setLinkDistance,
	physics,
	setPhysicsValue,
	onRecenter,
	onZoomIn,
	onZoomOut,
	isTouchDevice,
}: GraphControlsProps) {
	const hasFilters = Boolean(filterTagId || filterEventKey);
	type PhysicsKey = keyof GraphControlsProps["physics"];

	const physicsMeta = useMemo(
		() =>
			({
				personCharge: { label: "Person repel", min: -700, max: -120, step: 10 },
				auxCharge: { label: "Tag/Event repel", min: -360, max: -60, step: 10 },
				chargeDistanceMax: {
					label: "Charge reach",
					min: 400,
					max: 1400,
					step: 25,
				},
				collisionPerson: {
					label: "Person collide",
					min: 18,
					max: 48,
					step: 1,
				},
				collisionAux: {
					label: "Tag/Event collide",
					min: 12,
					max: 38,
					step: 1,
				},
				alphaDecay: { label: "Alpha decay", min: 0.01, max: 0.08, step: 0.001 },
				velocityDecay: {
					label: "Velocity decay",
					min: 0.05,
					max: 0.5,
					step: 0.01,
				},
				linkIterations: {
					label: "Link iterations",
					min: 1,
					max: 6,
					step: 1,
				},
			}) satisfies Record<
				PhysicsKey,
				{ label: string; min: number; max: number; step: number }
			>,
		[],
	);

	const [activePhysicsKey, setActivePhysicsKey] =
		useState<PhysicsKey>("personCharge");
	const [isCompactOpen, setIsCompactOpen] = useState(false);
	const activePhysics = physicsMeta[activePhysicsKey];

	return (
		<>
			<div
				className="absolute left-3 top-3 z-40 flex max-w-[calc(100%-1.5rem)] flex-wrap items-center gap-2 pointer-events-auto"
				onPointerDown={(e) => e.stopPropagation()}
				onWheel={(e) => e.stopPropagation()}>
				<div className="rounded-md border border-slate-800 bg-slate-950/95 px-2 py-1 text-[10px] font-medium text-slate-300 shadow-lg backdrop-blur">
					View controls
				</div>
				<div className="flex min-h-8 items-center gap-1 rounded-md border border-slate-700 bg-slate-950/95 px-1 py-1 shadow-lg backdrop-blur">
					<button
						className="rounded px-2 py-1 text-[11px] font-semibold text-slate-100 hover:bg-slate-800/70"
						onClick={onZoomOut}
						type="button"
						title="Zoom out">
						-
					</button>
					<button
						className="rounded px-2 py-1 text-[11px] font-semibold text-slate-100 hover:bg-slate-800/70"
						onClick={onZoomIn}
						type="button"
						title="Zoom in">
						+
					</button>
				</div>

				<button
					className="min-h-8 rounded-md border border-slate-700 bg-slate-950/95 px-2 py-1 text-[11px] text-slate-100 shadow-lg backdrop-blur hover:bg-slate-900"
					onClick={onRecenter}
					type="button"
					aria-label="Recenter graph view">
					Recenter view
				</button>

				<button
					type="button"
					className="min-h-8 rounded-md border border-slate-800 bg-slate-950/95 px-2 py-1 text-[11px] text-slate-100 shadow-lg backdrop-blur hover:bg-slate-900"
					aria-expanded={isCompactOpen}
					aria-label={
						isCompactOpen ? "Hide physics controls" : "Show physics controls"
					}
					onClick={() => setIsCompactOpen((v) => !v)}>
					{isCompactOpen ? "Hide physics" : "Show physics"}
				</button>

				<select
					className="min-h-8 rounded-md border border-slate-800 bg-slate-950/95 px-2 py-1 text-[11px] text-slate-100 shadow-lg backdrop-blur"
					value={activeYear === "all" ? "all" : String(activeYear)}
					aria-label="Filter by year"
					onChange={(e) =>
						setActiveYear(
							e.target.value === "all" ? "all" : Number(e.target.value),
						)
					}>
					<option value="all">All years</option>
					{yearOptions.map((year) => (
						<option key={year} value={year}>
							{year}
						</option>
					))}
				</select>

				{isCompactOpen && (
					<div className="flex min-h-8 items-center gap-2 rounded-md border border-slate-800 bg-slate-950/95 px-2 py-1 shadow-lg backdrop-blur">
						<select
							className="min-h-7 rounded border border-slate-700 bg-slate-900/80 px-2 py-1 text-[10px] text-slate-100"
							value={activePhysicsKey}
							aria-label="Select physics setting"
							onChange={(e) =>
								setActivePhysicsKey(e.target.value as PhysicsKey)
							}>
							{Object.entries(physicsMeta).map(([key, meta]) => (
								<option key={key} value={key}>
									{meta.label}
								</option>
							))}
						</select>
						<input
							type="range"
							min={activePhysics.min}
							max={activePhysics.max}
							step={activePhysics.step}
							value={physics[activePhysicsKey]}
							aria-label={`${activePhysics.label} value`}
							onChange={(e) =>
								setPhysicsValue(activePhysicsKey, Number(e.target.value))
							}
							className="h-1.5 w-24 accent-indigo-400"
						/>
						<span className="w-12 text-right text-[10px] font-semibold text-slate-300">
							{physics[activePhysicsKey]}
						</span>
					</div>
				)}

				<select
					className="min-h-8 rounded-md border border-slate-800 bg-slate-950/95 px-2 py-1 text-[11px] text-slate-100 shadow-lg backdrop-blur"
					value={selectedNodeId}
					aria-label="Find and focus person"
					onChange={(e) => onSelectNode(e.target.value)}>
					<option value="">Find a person...</option>
					{nodeOptions.map((node) => (
						<option key={node.id} value={node.id}>
							{node.label}
						</option>
					))}
				</select>

				<select
					className="min-h-8 rounded-md border border-slate-800 bg-slate-950/95 px-2 py-1 text-[11px] text-slate-100 shadow-lg backdrop-blur"
					value={filterTagId}
					aria-label="Filter graph by tag"
					onChange={(e) => setFilterTagId(e.target.value)}>
					<option value="">All tags</option>
					{tags.map((tag) => (
						<option key={tag.id} value={tag.id}>
							{tag.name}
						</option>
					))}
				</select>

				<select
					className="min-h-8 rounded-md border border-slate-800 bg-slate-950/95 px-2 py-1 text-[11px] text-slate-100 shadow-lg backdrop-blur"
					value={filterEventKey}
					aria-label="Filter graph by event"
					onChange={(e) => setFilterEventKey(e.target.value)}>
					<option value="">All events</option>
					{eventOptions.map((event) => (
						<option key={event.id} value={event.id}>
							{event.title}
						</option>
					))}
				</select>

				{hasFilters && (
					<button
						type="button"
						className="min-h-8 rounded-md border border-slate-800 bg-slate-950/95 px-2 py-1 text-[10px] text-slate-200 hover:bg-slate-900"
						onClick={() => {
							setFilterEventKey("");
							setFilterTagId("");
						}}>
						Clear filters
					</button>
				)}

				{isTouchDevice && (
					<div className="rounded-md border border-slate-800 bg-slate-950/95 px-2 py-1 text-[10px] text-slate-300">
						Drag nodes with one finger, pan on empty space
					</div>
				)}
			</div>

			<div
				className="absolute bottom-3 left-3 z-40 flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/95 px-2.5 py-2 shadow-lg backdrop-blur pointer-events-auto"
				onPointerDown={(e) => e.stopPropagation()}
				onWheel={(e) => e.stopPropagation()}>
				<div className="flex items-center gap-2">
					<span className="text-[10px] font-medium tracking-wide text-slate-300">
						Spacing
					</span>
					<input
						id="link-distance"
						type="range"
						min={60}
						max={240}
						step={5}
						value={linkDistance}
						aria-label="Adjust graph spacing"
						onChange={(e) => setLinkDistance(Number(e.target.value))}
						className="h-1.5 w-24 cursor-pointer accent-indigo-400"
					/>
					<span className="text-[10px] font-semibold text-slate-200">
						{linkDistance}
					</span>
				</div>
			</div>
		</>
	);
}
