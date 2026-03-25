export type Socials = {
	instagram: string[];
	linkedin: string[];
	twitter: string[];
	github?: string[];
	mastodon?: string[];
	website?: string[];
};

export type TimelineEvent = {
	id: string;
	// 'date' => single day; 'range' => start-end period
	kind: "date" | "range";
	date?: string;
	startDate?: string;
	endDate?: string;
	note: string;
	// optional reference to a global Event id
	sourceId?: string;
};

export type Event = {
	id: string;
	title: string;
	kind: "date" | "range";
	date?: string;
	startDate?: string;
	endDate?: string;
	note?: string;
};

export type Person = {
	id: string;
	name: string;
	nodeColor?: string;
	description: string;
	// Detailed memories/lore about the person (optional).
	lore: string;
	firstInteraction: string;
	lastInteraction: string;
	// list of tag ids referencing the global `tags` table
	inrete: string[];
	year: number;
	email: string;
	phone: string;
	socials: Socials;
	events: TimelineEvent[];
};

export type RelationshipType = string;

export type Relationship = {
	id: string;
	from: string;
	to: string;
	type: RelationshipType;
};

export type Tag = {
	id: string;
	// human-facing label
	name: string;
	// normalized for lookups (lowercase, underscores)
	normalized?: string;
};
