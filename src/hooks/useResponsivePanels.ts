import { useState, useEffect, useRef } from "react";
import { useAppStore } from "../store/useAppStore";

export function useResponsivePanels() {
	const showLeftPanel = useAppStore((s) => s.showLeftPanel);
	const setShowLeftPanel = useAppStore((s) => s.setShowLeftPanel);
	const showRightPanel = useAppStore((s) => s.showRightPanel);
	const setShowRightPanel = useAppStore((s) => s.setShowRightPanel);
	const rightPanelWidth = useAppStore((s) => s.rightPanelWidth);
	const setRightPanelWidth = useAppStore((s) => s.setRightPanelWidth);
	const selectedPersonId = useAppStore((s) => s.selectedPersonId);

	const [isMd, setIsMd] = useState(() =>
		typeof window !== "undefined" ? window.innerWidth >= 768 : false,
	);
	const [isResizing, setIsResizing] = useState(false);
	const containerRef = useRef<HTMLDivElement | null>(null);

	// Basic resize listener for breakpoint
	useEffect(() => {
		const onResize = () => setIsMd(window.innerWidth >= 768);
		window.addEventListener("resize", onResize);
		return () => window.removeEventListener("resize", onResize);
	}, []);

	// Panel resize logic
	useEffect(() => {
		if (!isResizing) return;
		const onPointerMove = (e: PointerEvent) => {
			if (!containerRef.current) return;
			const rect = containerRef.current.getBoundingClientRect();
			const newWidth = Math.max(
				280,
				Math.min(900, Math.round(rect.right - e.clientX)),
			);
			setRightPanelWidth(newWidth);
		};
		const onPointerUp = () => setIsResizing(false);
		window.addEventListener("pointermove", onPointerMove);
		window.addEventListener("pointerup", onPointerUp, { once: true });
		return () => {
			window.removeEventListener("pointermove", onPointerMove);
			window.removeEventListener("pointerup", onPointerUp as any);
		};
	}, [isResizing, setRightPanelWidth]);

	// Auto-open right panel on mobile when a person is selected
	useEffect(() => {
		if (selectedPersonId && !isMd) {
			setShowRightPanel(true);
		}
	}, [selectedPersonId, isMd, setShowRightPanel]);

	const gridTemplateColumns = isMd
		? [
				showLeftPanel ? "280px" : "",
				"1fr",
				showRightPanel ? `${rightPanelWidth}px` : "",
			]
				.filter(Boolean)
				.join(" ")
		: undefined;

	return {
		containerRef,
		isMd,
		showLeftPanel,
		setShowLeftPanel,
		showRightPanel,
		setShowRightPanel,
		rightPanelWidth,
		isResizing,
		setIsResizing,
		gridTemplateColumns,
	};
}
