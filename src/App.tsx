import { useEffect, useMemo, useRef, useState } from "react";
import GraphView from "./components/GraphView";
import PersonPanel from "./components/PersonPanel";
import Sidebar from "./components/Sidebar";
import { useAppStore } from "./store/useAppStore";

export default function App() {
	const setActiveYear = useAppStore((s) => s.setActiveYear);
	const addPerson = useAppStore((s) => s.addPerson);
	const theme = useAppStore((s) => s.theme);
	const selectedPersonId = useAppStore((s) => s.selectedPersonId);

	const onboardingSeenKey = useMemo(
		() => "relationship-map.onboardingSeen",
		[],
	);

	const [onboardingMounted, setOnboardingMounted] = useState(false);
	const [onboardingClosing, setOnboardingClosing] = useState(false);
	const onboardingCloseTimer = useRef<number | null>(null);
	const [startYear, setStartYear] = useState<number>(() =>
		new Date().getFullYear(),
	);
	const [firstPerson, setFirstPerson] = useState({
		name: "",
		firstInteraction: "",
		lastInteraction: "",
		description: "",
		lore: "",
	});

	const [sidebarOpen, setSidebarOpen] = useState(false);
	const [personPanelOpen, setPersonPanelOpen] = useState(false);

	const showLeftPanel = useAppStore((s) => s.showLeftPanel);
	const setShowLeftPanel = useAppStore((s) => s.setShowLeftPanel);
	const showRightPanel = useAppStore((s) => s.showRightPanel);
	const setShowRightPanel = useAppStore((s) => s.setShowRightPanel);
	const showGraphControls = useAppStore((s) => s.showGraphControls);
	const setShowGraphControls = useAppStore((s) => s.setShowGraphControls);
	const rightPanelWidth = useAppStore((s) => s.rightPanelWidth);
	const setRightPanelWidth = useAppStore((s) => s.setRightPanelWidth);

	const containerRef = useRef<HTMLDivElement | null>(null);
	const [isMd, setIsMd] = useState(() =>
		typeof window !== "undefined" ? window.innerWidth >= 768 : false,
	);
	const [dragging, setDragging] = useState(false);

	useEffect(() => {
		const onResize = () => setIsMd(window.innerWidth >= 768);
		window.addEventListener("resize", onResize);
		return () => window.removeEventListener("resize", onResize);
	}, []);

	useEffect(() => {
		if (!dragging) return;
		const onPointerMove = (e: PointerEvent) => {
			if (!containerRef.current) return;
			const rect = containerRef.current.getBoundingClientRect();
			const newWidth = Math.max(
				200,
				Math.min(900, Math.round(rect.right - e.clientX)),
			);
			setRightPanelWidth(newWidth);
		};
		const onPointerUp = () => setDragging(false);
		window.addEventListener("pointermove", onPointerMove);
		window.addEventListener("pointerup", onPointerUp, { once: true });
		return () => {
			window.removeEventListener("pointermove", onPointerMove);
			window.removeEventListener("pointerup", onPointerUp as any);
		};
	}, [dragging, setRightPanelWidth]);

	useEffect(() => {
		try {
			const seen = window.localStorage.getItem(onboardingSeenKey);
			if (!seen) setOnboardingMounted(true);
		} catch {
			setOnboardingMounted(true);
		}
	}, [onboardingSeenKey]);

	const closeOnboarding = () => {
		try {
			window.localStorage.setItem(onboardingSeenKey, "1");
		} catch {
			// ignore
		}
		setOnboardingClosing(true);
		if (onboardingCloseTimer.current)
			window.clearTimeout(onboardingCloseTimer.current);
		onboardingCloseTimer.current = window.setTimeout(() => {
			setOnboardingMounted(false);
			setOnboardingClosing(false);
		}, 180);
	};

	const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
		const normalized = hex.replace("#", "").trim();
		const full =
			normalized.length === 3
				? normalized
						.split("")
						.map((c) => c + c)
						.join("")
				: normalized;
		const num = Number.parseInt(full, 16);
		/* eslint-disable no-bitwise */
		return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
		/* eslint-enable no-bitwise */
	};

	useEffect(() => {
		const el = document.documentElement;
		el.style.setProperty("--bg", theme.bg);
		el.style.setProperty("--border", theme.border);
		el.style.setProperty("--text", theme.textMuted);
		el.style.setProperty("--text-h", theme.text);
		el.style.setProperty("--accent", theme.accent);
		el.style.setProperty("--panel-bg", theme.panelBg);

		try {
			const rgb = hexToRgb(theme.accent);
			el.style.setProperty("--accent-rgb", `${rgb.r}, ${rgb.g}, ${rgb.b}`);
			el.style.setProperty(
				"--accent-bg",
				`rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15)`,
			);
			el.style.setProperty(
				"--accent-border",
				`rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.5)`,
			);
		} catch {
			// ignore invalid hex
		}
	}, [theme]);

	useEffect(() => {
		return () => {
			if (onboardingCloseTimer.current)
				window.clearTimeout(onboardingCloseTimer.current);
		};
	}, []);

	// Open the person details panel on small screens when a person is selected
	useEffect(() => {
		if (!selectedPersonId) return;
		try {
			if (typeof window !== "undefined" && window.innerWidth < 768) {
				setPersonPanelOpen(true);
			}
		} catch {
			// ignore
		}
	}, [selectedPersonId]);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return;
			if (onboardingMounted) {
				closeOnboarding();
				return;
			}

			if (sidebarOpen) setSidebarOpen(false);
			if (personPanelOpen) setPersonPanelOpen(false);
		};

		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [onboardingMounted, sidebarOpen, personPanelOpen]);

	const gridTemplateColumns = (() => {
		if (!isMd) return undefined;
		const cols: string[] = [];
		if (showLeftPanel) cols.push("280px");
		cols.push("1fr");
		if (showRightPanel) cols.push(`${rightPanelWidth}px`);
		return cols.join(" ");
	})();

	return (
		<div className="min-h-screen w-full bg-(--bg) text-(--text-h)">
			<a
				href="#relationship-map-canvas"
				className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-80 focus:rounded-md focus:border focus:border-(--accent-border) focus:bg-slate-900 focus:px-3 focus:py-2 focus:text-xs focus:text-slate-100">
				Skip to relationship graph
			</a>
			<div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,rgba(var(--accent-rgb),0.22),transparent_55%),radial-gradient(ellipse_at_bottom,rgba(var(--accent-rgb),0.14),transparent_45%)]" />
			<div
				ref={containerRef}
				style={
					isMd
						? { gridTemplateColumns, position: "relative" }
						: { position: "relative" }
				}
				className="grid h-svh grid-cols-1 grid-rows-[56px_1fr] overflow-hidden md:grid-rows-1">
				<header className="z-10 flex items-center justify-between gap-2 border-b border-(--border) bg-(--panel-bg) px-3 md:hidden">
					<div>
						<div className="text-sm font-semibold text-slate-100">
							Relationship Map
						</div>
						<div className="text-[10px] text-slate-400">
							Map, filter, and update people faster
						</div>
					</div>
					<div className="flex items-center gap-1.5">
						<button
							type="button"
							title="Open filters and add person"
							aria-label="Open filters and add person"
							className="rounded-lg border border-(--border) bg-slate-900/40 px-2.5 py-2 text-[11px] text-slate-200 hover:bg-slate-900/60"
							onClick={() => setSidebarOpen(true)}>
							Left panel
						</button>
						<button
							type="button"
							title="Open selected person details"
							aria-label="Open selected person details"
							disabled={!selectedPersonId}
							className="rounded-lg border border-(--border) bg-slate-900/40 px-2.5 py-2 text-[11px] text-slate-200 hover:bg-slate-900/60 disabled:cursor-not-allowed disabled:opacity-40"
							onClick={() => setPersonPanelOpen(true)}>
							Details
						</button>
					</div>
				</header>

				{showLeftPanel && (
					<aside className="hidden border-r border-(--border) bg-(--panel-bg) overflow-y-auto md:block">
						<Sidebar />
					</aside>
				)}

				<main
					id="relationship-map-canvas"
					className="relative overflow-hidden md:col-span-1 md:row-span-1"
					aria-label="Relationship graph canvas area">
					<div className="absolute inset-0">
						<GraphView />
					</div>
				</main>

				{showRightPanel && (
					<aside className="hidden border-l border-(--border) bg-(--panel-bg) overflow-y-auto md:block">
						<PersonPanel />
					</aside>
				)}

				{/* draggable resizer (md+) */}
				<div
					className="hidden md:block"
					aria-hidden="true"
					title="Drag to resize details panel"
					style={{
						position: "absolute",
						top: 0,
						height: "100%",
						width: 12,
						right: rightPanelWidth - 6,
						cursor: "col-resize",
						zIndex: 60,
						display: "block",
					}}
					onPointerDown={(e) => {
						(e.currentTarget as Element).setPointerCapture(
							(e as any).pointerId,
						);
						setDragging(true);
					}}>
					<div className="h-full w-full bg-transparent hover:bg-slate-800/20" />
				</div>
			</div>

			{/* Floating toggles: left / right / graph controls (small, grow on hover) */}
			<div className="pointer-events-none fixed left-4 bottom-18 z-70">
				<div className="pointer-events-auto flex items-center gap-2 rounded-md bg-slate-900/60 p-1 border border-slate-800">
					<button
						type="button"
						aria-label="Toggle left panel"
						title="Toggle left panel"
						onClick={() => setShowLeftPanel(!showLeftPanel)}
						className="w-9 h-8 flex items-center justify-center text-slate-100 rounded-md transform transition-transform duration-150 hover:scale-110">
						{showLeftPanel ? "≡" : "≡"}
					</button>

					<button
						type="button"
						aria-label="Toggle right panel"
						title="Toggle right panel"
						onClick={() => setShowRightPanel(!showRightPanel)}
						className="w-9 h-8 flex items-center justify-center text-slate-100 rounded-md transform transition-transform duration-150 hover:scale-110">
						{showRightPanel ? "▷" : "▷"}
					</button>

					<button
						type="button"
						aria-label="Toggle canvas controls"
						title="Toggle canvas controls"
						onClick={() => setShowGraphControls(!showGraphControls)}
						className="w-9 h-8 flex items-center justify-center text-slate-100 rounded-md transform transition-transform duration-150 hover:scale-110">
						{showGraphControls ? "⚙" : "⚙"}
					</button>
				</div>
			</div>

			{sidebarOpen && (
				<div className="fixed inset-0 z-55 md:hidden">
					<div
						className="absolute inset-0 bg-black/60"
						onClick={() => setSidebarOpen(false)}
					/>
					<div
						role="dialog"
						aria-modal="true"
						aria-label="Filters and add panel"
						className="absolute left-0 top-0 h-full w-[92vw] max-w-sm border-r border-(--border) bg-(--panel-bg)">
						<div className="flex items-center justify-between gap-3 border-b border-(--border) px-3 py-3">
							<div className="text-sm font-semibold text-slate-100">
								Filters & Add
							</div>
							<button
								type="button"
								className="rounded-lg border border-(--border) bg-slate-900/40 px-3 py-2 text-xs text-slate-200 hover:bg-slate-900/60"
								onClick={() => setSidebarOpen(false)}>
								Close
							</button>
						</div>
						<div className="h-[calc(100%-56px)] overflow-auto">
							<Sidebar />
						</div>
					</div>
				</div>
			)}

			{personPanelOpen && (
				<div className="fixed inset-0 z-55 md:hidden">
					<div
						className="absolute inset-0 bg-black/60"
						onClick={() => setPersonPanelOpen(false)}
					/>
					<div
						role="dialog"
						aria-modal="true"
						aria-label="Person details panel"
						className="absolute right-0 top-0 h-full w-[92vw] max-w-sm border-l border-(--border) bg-(--panel-bg)">
						<div className="flex items-center justify-between gap-3 border-b border-(--border) px-3 py-3">
							<div className="text-sm font-semibold text-slate-100">
								Details
							</div>
							<button
								type="button"
								className="rounded-lg border border-(--border) bg-slate-900/40 px-3 py-2 text-xs text-slate-200 hover:bg-slate-900/60"
								onClick={() => setPersonPanelOpen(false)}>
								Close
							</button>
						</div>
						<div className="h-[calc(100%-56px)] overflow-auto">
							<PersonPanel />
						</div>
					</div>
				</div>
			)}

			{onboardingMounted && (
				<div className="fixed inset-0 z-60 flex items-center justify-center bg-black/65 p-4">
					<div
						role="dialog"
						aria-modal="true"
						aria-label="First-time setup"
						className={[
							"w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden rounded-2xl border border-(--border) bg-(--panel-bg) shadow-[0_0_80px_rgba(var(--accent-rgb),0.24)]",
							onboardingClosing ? "rm-fadeOut" : "rm-fadeIn",
						].join(" ")}>
						<div className="flex-none border-b border-(--border) p-4">
							<div className="text-sm font-semibold text-slate-100">
								Relationship Map
							</div>
							<div className="mt-1 text-xs text-slate-400">
								Two quick steps to set your starting year and first contact.
							</div>
						</div>

						<div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
							<div className="space-y-1">
								<label className="block text-xs font-medium text-slate-300">
									What year do you want to start adding people from?
								</label>
								<input
									type="number"
									min={1900}
									max={new Date().getFullYear() + 1}
									className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100"
									value={startYear}
									onChange={(e) => setStartYear(Number(e.target.value))}
								/>
								<div className="text-[11px] text-slate-500">
									This sets the default year filter and the default year for
									your first person.
								</div>
							</div>

							<div className="rounded-xl border border-(--border) bg-slate-900/40 p-3 space-y-3">
								<div className="text-xs font-semibold text-slate-100">
									Add your first person
								</div>

								<div className="space-y-1">
									<label className="block text-xs font-medium text-slate-300">
										Name
									</label>
									<input
										className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100"
										value={firstPerson.name}
										placeholder="e.g. Sam"
										onChange={(e) =>
											setFirstPerson((p) => ({ ...p, name: e.target.value }))
										}
									/>
								</div>

								<div className="space-y-1">
									<label className="block text-xs font-medium text-slate-300">
										First interaction
									</label>
									<textarea
										className="h-20 w-full resize-none rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100"
										value={firstPerson.firstInteraction}
										placeholder="What was it like? Where/when?"
										onChange={(e) =>
											setFirstPerson((p) => ({
												...p,
												firstInteraction: e.target.value,
											}))
										}
									/>
								</div>

								<div className="space-y-1">
									<label className="block text-xs font-medium text-slate-300">
										Last interaction (optional)
									</label>
									<textarea
										className="h-20 w-full resize-none rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100"
										value={firstPerson.lastInteraction}
										placeholder="Most recent moment / what changed?"
										onChange={(e) =>
											setFirstPerson((p) => ({
												...p,
												lastInteraction: e.target.value,
											}))
										}
									/>
								</div>

								<div className="space-y-1">
									<label className="block text-xs font-medium text-slate-300">
										Description / Notes
									</label>
									<textarea
										className="h-20 w-full resize-none rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100"
										value={firstPerson.description}
										placeholder="A short memory to keep."
										onChange={(e) =>
											setFirstPerson((p) => ({
												...p,
												description: e.target.value,
											}))
										}
									/>
								</div>

								<div className="space-y-1">
									<label className="block text-xs font-medium text-slate-300">
										Detailed lore (optional)
									</label>
									<textarea
										className="h-24 w-full resize-none rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100"
										value={firstPerson.lore}
										placeholder="More context, story, meaning."
										onChange={(e) =>
											setFirstPerson((p) => ({ ...p, lore: e.target.value }))
										}
									/>
								</div>

								<div className="text-[11px] text-slate-500">
									Social fields accept usernames/handles only (no full URLs
									needed).
								</div>
							</div>

							<div className="flex gap-3 justify-end border-t border-(--border) pt-4">
								<button
									type="button"
									className="rounded-lg border border-(--border) bg-slate-900 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
									onClick={() => {
										setActiveYear(startYear);
										closeOnboarding();
									}}
									disabled={!Number.isFinite(startYear)}>
									Continue without adding
								</button>

								<button
									type="button"
									className="rounded-lg border border-(--accent-border) bg-(--accent) px-4 py-2 text-sm font-semibold text-white shadow-[0_0_35px_rgba(var(--accent-rgb),0.32)] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
									disabled={
										!firstPerson.name.trim().length ||
										!Number.isFinite(startYear)
									}
									onClick={() => {
										void addPerson({
											name: firstPerson.name.trim(),
											year: startYear,
											firstInteraction: firstPerson.firstInteraction,
											lastInteraction: firstPerson.lastInteraction,
											description: firstPerson.description,
											lore: firstPerson.lore,
											inrete: [],
											email: "",
											phone: "",
											socials: {
												instagram: [],
												linkedin: [],
												twitter: [],
												github: [],
												mastodon: [],
												website: [],
											},
										}).then(() => {
											setActiveYear(startYear);
											closeOnboarding();
										});
									}}>
									Create first person
								</button>
							</div>

							<div className="pt-1 text-[11px] text-slate-500">
								Tip: click graph nodes to open details, add timeline context,
								then create relationships from the details panel.
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
