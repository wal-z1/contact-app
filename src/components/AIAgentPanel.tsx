import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import { useAppStore } from "../store/useAppStore";
import type { Person } from "../models/types";

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
	  };

const GEMINI_MODEL = "gemini-1.5-flash";

function unwrapJson(text: string): string {
	const trimmed = String(text ?? "").trim();
	if (!trimmed) return "{}";
	if (trimmed.startsWith("```") && trimmed.includes("\n")) {
		const withoutTicks = trimmed
			.replace(/^```(?:json)?\s*/i, "")
			.replace(/```$/i, "")
			.trim();
		return withoutTicks;
	}
	return trimmed;
}

function findPersonByName(
	people: Person[],
	rawName: string,
): Person | undefined {
	const q = String(rawName ?? "")
		.trim()
		.toLowerCase();
	if (!q) return undefined;
	const exact = people.find(
		(p) =>
			String(p.name ?? "")
				.trim()
				.toLowerCase() === q,
	);
	if (exact) return exact;
	return people.find((p) =>
		String(p.name ?? "")
			.toLowerCase()
			.includes(q),
	);
}

export default function AIAgentPanel() {
	const people = useLiveQuery<Person[]>(() => db.people.toArray(), []) ?? [];
	const addPerson = useAppStore((s) => s.addPerson);
	const updatePerson = useAppStore((s) => s.updatePerson);
	const createRelationship = useAppStore((s) => s.createRelationship);
	const setSelectedPersonId = useAppStore((s) => s.setSelectedPersonId);

	const [prompt, setPrompt] = useState("");
	const [running, setRunning] = useState(false);
	const [result, setResult] = useState("");
	const [error, setError] = useState(false);

	const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
	const hasApiKey = Boolean(apiKey && apiKey.trim());

	const peopleContext = useMemo(
		() =>
			people
				.slice(0, 200)
				.map((p) => ({ id: p.id, name: p.name, year: p.year }))
				.filter((p) => p.name),
		[people],
	);

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

		try {
			const systemPrompt = [
				"You are a contact-app command planner.",
				"Return strict JSON only.",
				"Schema: { action: 'create_person'|'update_person'|'select_person'|'link_people'|'none', args: object, message?: string }",
				"Rules:",
				"- Prefer 'none' when request is ambiguous.",
				"- For update/select/link, use person names from provided people list.",
				"- Never return markdown or explanations.",
			].join("\n");

			const payload = {
				contents: [
					{
						role: "user",
						parts: [
							{
								text: `${systemPrompt}\n\nPeople:\n${JSON.stringify(peopleContext)}\n\nUser request:\n${userText}`,
							},
						],
					},
				],
				generationConfig: {
					temperature: 0.1,
					responseMimeType: "application/json",
				},
			};

			const response = await fetch(
				`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey!)}`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(payload),
				},
			);

			if (!response.ok) {
				const text = await response.text();
				throw new Error(`Gemini request failed (${response.status}): ${text}`);
			}

			const data = (await response.json()) as {
				candidates?: Array<{
					content?: { parts?: Array<{ text?: string }> };
				}>;
			};

			const rawText =
				data.candidates?.[0]?.content?.parts?.[0]?.text ??
				'{"action":"none","args":{}}';
			const action = JSON.parse(unwrapJson(rawText)) as AgentAction;

			if (action.action === "create_person") {
				const name = String(action.args?.name ?? "").trim();
				if (!name) throw new Error("AI command missing person name.");
				const year = Number(action.args?.year);
				await addPerson({
					name,
					year: Number.isFinite(year) ? year : new Date().getFullYear(),
					email: String(action.args?.email ?? "").trim(),
					phone: String(action.args?.phone ?? "").trim(),
					location: String(action.args?.location ?? "").trim(),
					description: String(action.args?.description ?? "").trim(),
				});
				setResult(action.message || `Created person: ${name}`);
				setError(false);
				return;
			}

			if (action.action === "update_person") {
				const target = findPersonByName(
					people,
					String(action.args?.personName ?? ""),
				);
				if (!target) throw new Error("Could not find person to update.");
				const rawPatch = action.args?.patch ?? {};
				const patch: Partial<Person> = {};
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
					if (typeof value === "string") {
						(patch as any)[key] = value;
					}
				}
				if (rawPatch.year != null) {
					const y = Number(rawPatch.year);
					if (Number.isFinite(y)) patch.year = y;
				}
				if (Object.keys(patch).length === 0) {
					throw new Error("No valid patch fields found in AI command.");
				}
				await updatePerson(target.id, patch);
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
				const type = String(action.args?.type ?? "").trim() || "friend";
				if (!from || !to)
					throw new Error("Could not find both people for relationship.");
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
				Describe a change, for example: "add person Sarah, year 2024, email
				sarah@example.com"
			</div>
			<textarea
				className="w-full rounded-md border border-[color:var(--rm-border)] bg-black/25 p-2 text-[13px] text-[color:var(--rm-text)] outline-none focus:border-[color:var(--rm-accent)]"
				rows={3}
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
