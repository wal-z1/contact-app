import { useCallback, useEffect, useRef, type MutableRefObject } from "react";
import { forceCollide } from "d3-force";
import ForceGraph2D from "react-force-graph-2d";
import type { ForceGraphMethods } from "react-force-graph-2d";
import type { GraphLink, GraphNode } from "./types";

type GraphCanvasProps = {
	fgRef: MutableRefObject<ForceGraphMethods<any, any> | undefined>;
	width: number;
	height: number;
	graphData: { nodes: GraphNode[]; links: GraphLink[] };
	linkDistance: number;
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
	highlightedPersonIds: string[];
	selectedPersonId: string | null;
	onSelectPerson: (id: string | null) => void;
	onHighlightPeople: (personIds: string[], sourceNodeId: string) => void;
	onClearHighlights: () => void;
};

type CanvasNode = GraphNode & {
	x?: number;
	y?: number;
	fx?: number | null;
	fy?: number | null;
};

type CanvasLink = GraphLink & {
	source: CanvasNode | string;
	target: CanvasNode | string;
};

export default function GraphCanvas({
	fgRef,
	width,
	height,
	graphData,
	linkDistance,
	physics,
	highlightedPersonIds,
	selectedPersonId,
	onSelectPerson,
	onHighlightPeople,
	onClearHighlights,
}: GraphCanvasProps) {
	const recentlyDraggedRef = useRef(false);
	const highlightedSet = useRef<Set<string>>(new Set());
	const nodeLinkCounts = useRef<Record<string, number>>({});

	useEffect(() => {
		highlightedSet.current = new Set(highlightedPersonIds);
	}, [highlightedPersonIds]);

	useEffect(() => {
		const graph = fgRef.current as
			| (ForceGraphMethods<any, any> & {
					d3AlphaDecay?: (value: number) => unknown;
					d3VelocityDecay?: (value: number) => unknown;
			  })
			| undefined;

		if (!graph) return;

		// Calculate how many connections each node has to dynamically adjust forces and declutter
		const counts: Record<string, number> = {};
		graphData.links.forEach((link) => {
			const sourceId =
				typeof link.source === "object"
					? (link.source as CanvasNode).id
					: (link.source as string);
			const targetId =
				typeof link.target === "object"
					? (link.target as CanvasNode).id
					: (link.target as string);
			counts[sourceId] = (counts[sourceId] || 0) + 1;
			counts[targetId] = (counts[targetId] || 0) + 1;
		});
		nodeLinkCounts.current = counts;

		const chargeForce = graph.d3Force("charge") as
			| {
					strength: (value: number | ((node: CanvasNode) => number)) => void;
					distanceMax: (value: number) => void;
			  }
			| undefined;

		const linkForce = graph.d3Force("link") as
			| {
					distance: (value: number | ((link: CanvasLink) => number)) => void;
					strength: (value: number | ((link: CanvasLink) => number)) => void;
					iterations?: (value: number) => void;
			  }
			| undefined;

		// Force the nodes away from the center by ensuring strong repulsion
		chargeForce?.strength((node) => {
			const base =
				node.nodeType === "person" ? physics.personCharge : physics.auxCharge;
			return -Math.abs(base) * 1.5 - 150;
		});
		// Allow the repulsion to act over a very long distance to push the graph out
		chargeForce?.distanceMax(Math.max(physics.chargeDistanceMax, 2000));

		const targetDistance = Math.max(60, Math.min(260, linkDistance));
		const relationshipDistance = targetDistance + 40;
		const tagDistance = Math.max(90, targetDistance + 60);

		// FIX CLUMPING: Push heavily connected items further outward
		linkForce?.distance((link) => {
			const l = link as CanvasLink;
			const sourceId =
				typeof l.source === "object"
					? (l.source as CanvasNode).id
					: (l.source as string);
			const targetId =
				typeof l.target === "object"
					? (l.target as CanvasNode).id
					: (l.target as string);
			const maxLinks = Math.max(
				nodeLinkCounts.current[sourceId] || 1,
				nodeLinkCounts.current[targetId] || 1,
			);

			let dist = l.kind === "tag" ? tagDistance : relationshipDistance;

			// If it's a hub with many links, forcefully extend the distance so they don't crash the center
			if (maxLinks > 10) {
				dist += maxLinks * 2.5;
			}
			return dist;
		});

		// FIX CLUMPING: Drastically reduce pull strength of mega-hubs to let them drift outward
		const baseStrength = 0.82 - ((targetDistance - 60) / 200) * 0.58;
		const relationshipStrength = Math.max(
			0.04,
			Math.min(0.15, baseStrength * 0.2),
		);
		const tagStrength = Math.max(0.02, relationshipStrength * 0.4);

		linkForce?.strength((link) => {
			const l = link as CanvasLink;
			const sourceId =
				typeof l.source === "object"
					? (l.source as CanvasNode).id
					: (l.source as string);
			const targetId =
				typeof l.target === "object"
					? (l.target as CanvasNode).id
					: (l.target as string);
			const maxLinks = Math.max(
				nodeLinkCounts.current[sourceId] || 1,
				nodeLinkCounts.current[targetId] || 1,
			);

			let strength = l.kind === "tag" ? tagStrength : relationshipStrength;
			if (maxLinks > 10) {
				strength = Math.max(0.005, strength / (maxLinks / 5));
			}
			return strength;
		});

		if (typeof linkForce?.iterations === "function") {
			linkForce.iterations(Math.max(physics.linkIterations, 5));
		}

		// Improve collision to establish a hard physical barrier ensuring spreading
		graph.d3Force(
			"collide",
			forceCollide<CanvasNode>((node) => {
				const base =
					node.nodeType === "person"
						? physics.collisionPerson
						: physics.collisionAux;
				const radius = node.size ?? (node.nodeType === "person" ? 24 : 18);
				return Math.max(base, radius + 25);
			}).iterations(5),
		);

		graph.d3AlphaDecay?.(physics.alphaDecay);
		graph.d3VelocityDecay?.(physics.velocityDecay);
		graph.d3ReheatSimulation();
	}, [
		fgRef,
		graphData.nodes.length,
		graphData.links.length,
		linkDistance,
		physics,
	]);

	const paintNode = useCallback(
		(node: CanvasNode, ctx: CanvasRenderingContext2D) => {
			if (typeof node.x !== "number" || typeof node.y !== "number") return;

			const isSelected =
				node.nodeType === "person" && selectedPersonId === node.id;
			const isHighlighted =
				node.nodeType === "person" && highlightedSet.current.has(node.id);

			ctx.save();
			ctx.textAlign = "center";
			ctx.textBaseline = "middle";

			if (node.nodeType !== "person") {
				const radius = node.size ?? 18;
				const tagLabel = String(node.label || "tag")
					.trim()
					.slice(0, 16);
				const isEvent = node.nodeType === "event";

				ctx.shadowColor = "rgba(0, 0, 0, 0.22)";
				ctx.shadowBlur = 10;

				ctx.beginPath();
				ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
				ctx.fillStyle = isEvent ? "#0f766e" : "#1e1b4b";
				ctx.fill();

				ctx.shadowBlur = 0;
				ctx.strokeStyle = isEvent ? "#14b8a6" : "#8b5cf6";
				ctx.lineWidth = 2;
				ctx.stroke();

				ctx.fillStyle = isEvent ? "#99f6e4" : "#e9d5ff";
				ctx.font = "700 11px sans-serif";
				ctx.fillText(isEvent ? "E" : "#", node.x, node.y - 1);

				ctx.fillStyle = "#ede9fe";
				ctx.font = "600 10px sans-serif";
				ctx.fillText(tagLabel, node.x, node.y + radius + 10);

				ctx.restore();
				return;
			}

			const firstName = String(node.label || "Unknown")
				.trim()
				.split(/\s+/)[0];
			const initial =
				node.initial || (firstName[0] ? firstName[0].toUpperCase() : "?");
			const radius = node.size ?? 24;

			ctx.shadowColor = "rgba(0, 0, 0, 0.28)";
			ctx.shadowBlur = 14;

			ctx.beginPath();
			ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
			ctx.fillStyle = "#0f172a";
			ctx.fill();

			ctx.shadowBlur = 0;
			ctx.strokeStyle = isSelected
				? "#a855f7"
				: isHighlighted
					? "#22d3ee"
					: "#475569";
			ctx.lineWidth = isSelected ? 3 : isHighlighted ? 2.5 : 1.5;
			ctx.stroke();

			if (isSelected || isHighlighted) {
				ctx.beginPath();
				ctx.arc(node.x, node.y, radius + 6, 0, 2 * Math.PI);
				ctx.strokeStyle = isSelected
					? "rgba(168, 85, 247, 0.75)"
					: "rgba(34, 211, 238, 0.7)";
				ctx.lineWidth = isSelected ? 2.2 : 1.8;
				ctx.stroke();
			}

			ctx.beginPath();
			ctx.arc(node.x, node.y - 5, 11, 0, 2 * Math.PI);
			ctx.fillStyle = isSelected
				? "#a855f7"
				: isHighlighted
					? "#06b6d4"
					: node.color || "#7c3aed";
			ctx.fill();

			ctx.fillStyle = "#ffffff";
			ctx.font = "bold 11px sans-serif";
			ctx.fillText(initial, node.x, node.y - 5);

			ctx.fillStyle = "#f8fafc";
			ctx.font = "600 10px sans-serif";
			ctx.fillText(firstName.slice(0, 12), node.x, node.y + 12);

			ctx.restore();
		},
		[selectedPersonId],
	);

	if (width <= 0 || height <= 0) return null;

	return (
		<ForceGraph2D
			ref={fgRef}
			width={width}
			height={height}
			graphData={graphData}
			backgroundColor="#0f172a"
			nodeCanvasObject={paintNode}
			nodePointerAreaPaint={(node, color, ctx) => {
				const graphNode = node as CanvasNode;
				if (
					typeof graphNode.x !== "number" ||
					typeof graphNode.y !== "number"
				) {
					return;
				}

				const radius = graphNode.size ?? (graphNode.isTag ? 18 : 24);

				ctx.fillStyle = color;
				ctx.beginPath();
				ctx.arc(graphNode.x, graphNode.y, radius, 0, 2 * Math.PI);
				ctx.fill();
			}}
			linkColor={(link) => {
				const l = link as CanvasLink;

				// Identify how heavily connected the targets are
				const sourceId =
					typeof l.source === "object"
						? (l.source as CanvasNode).id
						: (l.source as string);
				const targetId =
					typeof l.target === "object"
						? (l.target as CanvasNode).id
						: (l.target as string);
				const maxLinks = Math.max(
					nodeLinkCounts.current[sourceId] || 1,
					nodeLinkCounts.current[targetId] || 1,
				);

				let r, g, b, baseAlpha;
				if (l.kind === "tag") {
					r = 167;
					g = 139;
					b = 250;
					baseAlpha = 0.32;
				} else if (l.kind === "event") {
					r = 20;
					g = 184;
					b = 166;
					baseAlpha = 0.3;
				} else {
					r = 148;
					g = 163;
					b = 184;
					baseAlpha = 0.4;
				}

				// FIX CLUTTER: Dramatically fade out lines pointing to massive hubs
				let alpha = baseAlpha;
				if (maxLinks > 8) {
					// 200 links -> baseAlpha * (8 / 200) -> nearly transparent, decluttering the view
					alpha = Math.max(0.02, baseAlpha * (8 / maxLinks));
				}

				return `rgba(${r}, ${g}, ${b}, ${alpha})`;
			}}
			linkWidth={(link) =>
				(link as GraphLink).kind === "tag"
					? 1.5
					: (link as GraphLink).kind === "event"
						? 1.6
						: 2.2
			}
			linkCurvature={(link) =>
				(link as GraphLink).kind === "relationship" ? 0.08 : 0
			}
			onNodeClick={(node) => {
				if (recentlyDraggedRef.current) return;
				const clicked = node as GraphNode;
				if (clicked.nodeType === "person") {
					onClearHighlights();
					onSelectPerson(clicked.id);
					return;
				}
				const related = Array.isArray(clicked.connectedPersonIds)
					? clicked.connectedPersonIds
					: [];
				onHighlightPeople(related, clicked.id);
			}}
			onNodeDrag={() => {
				recentlyDraggedRef.current = true;
			}}
			onNodeDragEnd={(node) => {
				const graphNode = node as CanvasNode;

				if (
					typeof graphNode.x === "number" &&
					typeof graphNode.y === "number"
				) {
					graphNode.fx = graphNode.x;
					graphNode.fy = graphNode.y;
				}

				window.setTimeout(() => {
					recentlyDraggedRef.current = false;
				}, 140);
			}}
			onNodeRightClick={(node) => {
				const graphNode = node as CanvasNode;
				graphNode.fx = null;
				graphNode.fy = null;
				fgRef.current?.d3ReheatSimulation();
			}}
			onBackgroundClick={() => {
				onClearHighlights();
				onSelectPerson(null);
			}}
			cooldownTicks={180}
			warmupTicks={30}
			enableNodeDrag={true}
			enableZoomInteraction={true}
			enablePanInteraction={true}
		/>
	);
}
