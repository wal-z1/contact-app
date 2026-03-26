import { useEffect, useState, useMemo } from "react";
import PersonPanel from "./components/PersonPanel";
import Sidebar from "./components/Sidebar";
import AppLayout from "./components/AppLayout";
import PanelToggles from "./components/PanelToggles";
import MobilePanel from "./components/MobilePanel";
import OnboardingDialog from "./components/OnboardingDialog";
import { useTheme } from "./hooks/useTheme";
import { useResponsivePanels } from "./hooks/useResponsivePanels";

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
		</div>
	);
}
