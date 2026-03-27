import {
	useState,
	useMemo,
	useEffect,
	type FC,
	type KeyboardEvent,
	type ComponentProps,
} from "react";
import { createPortal } from "react-dom";
import { useAppStore } from "../store/useAppStore";
import type { Socials } from "../models/types";
import type { PersonFormData } from "../store/useAppStore";
import SocialHandles from "./SocialHandles";

type FormState = Omit<PersonFormData, "nodeColor" | "events">;

type AiPersonDraft = Partial<FormState> & {
	tags?: string[];
};

type GeminiGenerateContentResponse = {
	candidates?: Array<{
		content?: {
			parts?: Array<{ text?: string }>;
		};
	}>;
};

const GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite"] as const;

const ADD_PERSON_AI_PROMPT = [
	"You extract person form data from natural language.",
	"Return strict JSON only. No markdown. No explanations.",
	"Schema:",
	"{",
	'  "name"?: string,',
	'  "year"?: number,',
	'  "description"?: string,',
	'  "firstInteraction"?: string,',
	'  "lastInteraction"?: string,',
	'  "lore"?: string,',
	'  "email"?: string,',
	'  "phone"?: string,',
	'  "location"?: string,',
	'  "tags"?: string[],',
	'  "socials"?: {',
	'    "instagram"?: string[],',
	'    "linkedin"?: string[],',
	'    "twitter"?: string[],',
	'    "github"?: string[],',
	'    "mastodon"?: string[],',
	'    "website"?: string[]',
	"  }",
	"}",
	"Rules:",
	"- Only extract fields for one person.",
	"- tags must be plain tag names, not IDs.",
	"- socials values must be arrays of strings.",
	"- If a field is missing, omit it.",
	"- Do not invent information.",
	"- If text says @username and platform is Instagram, place it in socials.instagram.",
].join("\n");

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

		if (response.ok) {
			return (await response.json()) as GeminiGenerateContentResponse;
		}

		lastError = new Error(
			`Gemini ${model} failed (${response.status}): ${await response.text()}`,
		);
	}

	throw lastError ?? new Error("Gemini request failed.");
}

function cleanString(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}

function uniqueStrings(values: string[]): string[] {
	return Array.from(
		new Set(values.map((v) => String(v ?? "").trim()).filter(Boolean)),
	);
}

function parseCommaSeparatedTags(value: string): string[] {
	return String(value ?? "")
		.split(",")
		.map((item) => item.trim())
		.filter(Boolean);
}

type FormFieldProps = ComponentProps<"input"> & { label: string; id: string };
const FormField: FC<FormFieldProps> = ({ label, id, ...props }) => (
	<div className="rm-field">
		<label className="rm-label" htmlFor={id}>
			{label}
		</label>
		<input id={id} className="rm-input" {...props} />
	</div>
);

type TextareaFieldProps = ComponentProps<"textarea"> & {
	label: string;
	id: string;
};
const TextareaField: FC<TextareaFieldProps> = ({ label, id, ...props }) => (
	<div className="rm-field">
		<label className="rm-label" htmlFor={id}>
			{label}
		</label>
		<textarea id={id} className="rm-input" {...props} />
	</div>
);

type AddPersonModalProps = {
	isOpen: boolean;
	onClose: () => void;
};

export default function AddPersonModal({
	isOpen,
	onClose,
}: AddPersonModalProps) {
	const activeYear = useAppStore((s) => s.activeYear);
	const createPerson = useAppStore((s) => s.createPerson);

	const [loading, setLoading] = useState(false);
	const [step, setStep] = useState<"basic" | "contact">("basic");

	const [aiPrompt, setAiPrompt] = useState("");
	const [aiLoading, setAiLoading] = useState(false);
	const [aiResult, setAiResult] = useState("");
	const [aiError, setAiError] = useState(false);

	const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
	const hasApiKey = Boolean(apiKey && apiKey.trim());

	const initialYear = useMemo(
		() =>
			typeof activeYear === "number" ? activeYear : new Date().getFullYear(),
		[activeYear],
	);

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
		} as Socials,
	});

	const [form, setForm] = useState<FormState>(emptyForm);

	useEffect(() => {
		if (isOpen) {
			setForm(emptyForm());
			setStep("basic");
			setLoading(false);
			setAiPrompt("");
			setAiLoading(false);
			setAiResult("");
			setAiError(false);
		}
	}, [isOpen, initialYear]);

	useEffect(() => {
		if (!isOpen) return;

		const onKeyDown = (event: globalThis.KeyboardEvent) => {
			if (event.key === "Escape") onClose();
		};

		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [isOpen, onClose]);

	const handleCreate = async () => {
		if (!form.name.trim()) return;

		setLoading(true);
		try {
			await createPerson(form as PersonFormData);
			onClose();
		} catch (error) {
			console.error("Failed to create person:", error);
		} finally {
			setLoading(false);
		}
	};

	const handleKeyDown = (
		e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
	) => {
		if (e.key === "Enter" && step === "basic" && !e.shiftKey) {
			e.preventDefault();
			if (form.name.trim()) setStep("contact");
		}
	};

	const cleanSocialPlatform = (value: string) => String(value ?? "").trim();
	const cleanSocialValue = (raw: string) => String(raw ?? "").trim();

	const handleSocialAdd = (platform: string, raw: string) => {
		const key = cleanSocialPlatform(platform);
		const value = cleanSocialValue(raw);

		if (!key || !value) return;

		setForm((s) => {
			const currentSocials =
				(s.socials as Record<string, string[] | undefined>) ?? {};
			const existing = Array.isArray(currentSocials[key])
				? [...currentSocials[key]!]
				: [];

			if (
				existing.some(
					(entry) =>
						String(entry ?? "")
							.trim()
							.toLowerCase() === value.toLowerCase(),
				)
			) {
				return s;
			}

			return {
				...s,
				socials: {
					...currentSocials,
					[key]: [...existing, value],
				} as Socials,
			};
		});
	};

	const handleSocialRemove = (platform: string, index: number) => {
		const key = cleanSocialPlatform(platform);
		if (!key) return;

		setForm((s) => {
			const currentSocials =
				(s.socials as Record<string, string[] | undefined>) ?? {};
			const existing = Array.isArray(currentSocials[key])
				? [...currentSocials[key]!]
				: [];

			if (index < 0 || index >= existing.length) return s;

			existing.splice(index, 1);

			return {
				...s,
				socials: {
					...currentSocials,
					[key]: existing,
				} as Socials,
			};
		});
	};

	const runAiFill = async () => {
		const source = aiPrompt.trim();
		if (!source || !hasApiKey) return;

		setAiLoading(true);
		setAiError(false);
		setAiResult("Parsing...");

		try {
			const payload = {
				contents: [
					{
						role: "user",
						parts: [
							{
								text: `${ADD_PERSON_AI_PROMPT}\n\nUser input:\n${source}`,
							},
						],
					},
				],
				generationConfig: {
					temperature: 0.05,
					responseMimeType: "application/json",
				},
			};

			const data = await callGemini(apiKey!.trim(), payload);
			const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
			const parsed = JSON.parse(unwrapJson(rawText)) as AiPersonDraft;

			setForm((prev) => {
				const mergedSocials: Socials = {
					instagram: uniqueStrings([
						...(prev.socials.instagram ?? []),
						...(parsed.socials?.instagram ?? []).map(cleanString),
					]),
					linkedin: uniqueStrings([
						...(prev.socials.linkedin ?? []),
						...(parsed.socials?.linkedin ?? []).map(cleanString),
					]),
					twitter: uniqueStrings([
						...(prev.socials.twitter ?? []),
						...(parsed.socials?.twitter ?? []).map(cleanString),
					]),
					github: uniqueStrings([
						...(prev.socials.github ?? []),
						...(parsed.socials?.github ?? []).map(cleanString),
					]),
					mastodon: uniqueStrings([
						...(prev.socials.mastodon ?? []),
						...(parsed.socials?.mastodon ?? []).map(cleanString),
					]),
					website: uniqueStrings([
						...(prev.socials.website ?? []),
						...(parsed.socials?.website ?? []).map(cleanString),
					]),
				};

				const existingTags = parseCommaSeparatedTags(prev.inrete);
				const incomingTags = Array.isArray(parsed.tags)
					? parsed.tags.map(cleanString).filter(Boolean)
					: [];

				return {
					...prev,
					name: cleanString(parsed.name) || prev.name,
					year:
						typeof parsed.year === "number" && Number.isFinite(parsed.year)
							? parsed.year
							: prev.year,
					description: cleanString(parsed.description) || prev.description,
					firstInteraction:
						cleanString(parsed.firstInteraction) || prev.firstInteraction,
					lastInteraction:
						cleanString(parsed.lastInteraction) || prev.lastInteraction,
					lore: cleanString(parsed.lore) || prev.lore,
					email: cleanString(parsed.email) || prev.email,
					phone: cleanString(parsed.phone) || prev.phone,
					location: cleanString(parsed.location) || prev.location,
					inrete:
						incomingTags.length > 0
							? uniqueStrings([...existingTags, ...incomingTags]).join(", ")
							: prev.inrete,
					socials: mergedSocials,
				};
			});

			setAiResult("Filled form from AI.");
			setAiError(false);
		} catch (error) {
			setAiError(true);
			setAiResult(error instanceof Error ? error.message : "AI fill failed.");
		} finally {
			setAiLoading(false);
		}
	};

	if (!isOpen) return null;
	if (typeof document === "undefined") return null;

	return createPortal(
		<>
			<style>{`
				.rm-overlay {
					position: fixed;
					inset: 0;
					z-index: 120;
					display: flex;
					align-items: center;
					justify-content: center;
					padding: 16px;
					background: rgba(0,0,0,0.72);
					backdrop-filter: blur(4px);
					-webkit-backdrop-filter: blur(4px);
				}
				.rm-modal {
					background: #0f1221;
					border: 1px solid var(--border);
					border-radius: 16px;
					width: 100%;
					max-width: 720px;
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
				}
				.rm-modal-sub {
					font-size: 12px;
					color: var(--text);
					margin-top: 2px;
				}
				.rm-steps { display: flex; gap: 6px; margin-top: 14px; }
				.rm-step { height: 3px; border-radius: 2px; flex: 1; background: var(--border); }
				.rm-step.active { background: var(--accent); }
				.rm-modal-body {
					flex: 1;
					overflow-y: auto;
					padding: 20px 24px;
					display: flex;
					flex-direction: column;
					gap: 14px;
				}
				.rm-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
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
				}
				.rm-input:focus { outline: none; border-color: var(--accent); }
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
				.rm-modal-footer {
					padding: 16px 24px;
					border-top: 1px solid var(--border);
					display: flex;
					align-items: center;
					justify-content: space-between;
					gap: 8px;
					flex-shrink: 0;
				}
				.rm-btn-ghost, .rm-btn-next, .rm-btn-primary {
					padding: 8px 16px;
					border-radius: 8px;
					font-size: 13px;
					font-weight: 600;
					cursor: pointer;
				}
				.rm-btn-ghost {
					border: 1px solid var(--border);
					background: transparent;
					color: var(--text);
				}
				.rm-btn-next {
					border: 1px solid var(--accent-border);
					background: var(--accent-bg);
					color: var(--accent);
					margin-left: auto;
				}
				.rm-btn-primary {
					border: none;
					background: var(--accent);
					color: #fff;
				}
				.rm-btn-primary:disabled,
				.rm-btn-next:disabled,
				.rm-btn-ghost:disabled {
					opacity: 0.45;
					cursor: not-allowed;
				}
				.rm-ai-box {
					border: 1px solid var(--border);
					border-radius: 10px;
					padding: 12px;
					background: rgba(255,255,255,0.02);
				}
				.rm-ai-header {
					display: flex;
					align-items: center;
					justify-content: space-between;
					gap: 8px;
					margin-bottom: 8px;
				}
				.rm-ai-title {
					font-size: 11px;
					font-weight: 700;
					letter-spacing: 0.06em;
					text-transform: uppercase;
					color: var(--text);
				}
				.rm-ai-sub {
					font-size: 11px;
					color: var(--text);
					opacity: 0.7;
				}
				.rm-ai-actions {
					display: flex;
					align-items: center;
					gap: 8px;
					margin-top: 8px;
					flex-wrap: wrap;
				}
				.rm-ai-status {
					font-size: 11px;
					color: var(--text);
				}
				.rm-ai-status.error {
					color: #fca5a5;
				}
				.rm-ai-status.ok {
					color: #86efac;
				}
				@media (max-width: 640px) {
					.rm-row { grid-template-columns: 1fr; }
					.rm-modal { max-height: 95vh; }
				}
			`}</style>

			<div
				className="rm-overlay"
				onClick={(e) => e.target === e.currentTarget && onClose()}>
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
							{step === "basic" ? "Basic info" : "Contact & socials (optional)"}
						</div>
						<div className="rm-steps">
							<div className="rm-step active" />
							<div
								className={`rm-step ${step === "contact" ? "active" : ""}`}
							/>
						</div>
					</div>

					<div className="rm-modal-body">
						<div className="rm-ai-box">
							<div className="rm-ai-header">
								<div className="rm-ai-title">AI fill</div>
								<div className="rm-ai-sub">Optional</div>
							</div>

							<textarea
								className="rm-input"
								rows={3}
								placeholder='Example: "there is this person I met at a concert in 2019, we talked about music and movies, we follow each other on Instagram but I forgot their handle…"'
								value={aiPrompt}
								onChange={(e) => setAiPrompt(e.target.value)}
							/>

							<div className="rm-ai-actions">
								<button
									type="button"
									className="rm-btn-next"
									onClick={() => void runAiFill()}
									disabled={aiLoading || !aiPrompt.trim() || !hasApiKey}>
									{aiLoading ? "Parsing…" : "Fill form with AI"}
								</button>

								{!hasApiKey && (
									<span className="rm-ai-status error">
										Set VITE_GEMINI_API_KEY in .env.local
									</span>
								)}

								{aiResult && (
									<span className={`rm-ai-status ${aiError ? "error" : "ok"}`}>
										{aiResult}
									</span>
								)}
							</div>
						</div>

						{step === "basic" && (
							<>
								<FormField
									label="Name"
									id="name"
									placeholder="Full name"
									value={form.name}
									onChange={(e) =>
										setForm((s) => ({ ...s, name: e.target.value }))
									}
									onKeyDown={handleKeyDown}
								/>
								<div className="rm-row">
									<FormField
										label="Year met"
										id="year"
										type="number"
										value={form.year}
										onChange={(e) =>
											setForm((s) => ({
												...s,
												year: Number(e.target.value || initialYear),
											}))
										}
									/>
									<FormField
										label="Location"
										id="location"
										placeholder="City, Country"
										value={form.location}
										onChange={(e) =>
											setForm((s) => ({ ...s, location: e.target.value }))
										}
									/>
								</div>
								<div className="rm-row">
									<TextareaField
										label="First interaction"
										id="firstInteraction"
										rows={2}
										placeholder="How you first met..."
										value={form.firstInteraction}
										onChange={(e) =>
											setForm((s) => ({
												...s,
												firstInteraction: e.target.value,
											}))
										}
										onKeyDown={handleKeyDown}
									/>
									<TextareaField
										label="Last interaction"
										id="lastInteraction"
										rows={2}
										placeholder="Most recent interaction..."
										value={form.lastInteraction}
										onChange={(e) =>
											setForm((s) => ({
												...s,
												lastInteraction: e.target.value,
											}))
										}
										onKeyDown={handleKeyDown}
									/>
								</div>
								<TextareaField
									label="Description"
									id="description"
									rows={2}
									placeholder="Short note about this person…"
									value={form.description}
									onChange={(e) =>
										setForm((s) => ({ ...s, description: e.target.value }))
									}
									onKeyDown={handleKeyDown}
								/>
								<TextareaField
									label="Lore"
									id="lore"
									rows={3}
									placeholder="Longer backstory, context, memories…"
									value={form.lore}
									onChange={(e) =>
										setForm((s) => ({ ...s, lore: e.target.value }))
									}
									onKeyDown={handleKeyDown}
								/>
								<FormField
									label="Tags"
									id="inrete"
									placeholder="music, school, work (comma separated)"
									value={form.inrete}
									onChange={(e) =>
										setForm((s) => ({ ...s, inrete: e.target.value }))
									}
								/>
							</>
						)}

						{step === "contact" && (
							<>
								<div className="rm-row">
									<FormField
										label="Phone"
										id="phone"
										placeholder="+1 555 000 0000"
										autoComplete="tel"
										value={form.phone}
										onChange={(e) =>
											setForm((s) => ({ ...s, phone: e.target.value }))
										}
									/>
									<FormField
										label="Email"
										id="email"
										placeholder="name@example.com"
										autoComplete="email"
										value={form.email}
										onChange={(e) =>
											setForm((s) => ({ ...s, email: e.target.value }))
										}
									/>
								</div>

								<div>
									<div className="rm-section-label">Social handles</div>
									<div style={{ marginTop: 12 }}>
										<SocialHandles
											socials={
												form.socials as Partial<Record<string, string[]>>
											}
											onAdd={handleSocialAdd}
											onRemove={handleSocialRemove}
										/>
									</div>
								</div>
							</>
						)}
					</div>

					<div className="rm-modal-footer">
						<button
							onClick={step === "basic" ? onClose : () => setStep("basic")}
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
		</>,
		document.body,
	);
}
