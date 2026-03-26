import PersonPanel from "./PersonPanel";
import Sidebar from "./Sidebar";
import GraphView from "./GraphView";

type AppLayoutProps = {
	// --- THIS IS THE FIX ---
	// Changed from React.RefObject<HTMLDivElement> to React.Ref<HTMLDivElement>
	containerRef: React.Ref<HTMLDivElement>;
	// ----------------------
	isMd: boolean;
	gridTemplateColumns?: string;
	showLeftPanel: boolean;
	showRightPanel: boolean;
	rightPanelWidth: number;
	onResizeStart: (e: React.PointerEvent) => void;
};

export default function AppLayout({
	containerRef,
	isMd,
	gridTemplateColumns,
	showLeftPanel,
	showRightPanel,
	rightPanelWidth,
	onResizeStart,
}: AppLayoutProps) {
	return (
		<div
			ref={containerRef}
			style={isMd ? { gridTemplateColumns } : undefined}
			className="relative grid h-svh grid-cols-1 grid-rows-[56px_1fr] overflow-hidden md:grid-rows-1">
			{/* Mobile Header */}
			<header className="z-20 flex items-center justify-between gap-2 border-b border-(--border) bg-(--panel-bg) px-3 md:hidden">
				<div className="flex flex-col">
					<span className="text-sm font-bold text-slate-100">
						Relationship Map
					</span>
					<span className="text-[10px] text-slate-400">
						Visualize your connections
					</span>
				</div>
			</header>

			{/* Left Sidebar (Desktop) */}
			{isMd && showLeftPanel && (
				<aside className="border-r border-(--border) bg-(--panel-bg) overflow-y-auto">
					<Sidebar />
				</aside>
			)}

			{/* Main Canvas */}
			<main
				id="relationship-map-canvas"
				className="relative overflow-hidden"
				aria-label="Relationship graph canvas">
				<GraphView />
			</main>

			{/* Right Details Panel (Desktop) */}
			{isMd && showRightPanel && (
				<>
					<aside className="border-l border-(--border) bg-(--panel-bg) overflow-y-auto">
						<PersonPanel />
					</aside>
					{/* Draggable Resizer */}
					<div
						aria-hidden="true"
						title="Drag to resize panel"
						style={{ left: `calc(100% - ${rightPanelWidth}px - 6px)` }}
						className="group absolute top-0 h-full w-3 cursor-col-resize z-30"
						onPointerDown={onResizeStart}>
						<div className="h-full w-px bg-slate-800 transition-colors duration-200 group-hover:w-0.5 group-hover:bg-(--accent)" />
					</div>
				</>
			)}
		</div>
	);
}
