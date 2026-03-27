import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ForceGraphMethods } from "react-force-graph-2d";
import { useLiveQuery } from "dexie-react-hooks";
import type { Relationship, Person, Event, Tag } from "../models/types";
import { db } from "../db/db";
import { useAppStore } from "../store/useAppStore";
import GraphControls from "./graph/GraphControls";
import GraphCanvas from "./graph/GraphCanvas";
import { useGraphDimensions } from "./graph/useGraphDimensions";
import { buildEventOptions, buildGraphData } from "./graph/graphData";

const DEFAULT_PHYSICS = {
	personCharge: -430,
	auxCharge: -170,
	chargeDistanceMax: 900,
	collisionPerson: 30,
	collisionAux: 20,
	alphaDecay: 0.035,
	velocityDecay: 0.2,
	linkIterations: 2,
	nodeSizeCap: 100,
};

const FOCUS_DELAY_MS = 80;
const FOCUS_RETRY_MS = 120;
const FOCUS_MAX_TRIES = 8;

export default function GraphView() {
	const selectedPersonId = useAppStore((s) => s.selectedPersonId);
	const setSelectedPersonId = useAppStore((s) => s.setSelectedPersonId);
	const activeYear = useAppStore((s) => s.activeYear);
	const setActiveYear = useAppStore((s) => s.setActiveYear);
	const showGraphControls = useAppStore((s) => s.showGraphControls);

	const people = useLiveQuery<Person[]>(() => db.people.toArray(), []) ?? [];
	const relationships =
		useLiveQuery<Relationship[]>(() => db.relationships.toArray(), []) ?? [];
	const tags =
		useLiveQuery<Tag[]>(
			() => ((db as any).tags ? (db as any).tags.toArray() : []),
			[],
		) ?? [];
	const savedEvents =
		useLiveQuery<Event[]>(() => db.events.toArray(), []) ?? [];

	const [filterEventKey, setFilterEventKey] = useState("");
	const [filterTagId, setFilterTagId] = useState("");
	const [zoomLevel, setZoomLevel] = useState(1);
	const [linkDistance, setLinkDistance] = useState(110);
	const [highlightSourceNodeId, setHighlightSourceNodeId] = useState("");
	const [highlightedPersonIds, setHighlightedPersonIds] = useState<string[]>([]);
	const [physics, setPhysics] = useState(DEFAULT_PHYSICS);

	const fgRef = useRef<ForceGraphMethods<any, any> | undefined>(undefined);
	const containerRef = useRef<HTMLDivElement>(null);
	const dimensions = useGraphDimensions(containerRef.current);

	const isTouchDevice = useMemo(
		() =>
			typeof window !== "undefined" &&
			(window.matchMedia("(pointer: coarse)").matches ||
				navigator.maxTouchPoints > 0),
		[],
	);

	const visiblePeople = useMemo(() => {
		if (activeYear === "all") return people;
		return people.filter((person) => person.year === activeYear);
	}, [people, activeYear]);

	const allEventOptions = useMemo(
		() => buildEventOptions(savedEvents, visiblePeople),
		[savedEvents, visiblePeople],
	);

	const graphData = useMemo(
		() =>
			buildGraphData(
				visiblePeople,
				relationships,
				tags,
				savedEvents,
				{
					filterEventKey,
					filterTagId,
				},
				physics.nodeSizeCap,
			),
		[
			visiblePeople,
			relationships,
			tags,
			savedEvents,
			filterEventKey,
			filterTagId,
			physics.nodeSizeCap,
		],
	);

	const nodeOptions = useMemo(
		() =>
			visiblePeople
				.map((person) => ({
					id: person.id,
					label: String(person.name ?? "").trim() || "Unknown",
				}))
				.sort((a, b) => a.label.localeCompare(b.label)),
		[visiblePeople],
	);

	const yearOptions = useMemo(() => {
		const years = new Set(people.map((p) => p.year).filter(Boolean));
		return [...years].sort((a, b) => b - a);
	}, [people]);

	const clearHighlights = useCallback(() => {
		setHighlightSourceNodeId("");
		setHighlightedPersonIds([]);
	}, []);

	const clearFilters = useCallback(() => {
		setFilterTagId("");
		setFilterEventKey("");
	}, []);

	const scheduleFocusPerson = useCallback(
		(nodeId: string) => {
			window.setTimeout(() => {
				const graph = fgRef.current as
					| (ForceGraphMethods<any, any> & {
							graphData?: () => {
								nodes?: Array<{ id?: string; x?: number; y?: number }>;
							};
							centerAt?: (x?: number, y?: number, ms?: number) => void;
							zoom?: ((k: number, ms?: number) => void) & (() => number);
					  })
					| undefined;

				if (!graph) return;

				const attemptFocus = () => {
					const found = graph
						?.graphData?.()
						?.nodes?.find((node) => node?.id === nodeId);

					if (
						!found ||
						typeof found.x !== "number" ||
						typeof found.y !== "number"
					) {
						return false;
					}

					const currentZoom =
						typeof graph.zoom === "function"
							? Number((graph.zoom as () => number)()) || zoomLevel
							: zoomLevel;

					const nextZoom = Math.max(currentZoom, 1.9);

					setZoomLevel(nextZoom);
					graph.centerAt?.(found.x, found.y, 420);
					(graph.zoom as ((k: number, ms?: number) => void) | undefined)?.(
						nextZoom,
						420,
					);

					return true;
				};

				if (attemptFocus()) return;

				let tries = 0;
				const intervalId = window.setInterval(() => {
					tries += 1;
					if (attemptFocus() || tries >= FOCUS_MAX_TRIES) {
						window.clearInterval(intervalId);
					}
				}, FOCUS_RETRY_MS);
			}, FOCUS_DELAY_MS);
		},
		[zoomLevel],
	);

	const recenter = useCallback(() => {
		setZoomLevel(1);
		fgRef.current?.d3ReheatSimulation();
		fgRef.current?.zoomToFit(400, 50);
	}, []);

	const zoomBy = useCallback(
		(delta: number) => {
			const next = Math.max(
				0.35,
				Math.min(3.5, Number((zoomLevel + delta).toFixed(2))),
			);
			setZoomLevel(next);
			fgRef.current?.zoom(next, 220);
		},
		[zoomLevel],
	);

	const selectNodeFromMenu = useCallback(
		(nodeId: string) => {
			if (!nodeId) {
				clearHighlights();
				setSelectedPersonId(null);
				return;
			}

			clearFilters();
			clearHighlights();
			setHighlightedPersonIds([nodeId]);
			setSelectedPersonId(nodeId);
			scheduleFocusPerson(nodeId);
		},
		[clearFilters, clearHighlights, scheduleFocusPerson, setSelectedPersonId],
	);

	const selectNodeFromCanvas = useCallback(
		(nodeId: string | null) => {
			if (!nodeId) {
				setSelectedPersonId(null);
				return;
			}

			setSelectedPersonId(nodeId);
			scheduleFocusPerson(nodeId);
		},
		[scheduleFocusPerson, setSelectedPersonId],
	);

	const handleHighlightPeople = useCallback(
		(personIds: string[], sourceNodeId: string) => {
			setSelectedPersonId(null);
			setHighlightSourceNodeId(sourceNodeId);
			setHighlightedPersonIds(personIds);
		},
		[setSelectedPersonId],
	);

	const setPhysicsValue = useCallback(
		<K extends keyof typeof physics>(key: K, value: number) => {
			setPhysics((prev) => ({ ...prev, [key]: value }));
		},
		[],
	);

	useEffect(() => {
		if (!selectedPersonId) return;

		const stillVisible = graphData.nodes.some(
			(node) => !node.isTag && node.id === selectedPersonId,
		);

		if (!stillVisible) {
			setSelectedPersonId(null);
		}
	}, [graphData.nodes, selectedPersonId, setSelectedPersonId]);

	useEffect(() => {
		if (!highlightSourceNodeId) return;

		const sourceNode = graphData.nodes.find(
			(node) => node.id === highlightSourceNodeId,
		);

		if (!sourceNode || sourceNode.nodeType === "person") {
			clearHighlights();
			return;
		}

		setHighlightedPersonIds(
			Array.isArray(sourceNode.connectedPersonIds)
				? sourceNode.connectedPersonIds
				: [],
		);
	}, [graphData.nodes, highlightSourceNodeId, clearHighlights]);

	useEffect(() => {
		if (!selectedPersonId) return;

		const isVisible = graphData.nodes.some(
			(node) => node.nodeType === "person" && node.id === selectedPersonId,
		);

		if (isVisible) {
			scheduleFocusPerson(selectedPersonId);
		}
	}, [selectedPersonId, graphData.nodes, scheduleFocusPerson]);

	useEffect(() => {
		if (!fgRef.current) return;
		if (graphData.nodes.length === 0) return;

		const timeoutId = window.setTimeout(() => {
			fgRef.current?.zoomToFit(600, 60);
		}, 120);

		return () => window.clearTimeout(timeoutId);
	}, [graphData.nodes.length, graphData.links.length]);

	return (
		<div
			className="relative h-full w-full overflow-hidden bg-slate-900"
			ref={containerRef}
		>
			{showGraphControls && (
				<GraphControls
					tags={tags}
					eventOptions={allEventOptions}
					nodeOptions={nodeOptions}
					activeYear={activeYear}
					yearOptions={yearOptions}
					filterTagId={filterTagId}
					filterEventKey={filterEventKey}
					selectedNodeId={selectedPersonId ?? ""}
					setActiveYear={setActiveYear}
					linkDistance={linkDistance}
					setFilterTagId={setFilterTagId}
					setFilterEventKey={setFilterEventKey}
					onSelectNode={selectNodeFromMenu}
					setLinkDistance={setLinkDistance}
					physics={physics}
					setPhysicsValue={setPhysicsValue}
					onRecenter={recenter}
					onZoomIn={() => zoomBy(0.2)}
					onZoomOut={() => zoomBy(-0.2)}
					isTouchDevice={isTouchDevice}
				/>
			)}

			<GraphCanvas
				fgRef={fgRef}
				width={dimensions.width}
				height={dimensions.height}
				graphData={graphData}
				linkDistance={linkDistance}
				physics={physics}
				highlightedPersonIds={highlightedPersonIds}
				selectedPersonId={selectedPersonId}
				onSelectPerson={selectNodeFromCanvas}
				onHighlightPeople={handleHighlightPeople}
				onClearHighlights={clearHighlights}
			/>
		</div>
	);
}