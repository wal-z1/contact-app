import { useMemo, useState } from "react";
import type { Tag } from "../../models/types";
import type { EventOption } from "./types";

// Helper for SVG Icons to keep the component clean
const Icons = {
	ZoomIn: () => (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			fill="none"
			viewBox="0 0 24 24"
			strokeWidth={1.5}
			stroke="currentColor"
			className="size-4">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
			/>
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				d="M10.5 7.5v6m3-3h-6"
			/>
		</svg>
	),
	ZoomOut: () => (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			fill="none"
			viewBox="0 0 24 24"
			strokeWidth={1.5}
			stroke="currentColor"
			className="size-4">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
			/>
			<path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5h-6" />
		</svg>
	),
	Recenter: () => (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			fill="none"
			viewBox="0 0 24 24"
			strokeWidth={1.5}
			stroke="currentColor"
			className="size-4">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				d="M9 9V4.5M9 9H4.5M9 9 3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5M15 15l5.25 5.25"
			/>
		</svg>
	),
	Chevron: ({ open }: { open: boolean }) => (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			fill="none"
			viewBox="0 0 24 24"
			strokeWidth={2}
			stroke="currentColor"
			className={`size-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`}>
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				d="m19.5 8.25-7.5 7.5-7.5-7.5"
			/>
		</svg>
	),
};

// Main Component
type GraphControlsProps = {
	tags: Tag[];
	eventOptions: EventOption[];
	nodeOptions: Array<{ id: string; label: string }>;
	activeYear: number | "all";
	yearOptions: number[];
	filterTagId: string;
	filterEventKey: string;
	selectedNodeId: string;
	setActiveYear: (value: number | "all") => void;
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
		nodeSizeCap: number;
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
				personCharge: { label: "Person Repel", min: -700, max: -120, step: 10 },
				auxCharge: { label: "Tag/Event Repel", min: -360, max: -60, step: 10 },
				chargeDistanceMax: {
					label: "Charge Reach",
					min: 400,
					max: 1400,
					step: 25,
				},
				collisionPerson: { label: "Person Collide", min: 18, max: 48, step: 1 },
				collisionAux: { label: "Tag/Event Collide", min: 12, max: 38, step: 1 },
				alphaDecay: { label: "Alpha Decay", min: 0.01, max: 0.08, step: 0.001 },
				velocityDecay: {
					label: "Velocity Decay",
					min: 0.05,
					max: 0.5,
					step: 0.01,
				},
				linkIterations: { label: "Link Iterations", min: 1, max: 6, step: 1 },
				nodeSizeCap: { label: "Node Size Cap", min: 20, max: 400, step: 2 },
			}) satisfies Record<
				PhysicsKey,
				{ label: string; min: number; max: number; step: number }
			>,
		[],
	);

	const [activePhysicsKey, setActivePhysicsKey] =
		useState<PhysicsKey>("personCharge");
	const [isTuningOpen, setIsTuningOpen] = useState(false);
	const activePhysics = physicsMeta[activePhysicsKey];

	const baseSelectClasses =
		"w-full min-h-8 rounded-md border border-slate-700/80 bg-slate-800/90 px-2 py-1 text-xs text-slate-100 shadow-sm backdrop-blur-sm focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 focus:outline-none";

	return (
		<div
			className="absolute left-4 top-4 z-40 flex w-72 max-w-[calc(100%-2rem)] flex-col gap-3 rounded-xl border border-slate-700/80 bg-slate-900/60 p-3 text-slate-200 shadow-2xl backdrop-blur-md pointer-events-auto"
			onPointerDown={(e) => e.stopPropagation()}
			onWheel={(e) => e.stopPropagation()}>
			{/* --- View Controls --- */}
			<div className="flex items-center justify-between gap-2">
				<span className="text-sm font-bold text-white">View Controls</span>
				<div className="flex items-center gap-1 rounded-lg bg-slate-800/80 p-0.5">
					<button
						onClick={onZoomOut}
						type="button"
						title="Zoom out"
						className="rounded-md p-1.5 text-slate-300 hover:bg-slate-700/70 hover:text-white transition-colors">
						<Icons.ZoomOut />
					</button>
					<button
						onClick={onZoomIn}
						type="button"
						title="Zoom in"
						className="rounded-md p-1.5 text-slate-300 hover:bg-slate-700/70 hover:text-white transition-colors">
						<Icons.ZoomIn />
					</button>
					<div className="mx-1 h-4 w-px bg-slate-600" />
					<button
						onClick={onRecenter}
						type="button"
						title="Recenter view"
						className="rounded-md p-1.5 text-slate-300 hover:bg-slate-700/70 hover:text-white transition-colors">
						<Icons.Recenter />
					</button>
				</div>
			</div>

			<hr className="border-white/10" />

			{/* --- Filters --- */}
			<div className="flex flex-col gap-2">
				<select
					value={selectedNodeId}
					onChange={(e) => onSelectNode(e.target.value)}
					className={baseSelectClasses}
					aria-label="Find and focus person">
					<option value="">Find a person...</option>
					{nodeOptions.map((node) => (
						<option key={node.id} value={node.id} title={node.label}>
							{node.label.length > 40
								? `${node.label.slice(0, 37)}…`
								: node.label}
						</option>
					))}
				</select>

				<div className="grid grid-cols-3 gap-2">
					<select
						value={activeYear}
						onChange={(e) =>
							setActiveYear(
								e.target.value === "all" ? "all" : Number(e.target.value),
							)
						}
						className={`${baseSelectClasses} col-span-1`}
						aria-label="Filter by year">
						<option value="all">All Years</option>
						{yearOptions.map((year) => (
							<option key={year} value={year}>
								{year}
							</option>
						))}
					</select>
					<select
						value={filterTagId}
						onChange={(e) => setFilterTagId(e.target.value)}
						className={`${baseSelectClasses} col-span-2`}
						aria-label="Filter by tag">
						<option value="">All Tags</option>
						{tags.map((tag) => (
							<option key={tag.id} value={tag.id} title={tag.name}>
								{tag.name.length > 40 ? `${tag.name.slice(0, 37)}…` : tag.name}
							</option>
						))}
					</select>
				</div>

				<select
					value={filterEventKey}
					onChange={(e) => setFilterEventKey(e.target.value)}
					className={baseSelectClasses}
					aria-label="Filter by event">
					<option value="">All Events</option>
					{eventOptions.map((event) => (
						<option key={event.id} value={event.id} title={event.title}>
							{event.title.length > 60
								? `${event.title.slice(0, 57)}…`
								: event.title}
						</option>
					))}
				</select>

				{hasFilters && (
					<button
						onClick={() => {
							setFilterEventKey("");
							setFilterTagId("");
						}}
						type="button"
						className="mt-1 w-full rounded-md bg-rose-600/20 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-600/40 transition-colors">
						Clear Filters
					</button>
				)}
			</div>

			{/* --- Advanced Tuning Accordion --- */}
			<div className="flex flex-col">
				<hr className="border-white/10" />
				<button
					onClick={() => setIsTuningOpen((v) => !v)}
					className="flex w-full items-center justify-between py-2 text-sm font-bold text-white">
					<span>Graph Tuning</span>
					<Icons.Chevron open={isTuningOpen} />
				</button>
				{isTuningOpen && (
					<div className="flex flex-col gap-3 pb-1">
						{/* Spacing Slider */}
						<div className="flex flex-col gap-1.5">
							<div className="flex justify-between items-center">
								<label
									htmlFor="link-distance"
									className="text-xs font-medium text-slate-300">
									Spacing
								</label>
								<span className="text-xs font-semibold text-slate-200">
									{linkDistance}
								</span>
							</div>
							<input
								id="link-distance"
								type="range"
								min={60}
								max={480}
								step={5}
								value={linkDistance}
								onChange={(e) => setLinkDistance(Number(e.target.value))}
								className="h-1.5 w-full cursor-pointer accent-indigo-400"
							/>
						</div>

						{/* Physics Sliders */}
						<div className="flex flex-col gap-2 rounded-lg bg-slate-950/40 p-2">
							<select
								value={activePhysicsKey}
								onChange={(e) =>
									setActivePhysicsKey(e.target.value as PhysicsKey)
								}
								className={baseSelectClasses}
								aria-label="Select physics setting">
								{Object.entries(physicsMeta).map(([key, meta]) => (
									<option key={key} value={key}>
										{meta.label}
									</option>
								))}
							</select>
							<div className="flex items-center gap-2">
								<input
									type="range"
									min={activePhysics.min}
									max={activePhysics.max}
									step={activePhysics.step}
									value={physics[activePhysicsKey]}
									onChange={(e) =>
										setPhysicsValue(activePhysicsKey, Number(e.target.value))
									}
									className="h-1.5 w-full accent-indigo-400"
								/>
								<span className="w-12 text-right text-xs font-semibold text-slate-300">
									{physics[activePhysicsKey]}
								</span>
							</div>
						</div>
					</div>
				)}
			</div>
			{isTouchDevice && (
				<div className="mt-1 rounded-md bg-slate-950/50 p-2 text-center text-[10px] text-slate-400">
					Drag nodes with one finger, pan on empty space
				</div>
			)}
		</div>
	);
}
