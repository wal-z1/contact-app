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

export default function GraphView() {
	const selectedPersonId = useAppStore((s) => s.selectedPersonId);
	const setSelectedPersonId = useAppStore((s) => s.setSelectedPersonId);
	const activeYear = useAppStore((s) => s.activeYear);
	const setActiveYear = useAppStore((s) => s.setActiveYear);

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

	const [filterEventKey, setFilterEventKey] = useState<string>("");
	const [filterTagId, setFilterTagId] = useState<string>("");
	const [zoomLevel, setZoomLevel] = useState(1);
	const [linkDistance, setLinkDistance] = useState(110);
	const [highlightSourceNodeId, setHighlightSourceNodeId] =
		useState<string>("");
	const [highlightedPersonIds, setHighlightedPersonIds] = useState<string[]>(
		[],
	);
	const [physics, setPhysics] = useState({
		personCharge: -430,
		auxCharge: -170,
		chargeDistanceMax: 900,
		collisionPerson: 30,
		collisionAux: 20,
		alphaDecay: 0.035,
		velocityDecay: 0.2,
		linkIterations: 2,
		nodeSizeCap: 100,
	});

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

	const allEventOptions = useMemo(() => {
		return buildEventOptions(savedEvents, visiblePeople);
	}, [savedEvents, visiblePeople]);

	const graphData = useMemo(() => {
		return buildGraphData(
			visiblePeople,
			relationships,
			tags,
			savedEvents,
			{
				filterEventKey,
				filterTagId,
			},
			physics.nodeSizeCap,
		);
	}, [
		visiblePeople,
		relationships,
		tags,
		savedEvents,
		filterEventKey,
		filterTagId,
		physics.nodeSizeCap,
	]);

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
		const yrs = new Set(people.map((p) => p.year).filter(Boolean));
		return [...yrs].sort((a, b) => b - a);
	}, [people]);

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
			setHighlightSourceNodeId("");
			setHighlightedPersonIds([]);
			return;
		}
		setHighlightedPersonIds(
			Array.isArray(sourceNode.connectedPersonIds)
				? sourceNode.connectedPersonIds
				: [],
		);
	}, [graphData.nodes, highlightSourceNodeId]);

	const recenter = useCallback(() => {
		setZoomLevel(1);
		fgRef.current?.d3ReheatSimulation();
		fgRef.current?.zoomToFit(400, 50);
	}, []);

	const focusPersonNode = useCallback(
		(nodeId: string) => {
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
			const maxTries = 8;
			const id = window.setInterval(() => {
				tries += 1;
				if (attemptFocus() || tries >= maxTries) {
					window.clearInterval(id);
				}
			}, 120);
		},
		[zoomLevel],
	);

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

	useEffect(() => {
		if (!selectedPersonId) return;
		const visible = graphData.nodes.some(
			(node) => node.nodeType === "person" && node.id === selectedPersonId,
		);
		if (!visible) return;

		window.setTimeout(() => {
			focusPersonNode(selectedPersonId);
		}, 80);
	}, [selectedPersonId, graphData.nodes, focusPersonNode]);

	const selectNodeFromMenu = useCallback(
		(nodeId: string) => {
			if (!nodeId) {
				setHighlightSourceNodeId("");
				setHighlightedPersonIds([]);
				setSelectedPersonId(null);
				return;
			}

			// Clear active filters so the searched person is always visible in graph.
			setFilterTagId("");
			setFilterEventKey("");
			setHighlightSourceNodeId("");
			setHighlightedPersonIds([nodeId]);
			setSelectedPersonId(nodeId);
			window.setTimeout(() => {
				focusPersonNode(nodeId);
			}, 80);
		},
		[focusPersonNode, setSelectedPersonId],
	);

	const selectNodeFromCanvas = useCallback(
		(nodeId: string | null) => {
			if (!nodeId) {
				setSelectedPersonId(null);
				return;
			}

			setSelectedPersonId(nodeId);
			window.setTimeout(() => {
				focusPersonNode(nodeId);
			}, 80);
		},
		[focusPersonNode, setSelectedPersonId],
	);

	const setPhysicsValue = useCallback(
		<K extends keyof typeof physics>(key: K, value: number) => {
			setPhysics((prev) => ({ ...prev, [key]: value }));
		},
		[],
	);

	useEffect(() => {
		if (!fgRef.current) return;
		if (graphData.nodes.length === 0) return;

		const id = window.setTimeout(() => {
			fgRef.current?.zoomToFit(600, 60);
		}, 120);

		return () => window.clearTimeout(id);
	}, [graphData.nodes.length, graphData.links.length]);

	return (
		<div
			className="relative h-full w-full overflow-hidden bg-slate-900"
			ref={containerRef}>
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
				onHighlightPeople={(personIds, sourceNodeId) => {
					setSelectedPersonId(null);
					setHighlightSourceNodeId(sourceNodeId);
					setHighlightedPersonIds(personIds);
				}}
				onClearHighlights={() => {
					setHighlightSourceNodeId("");
					setHighlightedPersonIds([]);
				}}
			/>
		</div>
	);
}
