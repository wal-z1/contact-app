import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import { useAppStore } from "../store/useAppStore";
import type { Person } from "../models/types";

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
};

type BatchReviewState = {
	message: string;
	matches: BatchReviewMatch[];
	possibleMatches: BatchReviewMatch[];
	newPeople: BatchReviewNewPerson[];
	rawInput?: string;
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
			action: "review_people_batch";
			args: {
				matches?: BatchReviewMatch[];
				possibleMatches?: BatchReviewMatch[];
				newPeople?: BatchReviewNewPerson[];
				rawInput?: string;
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
			args: {
				tagName?: string;
				type?: string;
			};
			message?: string;
	  }
	| {
			action: "bulk_unlink_people_by_tag";
			args: {
				tagName?: string;
				type?: string;
			};
			message?: string;
	  };

const GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite"] as const;

type GeminiGenerateContentResponse = {
	candidates?: Array<{
		content?: {
			parts?: Array<{
				text?: string;
			}>;
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
			else if (personTokens.some((pt) => pt.includes(qt) || qt.includes(pt))) {
				score += 1;
			}
		}

		if (score > bestScore) {
			bestScore = score;
			bestMatch = person;
		}
	}

	if (bestMatch && bestScore >= Math.max(1, queryTokens.length)) {
		return bestMatch;
	}

	return undefined;
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

	return {
		tagName: sanitizeString(bulkMatch[1]),
		year: Number(bulkMatch[2]),
	};
}
function looksLikeLargeBatchInput(text: string): boolean {
	const source = String(text ?? "").trim();
	if (!source) return false;

	const lines = source
		.split("\n")
		.map((s) => s.trim())
		.filter(Boolean);

	const parsedFollowers = parseInstagramFollowersDump(source);
	const hasInstagramFollowerShape = parsedFollowers.length >= 5;

	const hasManyLines = lines.length >= 8;
	const hasManyHandles = (source.match(/@[a-z0-9._-]+/gi) ?? []).length >= 6;
	const hasManyUrls = extractUrls(source).length >= 5;
	const hasBulkWords =
		/\b(followers|following|import|list|batch|paste|pasted|csv|usernames?)\b/i.test(
			source,
		);

	return (
		hasInstagramFollowerShape ||
		hasManyLines ||
		hasManyHandles ||
		hasManyUrls ||
		hasBulkWords
	);
}

type ParsedInstagramFollower = {
	username: string;
	displayName: string;
};

function parseInstagramFollowersDump(text: string): ParsedInstagramFollower[] {
	const lines = String(text ?? "")
		.split("\n")
		.map((s) => s.trim())
		.filter(Boolean);

	const startIndex = lines.findIndex((line) =>
		/followers of .* on instagram/i.test(line),
	);

	const body = startIndex >= 0 ? lines.slice(startIndex + 1) : lines;

	const cleaned = body.filter((line) => !/^search$/i.test(line));

	const pairs: ParsedInstagramFollower[] = [];
	for (let i = 0; i + 1 < cleaned.length; i += 2) {
		const username = cleaned[i];
		const displayName = cleaned[i + 1];

		if (!username || !displayName) continue;

		pairs.push({
			username,
			displayName,
		});
	}

	return pairs;
}
async function generateAgentAction(
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

		if (response.ok) {
			return (await response.json()) as GeminiGenerateContentResponse;
		}

		lastError = new Error(
			`Gemini request failed for ${model} (${response.status}): ${await response.text()}`,
		);
	}

	throw lastError ?? new Error("Gemini request failed.");
}

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
			tags.slice(0, 500).map((t) => ({
				id: t.id,
				name: t.name,
				normalized: t.normalized,
			})),
		[tags],
	);

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

	const handleApplyBatchCreateAll = async () => {
		if (!batchReview?.newPeople?.length) return;

		setRunning(true);
		setError(false);

		try {
			for (const candidate of batchReview.newPeople) {
				const name = sanitizeString(candidate.name);
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
			}

			setResult(`Created ${batchReview.newPeople.length} new people.`);
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
			const directTag = extractRequestedTag(userText);
			const directSocials = extractSocialUpdates(userText);
			const directBulkTagYear = extractBulkTagYearRequest(userText);
			const parsedFollowers = parseInstagramFollowersDump(userText);
			const isLargeBatch =
				looksLikeLargeBatchInput(userText) || parsedFollowers.length > 0;

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

				if (!tag) {
					throw new Error(`Could not find tag "${directBulkTagYear.tagName}".`);
				}

				const matchedPeople = people.filter((p) =>
					Array.isArray(p.inrete) ? p.inrete.includes(tag.id) : false,
				);

				if (matchedPeople.length === 0) {
					throw new Error(
						`No people found with tag "${directBulkTagYear.tagName}".`,
					);
				}

				await Promise.all(
					matchedPeople.map((p) =>
						updatePerson(p.id, { year: directBulkTagYear.year! }),
					),
				);

				setResult(
					`Updated ${matchedPeople.length} people with tag "${tag.name}" to year ${directBulkTagYear.year}.`,
				);
				setError(false);
				return;
			}

			const systemPrompt = [
				"You are a contact-app command planner.",
				"Return strict JSON only.",
				"Schema: { action: 'create_person'|'update_person'|'bulk_update_people'|'bulk_link_people_by_tag'|'bulk_unlink_people_by_tag'|'review_people_batch'|'select_person'|'link_people'|'none', args: object, message?: string }",
				"- If the user asks to connect all people sharing a tag, use action='bulk_link_people_by_tag'.",
				"- bulk_link_people_by_tag args shape: { tagName: string, type: string }",
				"- Example: 'for every person with tag 1cp, create relationships with every other person with tag 1cp using type studied_together' => { action: 'bulk_link_people_by_tag', args: { tagName: '1cp', type: 'studied_together' } }",
				"Rules:",
				"- Prefer 'none' when request is ambiguous.",
				"- For update/select/link, use person names from provided people list.",
				"- For bulk changes by tag, use action='bulk_update_people'.",
				"- For large pasted lists, follower/following dumps, imports, batches, many usernames, or anything that looks like many people at once, use action='review_people_batch'.",
				"- review_people_batch should NOT apply changes directly.",
				"- review_people_batch args shape: { matches: [], possibleMatches: [], newPeople: [], rawInput?: string }",
				"- matches should contain strong matches to existing people.",
				"- possibleMatches should contain uncertain matches.",
				"- newPeople should contain likely new person records to create.",
				"- Never return markdown or explanations.",
				"- This app stores tag references on a person in args.patch.inrete as an array of tag IDs.",
				"- If parsed Instagram followers are provided, treat each item as { username, displayName }.",
				"- For Instagram follower imports, put the Instagram username into newPeople[].instagram as a full URL like https://instagram.com/username.",
				"- For Instagram follower imports, prefer displayName as the person's name.",
				"- For stylized or non-Latin names, preserve them exactly as given.",
				"- Global tags are separate records with fields id, name, normalized.",
				"- Social links are mainly stored in args.patch.socials, where each key maps to an array of strings.",
				"- Allowed socials keys include instagram, linkedin, twitter, github, mastodon, website, facebook.",
				"- tiktok may also be stored as args.patch.tiktok.",
				"- If the user says 'this person', prefer the selected person.",
				"- If the user asks to update all people with a given tag, return { action: 'bulk_update_people', args: { tagName: string, patch: {...} } }.",
				"- If the user says known from year/years should become 2024, map that to patch.year = 2024.",
				"- If input looks like a large list, do review_people_batch even if some matches are obvious.",
				"- If the user asks to connect all people sharing a tag, use action='bulk_link_people_by_tag'.",
				"- If the user asks to remove relationships between all people sharing a tag, use action='bulk_unlink_people_by_tag'.",
				"- bulk_link_people_by_tag args shape: { tagName: string, type: string }",
				"- bulk_unlink_people_by_tag args shape: { tagName: string, type: string }",
				"- Example: 'for every person with tag 1cp, create relationships with every other person with tag 1cp using type studied_together' => { action: 'bulk_link_people_by_tag', args: { tagName: '1cp', type: 'studied_together' } }",
				"- Example: 'for every person with tag 1cp, remove relationships with every other person with tag 1cp using type studied_together' => { action: 'bulk_unlink_people_by_tag', args: { tagName: '1cp', type: 'studied_together' } }",
				"- If the user asks to add a location tag, store it as a normal tag in args.patch.inrete.",
				"- If the user asks to set a person's location, use args.patch.location.",
			].join("\n");

			const payload = {
				contents: [
					{
						role: "user",
						parts: [
							{
								text: `${systemPrompt}

Selected person:
${JSON.stringify(
	selectedPerson
		? {
				id: selectedPerson.id,
				name: selectedPerson.name,
				inrete: selectedPerson.inrete ?? [],
				socials: selectedPerson.socials ?? {},
			}
		: null,
)}

People:
${JSON.stringify(peopleContext)}

Global tags:
${JSON.stringify(tagsContext)}

Large-batch hint:
${JSON.stringify({ isLargeBatch })}

Parsed Instagram followers:
${JSON.stringify(parsedFollowers.slice(0, 300))}

User request:
${userText}`,
							},
						],
					},
				],
				generationConfig: {
					temperature: 0.1,
					responseMimeType: "application/json",
				},
			};

			const data = await generateAgentAction(apiKey!.trim(), payload);

			const rawText =
				data.candidates?.[0]?.content?.parts?.[0]?.text ??
				'{"action":"none","args":{},"message":"No change was applied."}';

			const action = JSON.parse(unwrapJson(rawText)) as AgentAction;

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

				const matches = rawMatches.map(enrichMatch).filter((item) => {
					return Boolean(
						sanitizeString(item.input) ||
						sanitizeString(item.personName) ||
						sanitizeString(item.personId),
					);
				});

				const possibleMatches = rawPossibleMatches
					.map(enrichMatch)
					.filter((item) => {
						return Boolean(
							sanitizeString(item.input) ||
							sanitizeString(item.personName) ||
							sanitizeString(item.personId),
						);
					});

				setBatchReview({
					message:
						action.message ||
						`Found ${matches.length} confirmed matches, ${possibleMatches.length} possible matches, and ${newPeople.length} new people. Review the names below.`,
					matches,
					possibleMatches,
					newPeople,
					rawInput: sanitizeString(action.args?.rawInput),
				});

				setResult(
					action.message ||
						`Found ${matches.length} confirmed matches, ${possibleMatches.length} possible matches, and ${newPeople.length} new people to review.`,
				);
				setError(false);
				return;
			}

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

			if (action.action === "bulk_update_people") {
				const tagName = sanitizeString(action.args?.tagName);
				const rawPatch = action.args?.patch ?? {};
				const bulkPatch: Partial<Person> = {};

				if (rawPatch.year != null) {
					const y = Number(rawPatch.year);
					if (Number.isFinite(y)) {
						bulkPatch.year = y;
					}
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
					if (typeof value === "string" && value.trim()) {
						(bulkPatch as Record<string, unknown>)[key] = value.trim();
					}
				}

				if (!tagName) {
					throw new Error("Bulk update missing tag name.");
				}

				if (Object.keys(bulkPatch).length === 0) {
					throw new Error("Bulk update missing valid patch fields.");
				}

				const normalized = normalizeTag(tagName);
				const tag = tags.find(
					(t) =>
						normalizeTag(t.normalized || t.name) === normalized ||
						normalizeTag(t.name) === normalized,
				);

				if (!tag) {
					throw new Error(`Could not find tag "${tagName}".`);
				}

				const matchedPeople = people.filter((p) =>
					Array.isArray(p.inrete) ? p.inrete.includes(tag.id) : false,
				);

				if (matchedPeople.length === 0) {
					throw new Error(`No people found with tag "${tag.name}".`);
				}

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
			if (action.action === "bulk_unlink_people_by_tag") {
				const tagName = sanitizeString(action.args?.tagName);
				const type = sanitizeString(action.args?.type) || "related";

				if (!tagName) {
					throw new Error("Bulk unlink missing tag name.");
				}

				const normalized = normalizeTag(tagName);
				const tag = tags.find(
					(t) =>
						normalizeTag(t.normalized || t.name) === normalized ||
						normalizeTag(t.name) === normalized,
				);

				if (!tag) {
					throw new Error(`Could not find tag "${tagName}".`);
				}

				const matchedPeople = people.filter((p) =>
					Array.isArray(p.inrete) ? p.inrete.includes(tag.id) : false,
				);

				if (matchedPeople.length < 2) {
					throw new Error(
						`Need at least 2 people with tag "${tag.name}" to remove relationships.`,
					);
				}

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

						const idsToDelete = [...direct, ...reverse]
							.map((r: any) => r.id)
							.filter(Boolean);

						if (idsToDelete.length > 0) {
							await db.relationships.bulkDelete(idsToDelete);
							removed += idsToDelete.length;
						}
					}
				}

				setResult(
					action.message ||
						`Removed ${removed} "${type}" relationships among ${matchedPeople.length} people with tag "${tag.name}".`,
				);
				setError(false);
				return;
			}
			if (action.action === "bulk_link_people_by_tag") {
				const tagName = sanitizeString(action.args?.tagName);
				const type = sanitizeString(action.args?.type) || "related";

				if (!tagName) {
					throw new Error("Bulk link missing tag name.");
				}

				const normalized = normalizeTag(tagName);
				const tag = tags.find(
					(t) =>
						normalizeTag(t.normalized || t.name) === normalized ||
						normalizeTag(t.name) === normalized,
				);

				if (!tag) {
					throw new Error(`Could not find tag "${tagName}".`);
				}

				const matchedPeople = people.filter((p) =>
					Array.isArray(p.inrete) ? p.inrete.includes(tag.id) : false,
				);

				if (matchedPeople.length < 2) {
					throw new Error(
						`Need at least 2 people with tag "${tag.name}" to create relationships.`,
					);
				}

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
						created += 1;
					}
				}

				setResult(
					action.message ||
						`Created ${created} "${type}" relationships between ${matchedPeople.length} people with tag "${tag.name}".`,
				);
				setError(false);
				return;
			}
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

				if (!target && people.length === 1) {
					target = people[0];
				}

				if (!target) {
					throw new Error(
						"Could not find person to update. Select the person first, or include the exact saved name in your prompt.",
					);
				}

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
					if (typeof value === "string" && value.trim()) {
						patch[key] = value.trim();
					}
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

					if (arr.length > 0) {
						mergedSocials[key] = uniqueStrings([
							...(mergedSocials[key] ?? []),
							...arr,
						]);
					}
				}

				for (const [key, value] of Object.entries(directSocials.socials)) {
					mergedSocials[key] = uniqueStrings([
						...(mergedSocials[key] ?? []),
						...value,
					]);
				}

				if (Object.keys(mergedSocials).length > 0) {
					patch.socials = mergedSocials;
				}

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
					if (!mergedInrete.includes(tagRecord.id)) {
						mergedInrete.push(tagRecord.id);
					}
					patch.inrete = mergedInrete;
				}

				const aiTiktok = sanitizeString(
					(rawPatch as Record<string, unknown>).tiktok,
				);
				const aiFacebook = sanitizeString(
					(rawPatch as Record<string, unknown>).facebook,
				);

				if (directSocials.flat.tiktok || aiTiktok) {
					patch.tiktok = directSocials.flat.tiktok || aiTiktok;
				}

				if (directSocials.flat.facebook || aiFacebook) {
					patch.facebook = directSocials.flat.facebook || aiFacebook;
				}

				if (Object.keys(patch).length === 0) {
					throw new Error("No valid patch fields found in AI command.");
				}

				await updatePerson(target.id, patch as Partial<Person>);
				setSelectedPersonId(target.id);
				setResult(action.message || `Updated ${target.name}`);
				setError(false);
				return;
			}

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

			if (action.action === "link_people") {
				const from = findPersonByName(
					people,
					String(action.args?.fromName ?? ""),
				);
				const to = findPersonByName(people, String(action.args?.toName ?? ""));
				const type = sanitizeString(action.args?.type) || "friend";

				if (!from || !to) {
					throw new Error("Could not find both people for relationship.");
				}

				await createRelationship(from.id, to.id, type);
				setResult(
					action.message || `Linked ${from.name} -> ${to.name} as ${type}`,
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

	return (
		<div className="rounded-md border border-[color:var(--rm-border)] bg-black/20 p-3">
			<div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[color:var(--rm-text-muted)]">
				AI Agent (Gemini)
			</div>

			<div className="mb-2 text-[12px] text-[color:var(--rm-text-muted)]">
				Examples: "add tag saying nice to this person", "add these socials:
				https://...", "all ppl that have 1cp tag should update their known from
				years to 2024", or paste a big follower list for review.
			</div>

			{selectedPerson && (
				<div className="mb-2 rounded-md border border-[color:var(--rm-border)] bg-black/20 p-2 text-[12px] text-[color:var(--rm-text-muted)]">
					Selected person:{" "}
					<span className="text-[color:var(--rm-text)]">
						{selectedPerson.name}
					</span>
				</div>
			)}

			<textarea
				className="w-full rounded-md border border-[color:var(--rm-border)] bg-black/25 p-2 text-[13px] text-[color:var(--rm-text)] outline-none focus:border-[color:var(--rm-accent)]"
				rows={5}
				value={prompt}
				onChange={(e) => setPrompt(e.target.value)}
				placeholder="Tell the AI what to change..."
			/>

			<div className="mt-2 flex items-center gap-2">
				<button
					type="button"
					className="rm-sidebar-btn"
					onClick={() => void runAgent()}
					disabled={running || !prompt.trim()}>
					{running ? "Running..." : "Run AI Command"}
				</button>

				{!hasApiKey && (
					<span className="text-[11px] text-amber-300">
						Set VITE_GEMINI_API_KEY in .env.local
					</span>
				)}
			</div>

			{batchReview && (
				<div className="mt-3 rounded-md border border-sky-500/30 bg-sky-500/10 p-3 text-[12px] text-sky-100">
					<div className="mb-2 font-semibold">Review required</div>

					<div className="mb-2 text-sky-50">
						We found existing people, possible matches, and new people from this
						import. Review the names below before creating or selecting
						anything.
					</div>

					<div className="mb-3 grid gap-2 rounded-md border border-sky-400/20 bg-black/20 p-2 sm:grid-cols-3">
						<div>
							<div className="text-[11px] uppercase tracking-wide text-sky-200/70">
								Confirmed
							</div>
							<div className="text-[15px] font-semibold">
								{batchReview.matches.length}
							</div>
						</div>
						<div>
							<div className="text-[11px] uppercase tracking-wide text-sky-200/70">
								Possible
							</div>
							<div className="text-[15px] font-semibold">
								{batchReview.possibleMatches.length}
							</div>
						</div>
						<div>
							<div className="text-[11px] uppercase tracking-wide text-sky-200/70">
								New people
							</div>
							<div className="text-[15px] font-semibold">
								{batchReview.newPeople.length}
							</div>
						</div>
					</div>

					{batchReview.matches.length > 0 && (
						<div className="mb-3">
							<div className="mb-1 font-medium">Confirmed matches</div>
							<div className="space-y-1">
								{batchReview.matches.slice(0, 8).map((item, idx) => {
									const sourceName =
										item.input?.trim() ||
										item.personName?.trim() ||
										"Imported person";

									const matchedName =
										item.personName?.trim() ||
										(item.personId
											? `Saved person (${item.personId})`
											: "Saved person");

									return (
										<div
											key={`${item.input || item.personId || "match"}-${idx}`}
											className="rounded border border-sky-400/15 bg-black/20 px-2 py-1">
											<div className="font-medium text-sky-50">
												{sourceName}
											</div>
											<div className="text-sky-200/80">
												Matches with: {matchedName}
											</div>
											{item.reason && (
												<div className="text-[11px] text-sky-200/60">
													{item.reason}
												</div>
											)}
										</div>
									);
								})}
							</div>
						</div>
					)}

					{batchReview.possibleMatches.length > 0 && (
						<div className="mb-3">
							<div className="mb-1 font-medium">Possible matches</div>
							<div className="space-y-1">
								{batchReview.possibleMatches.slice(0, 8).map((item, idx) => {
									const sourceName =
										item.input?.trim() ||
										item.personName?.trim() ||
										"Imported person";

									const candidateName =
										item.personName?.trim() ||
										(item.personId
											? `Possible saved person (${item.personId})`
											: "Possible saved person");

									return (
										<div
											key={`${item.input || item.personId || "possible"}-${idx}`}
											className="rounded border border-amber-400/15 bg-black/20 px-2 py-1">
											<div className="font-medium text-sky-50">
												{sourceName}
											</div>
											<div className="text-sky-200/80">
												Could match: {candidateName}
											</div>
											{typeof item.confidence === "number" && (
												<div className="text-[11px] text-sky-200/60">
													Confidence: {Math.round(item.confidence * 100)}%
												</div>
											)}
											{item.reason && (
												<div className="text-[11px] text-sky-200/60">
													{item.reason}
												</div>
											)}
										</div>
									);
								})}
							</div>
						</div>
					)}

					{batchReview.newPeople.length > 0 && (
						<div className="mb-3">
							<div className="mb-1 font-medium">New people to create</div>
							<div className="space-y-1">
								{batchReview.newPeople.slice(0, 8).map((item, idx) => {
									const displayName = item.name?.trim() || "Unnamed person";
									const secondary =
										item.instagram?.trim() ||
										item.tiktok?.trim() ||
										item.facebook?.trim() ||
										item.email?.trim() ||
										"";

									return (
										<div
											key={`${item.name || "new"}-${idx}`}
											className="rounded border border-emerald-400/15 bg-black/20 px-2 py-1">
											<div className="font-medium text-sky-50">
												{displayName}
											</div>
											{secondary && (
												<div className="text-sky-200/80">{secondary}</div>
											)}
										</div>
									);
								})}
							</div>
						</div>
					)}

					<div className="mt-3 flex flex-wrap gap-2">
						<button
							type="button"
							className="rm-sidebar-btn"
							onClick={() => void handleApplyBatchCreateAll()}
							disabled={running || batchReview.newPeople.length === 0}>
							Create all new people
						</button>

						<button
							type="button"
							className="rm-sidebar-btn"
							onClick={handleSelectFirstMatch}
							disabled={batchReview.matches.length === 0}>
							Select first confirmed match
						</button>

						<button
							type="button"
							className="rm-sidebar-btn"
							onClick={() => setBatchReview(null)}>
							Dismiss review
						</button>
					</div>
				</div>
			)}

			{result && (
				<div
					className={`mt-2 rounded-md border p-2 text-[12px] ${
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
