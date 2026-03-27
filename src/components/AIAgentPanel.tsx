import { useMemo, useState, useRef, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import { useAppStore } from "../store/useAppStore";
import type { Person } from "../models/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type AppTag = {
	id: string;
	name: string;
	normalized: string;
};

type PersonWithShape = Person & {
	inrete?: string[];
	socials?: Record<string, string[]>;
	tiktok?: string;
	facebook?: string;
};

type BatchReviewMatch = {
	input: string;
	personId?: string;
	personName?: string;
	confidence?: number;
	reason?: string;
};

type BatchReviewNewPerson = {
	name?: string;
	year?: number;
	email?: string;
	phone?: string;
	location?: string;
	description?: string;
	instagram?: string;
	tiktok?: string;
	facebook?: string;
	_selected?: boolean;
	_editName?: string;
};

type BatchReviewState = {
	message: string;
	matches: BatchReviewMatch[];
	possibleMatches: BatchReviewMatch[];
	newPeople: BatchReviewNewPerson[];
	rawInput?: string;
	dataType?: string;
	summary?: string;
};

type AgentAction =
	| {
			action: "create_person";
			args: {
				name?: string;
				year?: number;
				email?: string;
				phone?: string;
				location?: string;
				description?: string;
			};
			message?: string;
	  }
	| {
			action: "remove_tag_from_people";
			args: {
				personNames?: string[];
				tagName?: string;
			};
			message?: string;
	  }
	| {
			action: "remove_tag_from_person";
			args: {
				personName?: string;
				tagName?: string;
			};
			message?: string;
	  }
	| {
			action: "bulk_remove_tag";
			args: { tagName?: string };
			message?: string;
	  }
	| {
			action: "update_person";
			args: {
				personName?: string;
				patch?: Record<string, unknown>;
			};
			message?: string;
	  }
	| {
			action: "bulk_update_people";
			args: {
				tagName?: string;
				patch?: Record<string, unknown>;
			};
			message?: string;
	  }
	| {
			action: "multi_update_people";
			args: {
				personNames?: string[];
				patch?: Record<string, unknown>;
			};
			message?: string;
	  }
	| {
			action: "review_people_batch";
			args: {
				matches?: BatchReviewMatch[];
				possibleMatches?: BatchReviewMatch[];
				newPeople?: BatchReviewNewPerson[];
				rawInput?: string;
				dataType?: string;
				summary?: string;
			};
			message?: string;
	  }
	| {
			action: "select_person";
			args: { personName?: string };
			message?: string;
	  }
	| {
			action: "link_people";
			args: { fromName?: string; toName?: string; type?: string };
			message?: string;
	  }
	| {
			action: "none";
			args?: Record<string, unknown>;
			message?: string;
	  }
	| {
			action: "bulk_link_people_by_tag";
			args: { tagName?: string; type?: string };
			message?: string;
	  }
	| {
			action: "bulk_unlink_people_by_tag";
			args: { tagName?: string; type?: string };
			message?: string;
	  };

// ─── Input Mode Detection ──────────────────────────────────────────────────

type InputMode = "command" | "bulk";

type ModeAnalysis = {
	mode: InputMode;
	confidence: "high" | "medium" | "low";
	reason: string;
	dataHint?: string; // e.g. "instagram_followers", "name_list", "csv", "mixed_dump"
};

function analyzeInputMode(text: string): ModeAnalysis {
	const source = String(text ?? "").trim();
	if (!source) return { mode: "command", confidence: "high", reason: "empty" };

	const lines = source
		.split("\n")
		.map((s) => s.trim())
		.filter(Boolean);

	const parsedFollowers = parseInstagramFollowersDump(source);
	if (parsedFollowers.length >= 4) {
		return {
			mode: "bulk",
			confidence: "high",
			reason: `Detected ${parsedFollowers.length} Instagram followers`,
			dataHint: "instagram_followers",
		};
	}

	const handleCount = (source.match(/@[a-z0-9._-]+/gi) ?? []).length;
	if (handleCount >= 5) {
		return {
			mode: "bulk",
			confidence: "high",
			reason: `${handleCount} social handles detected`,
			dataHint: "handle_list",
		};
	}

	const urlCount = extractUrls(source).length;
	if (urlCount >= 5) {
		return {
			mode: "bulk",
			confidence: "high",
			reason: `${urlCount} URLs detected`,
			dataHint: "url_list",
		};
	}

	// CSV shape: commas + multiple rows
	const commaLines = lines.filter((l) => l.includes(","));
	if (commaLines.length >= 5 && lines.length >= 5) {
		return {
			mode: "bulk",
			confidence: "high",
			reason: `${lines.length} CSV-shaped rows`,
			dataHint: "csv",
		};
	}

	const hasBulkKeyword =
		/\b(followers|following|import|list|batch|paste|pasted|csv|usernames?|contacts?|export|dump)\b/i.test(
			source,
		);
	if (hasBulkKeyword && lines.length >= 3) {
		return {
			mode: "bulk",
			confidence: "medium",
			reason: "bulk keyword + multiple lines",
			dataHint: "mixed_dump",
		};
	}

	if (lines.length >= 10) {
		return {
			mode: "bulk",
			confidence: "medium",
			reason: `${lines.length} lines of content`,
			dataHint: "name_list",
		};
	}

	// Command signals: verb at start, mentions existing names, short & imperative
	const commandPattern =
		/^(add|create|update|set|change|remove|delete|link|select|find|make|tag|give|assign|connect)\b/i;
	if (commandPattern.test(source) && lines.length <= 4) {
		return {
			mode: "command",
			confidence: "high",
			reason: "starts with command verb",
		};
	}

	if (lines.length <= 3) {
		return {
			mode: "command",
			confidence: "medium",
			reason: "short single-intent text",
		};
	}

	return { mode: "bulk", confidence: "low", reason: "long unstructured text" };
}

const DATA_HINT_LABELS: Record<string, string> = {
	instagram_followers: "Instagram followers dump",
	handle_list: "Social handles list",
	url_list: "URL / links list",
	csv: "CSV / spreadsheet data",
	mixed_dump: "Mixed contact dump",
	name_list: "Name list",
};

// ─── Gemini / LLM helpers ──────────────────────────────────────────────────

const GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite"] as const;

type GeminiGenerateContentResponse = {
	candidates?: Array<{
		content?: {
			parts?: Array<{ text?: string }>;
		};
	}>;
};

function unwrapJson(text: string): string {
	const trimmed = String(text ?? "").trim();
	if (!trimmed) return "{}";
	if (trimmed.startsWith("```") && trimmed.includes("\n")) {
		return trimmed
			.replace(/^```(?:json)?\s*/i, "")
			.replace(/```$/i, "")
			.trim();
	}
	return trimmed;
}

async function callGemini(
	apiKey: string,
	payload: unknown,
): Promise<GeminiGenerateContentResponse> {
	let lastError: Error | null = null;
	for (const model of GEMINI_MODELS) {
		const response = await fetch(
			`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			},
		);
		if (response.ok)
			return (await response.json()) as GeminiGenerateContentResponse;
		lastError = new Error(
			`Gemini ${model} failed (${response.status}): ${await response.text()}`,
		);
	}
	throw lastError ?? new Error("Gemini request failed.");
}

// ─── String / name utils ─────────────────────────────────────────────────

function sanitizeString(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}

function normalizeName(value: string): string {
	return String(value ?? "")
		.normalize("NFKC")
		.toLowerCase()
		.replace(/[^\p{L}\p{N}\s]/gu, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function tokenizeName(value: string): string[] {
	return normalizeName(value)
		.split(" ")
		.map((s) => s.trim())
		.filter(Boolean);
}

function normalizeTag(value: string): string {
	return sanitizeString(value).toLowerCase();
}

function slugId(value: string): string {
	return sanitizeString(value)
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

function uniqueStrings(values: string[]): string[] {
	return Array.from(new Set(values.filter(Boolean)));
}

// ─── Fuzzy string matching ────────────────────────────────────────────────

function levenshtein(a: string, b: string): number {
	const m = a.length,
		n = b.length;
	const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
		Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
	);
	for (let i = 1; i <= m; i++)
		for (let j = 1; j <= n; j++)
			dp[i][j] =
				a[i - 1] === b[j - 1]
					? dp[i - 1][j - 1]
					: 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
	return dp[m][n];
}

function stringSimilarity(a: string, b: string): number {
	if (!a && !b) return 1;
	if (!a || !b) return 0;
	const dist = levenshtein(a, b);
	return 1 - dist / Math.max(a.length, b.length);
}

function findPersonByName(
	people: PersonWithShape[],
	rawName: string,
): PersonWithShape | undefined {
	const query = normalizeName(rawName);
	if (!query) return undefined;

	const exact = people.find(
		(p) => normalizeName(String(p.name ?? "")) === query,
	);
	if (exact) return exact;

	const includes = people.find((p) =>
		normalizeName(String(p.name ?? "")).includes(query),
	);
	if (includes) return includes;

	const reverseIncludes = people.find((p) =>
		query.includes(normalizeName(String(p.name ?? ""))),
	);
	if (reverseIncludes) return reverseIncludes;

	const queryTokens = tokenizeName(rawName);
	if (queryTokens.length === 0) return undefined;

	let bestMatch: PersonWithShape | undefined;
	let bestScore = 0;

	for (const person of people) {
		const personTokens = tokenizeName(String(person.name ?? ""));
		if (personTokens.length === 0) continue;
		let score = 0;
		for (const qt of queryTokens) {
			if (personTokens.includes(qt)) score += 2;
			else if (personTokens.some((pt) => pt.includes(qt) || qt.includes(pt)))
				score += 1;
		}
		if (score > bestScore) {
			bestScore = score;
			bestMatch = person;
		}
	}

	if (bestMatch && bestScore >= Math.max(1, queryTokens.length))
		return bestMatch;

	// ── Fuzzy fallback: Levenshtein on full normalized name ──────────────
	const SIMILARITY_THRESHOLD = 0.72; // tweakable: 0 = anything, 1 = exact
	let fuzzyBest: PersonWithShape | undefined;
	let fuzzyBestScore = 0;

	for (const person of people) {
		const personNorm = normalizeName(String(person.name ?? ""));
		if (!personNorm) continue;

		// Score against full name
		let score = stringSimilarity(query, personNorm);

		// Also score each token of the person's name against each query token
		const personTokens = tokenizeName(String(person.name ?? ""));
		for (const qt of queryTokens) {
			for (const pt of personTokens) {
				const s = stringSimilarity(qt, pt);
				if (s > score) score = s;
			}
		}

		if (score > fuzzyBestScore) {
			fuzzyBestScore = score;
			fuzzyBest = person;
		}
	}

	return fuzzyBest && fuzzyBestScore >= SIMILARITY_THRESHOLD
		? fuzzyBest
		: undefined;
}

function extractUrls(text: string): string[] {
	return (String(text ?? "").match(/https?:\/\/[^\s]+/gi) ?? []).map((url) =>
		url.trim().replace(/[),.;]+$/, ""),
	);
}

function extractSocialUpdates(text: string): {
	socials: Record<string, string[]>;
	flat: Partial<PersonWithShape>;
} {
	const urls = extractUrls(text);
	const socials: Record<string, string[]> = {};
	const flat: Partial<PersonWithShape> = {};

	for (const url of urls) {
		const lower = url.toLowerCase();
		if (lower.includes("instagram.com")) {
			socials.instagram = uniqueStrings([...(socials.instagram ?? []), url]);
			continue;
		}
		if (lower.includes("linkedin.com")) {
			socials.linkedin = uniqueStrings([...(socials.linkedin ?? []), url]);
			continue;
		}
		if (lower.includes("twitter.com") || lower.includes("x.com")) {
			socials.twitter = uniqueStrings([...(socials.twitter ?? []), url]);
			continue;
		}
		if (lower.includes("github.com")) {
			socials.github = uniqueStrings([...(socials.github ?? []), url]);
			continue;
		}
		if (lower.includes("facebook.com")) {
			socials.facebook = uniqueStrings([...(socials.facebook ?? []), url]);
			flat.facebook = url;
			continue;
		}
		if (lower.includes("tiktok.com")) {
			flat.tiktok = url;
			continue;
		}
		socials.website = uniqueStrings([...(socials.website ?? []), url]);
	}

	return { socials, flat };
}

function extractRequestedTag(text: string): string | undefined {
	const source = String(text ?? "");
	const match =
		source.match(/tag\s+(?:saying|called|named)?\s*["']([^"']+)["']/i) ??
		source.match(/add\s+tag\s+["']([^"']+)["']/i) ??
		source.match(/add\s+tag\s+([a-z0-9 _-]+)/i);
	return match?.[1]?.trim() || undefined;
}

function extractBulkTagYearRequest(text: string): {
	tagName?: string;
	year?: number;
} {
	const source = String(text ?? "").trim();
	const bulkMatch =
		source.match(
			/all\s+(?:people|ppl|persons?)\s+that\s+have\s+["']?([^"'\n]+?)["']?\s+tag.*?\b(?:year|years|known from years?)\b.*?\bto\b\s*(\d{4})/i,
		) ??
		source.match(
			/all\s+(?:people|ppl|persons?)\s+with\s+["']?([^"'\n]+?)["']?\s+tag.*?\b(?:year|years|known from years?)\b.*?\bto\b\s*(\d{4})/i,
		) ??
		source.match(
			/["']?([^"'\n]+?)["']?\s+tag.*?\ball\s+(?:people|ppl|persons?).*?\b(?:year|years|known from years?)\b.*?\bto\b\s*(\d{4})/i,
		);
	if (!bulkMatch) return {};
	return { tagName: sanitizeString(bulkMatch[1]), year: Number(bulkMatch[2]) };
}

// ─── Instagram parser ────────────────────────────────────────────────────

type ParsedInstagramFollower = { username: string; displayName?: string };

function looksLikeInstagramUsername(value: string): boolean {
	const v = String(value ?? "").trim();
	return (
		Boolean(v) && v.length <= 30 && !v.includes(" ") && /^[a-z0-9._]+$/i.test(v)
	);
}

function parseInstagramFollowersDump(text: string): ParsedInstagramFollower[] {
	const lines = String(text ?? "")
		.split("\n")
		.map((s) => s.trim())
		.filter((s) => s && s !== "⠀");

	const startIndex = lines.findIndex((line) =>
		/followers of .* on instagram/i.test(line),
	);
	const body = startIndex >= 0 ? lines.slice(startIndex + 1) : lines;
	const cleaned = body.filter(
		(line) =>
			!/^search$/i.test(line) && !/^followers of .* on instagram$/i.test(line),
	);

	const parsed: ParsedInstagramFollower[] = [];
	for (let i = 0; i < cleaned.length; i++) {
		const current = cleaned[i];
		if (!looksLikeInstagramUsername(current)) continue;
		const next = cleaned[i + 1];
		const nextIsUsername = looksLikeInstagramUsername(next);
		parsed.push({
			username: current,
			displayName: next && !nextIsUsername ? next : undefined,
		});
		if (next && !nextIsUsername) i += 1;
	}
	return parsed;
}

// ─── System prompts ──────────────────────────────────────────────────────

const COMMAND_SYSTEM_PROMPT = [
	"You are a contact-app command executor. The user gave a short, direct command.",
	"Return strict JSON only. No markdown, no explanations.",
	"Schema: { action: string, args: object, message?: string }",
	"",
	"Supported actions:",
	"- create_person: args: { name, year?, email?, phone?, location?, description? }",
	"- update_person: args: { personName, patch: { ...fields } }",
	"- bulk_update_people: args: { tagName, patch: { ...fields } }",
	"- bulk_link_people_by_tag: args: { tagName, type }",
	"- bulk_unlink_people_by_tag: args: { tagName, type }",
	"- select_person: args: { personName }",
	"- remove_tag_from_people: args: { personNames: string[], tagName } — remove a tag from multiple specific named people.",
	"- link_people: args: { fromName, toName, type }",
	"- bulk_remove_tag: args: { tagName } — remove a tag from ALL people who currently have it.",
	"- none: args: {}",
	"- multi_update_people: args: { personNames: string[], patch: { ...fields } }  — use when the same patch applies to multiple specific named people.",
	"",
	"- remove_tag_from_person: args: { personName, tagName } — remove a single tag from a specific person.",
	"Rules:",
	"- Use exact person names from the provided people list.",
	"- Tags are stored as IDs in args.patch.inrete[].",
	"- Social links go in args.patch.socials (keys: instagram, linkedin, twitter, github, mastodon, website, facebook).",
	"- tiktok stored as args.patch.tiktok (string URL).",
	"- For tag additions, look up the tag by name and use its id.",
	"- If 'this person' is mentioned, use the selected person.",
	"- location field for city/country, not for tag.",
	"- year = known-since year (integer).",
	"- Return 'none' if ambiguous.",
].join("\n");

const BULK_SYSTEM_PROMPT = [
	"You are a contact-app data analyst. The user pasted a large, unstructured dump of contact data.",
	"Your job: parse, classify, and plan — do NOT apply changes yet.",
	"Return strict JSON only. No markdown, no explanations.",
	"",
	"Schema:",
	"{",
	"  action: 'review_people_batch',",
	"  args: {",
	"    dataType: string,       // 'instagram_followers' | 'name_list' | 'csv' | 'handle_list' | 'url_list' | 'mixed_dump'",
	"    summary: string,        // 1-2 sentence plain-English description of what you found",
	"    matches: BatchReviewMatch[],       // strong match to existing person",
	"    possibleMatches: BatchReviewMatch[], // uncertain match",
	"    newPeople: NewPerson[],            // definitely new",
	"    rawInput?: string",
	"  },",
	"  message?: string",
	"}",
	"",
	"BatchReviewMatch: { input: string, personId?: string, personName?: string, confidence?: number, reason?: string }",
	"NewPerson: { name?, year?, email?, phone?, location?, description?, instagram?, tiktok?, facebook? }",
	"",
	"Rules for analysis:",
	"- Classify data type accurately (instagram_followers, csv, name_list, handle_list, url_list, mixed_dump).",
	"- Write a clear summary explaining what the data contains and what you're proposing.",
	"- For Instagram followers: use displayName as name, build instagram URL from username.",
	"- For CSV: detect columns (name, email, phone, etc) and map them.",
	"- For name lists: each line is a potential person name.",
	"- For handle lists: each @handle maps to a social account.",
	"- Cross-reference with the existing people list — flag strong matches (same name/handle) vs new.",
	"- Do NOT pair one person's username with another person's name.",
	"- Preserve non-Latin and stylized names exactly as given.",
	"- If a follower has only a username and no displayName, use the username as the fallback name.",
	"- Instagram URL format: https://instagram.com/<username>",
	"- Be conservative with matches: prefer 'newPeople' over wrong 'matches'.",
].join("\n");

// ─── Main Component ──────────────────────────────────────────────────────

export default function AIAgentPanel() {
	const people =
		useLiveQuery<PersonWithShape[]>(() => db.people.toArray(), []) ?? [];

	const tags =
		useLiveQuery<AppTag[]>(() => {
			const anyDb = db as unknown as {
				tags?: { toArray: () => Promise<AppTag[]> };
			};
			return anyDb.tags?.toArray?.() ?? Promise.resolve([]);
		}, []) ?? [];

	const addPerson = useAppStore((s) => s.addPerson);
	const updatePerson = useAppStore((s) => s.updatePerson);
	const createRelationship = useAppStore((s) => s.createRelationship);
	const setSelectedPersonId = useAppStore((s) => s.setSelectedPersonId);
	const selectedPersonId = useAppStore((s) => s.selectedPersonId);

	const [prompt, setPrompt] = useState("");
	const [running, setRunning] = useState(false);
	const [result, setResult] = useState("");
	const [error, setError] = useState(false);
	const [batchReview, setBatchReview] = useState<BatchReviewState | null>(null);
	const [modeAnalysis, setModeAnalysis] = useState<ModeAnalysis | null>(null);
	// Track selected new people for selective creation
	const [selectedNewPeople, setSelectedNewPeople] = useState<Set<number>>(
		new Set(),
	);
	// Inline name edits
	const [nameEdits, setNameEdits] = useState<Record<number, string>>({});

	const textareaRef = useRef<HTMLTextAreaElement>(null);

	const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
	const hasApiKey = Boolean(apiKey && apiKey.trim());

	const selectedPerson = useMemo(
		() => people.find((p) => p.id === selectedPersonId),
		[people, selectedPersonId],
	);

	const peopleContext = useMemo(
		() =>
			people.slice(0, 200).map((p) => ({
				id: p.id,
				name: p.name,
				year: p.year,
				email: p.email ?? "",
				phone: p.phone ?? "",
				location: p.location ?? "",
				inrete: p.inrete ?? [],
				socials: p.socials ?? {},
				tiktok: p.tiktok ?? "",
				facebook: p.facebook ?? "",
			})),
		[people],
	);

	const tagsContext = useMemo(
		() =>
			tags
				.slice(0, 500)
				.map((t) => ({ id: t.id, name: t.name, normalized: t.normalized })),
		[tags],
	);

	// Auto-detect mode as user types (debounced)
	useEffect(() => {
		const timer = setTimeout(() => {
			if (prompt.trim().length > 10) {
				setModeAnalysis(analyzeInputMode(prompt));
			} else {
				setModeAnalysis(null);
			}
		}, 300);
		return () => clearTimeout(timer);
	}, [prompt]);

	// When batch review opens, pre-select all new people
	useEffect(() => {
		if (batchReview) {
			const allIndices = new Set(batchReview.newPeople.map((_, i) => i));
			setSelectedNewPeople(allIndices);
			setNameEdits({});
		}
	}, [batchReview]);

	const ensureTag = async (tagName: string): Promise<AppTag> => {
		const normalized = normalizeTag(tagName);
		const existing = tags.find((t) => t.normalized === normalized);
		if (existing) return existing;
		const newTag: AppTag = {
			id: slugId(tagName) || `tag-${Date.now()}`,
			name: tagName.trim(),
			normalized,
		};
		const anyDb = db as unknown as {
			tags?: { put: (value: AppTag) => Promise<unknown> };
		};
		if (anyDb.tags?.put) {
			await anyDb.tags.put(newTag);
			return newTag;
		}
		return newTag;
	};

	// ─── Batch Review Actions ──────────────────────────────────────────

	const handleApplyBatchCreateSelected = async () => {
		if (!batchReview?.newPeople?.length) return;
		setRunning(true);
		setError(false);

		try {
			const toCreate = batchReview.newPeople.filter((_, i) =>
				selectedNewPeople.has(i),
			);
			let created = 0;

			for (const candidate of toCreate) {
				const rawName =
					nameEdits[batchReview.newPeople.indexOf(candidate)] ?? candidate.name;
				const name = sanitizeString(rawName);
				if (!name) continue;

				await addPerson({
					name,
					year: Number.isFinite(Number(candidate.year))
						? Number(candidate.year)
						: new Date().getFullYear(),
					email: sanitizeString(candidate.email),
					phone: sanitizeString(candidate.phone),
					location: sanitizeString(candidate.location),
					description: sanitizeString(candidate.description),
					inrete: [],
					socials: {
						instagram: candidate.instagram
							? [
									sanitizeString(candidate.instagram).startsWith("http")
										? sanitizeString(candidate.instagram)
										: `https://instagram.com/${sanitizeString(candidate.instagram).replace(/^@/, "")}`,
								].filter(Boolean)
							: [],
						linkedin: [],
						twitter: [],
						github: [],
						mastodon: [],
						website: [],
						facebook: candidate.facebook
							? [sanitizeString(candidate.facebook)].filter(Boolean)
							: [],
					},
					tiktok: sanitizeString(candidate.tiktok),
					facebook: sanitizeString(candidate.facebook),
					events: [],
				} as Parameters<typeof addPerson>[0]);
				created++;
			}

			setResult(
				`✓ Created ${created} new ${created === 1 ? "person" : "people"}.`,
			);
			setBatchReview(null);
			setError(false);
		} catch (err) {
			setError(true);
			setResult(err instanceof Error ? err.message : "Failed creating batch.");
		} finally {
			setRunning(false);
		}
	};

	const handleSelectFirstMatch = () => {
		if (!batchReview?.matches?.length) return;
		const first = batchReview.matches[0];
		if (!first.personId) return;
		setSelectedPersonId(first.personId);
		setResult(`Selected ${first.personName || "matched person"}.`);
		setBatchReview(null);
		setError(false);
	};

	const toggleNewPerson = (idx: number) => {
		setSelectedNewPeople((prev) => {
			const next = new Set(prev);
			if (next.has(idx)) next.delete(idx);
			else next.add(idx);
			return next;
		});
	};

	const toggleAllNewPeople = () => {
		if (!batchReview) return;
		if (selectedNewPeople.size === batchReview.newPeople.length) {
			setSelectedNewPeople(new Set());
		} else {
			setSelectedNewPeople(new Set(batchReview.newPeople.map((_, i) => i)));
		}
	};

	// ─── Main Agent Run ──────────────────────────────────────────────

	const runAgent = async () => {
		const userText = prompt.trim();
		if (!userText) return;

		if (!hasApiKey) {
			setError(true);
			setResult(
				"Missing Gemini key. Add VITE_GEMINI_API_KEY in .env.local and restart dev server.",
			);
			return;
		}

		setRunning(true);
		setError(false);
		setResult("Thinking...");
		setBatchReview(null);

		try {
			const mode = analyzeInputMode(userText);
			setModeAnalysis(mode);

			// ── Direct heuristic fast-paths (command mode only) ──────────────

			if (mode.mode === "command") {
				const directBulkTagYear = extractBulkTagYearRequest(userText);

				if (
					directBulkTagYear.tagName &&
					Number.isFinite(directBulkTagYear.year)
				) {
					const normalized = normalizeTag(directBulkTagYear.tagName);
					const tag = tags.find(
						(t) =>
							normalizeTag(t.normalized || t.name) === normalized ||
							normalizeTag(t.name) === normalized,
					);
					if (!tag)
						throw new Error(
							`Could not find tag "${directBulkTagYear.tagName}".`,
						);

					const matchedPeople = people.filter((p) =>
						Array.isArray(p.inrete) ? p.inrete.includes(tag.id) : false,
					);
					if (matchedPeople.length === 0)
						throw new Error(
							`No people found with tag "${directBulkTagYear.tagName}".`,
						);

					await Promise.all(
						matchedPeople.map((p) =>
							updatePerson(p.id, { year: directBulkTagYear.year! }),
						),
					);
					setResult(
						`Updated ${matchedPeople.length} people with tag "${tag.name}" → year ${directBulkTagYear.year}.`,
					);
					setError(false);
					return;
				}
			}

			// ── Choose system prompt by mode ──────────────────────────────

			const parsedFollowers = parseInstagramFollowersDump(userText);
			const systemPrompt =
				mode.mode === "bulk" ? BULK_SYSTEM_PROMPT : COMMAND_SYSTEM_PROMPT;

			const userContextBlock = [
				`Selected person:\n${JSON.stringify(
					selectedPerson
						? {
								id: selectedPerson.id,
								name: selectedPerson.name,
								inrete: selectedPerson.inrete ?? [],
								socials: selectedPerson.socials ?? {},
							}
						: null,
				)}`,
				`People (first 200):\n${JSON.stringify(peopleContext)}`,
				`Global tags:\n${JSON.stringify(tagsContext)}`,
				mode.mode === "bulk" && parsedFollowers.length > 0
					? `Parsed Instagram followers:\n${JSON.stringify(parsedFollowers.slice(0, 300))}`
					: null,
				mode.mode === "bulk"
					? `Detected data hint: ${mode.dataHint ?? "unknown"}`
					: null,
				`User input:\n${userText}`,
			]
				.filter(Boolean)
				.join("\n\n");

			const payload = {
				contents: [
					{
						role: "user",
						parts: [{ text: `${systemPrompt}\n\n---\n\n${userContextBlock}` }],
					},
				],
				generationConfig: {
					temperature: mode.mode === "bulk" ? 0.15 : 0.05,
					responseMimeType: "application/json",
				},
			};

			const data = await callGemini(apiKey!.trim(), payload);

			const rawText =
				data.candidates?.[0]?.content?.parts?.[0]?.text ??
				'{"action":"none","args":{},"message":"No change was applied."}';

			const action = JSON.parse(unwrapJson(rawText)) as AgentAction;

			// ── Handle review_people_batch ────────────────────────────────

			if (action.action === "review_people_batch") {
				const rawMatches = Array.isArray(action.args?.matches)
					? action.args.matches
					: [];
				const rawPossibleMatches = Array.isArray(action.args?.possibleMatches)
					? action.args.possibleMatches
					: [];
				const newPeople = Array.isArray(action.args?.newPeople)
					? action.args.newPeople
					: [];

				const enrichMatch = (item: BatchReviewMatch): BatchReviewMatch => {
					const input = sanitizeString(item.input);
					const personId = sanitizeString(item.personId);
					const aiPersonName = sanitizeString(item.personName);
					const personFromId = personId
						? people.find((p) => p.id === personId)
						: undefined;
					const personFromName = aiPersonName
						? findPersonByName(people, aiPersonName)
						: undefined;
					const matchedPerson = personFromId || personFromName;

					return {
						...item,
						input:
							input ||
							aiPersonName ||
							(matchedPerson ? matchedPerson.name : ""),
						personId: matchedPerson?.id || personId || undefined,
						personName: matchedPerson?.name || aiPersonName || undefined,
						reason: sanitizeString(item.reason),
						confidence:
							typeof item.confidence === "number" ? item.confidence : undefined,
					};
				};

				const matches = rawMatches
					.map(enrichMatch)
					.filter((item) =>
						Boolean(
							sanitizeString(item.input) ||
							sanitizeString(item.personName) ||
							sanitizeString(item.personId),
						),
					);

				const possibleMatches = rawPossibleMatches
					.map(enrichMatch)
					.filter((item) =>
						Boolean(
							sanitizeString(item.input) ||
							sanitizeString(item.personName) ||
							sanitizeString(item.personId),
						),
					);

				setBatchReview({
					message:
						action.message ||
						`Found ${matches.length} matches, ${possibleMatches.length} possible, ${newPeople.length} new.`,
					matches,
					possibleMatches,
					newPeople,
					rawInput: sanitizeString(action.args?.rawInput),
					dataType: sanitizeString(action.args?.dataType),
					summary: sanitizeString(action.args?.summary),
				});

				setResult(
					action.message ||
						`Analysis complete — ${newPeople.length} new people to review.`,
				);
				setError(false);
				return;
			}

			// ── create_person ─────────────────────────────────────────────

			if (action.action === "create_person") {
				const name = sanitizeString(action.args?.name);
				if (!name) throw new Error("AI command missing person name.");
				const year = Number(action.args?.year);

				await addPerson({
					name,
					year: Number.isFinite(year) ? year : new Date().getFullYear(),
					email: sanitizeString(action.args?.email),
					phone: sanitizeString(action.args?.phone),
					location: sanitizeString(action.args?.location),
					description: sanitizeString(action.args?.description),
					inrete: [],
					socials: {
						instagram: [],
						linkedin: [],
						twitter: [],
						github: [],
						mastodon: [],
						website: [],
					},
					events: [],
				} as Parameters<typeof addPerson>[0]);

				setResult(action.message || `Created person: ${name}`);
				setError(false);
				return;
			}
			if (action.action === "remove_tag_from_people") {
				const tagName = sanitizeString(action.args?.tagName);
				const rawNames = Array.isArray(action.args?.personNames)
					? action.args.personNames
					: [];
				if (!tagName)
					throw new Error("remove_tag_from_people missing tagName.");
				if (rawNames.length === 0)
					throw new Error("remove_tag_from_people missing personNames.");

				const normalized = normalizeTag(tagName);
				const tag = tags.find(
					(t) =>
						normalizeTag(t.normalized || t.name) === normalized ||
						normalizeTag(t.name) === normalized,
				);
				if (!tag) throw new Error(`Could not find tag "${tagName}".`);

				const updated: string[] = [];
				const notFound: string[] = [];

				for (const rawName of rawNames) {
					const target = findPersonByName(people, rawName);
					if (!target) {
						notFound.push(rawName);
						continue;
					}

					const currentInrete = Array.isArray(target.inrete)
						? target.inrete
						: [];
					if (!currentInrete.includes(tag.id)) continue;

					await updatePerson(target.id, {
						inrete: currentInrete.filter((id) => id !== tag.id),
					});
					updated.push(target.name);
				}

				const msg = updated.length
					? `Removed tag "${tag.name}" from ${updated.join(", ")}.`
					: `No one was updated.`;
				const warn = notFound.length
					? ` Could not find: ${notFound.join(", ")}.`
					: "";
				setResult(action.message || msg + warn);
				setError(notFound.length > 0 && updated.length === 0);
				return;
			}

			// ── bulk_update_people ────────────────────────────────────────

			if (action.action === "bulk_update_people") {
				const tagName = sanitizeString(action.args?.tagName);
				const rawPatch = action.args?.patch ?? {};
				const bulkPatch: Partial<Person> = {};

				if (rawPatch.year != null) {
					const y = Number(rawPatch.year);
					if (Number.isFinite(y)) bulkPatch.year = y;
				}

				for (const key of [
					"name",
					"description",
					"firstInteraction",
					"lastInteraction",
					"lore",
					"email",
					"phone",
					"location",
				] as const) {
					const value = rawPatch[key];
					if (typeof value === "string" && value.trim())
						(bulkPatch as Record<string, unknown>)[key] = value.trim();
				}

				if (!tagName) throw new Error("Bulk update missing tag name.");
				if (Object.keys(bulkPatch).length === 0)
					throw new Error("Bulk update missing valid patch fields.");

				const normalized = normalizeTag(tagName);
				const tag = tags.find(
					(t) =>
						normalizeTag(t.normalized || t.name) === normalized ||
						normalizeTag(t.name) === normalized,
				);
				if (!tag) throw new Error(`Could not find tag "${tagName}".`);

				const matchedPeople = people.filter((p) =>
					Array.isArray(p.inrete) ? p.inrete.includes(tag.id) : false,
				);
				if (matchedPeople.length === 0)
					throw new Error(`No people found with tag "${tag.name}".`);

				await Promise.all(
					matchedPeople.map((p) => updatePerson(p.id, bulkPatch)),
				);
				setResult(
					action.message ||
						`Updated ${matchedPeople.length} people with tag "${tag.name}".`,
				);
				setError(false);
				return;
			}

			// ── bulk_unlink_people_by_tag ─────────────────────────────────

			if (action.action === "bulk_unlink_people_by_tag") {
				const tagName = sanitizeString(action.args?.tagName);
				const type = sanitizeString(action.args?.type) || "related";
				if (!tagName) throw new Error("Bulk unlink missing tag name.");

				const normalized = normalizeTag(tagName);
				const tag = tags.find(
					(t) =>
						normalizeTag(t.normalized || t.name) === normalized ||
						normalizeTag(t.name) === normalized,
				);
				if (!tag) throw new Error(`Could not find tag "${tagName}".`);

				const matchedPeople = people.filter((p) =>
					Array.isArray(p.inrete) ? p.inrete.includes(tag.id) : false,
				);
				if (matchedPeople.length < 2)
					throw new Error(`Need at least 2 people with tag "${tag.name}".`);

				let removed = 0;
				for (let i = 0; i < matchedPeople.length; i++) {
					for (let j = i + 1; j < matchedPeople.length; j++) {
						const from = matchedPeople[i];
						const to = matchedPeople[j];

						const direct = await db.relationships
							.where("from")
							.equals(from.id)
							.filter(
								(r: any) =>
									r.to === to.id && String(r.type ?? "").trim() === type,
							)
							.toArray();
						const reverse = await db.relationships
							.where("from")
							.equals(to.id)
							.filter(
								(r: any) =>
									r.to === from.id && String(r.type ?? "").trim() === type,
							)
							.toArray();

						const ids = [...direct, ...reverse]
							.map((r: any) => r.id)
							.filter(Boolean);
						if (ids.length > 0) {
							await db.relationships.bulkDelete(ids);
							removed += ids.length;
						}
					}
				}

				setResult(
					action.message ||
						`Removed ${removed} "${type}" relationships among ${matchedPeople.length} people.`,
				);
				setError(false);
				return;
			}

			// ── bulk_link_people_by_tag ───────────────────────────────────

			if (action.action === "bulk_link_people_by_tag") {
				const tagName = sanitizeString(action.args?.tagName);
				const type = sanitizeString(action.args?.type) || "related";
				if (!tagName) throw new Error("Bulk link missing tag name.");

				const normalized = normalizeTag(tagName);
				const tag = tags.find(
					(t) =>
						normalizeTag(t.normalized || t.name) === normalized ||
						normalizeTag(t.name) === normalized,
				);
				if (!tag) throw new Error(`Could not find tag "${tagName}".`);

				const matchedPeople = people.filter((p) =>
					Array.isArray(p.inrete) ? p.inrete.includes(tag.id) : false,
				);
				if (matchedPeople.length < 2)
					throw new Error(`Need at least 2 people with tag "${tag.name}".`);

				let created = 0;
				for (let i = 0; i < matchedPeople.length; i++) {
					for (let j = i + 1; j < matchedPeople.length; j++) {
						const from = matchedPeople[i];
						const to = matchedPeople[j];
						const existing = await db.relationships
							.where("from")
							.equals(from.id)
							.filter(
								(r: any) =>
									r.to === to.id && String(r.type ?? "").trim() === type,
							)
							.first();
						if (existing) continue;
						await createRelationship(from.id, to.id, type);
						created++;
					}
				}

				setResult(
					action.message ||
						`Created ${created} "${type}" relationships between ${matchedPeople.length} people.`,
				);
				setError(false);
				return;
			}
			// ── multi_update_people ───────────────────────────────────────────────

			if (action.action === "multi_update_people") {
				const rawNames = Array.isArray(action.args?.personNames)
					? action.args.personNames
					: [];
				if (rawNames.length === 0)
					throw new Error("multi_update_people missing personNames.");

				const rawPatch = action.args?.patch ?? {};
				const patch: Record<string, unknown> = {};

				for (const key of [
					"name",
					"description",
					"firstInteraction",
					"lastInteraction",
					"lore",
					"email",
					"phone",
					"location",
				] as const) {
					const value = rawPatch[key];
					if (typeof value === "string" && value.trim())
						patch[key] = value.trim();
				}

				if (rawPatch.year != null) {
					const y = Number(rawPatch.year);
					if (Number.isFinite(y)) patch.year = y;
				}

				// Resolve tag
				let requestedTagName: string | undefined;
				const aiTagId =
					Array.isArray(rawPatch.inrete) && rawPatch.inrete.length > 0
						? sanitizeString(rawPatch.inrete[0])
						: "";
				if (aiTagId) {
					const existingTag = tags.find((t) => t.id === aiTagId);
					if (existingTag) requestedTagName = existingTag.name;
				}
				if (!requestedTagName) requestedTagName = extractRequestedTag(userText);

				const updated: string[] = [];
				const notFound: string[] = [];

				for (const rawName of rawNames) {
					const target = findPersonByName(people, rawName);
					if (!target) {
						notFound.push(rawName);
						continue;
					}

					const finalPatch: Record<string, unknown> = { ...patch };

					if (requestedTagName) {
						const tagRecord = await ensureTag(requestedTagName);
						const mergedInrete = [...(target.inrete ?? [])];
						if (!mergedInrete.includes(tagRecord.id))
							mergedInrete.push(tagRecord.id);
						finalPatch.inrete = mergedInrete;
					}

					if (Object.keys(finalPatch).length === 0) continue;

					await updatePerson(target.id, finalPatch as Partial<Person>);
					updated.push(target.name);
				}

				const msg = updated.length
					? `Updated ${updated.join(", ")}.`
					: "No people were updated.";
				const warn = notFound.length
					? ` Could not find: ${notFound.join(", ")}.`
					: "";

				setResult(action.message || msg + warn);
				setError(notFound.length > 0 && updated.length === 0);
				if (updated.length === 1)
					setSelectedPersonId(
						people.find((p) => p.name === updated[0])?.id ?? selectedPersonId,
					);
				return;
			}
			if (action.action === "bulk_remove_tag") {
				const tagName = sanitizeString(action.args?.tagName);
				if (!tagName) throw new Error("bulk_remove_tag missing tagName.");

				const normalized = normalizeTag(tagName);
				const tag = tags.find(
					(t) =>
						normalizeTag(t.normalized || t.name) === normalized ||
						normalizeTag(t.name) === normalized,
				);
				if (!tag) throw new Error(`Could not find tag "${tagName}".`);

				const matchedPeople = people.filter((p) =>
					Array.isArray(p.inrete) ? p.inrete.includes(tag.id) : false,
				);
				if (matchedPeople.length === 0) {
					setResult(`No people have the "${tag.name}" tag.`);
					setError(false);
					return;
				}

				await Promise.all(
					matchedPeople.map((p) =>
						updatePerson(p.id, {
							inrete: (p.inrete ?? []).filter((id) => id !== tag.id),
						}),
					),
				);
				setResult(
					action.message ||
						`Removed tag "${tag.name}" from ${matchedPeople.length} people.`,
				);
				setError(false);
				return;
			}

			if (action.action === "remove_tag_from_person") {
				const tagName = sanitizeString(action.args?.tagName);
				const personName = sanitizeString(action.args?.personName);
				if (!tagName)
					throw new Error("remove_tag_from_person missing tagName.");

				const target = findPersonByName(people, personName) ?? selectedPerson;
				if (!target) throw new Error(`Could not find person "${personName}".`);

				const normalized = normalizeTag(tagName);
				const tag = tags.find(
					(t) =>
						normalizeTag(t.normalized || t.name) === normalized ||
						normalizeTag(t.name) === normalized,
				);
				if (!tag) throw new Error(`Could not find tag "${tagName}".`);

				const currentInrete = Array.isArray(target.inrete) ? target.inrete : [];
				if (!currentInrete.includes(tag.id)) {
					setResult(`${target.name} does not have the "${tag.name}" tag.`);
					setError(false);
					return;
				}

				await updatePerson(target.id, {
					inrete: currentInrete.filter((id) => id !== tag.id),
				});
				setSelectedPersonId(target.id);
				setResult(
					action.message || `Removed tag "${tag.name}" from ${target.name}.`,
				);
				setError(false);
				return;
			}

			// ── update_person (+ direct social / tag extractions) ─────────

			const directTag = extractRequestedTag(userText);
			const directSocials = extractSocialUpdates(userText);

			if (
				action.action === "update_person" ||
				directTag ||
				Object.keys(directSocials.socials).length > 0 ||
				directSocials.flat.tiktok ||
				directSocials.flat.facebook
			) {
				let target =
					findPersonByName(
						people,
						String(
							action.action === "update_person"
								? (action.args?.personName ?? "")
								: "",
						),
					) ?? selectedPerson;

				if (!target) {
					const promptLines = userText
						.split("\n")
						.map((s) => s.trim())
						.filter(Boolean);
					target = findPersonByName(people, promptLines[0] ?? "");
				}

				if (!target && people.length === 1) target = people[0];

				if (!target)
					throw new Error(
						"Could not find person to update. Select the person first, or include their exact saved name.",
					);

				const rawPatch =
					action.action === "update_person" ? (action.args?.patch ?? {}) : {};
				const patch: Record<string, unknown> = {};

				for (const key of [
					"name",
					"description",
					"firstInteraction",
					"lastInteraction",
					"lore",
					"email",
					"phone",
					"location",
				] as const) {
					const value = rawPatch[key];
					if (typeof value === "string" && value.trim())
						patch[key] = value.trim();
				}

				if (rawPatch.year != null) {
					const y = Number(rawPatch.year);
					if (Number.isFinite(y)) patch.year = y;
				}

				const currentSocials = target.socials ?? {
					instagram: [],
					linkedin: [],
					twitter: [],
					github: [],
					mastodon: [],
					website: [],
				};
				const patchSocials =
					typeof rawPatch.socials === "object" && rawPatch.socials !== null
						? (rawPatch.socials as Record<string, unknown>)
						: {};

				const mergedSocials: Record<string, string[]> = { ...currentSocials };
				for (const [key, value] of Object.entries(patchSocials)) {
					const arr = Array.isArray(value)
						? value.map((v) => sanitizeString(v)).filter(Boolean)
						: typeof value === "string"
							? [value.trim()].filter(Boolean)
							: [];
					if (arr.length > 0)
						mergedSocials[key] = uniqueStrings([
							...(mergedSocials[key] ?? []),
							...arr,
						]);
				}

				for (const [key, value] of Object.entries(directSocials.socials)) {
					mergedSocials[key] = uniqueStrings([
						...(mergedSocials[key] ?? []),
						...value,
					]);
				}

				if (Object.keys(mergedSocials).length > 0)
					patch.socials = mergedSocials;

				const mergedInrete = [...(target.inrete ?? [])];
				let requestedTagName = directTag;

				if (!requestedTagName) {
					const aiTagId =
						Array.isArray(rawPatch.inrete) && rawPatch.inrete.length > 0
							? sanitizeString(rawPatch.inrete[0])
							: "";
					if (aiTagId) {
						const existingTag = tags.find((t) => t.id === aiTagId);
						if (existingTag) requestedTagName = existingTag.name;
					}
				}

				if (requestedTagName) {
					const tagRecord = await ensureTag(requestedTagName);
					if (!mergedInrete.includes(tagRecord.id))
						mergedInrete.push(tagRecord.id);
					patch.inrete = mergedInrete;
				}

				const aiTiktok = sanitizeString(
					(rawPatch as Record<string, unknown>).tiktok,
				);
				const aiFacebook = sanitizeString(
					(rawPatch as Record<string, unknown>).facebook,
				);
				if (directSocials.flat.tiktok || aiTiktok)
					patch.tiktok = directSocials.flat.tiktok || aiTiktok;
				if (directSocials.flat.facebook || aiFacebook)
					patch.facebook = directSocials.flat.facebook || aiFacebook;

				if (Object.keys(patch).length === 0)
					throw new Error("No valid patch fields found in AI command.");

				await updatePerson(target.id, patch as Partial<Person>);
				setSelectedPersonId(target.id);
				setResult(action.message || `Updated ${target.name}`);
				setError(false);
				return;
			}

			// ── select_person ─────────────────────────────────────────────

			if (action.action === "select_person") {
				const target = findPersonByName(
					people,
					String(action.args?.personName ?? ""),
				);
				if (!target) throw new Error("Could not find person to select.");
				setSelectedPersonId(target.id);
				setResult(action.message || `Selected ${target.name}`);
				setError(false);
				return;
			}

			// ── link_people ───────────────────────────────────────────────

			if (action.action === "link_people") {
				const from = findPersonByName(
					people,
					String(action.args?.fromName ?? ""),
				);
				const to = findPersonByName(people, String(action.args?.toName ?? ""));
				const type = sanitizeString(action.args?.type) || "friend";
				if (!from || !to)
					throw new Error("Could not find both people for relationship.");
				await createRelationship(from.id, to.id, type);
				setResult(
					action.message || `Linked ${from.name} → ${to.name} as ${type}`,
				);
				setError(false);
				return;
			}

			setResult(action.message || "No change was applied.");
			setError(false);
		} catch (err) {
			setError(true);
			setResult(err instanceof Error ? err.message : "Agent failed.");
		} finally {
			setRunning(false);
		}
	};

	// ─── Derived state for batch UI ────────────────────────────────────

	const selectedCreateCount = selectedNewPeople.size;

	// ─── Render ───────────────────────────────────────────────────────

	return (
		<div className="rounded-md border border-[color:var(--rm-border)] bg-black/20 p-3 space-y-2">
			{/* Header */}
			<div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[color:var(--rm-text-muted)]">
				AI Agent (Gemini)
			</div>

			{/* Selected person pill */}
			{selectedPerson && (
				<div className="flex items-center gap-1.5 rounded-md border border-[color:var(--rm-border)] bg-black/20 px-2 py-1 text-[12px] text-[color:var(--rm-text-muted)]">
					<span className="opacity-50">Selected:</span>
					<span className="text-[color:var(--rm-text)] font-medium">
						{selectedPerson.name}
					</span>
				</div>
			)}

			{/* Textarea */}
			<div className="relative">
				<textarea
					ref={textareaRef}
					className="w-full rounded-md border border-[color:var(--rm-border)] bg-black/25 p-2 pr-24 text-[13px] text-[color:var(--rm-text)] outline-none focus:border-[color:var(--rm-accent)] resize-none"
					rows={5}
					value={prompt}
					onChange={(e) => setPrompt(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
							e.preventDefault();
							void runAgent();
						}
					}}
					placeholder={`Command: "add a person named Alice with tag VIP"\n\nBulk: Paste a list of names, emails, or Instagram followers to analyze and batch update.`}
				/>

				{/* Mode badge — shown inside textarea corner when text is long enough */}
				{modeAnalysis && (
					<div
						className={`absolute top-2 right-2 flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider select-none pointer-events-none ${
							modeAnalysis.mode === "bulk"
								? "bg-sky-500/20 text-sky-300 border border-sky-500/30"
								: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
						}`}>
						{modeAnalysis.mode === "bulk" ? (
							<>
								<svg viewBox="0 0 12 12" className="w-2.5 h-2.5 fill-current">
									<rect x="0" y="0" width="5" height="5" />
									<rect x="7" y="0" width="5" height="5" />
									<rect x="0" y="7" width="5" height="5" />
									<rect x="7" y="7" width="5" height="5" />
								</svg>
								Bulk
							</>
						) : (
							<>
								<svg viewBox="0 0 12 12" className="w-2.5 h-2.5 fill-current">
									<path d="M1 6l3 3 7-7" />
								</svg>
								Command
							</>
						)}
					</div>
				)}
			</div>

			{/* Mode description row */}
			{modeAnalysis && (
				<div className="flex items-center gap-2 text-[11px] text-[color:var(--rm-text-muted)]">
					{modeAnalysis.mode === "bulk" ? (
						<>
							<span className="text-sky-400">Analysis mode</span>
							<span className="opacity-40">·</span>
							<span>
								{modeAnalysis.dataHint
									? (DATA_HINT_LABELS[modeAnalysis.dataHint] ??
										modeAnalysis.dataHint)
									: modeAnalysis.reason}
							</span>
						</>
					) : (
						<>
							<span className="text-emerald-400">Command mode</span>
							<span className="opacity-40">·</span>
							<span>{modeAnalysis.reason}</span>
						</>
					)}
					{modeAnalysis.confidence === "low" && (
						<span className="opacity-50">(low confidence detection)</span>
					)}
				</div>
			)}

			{/* Hint text when no mode detected yet */}
			{!modeAnalysis && (
				<div className="text-[11px] text-[color:var(--rm-text-muted)] opacity-60">
					Type a command or paste a bulk list — mode is auto-detected.
				</div>
			)}

			{/* Run button row */}
			<div className="flex items-center gap-2">
				<button
					type="button"
					className="rm-sidebar-btn"
					onClick={() => void runAgent()}
					disabled={running || !prompt.trim()}>
					{running
						? "Running…"
						: modeAnalysis?.mode === "bulk"
							? "Analyze & Review"
							: "Run Command"}
				</button>

				{!hasApiKey && (
					<span className="text-[11px] text-amber-300">
						Set VITE_GEMINI_API_KEY in .env.local
					</span>
				)}

				{!running && prompt.trim() && (
					<span className="text-[10px] text-[color:var(--rm-text-muted)] opacity-40 ml-auto">
						⌘↵ to run
					</span>
				)}
			</div>

			{/* ── Batch Review Panel ──────────────────────────────────── */}
			{batchReview && (
				<div className="rounded-md border border-sky-500/30 bg-sky-500/10 p-3 text-[12px] text-sky-100 space-y-3">
					{/* Header */}
					<div className="flex items-start justify-between gap-2">
						<div>
							<div className="font-semibold text-sky-50 text-[13px]">
								Analysis Result
							</div>
							{batchReview.dataType && (
								<div className="text-[11px] text-sky-300 mt-0.5">
									{DATA_HINT_LABELS[batchReview.dataType] ??
										batchReview.dataType}
								</div>
							)}
						</div>
						<button
							type="button"
							onClick={() => setBatchReview(null)}
							className="text-sky-300/50 hover:text-sky-100 text-[16px] leading-none mt-0.5">
							✕
						</button>
					</div>

					{/* AI summary */}
					{batchReview.summary && (
						<div className="rounded border border-sky-400/20 bg-black/20 px-3 py-2 text-sky-100/90 text-[12px] leading-relaxed">
							{batchReview.summary}
						</div>
					)}

					{/* Counts row */}
					<div className="grid grid-cols-3 gap-2">
						{[
							{
								label: "Confirmed",
								value: batchReview.matches.length,
								color: "text-emerald-300",
							},
							{
								label: "Possible",
								value: batchReview.possibleMatches.length,
								color: "text-amber-300",
							},
							{
								label: "New people",
								value: batchReview.newPeople.length,
								color: "text-sky-300",
							},
						].map(({ label, value, color }) => (
							<div
								key={label}
								className="rounded border border-sky-400/15 bg-black/20 px-2 py-2 text-center">
								<div className={`text-[18px] font-bold ${color}`}>{value}</div>
								<div className="text-[10px] uppercase tracking-wide text-sky-200/50 mt-0.5">
									{label}
								</div>
							</div>
						))}
					</div>

					{/* Confirmed matches */}
					{batchReview.matches.length > 0 && (
						<div>
							<div className="text-[11px] uppercase tracking-wide text-emerald-300/70 mb-1.5">
								Confirmed matches
							</div>
							<div className="space-y-1">
								{batchReview.matches.slice(0, 10).map((item, idx) => (
									<div
										key={`m-${idx}`}
										className="rounded border border-emerald-400/15 bg-black/20 px-2 py-1.5 flex items-start justify-between gap-2">
										<div className="min-w-0">
											<div className="font-medium text-sky-50 truncate">
												{item.input?.trim() || item.personName?.trim() || "—"}
											</div>
											<div className="text-sky-200/70 text-[11px]">
												→{" "}
												{item.personName?.trim() ||
													item.personId ||
													"Saved person"}
											</div>
											{item.reason && (
												<div className="text-[10px] text-sky-200/40">
													{item.reason}
												</div>
											)}
										</div>
										{typeof item.confidence === "number" && (
											<div className="shrink-0 text-[10px] text-emerald-300/70 font-mono">
												{Math.round(item.confidence * 100)}%
											</div>
										)}
									</div>
								))}
								{batchReview.matches.length > 10 && (
									<div className="text-[11px] text-sky-200/40 pl-1">
										+{batchReview.matches.length - 10} more confirmed
									</div>
								)}
							</div>
						</div>
					)}

					{/* Possible matches */}
					{batchReview.possibleMatches.length > 0 && (
						<div>
							<div className="text-[11px] uppercase tracking-wide text-amber-300/70 mb-1.5">
								Possible matches — review manually
							</div>
							<div className="space-y-1">
								{batchReview.possibleMatches.slice(0, 8).map((item, idx) => (
									<div
										key={`p-${idx}`}
										className="rounded border border-amber-400/15 bg-black/20 px-2 py-1.5 flex items-start justify-between gap-2">
										<div className="min-w-0">
											<div className="font-medium text-sky-50 truncate">
												{item.input?.trim() || item.personName?.trim() || "—"}
											</div>
											<div className="text-sky-200/70 text-[11px]">
												≈{" "}
												{item.personName?.trim() ||
													item.personId ||
													"possible saved person"}
											</div>
											{item.reason && (
												<div className="text-[10px] text-sky-200/40">
													{item.reason}
												</div>
											)}
										</div>
										{typeof item.confidence === "number" && (
											<div className="shrink-0 text-[10px] text-amber-300/70 font-mono">
												{Math.round(item.confidence * 100)}%
											</div>
										)}
									</div>
								))}
								{batchReview.possibleMatches.length > 8 && (
									<div className="text-[11px] text-sky-200/40 pl-1">
										+{batchReview.possibleMatches.length - 8} more possible
									</div>
								)}
							</div>
						</div>
					)}

					{/* New people — selectable + editable names */}
					{batchReview.newPeople.length > 0 && (
						<div>
							<div className="flex items-center justify-between mb-1.5">
								<div className="text-[11px] uppercase tracking-wide text-sky-300/70">
									New people to create
								</div>
								<button
									type="button"
									onClick={toggleAllNewPeople}
									className="text-[10px] text-sky-300/60 hover:text-sky-200 underline underline-offset-2">
									{selectedNewPeople.size === batchReview.newPeople.length
										? "Deselect all"
										: "Select all"}
								</button>
							</div>

							<div className="space-y-1 max-h-64 overflow-y-auto pr-0.5">
								{batchReview.newPeople.map((item, idx) => {
									const isSelected = selectedNewPeople.has(idx);
									const editedName = nameEdits[idx] ?? item.name ?? "";
									const secondary =
										item.instagram?.trim() ||
										item.tiktok?.trim() ||
										item.facebook?.trim() ||
										item.email?.trim() ||
										"";

									return (
										<div
											key={`n-${idx}`}
											className={`rounded border px-2 py-1.5 flex items-start gap-2 cursor-pointer transition-colors ${
												isSelected
													? "border-sky-400/30 bg-black/25"
													: "border-sky-400/10 bg-black/10 opacity-40"
											}`}
											onClick={() => toggleNewPerson(idx)}>
											{/* Checkbox */}
											<div
												className={`mt-0.5 shrink-0 w-3.5 h-3.5 rounded-sm border flex items-center justify-center transition-colors ${
													isSelected
														? "bg-sky-500 border-sky-400"
														: "border-sky-400/30 bg-transparent"
												}`}>
												{isSelected && (
													<svg
														viewBox="0 0 10 10"
														className="w-2 h-2 fill-white">
														<path
															d="M1.5 5l2.5 2.5 4.5-4.5"
															stroke="white"
															strokeWidth="1.5"
															fill="none"
															strokeLinecap="round"
														/>
													</svg>
												)}
											</div>

											<div
												className="flex-1 min-w-0"
												onClick={(e) => e.stopPropagation()}>
												{/* Editable name */}
												<input
													type="text"
													value={editedName}
													onChange={(e) =>
														setNameEdits((prev) => ({
															...prev,
															[idx]: e.target.value,
														}))
													}
													className="w-full bg-transparent text-[12px] font-medium text-sky-50 outline-none border-b border-transparent focus:border-sky-400/40 pb-0.5"
													placeholder="Name"
													onClick={() => {
														if (!isSelected) toggleNewPerson(idx);
													}}
												/>
												{secondary && (
													<div className="text-[10px] text-sky-200/60 mt-0.5 truncate">
														{secondary}
													</div>
												)}
											</div>
										</div>
									);
								})}
							</div>

							{batchReview.newPeople.length > 10 && (
								<div className="text-[10px] text-sky-200/40 mt-1 pl-1">
									Scroll to see all {batchReview.newPeople.length} people
								</div>
							)}
						</div>
					)}

					{/* Action buttons */}
					<div className="flex flex-wrap gap-2 pt-1 border-t border-sky-400/15">
						{batchReview.newPeople.length > 0 && (
							<button
								type="button"
								className="rm-sidebar-btn"
								onClick={() => void handleApplyBatchCreateSelected()}
								disabled={running || selectedCreateCount === 0}>
								{running
									? "Creating…"
									: `Create ${selectedCreateCount} ${selectedCreateCount === 1 ? "person" : "people"}`}
							</button>
						)}

						{batchReview.matches.length > 0 && (
							<button
								type="button"
								className="rm-sidebar-btn"
								onClick={handleSelectFirstMatch}
								disabled={batchReview.matches.length === 0}>
								Select first match
							</button>
						)}

						<button
							type="button"
							className="rm-sidebar-btn opacity-60 hover:opacity-100"
							onClick={() => setBatchReview(null)}>
							Dismiss
						</button>
					</div>
				</div>
			)}

			{/* Result / error strip */}
			{result && !batchReview && (
				<div
					className={`rounded-md border px-2 py-1.5 text-[12px] ${
						error
							? "border-red-500/30 bg-red-500/10 text-red-200"
							: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
					}`}>
					{result}
				</div>
			)}
		</div>
	);
}
