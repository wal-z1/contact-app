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

export default function App() {
	// Custom hooks to encapsulate logic
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

	// Check if onboarding has been completed on initial mount
	useEffect(() => {
		try {
			const seen = window.localStorage.getItem(onboardingSeenKey);
			if (!seen) {
				setOnboardingMounted(true);
			}
		} catch {
			// If localStorage fails, show onboarding
			setOnboardingMounted(true);
		}
	}, [onboardingSeenKey]);

	const handleCloseOnboarding = () => {
		try {
			window.localStorage.setItem(onboardingSeenKey, "1");
		} catch {
			// Ignore if localStorage is unavailable
		}
		setOnboardingMounted(false);
	};

	// Global escape key handler
	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return;
			if (reviewMode) {
				stopManualReview();
				return;
			}
			if (onboardingMounted) {
				// Don't close onboarding with Escape, make it a conscious choice
				return;
			}
			// Close mobile panels
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
		// Set pointer capture to ensure events are received even if the cursor leaves the element
		(e.currentTarget as Element).setPointerCapture(e.pointerId);
		setIsResizing(true);
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

			{/* Mobile-only slide-over panels */}
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
						className="mx-auto flex h-full max-h-[92vh] w-full max-w-[1024px] flex-col overflow-hidden rounded-xl border border-(--border) bg-(--panel-bg) shadow-[0_20px_70px_rgba(0,0,0,0.6)]">
						<div className="border-b border-(--border) bg-white/5 px-4 py-3 md:px-5">
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

						<div className="min-h-0 flex-1 overflow-y-auto">
							<PersonPanel />
						</div>

						<div className="flex items-center justify-between border-t border-(--border) bg-white/5 px-4 py-3 md:px-5">
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
