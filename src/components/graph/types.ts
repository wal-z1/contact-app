export type GraphNode = {
	id: string;
	label: string;
	fullName: string;
	initial: string;
	color?: string;
	isTag: boolean;
	nodeType: "person" | "tag" | "event";
	size: number;
	connectedPersonIds?: string[];
};

export type GraphLink = {
	source: string;
	target: string;
	kind: "relationship" | "tag" | "event";
};

export type EventOption = {
	id: string;
	title: string;
};
