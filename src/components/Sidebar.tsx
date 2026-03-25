import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import { useAppStore } from "../store/useAppStore";
import type { Person, Socials, Tag } from "../models/types";

type FormState = {
	name: string;
	year: number;
	description: string;
	firstInteraction: string;
	lastInteraction: string;
	lore: string;
	inrete: string;
	email: string;
	phone: string;
	location: string;
	socials: Socials;
};

const SOCIAL_PLATFORMS: Array<keyof Socials> = [
	"instagram",
	"linkedin",
	"twitter",
	"github",
	"mastodon",
	"website",
];

const SOCIAL_LABELS: Record<string, string> = {
	instagram: "Instagram",
	linkedin: "LinkedIn",
	twitter: "Twitter / X",
	github: "GitHub",
	mastodon: "Mastodon",
	website: "Website",
};

const SOCIAL_ICONS: Record<string, string> = {
	instagram: "📸",
	linkedin: "💼",
	twitter: "𝕏",
	github: "⌥",
	mastodon: "🐘",
	website: "🌐",
};

const BULK_JSON_EXAMPLE = `{
	"tags": [
		{ "id": "tag-work", "name": "work", "normalized": "work" },
		{ "id": "tag-frontend", "name": "frontend", "normalized": "frontend" },
		{ "id": "tag-community", "name": "community", "normalized": "community" }
	],
	"people": [
		{
			"id": "sam-001",
			"name": "Sam Rivera",
			"nodeColor": "#2563eb",
			"year": 2024,
			"description": "Frontend engineer from meetup",
			"firstInteraction": "Met at React meetup",
			"lastInteraction": "Coffee chat about product ideas",
			"location": "Austin, TX",
			"lore": "Helped with launch docs",
			"email": "sam@example.com",
			"phone": "+1 555 111 2233",
			"inrete": ["tag-work", "tag-frontend", "tag-community"],
			"socials": {
				"twitter": ["samcodes"],
				"linkedin": ["sam-rivera"]
			},
			"events": [
				{
					"kind": "date",
					"date": "2025-10-03",
					"note": "Met at launch event"
				}
			]
		}
	]
}`;

export default function Sidebar() {
	const people = useLiveQuery<Person[]>(() => db.people.toArray(), []) ?? [];
	const activeYear = useAppStore((s) => s.activeYear);
	const selectedPersonId = useAppStore((s) => s.selectedPersonId);
	const setActiveYear = useAppStore((s) => s.setActiveYear);
	const addPerson = useAppStore((s) => s.addPerson);
	const importPeopleFromJson = useAppStore((s) => s.importPeopleFromJson);
	const setSelectedPersonId = useAppStore((s) => s.setSelectedPersonId);

	const initialYear = useMemo(
		() =>
			typeof activeYear === "number" ? activeYear : new Date().getFullYear(),
		[activeYear],
	);

	const [modalOpen, setModalOpen] = useState(false);
	const [loading, setLoading] = useState(false);
	const [uploading, setUploading] = useState(false);
	const [uploadMessage, setUploadMessage] = useState<string>("");
	const [uploadError, setUploadError] = useState(false);
	const [peopleSearch, setPeopleSearch] = useState("");
	const [peopleListOpen, setPeopleListOpen] = useState(true);
	const [step, setStep] = useState<"basic" | "contact">("basic");
	const fileInputRef = useRef<HTMLInputElement | null>(null);

	useEffect(() => {
		if (!modalOpen) return;
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				setModalOpen(false);
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [modalOpen]);

	const emptyForm = (): FormState => ({
		name: "",
		year: initialYear,
		description: "",
		firstInteraction: "",
		lastInteraction: "",
		lore: "",
		inrete: "",
		email: "",
		phone: "",
		location: "",
		socials: {
			instagram: [],
			linkedin: [],
			twitter: [],
			github: [],
			mastodon: [],
			website: [],
		},
	});

	const [form, setForm] = useState<FormState>(emptyForm);

	const normalizeHandle = (value: string) => {
		const trimmed = value.trim();
		if (!trimmed) return "";
		return trimmed
			.replace(/^@/, "")
			.replace(/^https?:\/\//i, "")
			.split(/[/?#]/)[0]
			.trim();
	};

	const normalizeHandles = (value: string) =>
		value
			.split(",")
			.map((s) => normalizeHandle(s))
			.filter(Boolean);

	const openModal = () => {
		setForm(emptyForm());
		setStep("basic");
		setModalOpen(true);
	};

	const closeModal = () => setModalOpen(false);

	const yearOptions = useMemo(() => {
		const yrs = new Set(people.map((p) => p.year).filter(Boolean));
		return [...yrs].sort((a, b) => b - a);
	}, [people]);

	const sortedPeople = useMemo(() => {
		const query = peopleSearch.trim().toLowerCase();
		return [...people]
			.filter((person) =>
				activeYear === "all" ? true : person.year === activeYear,
			)
			.sort((a, b) => {
				const an = String(a.name ?? "")
					.trim()
					.toLowerCase();
				const bn = String(b.name ?? "")
					.trim()
					.toLowerCase();
				return an.localeCompare(bn);
			})
			.filter((person) => {
				if (!query) return true;
				const name = String(person.name ?? "").toLowerCase();
				const description = String(person.description ?? "").toLowerCase();
				const year = String(person.year ?? "");
				return (
					name.includes(query) ||
					description.includes(query) ||
					year.includes(query)
				);
			});
	}, [people, peopleSearch, activeYear]);

	const handleCreate = async () => {
		if (!form.name.trim()) return;

		setLoading(true);
		try {
			const requested = form.inrete
				.split(",")
				.map((s) => s.trim())
				.filter(Boolean);

			const existingTags: Tag[] = (await (db as any).tags.toArray()) ?? [];
			const normalize = (s: string) =>
				String(s ?? "")
					.trim()
					.toLowerCase()
					.replace(/\s+/g, "_");

			const tagIds: string[] = [];

			for (const raw of requested) {
				const normalized = normalize(raw);
				const found = existingTags.find(
					(t) => (t.normalized ?? normalize(t.name)) === normalized,
				);

				if (found) {
					tagIds.push(found.id);
					continue;
				}

				const id = Math.random().toString(36).slice(2, 9);
				try {
					await (db as any).tags.add({ id, name: raw, normalized });
				} catch {
					// ignore duplicate write race
				}
				tagIds.push(id);
			}

			const payload: Partial<Person> = {
				name: form.name.trim(),
				year: Number(form.year) || initialYear,
				description: form.description.trim() || "",
				firstInteraction: form.firstInteraction.trim() || "",
				lastInteraction: form.lastInteraction.trim() || "",
				lore: form.lore.trim() || "",
				email: form.email.trim() || "",
				phone: form.phone.trim() || "",
				location: form.location.trim() || "",
				inrete: tagIds,
				socials: SOCIAL_PLATFORMS.reduce((acc, key) => {
					const raw = (form.socials as any)[key] ?? [];
					const joined = Array.isArray(raw) ? raw.join(",") : String(raw || "");
					(acc as any)[key] = normalizeHandles(joined);
					return acc;
				}, {} as Socials),
			};

			const id = await addPerson(payload as Person);
			setSelectedPersonId(id);
			setModalOpen(false);
		} finally {
			setLoading(false);
		}
	};

	const openUploadPicker = () => {
		setUploadError(false);
		setUploadMessage("");
		fileInputRef.current?.click();
	};

	const downloadJson = (fileName: string, payload: unknown) => {
		const blob = new Blob([JSON.stringify(payload, null, 2)], {
			type: "application/json",
		});
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = fileName;
		a.click();
		URL.revokeObjectURL(url);
	};

	const exportBackupJson = async () => {
		const [allPeople, allRelationships, allTags, allEvents] = await Promise.all(
			[
				db.people.toArray(),
				db.relationships.toArray(),
				(db as any).tags ? (db as any).tags.toArray() : Promise.resolve([]),
				db.events.toArray(),
			],
		);

		const tagsById = new Map<string, string>();
		for (const tag of allTags as Tag[]) {
			if (!tag?.id) continue;
			const normalized = String(tag.normalized ?? "").trim();
			const name = String(tag.name ?? "").trim();
			tagsById.set(tag.id, normalized || name);
		}

		const peopleForBackup = allPeople.map((person) => {
			const inreteIds = Array.isArray(person.inrete) ? person.inrete : [];
			const inrete = inreteIds
				.map((tagId) => tagsById.get(tagId) ?? String(tagId ?? "").trim())
				.filter(Boolean);

			return {
				...person,
				inrete,
			};
		});

		downloadJson("relationship-map-backup.json", {
			version: 1,
			exportedAt: new Date().toISOString(),
			people: peopleForBackup,
			relationships: allRelationships,
			tags: allTags,
			events: allEvents,
		});

		setUploadError(false);
		setUploadMessage(
			`Backup exported: ${allPeople.length} people, ${allRelationships.length} relationships.`,
		);
	};

	const handleUploadFile = async (e: ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		setUploading(true);
		setUploadError(false);
		setUploadMessage("");

		try {
			const text = await file.text();
			const parsed: unknown = JSON.parse(text);
			const result = await importPeopleFromJson(parsed);
			setUploadMessage(
				`Import complete: ${result.added} added, ${result.updated} updated, ${result.skipped} skipped, ${result.relationshipsImported} relationships, ${result.eventsImported} events, ${result.tagsImported} tags.`,
			);
		} catch (error) {
			setUploadError(true);
			setUploadMessage(
				error instanceof Error
					? error.message
					: "Could not import file. Check JSON format and try again.",
			);
		} finally {
			setUploading(false);
			e.target.value = "";
		}
	};

	const field = (
		label: string,
		key: keyof FormState,
		opts?: {
			type?: string;
			placeholder?: string;
			textarea?: boolean;
			rows?: number;
		},
	) => (
		<div className="rm-field">
			<label className="rm-label" htmlFor={`rm-${String(key)}-${step}`}>
				{label}
			</label>
			{opts?.textarea ? (
				<textarea
					id={`rm-${String(key)}-${step}`}
					className="rm-input"
					rows={opts.rows ?? 3}
					value={String(form[key] ?? "")}
					onChange={(e) => setForm((s) => ({ ...s, [key]: e.target.value }))}
					placeholder={opts?.placeholder}
				/>
			) : (
				<input
					id={`rm-${String(key)}-${step}`}
					className="rm-input"
					type={opts?.type ?? "text"}
					value={
						opts?.type === "number"
							? String(form[key] ?? "")
							: (form[key] as string)
					}
					onChange={(e) =>
						setForm((s) => ({
							...s,
							[key]:
								opts?.type === "number"
									? Number(e.target.value || initialYear)
									: e.target.value,
						}))
					}
					placeholder={opts?.placeholder}
					autoComplete={
						key === "email"
							? "email"
							: key === "phone"
								? "tel"
								: key === "name"
									? "name"
									: "off"
					}
					onKeyDown={(e) => {
						if (e.key === "Enter" && step === "basic") {
							e.preventDefault();
							if (form.name.trim()) setStep("contact");
						}
					}}
				/>
			)}
		</div>
	);

	return (
		<>
			<style>{`
				.rm-shell-title {
					display: flex;
					flex-direction: column;
					gap: 3px;
				}
				.rm-shell-kicker {
					font-size: 10px;
					letter-spacing: 0.08em;
					text-transform: uppercase;
					font-weight: 700;
					color: var(--text);
				}
				.rm-shell-heading {
					font-size: 15px;
					font-weight: 700;
					color: var(--text-h);
				}
				.rm-shell-sub {
					font-size: 11px;
					line-height: 1.4;
					color: var(--text);
				}
				.rm-stats {
					display: grid;
					grid-template-columns: repeat(2, minmax(0, 1fr));
					gap: 8px;
				}
				.rm-stat {
					border: 1px solid var(--border);
					background: rgba(255,255,255,0.03);
					border-radius: 8px;
					padding: 8px;
				}
				.rm-stat-label {
					font-size: 10px;
					text-transform: uppercase;
					letter-spacing: 0.08em;
					color: var(--text);
					font-weight: 700;
				}
				.rm-stat-value {
					margin-top: 2px;
					font-size: 16px;
					font-weight: 700;
					color: var(--text-h);
				}
				.rm-toolbar {
					position: sticky;
					top: 0;
					z-index: 3;
					display: flex;
					flex-direction: column;
					gap: 10px;
					padding-bottom: 10px;
					background: linear-gradient(
						180deg,
						rgba(15, 18, 33, 0.98) 0%,
						rgba(15, 18, 33, 0.94) 78%,
						rgba(15, 18, 33, 0) 100%
					);
				}
				.rm-action-grid {
					display: grid;
					grid-template-columns: repeat(2, minmax(0, 1fr));
					gap: 8px;
				}
				.rm-action-grid > button:first-child {
					grid-column: 1 / -1;
				}
				@media (max-width: 520px) {
					.rm-action-grid {
						grid-template-columns: 1fr;
					}
					.rm-action-grid > button:first-child {
						grid-column: auto;
					}
				}
				.rm-filter-row {
					display: flex;
					align-items: center;
					gap: 8px;
					flex-wrap: wrap;
				}
				.rm-filter-label {
					font-size: 11px;
					font-weight: 700;
					color: var(--text);
					letter-spacing: 0.06em;
					text-transform: uppercase;
				}
				.rm-sidebar-btn {
					display: inline-flex;
					align-items: center;
					justify-content: center;
					gap: 6px;
					width: 100%;
					min-width: 0;
					padding: 7px 14px;
					border-radius: 8px;
					font-size: 13px;
					font-weight: 600;
					cursor: pointer;
					transition: all 0.15s;
					border: 1px solid var(--accent-border);
					background: var(--accent-bg);
					color: var(--accent);
					letter-spacing: 0.01em;
				}
				.rm-sidebar-btn.primary {
					font-size: 14px;
					padding: 9px 14px;
				}
				.rm-sidebar-btn:hover {
					background: rgba(var(--accent-rgb), 0.25);
				}
				.rm-sidebar-btn:disabled {
					opacity: 0.55;
					cursor: not-allowed;
				}
				.rm-upload-note {
					font-size: 11px;
					line-height: 1.45;
					color: var(--text);
				}
				.rm-upload-msg {
					font-size: 11px;
					line-height: 1.4;
				}
				.rm-upload-msg.ok { color: #86efac; }
				.rm-upload-msg.err { color: #fca5a5; }
				.rm-upload-card {
					border: 1px solid var(--border);
					background: rgba(255,255,255,0.03);
					border-radius: 10px;
					padding: 10px;
					display: flex;
					flex-direction: column;
					gap: 8px;
				}
				.rm-upload-steps {
					font-size: 11px;
					line-height: 1.45;
					color: var(--text);
					display: grid;
					gap: 4px;
				}
				.rm-upload-example {
					margin: 0;
					border: 1px solid rgba(255,255,255,0.08);
					background: rgba(15, 23, 42, 0.45);
					border-radius: 8px;
					padding: 10px;
					font-size: 11px;
					line-height: 1.45;
					color: #d1d5db;
					overflow-x: auto;
					white-space: pre;
				}
				.rm-upload-details {
					display: flex;
					flex-direction: column;
					gap: 8px;
				}
				.rm-people-panel {
					border: 1px solid var(--border);
					background: rgba(255,255,255,0.03);
					border-radius: 10px;
					padding: 10px;
					display: flex;
					flex-direction: column;
					gap: 8px;
				}
				.rm-people-head {
					display: flex;
					align-items: baseline;
					justify-content: space-between;
					gap: 8px;
				}
				.rm-people-toggle {
					background: transparent;
					border: 1px solid var(--border);
					border-radius: 6px;
					padding: 4px 8px;
					font-size: 11px;
					color: var(--text);
					cursor: pointer;
				}
				.rm-people-toggle:hover {
					color: var(--text-h);
					border-color: var(--accent-border);
				}
				.rm-people-title {
					font-size: 12px;
					font-weight: 700;
					color: var(--text-h);
				}
				.rm-people-count {
					font-size: 11px;
					color: var(--text);
				}
				.rm-people-search {
					background: rgba(255,255,255,0.035);
					border: 1px solid var(--border);
					border-radius: 8px;
					padding: 7px 10px;
					font-size: 12px;
					color: var(--text-h);
				}
				.rm-people-search:focus {
					outline: none;
					border-color: var(--accent);
				}
				.rm-people-list {
					max-height: 240px;
					overflow-y: auto;
					display: flex;
					flex-direction: column;
					gap: 6px;
					padding-right: 2px;
				}
				.rm-people-item {
					display: grid;
					grid-template-columns: 1fr auto;
					gap: 6px;
					text-align: left;
					padding: 8px;
					border-radius: 8px;
					border: 1px solid var(--border);
					background: rgba(255,255,255,0.02);
					cursor: pointer;
					transition: background 0.15s, border-color 0.15s;
				}
				.rm-people-item:hover {
					background: rgba(255,255,255,0.05);
				}
				.rm-people-item.active {
					border-color: var(--accent-border);
					background: var(--accent-bg);
				}
				.rm-people-name {
					font-size: 12px;
					font-weight: 700;
					color: var(--text-h);
					white-space: nowrap;
					overflow: hidden;
					text-overflow: ellipsis;
				}
				.rm-people-meta {
					font-size: 11px;
					color: var(--text);
					white-space: nowrap;
				}
				.rm-people-empty {
					font-size: 12px;
					color: var(--text);
					padding: 6px 2px;
				}
				.rm-upload-summary {
					display: flex;
					align-items: center;
					justify-content: space-between;
					gap: 8px;
					cursor: pointer;
					font-size: 12px;
					font-weight: 700;
					color: var(--text-h);
					list-style: none;
					user-select: none;
				}
				.rm-upload-summary::-webkit-details-marker { display: none; }
				.rm-upload-summary-icon {
					font-size: 12px;
					color: var(--text);
					transition: transform 0.15s ease;
				}
				details[open] .rm-upload-summary-icon {
					transform: rotate(180deg);
				}
				.rm-year-select {
					appearance: none;
					background: transparent;
					border: 1px solid var(--border);
					border-radius: 8px;
					padding: 6px 28px 6px 10px;
					font-size: 13px;
					color: var(--text-h);
					cursor: pointer;
					background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%239ca3af' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
					background-repeat: no-repeat;
					background-position: right 9px center;
					background-color: rgba(255,255,255,0.03);
					transition: border-color 0.15s;
				}
				.rm-year-select:focus { outline: none; border-color: var(--accent); }
				.rm-overlay {
					position: fixed; inset: 0; z-index: 50;
					display: flex; align-items: center; justify-content: center;
					background: rgba(0,0,0,0.72);
					backdrop-filter: blur(4px);
					-webkit-backdrop-filter: blur(4px);
					padding: 16px;
					animation: rmFadeIn 0.15s ease-out;
				}
				.rm-modal {
					background: #0f1221;
					border: 1px solid var(--border);
					border-radius: 16px;
					width: 100%;
					max-width: 520px;
					max-height: 90vh;
					display: flex;
					flex-direction: column;
					overflow: hidden;
					box-shadow: 0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04);
				}
				.rm-modal-header {
					padding: 20px 24px 16px;
					border-bottom: 1px solid var(--border);
					flex-shrink: 0;
				}
				.rm-modal-title {
					font-size: 15px;
					font-weight: 700;
					color: var(--text-h);
					letter-spacing: -0.01em;
				}
				.rm-modal-sub {
					font-size: 12px;
					color: var(--text);
					margin-top: 2px;
				}
				.rm-steps {
					display: flex;
					gap: 6px;
					margin-top: 14px;
				}
				.rm-step {
					height: 3px;
					border-radius: 2px;
					flex: 1;
					background: var(--border);
					transition: background 0.2s;
				}
				.rm-step.active { background: var(--accent); }
				.rm-modal-body {
					flex: 1;
					overflow-y: auto;
					padding: 20px 24px;
					display: flex;
					flex-direction: column;
					gap: 14px;
				}
				.rm-modal-body::-webkit-scrollbar { width: 4px; }
				.rm-modal-body::-webkit-scrollbar-track { background: transparent; }
				.rm-modal-body::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }
				.rm-modal-footer {
					padding: 16px 24px;
					border-top: 1px solid var(--border);
					display: flex;
					align-items: center;
					justify-content: space-between;
					flex-shrink: 0;
					gap: 8px;
				}
				.rm-field { display: flex; flex-direction: column; gap: 5px; }
				.rm-label {
					font-size: 11px;
					font-weight: 600;
					color: var(--text);
					letter-spacing: 0.06em;
					text-transform: uppercase;
				}
				.rm-input {
					background: rgba(255,255,255,0.035);
					border: 1px solid var(--border);
					border-radius: 8px;
					padding: 9px 12px;
					font-size: 13px;
					color: var(--text-h);
					width: 100%;
					box-sizing: border-box;
					resize: vertical;
					transition: border-color 0.15s, background 0.15s;
					font-family: inherit;
				}
				.rm-input::placeholder { color: rgba(255,255,255,0.2); }
				.rm-input:focus {
					outline: none;
					border-color: var(--accent);
					background: rgba(var(--accent-rgb), 0.06);
				}
				.rm-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
				.rm-section-label {
					font-size: 11px;
					font-weight: 600;
					color: var(--text);
					letter-spacing: 0.08em;
					text-transform: uppercase;
					padding-bottom: 10px;
					border-bottom: 1px solid var(--border);
					margin-bottom: 2px;
				}
				.rm-socials-grid {
					display: grid;
					grid-template-columns: 1fr 1fr;
					gap: 10px;
				}
				.rm-social-item { display: flex; flex-direction: column; gap: 4px; }
				.rm-social-label {
					font-size: 11px;
					color: var(--text);
					display: flex;
					align-items: center;
					gap: 5px;
				}
				.rm-btn-ghost {
					padding: 8px 16px;
					border-radius: 8px;
					font-size: 13px;
					font-weight: 600;
					cursor: pointer;
					border: 1px solid var(--border);
					background: transparent;
					color: var(--text);
					transition: all 0.15s;
				}
				.rm-btn-ghost:hover { background: rgba(255,255,255,0.05); color: var(--text-h); }
				.rm-btn-primary {
					padding: 8px 20px;
					border-radius: 8px;
					font-size: 13px;
					font-weight: 700;
					cursor: pointer;
					border: none;
					background: var(--accent);
					color: #fff;
					transition: all 0.15s;
					letter-spacing: 0.01em;
				}
				.rm-btn-primary:hover { filter: brightness(1.1); }
				.rm-btn-primary:disabled { opacity: 0.4; cursor: not-allowed; filter: none; }
				.rm-btn-next {
					padding: 8px 20px;
					border-radius: 8px;
					font-size: 13px;
					font-weight: 700;
					cursor: pointer;
					border: 1px solid var(--accent-border);
					background: var(--accent-bg);
					color: var(--accent);
					transition: all 0.15s;
					margin-left: auto;
				}
				.rm-btn-next:hover { background: rgba(var(--accent-rgb), 0.25); }
				.rm-btn-next:disabled { opacity: 0.4; cursor: not-allowed; }
			`}</style>

			<div className="flex h-full w-full flex-col gap-4 overflow-y-auto p-4">
				<div className="rm-shell-title">
					<div className="rm-shell-kicker">Workspace</div>
					<div className="rm-shell-heading">People manager</div>
					<div className="rm-shell-sub">
						Add contacts, filter by year, and import/export your local data.
					</div>
				</div>

				<div className="rm-stats" aria-label="Data summary">
					<div className="rm-stat">
						<div className="rm-stat-label">People</div>
						<div className="rm-stat-value">{people.length}</div>
					</div>
					<div className="rm-stat">
						<div className="rm-stat-label">Visible list</div>
						<div className="rm-stat-value">{sortedPeople.length}</div>
					</div>
				</div>

				<div className="rm-toolbar">
					<div className="rm-action-grid">
						<button
							type="button"
							onClick={openModal}
							className="rm-sidebar-btn primary"
							aria-label="Open add person dialog">
							<span style={{ fontSize: 15 }}>＋</span> Add person
						</button>

						<button
							type="button"
							onClick={openUploadPicker}
							disabled={uploading}
							aria-label="Import people from JSON file"
							className="rm-sidebar-btn">
							<span style={{ fontSize: 13 }}>⇪</span>
							{uploading ? "Importing..." : "Import JSON"}
						</button>

						<button
							type="button"
							onClick={() => void exportBackupJson()}
							aria-label="Export full data backup"
							className="rm-sidebar-btn">
							<span style={{ fontSize: 13 }}>⎙</span>
							Export Backup
						</button>
					</div>

					<input
						ref={fileInputRef}
						type="file"
						accept=".json,application/json"
						onChange={handleUploadFile}
						tabIndex={-1}
						aria-hidden="true"
						style={{ display: "none" }}
					/>

					<div className="rm-filter-row">
						<label className="rm-filter-label" htmlFor="rm-active-year">
							Year filter
						</label>
						<select
							id="rm-active-year"
							value={activeYear === "all" ? "all" : String(activeYear)}
							onChange={(e) =>
								setActiveYear(
									e.target.value === "all" ? "all" : Number(e.target.value),
								)
							}
							className="rm-year-select">
							<option value="all">All years</option>
							{yearOptions.map((y) => (
								<option key={y} value={y}>
									{y}
								</option>
							))}
						</select>
					</div>
				</div>

				<div className="rm-upload-note" role="note">
					Your data is local-first. Import or export JSON to move your workspace
					between devices.
				</div>

				<div className="rm-upload-card">
					<div className="rm-upload-steps" aria-label="Import guide">
						<div>1. Create a .json file on your computer.</div>
						<div>2. Add either a people array or an object with people.</div>
						<div>3. Click Import JSON and choose the file.</div>
						<div>
							4. Existing ids are updated, new ids are added automatically.
						</div>
						<div>5. Use Export Backup to move data between devices.</div>
					</div>

					<details className="rm-upload-details">
						<summary className="rm-upload-summary">
							<span>JSON format example</span>
							<span className="rm-upload-summary-icon">▾</span>
						</summary>
						<pre className="rm-upload-example">{BULK_JSON_EXAMPLE}</pre>
					</details>
				</div>

				<div className="rm-people-panel">
					<div className="rm-people-head">
						<div className="rm-people-title">People List</div>
						<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
							<div className="rm-people-count">{sortedPeople.length}</div>
							<button
								type="button"
								className="rm-people-toggle"
								onClick={() => setPeopleListOpen((v) => !v)}>
								{peopleListOpen ? "Collapse" : "Expand"}
							</button>
						</div>
					</div>

					{peopleListOpen && (
						<>
							<label className="rm-filter-label" htmlFor="rm-people-search">
								Search
							</label>
							<input
								id="rm-people-search"
								className="rm-people-search"
								value={peopleSearch}
								onChange={(e) => setPeopleSearch(e.target.value)}
								placeholder="Search name, year, notes"
								aria-label="Search people list"
								autoComplete="off"
							/>
							<div className="rm-people-list">
								{sortedPeople.length === 0 ? (
									<div className="rm-people-empty">No people found.</div>
								) : (
									sortedPeople.map((person) => (
										<button
											key={person.id}
											type="button"
											className={`rm-people-item ${
												selectedPersonId === person.id ? "active" : ""
											}`}
											title={`Open ${person.name || "Unknown"}`}
											onClick={() => setSelectedPersonId(person.id)}>
											<div className="rm-people-name">
												{person.name || "Unknown"}
											</div>
											<div className="rm-people-meta">{person.year || "-"}</div>
										</button>
									))
								)}
							</div>
						</>
					)}
				</div>

				{uploadMessage && (
					<div
						role="status"
						aria-live="polite"
						className={`rm-upload-msg ${uploadError ? "err" : "ok"}`}>
						{uploadMessage}
					</div>
				)}
			</div>

			{modalOpen && (
				<div
					className="rm-overlay"
					onClick={(e) => e.target === e.currentTarget && closeModal()}>
					<div
						role="dialog"
						aria-modal="true"
						aria-labelledby="rm-add-person-title"
						className="rm-modal">
						<div className="rm-modal-header">
							<div id="rm-add-person-title" className="rm-modal-title">
								Add person
							</div>
							<div className="rm-modal-sub">
								{step === "basic"
									? "Basic info"
									: "Contact & socials (optional)"}
							</div>
							<div className="rm-steps">
								<div
									className={`rm-step ${
										step === "basic" || step === "contact" ? "active" : ""
									}`}
								/>
								<div
									className={`rm-step ${step === "contact" ? "active" : ""}`}
								/>
							</div>
						</div>

						<div className="rm-modal-body">
							{step === "basic" && (
								<>
									{field("Name", "name", { placeholder: "Full name" })}
									<div className="rm-row">
										{field("Year met", "year", { type: "number" })}
										{field("Location", "location", {
											placeholder: "City, Country",
										})}
									</div>
									<div className="rm-row">
										{field("First interaction", "firstInteraction", {
											textarea: true,
											rows: 2,
											placeholder: "How you first met...",
										})}
										{field("Last interaction", "lastInteraction", {
											textarea: true,
											rows: 2,
											placeholder: "Most recent interaction...",
										})}
									</div>
									{field("Description", "description", {
										textarea: true,
										rows: 2,
										placeholder: "Short note about this person…",
									})}
									{field("Lore", "lore", {
										textarea: true,
										rows: 3,
										placeholder: "Longer backstory, context, memories…",
									})}
									{field("Tags", "inrete", {
										placeholder: "music, school, work (comma separated)",
									})}
								</>
							)}

							{step === "contact" && (
								<>
									<div className="rm-row">
										{field("Phone", "phone", {
											placeholder: "+1 555 000 0000",
										})}
										{field("Email", "email", {
											placeholder: "name@example.com",
										})}
									</div>

									<div>
										<div className="rm-section-label">Social handles</div>
										<div className="rm-socials-grid" style={{ marginTop: 12 }}>
											{SOCIAL_PLATFORMS.map((key) => (
												<div key={key} className="rm-social-item">
													<span className="rm-social-label">
														<span>{SOCIAL_ICONS[key]}</span>
														{SOCIAL_LABELS[key]}
													</span>
													<input
														className="rm-input"
														value={(form.socials as any)[key].join(",")}
														onChange={(e) =>
															setForm((s) => ({
																...s,
																socials: {
																	...(s.socials as any),
																	[key]: e.target.value
																		.split(",")
																		.map((v) => v.trim())
																		.filter(Boolean),
																},
															}))
														}
														placeholder="@handle"
													/>
												</div>
											))}
										</div>
									</div>
								</>
							)}
						</div>

						<div className="rm-modal-footer">
							<button
								onClick={step === "basic" ? closeModal : () => setStep("basic")}
								className="rm-btn-ghost">
								{step === "basic" ? "Cancel" : "← Back"}
							</button>

							{step === "basic" ? (
								<button
									className="rm-btn-next"
									disabled={!form.name.trim()}
									onClick={() => setStep("contact")}>
									Next →
								</button>
							) : (
								<button
									className="rm-btn-primary"
									disabled={loading || !form.name.trim()}
									onClick={handleCreate}>
									{loading ? "Creating…" : "Create person"}
								</button>
							)}
						</div>
					</div>
				</div>
			)}
		</>
	);
}
