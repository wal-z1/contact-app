import { useAppStore } from "../store/useAppStore";

const Icons = {
	LeftPanel: () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" /></svg>,
	RightPanel: () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" /></svg>,
	Controls: () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-5"><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-1.007 1.11-1.226.554-.225 1.151-.242 1.709-.045l5.8 3.352a2.122 2.122 0 0 1 1.085 1.838V18.06a2.12 2.12 0 0 1-1.085 1.838l-5.8 3.352c-.558.322-1.21.322-1.768 0l-5.8-3.352a2.12 2.12 0 0 1-1.085-1.838V7.062a2.122 2.122 0 0 1 1.085-1.838l5.8-3.352Z" /></svg>,
};

const ToggleButton = ({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) => (
	<div className="relative group">
		<button type="button" aria-label={title} onClick={onClick} className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-slate-700/60 hover:text-white">
			{children}
		</button>
		<div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-max rounded-md bg-slate-900 px-2 py-1 text-xs text-slate-200 opacity-0 transition-opacity group-hover:opacity-100 pointer-events-none">
			{title}
		</div>
	</div>
);

export default function PanelToggles() {
	const { showLeftPanel, setShowLeftPanel, showRightPanel, setShowRightPanel, showGraphControls, setShowGraphControls } = useAppStore();

	return (
		<div className="pointer-events-auto fixed bottom-4 left-1/2 z-40 -translate-x-1/2">
			<div className="flex items-center gap-1 rounded-xl border border-slate-700/80 bg-slate-900/60 p-1 shadow-lg backdrop-blur-md">
				<ToggleButton title="Toggle Filters Panel" onClick={() => setShowLeftPanel(!showLeftPanel)}>
					<Icons.LeftPanel />
				</ToggleButton>
				<ToggleButton title="Toggle Graph Controls" onClick={() => setShowGraphControls(!showGraphControls)}>
					<Icons.Controls />
				</ToggleButton>
				<ToggleButton title="Toggle Details Panel" onClick={() => setShowRightPanel(!showRightPanel)}>
					<Icons.RightPanel />
				</ToggleButton>
			</div>
		</div>
	);
}