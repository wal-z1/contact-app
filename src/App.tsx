import { useEffect, useState, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import PersonPanel from "./components/PersonPanel";
import Sidebar from "./components/Sidebar";
import AppLayout from "./components/AppLayout";
import PanelToggles from "./components/PanelToggles";
import MobilePanel from "./components/MobilePanel";
import OnboardingDialog from "./components/OnboardingDialog";
import { useTheme } from "./hooks/useTheme";
import { useResponsivePanels } from "./hooks/useResponsivePanels";
import { useAppStore } from "./store/useAppStore";
import { db } from "./db/db";

type GeminiGenerateContentResponse = {
	candidates?: Array<{
		content?: {
			parts?: Array<{ text?: string }>;
		};
	}>;
};

const GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite"] as const;

const REVIEW_AI_SYSTEM_PROMPT = [
	"You are a relationship-map review assistant.",
	"You are helping the user review one person record at a time.",
	"Return strict JSON only. No markdown. No explanations outside JSON.",
	"Schema:",
	"{",
	'  "summary": string,',
	'  "missingFields": string[],',
	'  "suggestedTags": string[],',
	'  "suggestedDescription"?: string,',
	'  "suggestedLore"?: string,',
	'  "notes": string[]',
	"}",
	"Rules:",
	"- Only analyze the currently selected person.",
	"- Be conservative and do not invent facts.",
	"- If information is missing, say what is missing.",
	"- suggestedTags must be plain tag names, not ids.",
	"- suggestedDescription and suggestedLore must be based only on existing data and user prompt.",
	"- notes should be short, actionable review suggestions.",
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

function cleanStringArray(value: unknown): string[] {
	return Array.isArray(value)
		? Array.from(
				new Set(value.map((item) => String(item ?? "").trim()).filter(Boolean)),
			)
		: [];
}

export default function App() {
	useTheme();

	const {
		containerRef,
		isMd,
		gridTemplateColumns,
		showLeftPanel,
		setShowLeftPanel,
		showRightPanel,
		setShowRightPanel,
		rightPanelWidth,
		setIsResizing,
	} = useResponsivePanels();

	const onboardingSeenKey = useMemo(
		() => "relationship-map.onboardingSeen",
		[],
	);

	const reviewMode = useAppStore((s) => s.reviewMode);
	const reviewList = useAppStore((s) => s.reviewList);
	const selectedPersonId = useAppStore((s) => s.selectedPersonId);
	const stopManualReview = useAppStore((s) => s.stopManualReview);
	const reviewNext = useAppStore((s) => s.reviewNext);
	const reviewPrev = useAppStore((s) => s.reviewPrev);

	const reviewPerson = useLiveQuery(
		() => (selectedPersonId ? db.people.get(selectedPersonId) : undefined),
		[selectedPersonId],
	);

	const reviewIndex = useMemo(() => {
		if (!selectedPersonId) return -1;
		return reviewList.findIndex((id) => id === selectedPersonId);
	}, [reviewList, selectedPersonId]);

	const totalReview = reviewList.length;
	const isFirstReview = reviewIndex <= 0;
	const isLastReview = reviewIndex >= 0 && reviewIndex === totalReview - 1;

	const [onboardingMounted, setOnboardingMounted] = useState(false);

	const [reviewAiPrompt, setReviewAiPrompt] = useState("");
	const [reviewAiLoading, setReviewAiLoading] = useState(false);
	const [reviewAiError, setReviewAiError] = useState(false);
	const [reviewAiResult, setReviewAiResult] = useState<{
		summary: string;
		missingFields: string[];
		suggestedTags: string[];
		suggestedDescription?: string;
		suggestedLore?: string;
		notes: string[];
	} | null>(null);
	const [reviewAiStatus, setReviewAiStatus] = useState("");

	const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
	const hasApiKey = Boolean(apiKey && apiKey.trim());

	useEffect(() => {
		try {
			const seen = window.localStorage.getItem(onboardingSeenKey);
			if (!seen) {
				setOnboardingMounted(true);
			}
		} catch {
			setOnboardingMounted(true);
		}
	}, [onboardingSeenKey]);

	useEffect(() => {
		if (!reviewMode) {
			setReviewAiPrompt("");
			setReviewAiResult(null);
			setReviewAiStatus("");
			setReviewAiError(false);
			setReviewAiLoading(false);
			return;
		}
	}, [reviewMode]);

	useEffect(() => {
		if (!reviewMode) return;
		setReviewAiResult(null);
		setReviewAiStatus("");
		setReviewAiError(false);
	}, [selectedPersonId, reviewMode]);

	const handleCloseOnboarding = () => {
		try {
			window.localStorage.setItem(onboardingSeenKey, "1");
		} catch {
			// Ignore if localStorage is unavailable
		}
		setOnboardingMounted(false);
	};

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return;
			if (reviewMode) {
				stopManualReview();
				return;
			}
			if (onboardingMounted) {
				return;
			}
			if (!isMd) {
				if (showLeftPanel) setShowLeftPanel(false);
				if (showRightPanel) setShowRightPanel(false);
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [
		isMd,
		onboardingMounted,
		showLeftPanel,
		showRightPanel,
		reviewMode,
		stopManualReview,
		setShowLeftPanel,
		setShowRightPanel,
	]);

	const handleResizeStart = (e: React.PointerEvent<Element>) => {
		(e.currentTarget as Element).setPointerCapture(e.pointerId);
		setIsResizing(true);
	};

	const runReviewAi = async () => {
		if (!hasApiKey || !reviewPerson) return;

		const userPrompt =
			reviewAiPrompt.trim() ||
			"Summarize this person, point out missing fields, suggest helpful tags, and suggest cleaner description text if possible.";

		setReviewAiLoading(true);
		setReviewAiError(false);
		setReviewAiStatus("Reviewing current person...");

		try {
			const payload = {
				contents: [
					{
						role: "user",
						parts: [
							{
								text: [
									REVIEW_AI_SYSTEM_PROMPT,
									"",
									"Selected person JSON:",
									JSON.stringify(reviewPerson, null, 2),
									"",
									`User review request: ${userPrompt}`,
								].join("\n"),
							},
						],
					},
				],
				generationConfig: {
					temperature: 0.1,
					responseMimeType: "application/json",
				},
			};

			const data = await callGemini(apiKey!.trim(), payload);
			const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
			const parsed = JSON.parse(unwrapJson(rawText)) as Record<string, unknown>;

			setReviewAiResult({
				summary: cleanString(parsed.summary),
				missingFields: cleanStringArray(parsed.missingFields),
				suggestedTags: cleanStringArray(parsed.suggestedTags),
				suggestedDescription:
					cleanString(parsed.suggestedDescription) || undefined,
				suggestedLore: cleanString(parsed.suggestedLore) || undefined,
				notes: cleanStringArray(parsed.notes),
			});

			setReviewAiStatus("AI review ready.");
			setReviewAiError(false);
		} catch (error) {
			setReviewAiError(true);
			setReviewAiStatus(
				error instanceof Error ? error.message : "AI review failed.",
			);
		} finally {
			setReviewAiLoading(false);
		}
	};

	return (
		<div className="min-h-screen w-full bg-(--bg) text-(--text-h)">
			<a
				href="#relationship-map-canvas"
				className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 z-50 rounded-md border border-(--accent-border) bg-slate-900 px-3 py-2 text-xs text-slate-100">
				Skip to relationship graph
			</a>

			<div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,rgba(var(--accent-rgb),0.22),transparent_55%),radial-gradient(ellipse_at_bottom,rgba(var(--accent-rgb),0.14),transparent_45%)]" />

			<AppLayout
				containerRef={containerRef}
				isMd={isMd}
				gridTemplateColumns={gridTemplateColumns}
				showLeftPanel={showLeftPanel}
				showRightPanel={showRightPanel}
				rightPanelWidth={rightPanelWidth}
				onResizeStart={handleResizeStart}
			/>

			<PanelToggles />

			{!isMd && (
				<>
					<MobilePanel
						isOpen={showLeftPanel}
						onClose={() => setShowLeftPanel(false)}
						position="left"
						title="Filters & Actions">
						<Sidebar />
					</MobilePanel>

					<MobilePanel
						isOpen={showRightPanel}
						onClose={() => setShowRightPanel(false)}
						position="right"
						title="Details">
						<PersonPanel />
					</MobilePanel>
				</>
			)}

			{onboardingMounted && (
				<OnboardingDialog onClose={handleCloseOnboarding} />
			)}

			{reviewMode && (
				<div className="fixed inset-0 z-[80] bg-black/70 p-4 backdrop-blur-sm md:p-6">
					<div
						role="dialog"
						aria-modal="true"
						aria-labelledby="manual-review-title"
						className="mx-auto flex h-full max-h-[92vh] w-full max-w-[1280px] flex-col overflow-hidden rounded-xl border border-(--border) bg-(--panel-bg) shadow-[0_20px_70px_rgba(0,0,0,0.6)]">
						<div className="shrink-0 border-b border-(--border) bg-white/5 px-4 py-3 md:px-5">
							<div className="flex items-center justify-between gap-3">
								<div>
									<div
										id="manual-review-title"
										className="text-sm font-bold uppercase tracking-[0.08em] text-[color:var(--text-h)]">
										Manual Review
									</div>
									<div className="mt-1 text-xs text-[color:var(--text)]">
										Reviewing {Math.max(1, reviewIndex + 1)} of{" "}
										{Math.max(1, totalReview)}
										{reviewPerson?.name ? ` • ${reviewPerson.name}` : ""}
									</div>
								</div>

								<button
									type="button"
									onClick={stopManualReview}
									className="rounded-md border border-(--border) bg-transparent px-3 py-1.5 text-xs text-[color:var(--text)] hover:bg-white/10">
									Close review
								</button>
							</div>
						</div>

						<div className="min-h-0 flex-1 overflow-hidden">
							<div className="grid h-full min-h-0 grid-cols-1 md:grid-cols-[360px_minmax(0,1fr)]">
								{/* AI side */}
								<div className="min-h-0 overflow-y-auto border-b border-(--border) bg-white/5 p-4 md:border-b-0 md:border-r md:p-5">
									<div className="rounded-lg border border-(--border) bg-black/10 p-3">
										<div className="mb-2 flex items-center justify-between gap-3">
											<div>
												<div className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-h)]">
													AI Review Assistant
												</div>
												<div className="mt-1 text-[11px] text-[color:var(--text)] opacity-80">
													Ask for missing fields, suggested tags, cleaner
													wording, or a quick summary.
												</div>
											</div>
											<div className="text-[11px] text-[color:var(--text)] opacity-60">
												{reviewPerson?.name ?? "No person selected"}
											</div>
										</div>

										<textarea
											className="w-full rounded-md border border-(--border) bg-black/20 px-3 py-2 text-xs text-[color:var(--text-h)] outline-none focus:border-(--accent)"
											rows={4}
											placeholder='Example: "What is missing here?" or "Suggest better tags and rewrite the description."'
											value={reviewAiPrompt}
											onChange={(e) => setReviewAiPrompt(e.target.value)}
										/>

										<div className="mt-2 flex flex-wrap items-center gap-2">
											<button
												type="button"
												onClick={() => void runReviewAi()}
												disabled={
													reviewAiLoading || !reviewPerson || !hasApiKey
												}
												className="rounded-md border border-(--accent-border) bg-(--accent-bg) px-3 py-1.5 text-xs font-semibold text-(--accent) hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40">
												{reviewAiLoading ? "Reviewing…" : "Run AI review"}
											</button>

											{!hasApiKey && (
												<div className="text-[11px] text-amber-300">
													Set VITE_GEMINI_API_KEY in .env.local
												</div>
											)}

											{reviewAiStatus && (
												<div
													className={`text-[11px] ${
														reviewAiError ? "text-red-300" : "text-emerald-300"
													}`}>
													{reviewAiStatus}
												</div>
											)}
										</div>

										{reviewAiResult && (
											<div className="mt-3 space-y-3">
												<div className="rounded-md border border-(--border) bg-black/15 p-3">
													<div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--text)] opacity-80">
														Summary
													</div>
													<div className="mt-2 text-xs leading-5 text-[color:var(--text-h)]">
														{reviewAiResult.summary || "No summary returned."}
													</div>
												</div>

												<div className="rounded-md border border-(--border) bg-black/15 p-3">
													<div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--text)] opacity-80">
														Missing fields
													</div>
													<div className="mt-2 flex flex-wrap gap-2">
														{reviewAiResult.missingFields.length > 0 ? (
															reviewAiResult.missingFields.map((item) => (
																<span
																	key={item}
																	className="rounded-full border border-(--border) bg-white/5 px-2 py-1 text-[11px] text-[color:var(--text-h)]">
																	{item}
																</span>
															))
														) : (
															<span className="text-xs text-[color:var(--text)] opacity-70">
																No obvious missing fields.
															</span>
														)}
													</div>
												</div>

												<div className="rounded-md border border-(--border) bg-black/15 p-3">
													<div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--text)] opacity-80">
														Suggested tags
													</div>
													<div className="mt-2 flex flex-wrap gap-2">
														{reviewAiResult.suggestedTags.length > 0 ? (
															reviewAiResult.suggestedTags.map((item) => (
																<span
																	key={item}
																	className="rounded-full border border-(--border) bg-white/5 px-2 py-1 text-[11px] text-[color:var(--text-h)]">
																	{item}
																</span>
															))
														) : (
															<span className="text-xs text-[color:var(--text)] opacity-70">
																No tag suggestions.
															</span>
														)}
													</div>
												</div>

												<div className="rounded-md border border-(--border) bg-black/15 p-3">
													<div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--text)] opacity-80">
														Review notes
													</div>
													<div className="mt-2 space-y-1">
														{reviewAiResult.notes.length > 0 ? (
															reviewAiResult.notes.map((note, index) => (
																<div
																	key={`${note}-${index}`}
																	className="text-xs leading-5 text-[color:var(--text-h)]">
																	• {note}
																</div>
															))
														) : (
															<div className="text-xs text-[color:var(--text)] opacity-70">
																No extra notes.
															</div>
														)}
													</div>
												</div>

												{reviewAiResult.suggestedDescription && (
													<div className="rounded-md border border-(--border) bg-black/15 p-3">
														<div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--text)] opacity-80">
															Suggested description
														</div>
														<div className="mt-2 whitespace-pre-wrap text-xs leading-5 text-[color:var(--text-h)]">
															{reviewAiResult.suggestedDescription}
														</div>
													</div>
												)}

												{reviewAiResult.suggestedLore && (
													<div className="rounded-md border border-(--border) bg-black/15 p-3">
														<div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--text)] opacity-80">
															Suggested lore
														</div>
														<div className="mt-2 whitespace-pre-wrap text-xs leading-5 text-[color:var(--text-h)]">
															{reviewAiResult.suggestedLore}
														</div>
													</div>
												)}
											</div>
										)}
									</div>
								</div>

								{/* Person side */}
								<div className="min-h-0 overflow-y-auto">
									<div className="min-h-full">
										<PersonPanel />
									</div>
								</div>
							</div>
						</div>

						<div className="shrink-0 flex items-center justify-between border-t border-(--border) bg-white/5 px-4 py-3 md:px-5">
							<button
								type="button"
								onClick={reviewPrev}
								disabled={isFirstReview}
								className="rounded-md border border-(--border) bg-transparent px-3 py-1.5 text-xs text-[color:var(--text)] hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40">
								Previous
							</button>

							<div className="text-xs text-[color:var(--text)] opacity-80">
								Guided review mode
							</div>

							<button
								type="button"
								onClick={reviewNext}
								className="rounded-md border border-(--accent-border) bg-(--accent-bg) px-3 py-1.5 text-xs font-semibold text-(--accent) hover:bg-white/10">
								{isLastReview ? "Finish review" : "Next"}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
