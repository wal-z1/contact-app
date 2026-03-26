import { useState, useRef, useEffect } from "react";
import { useAppStore } from "../store/useAppStore";
import type { Person } from "../models/types";

type OnboardingDialogProps = {
	onClose: () => void;
};

export default function OnboardingDialog({ onClose }: OnboardingDialogProps) {
	const addPerson = useAppStore((s) => s.addPerson);
	const setActiveYear = useAppStore((s) => s.setActiveYear);

	const [isClosing, setIsClosing] = useState(false);
	const closeTimer = useRef<number | null>(null);

	const [startYear, setStartYear] = useState(() => new Date().getFullYear());
	const [firstPerson, setFirstPerson] = useState({
		name: "",
		firstInteraction: "",
		lastInteraction: "",
		description: "",
		lore: "",
	});

	// Cleanup timer on unmount
	useEffect(() => {
		return () => {
			if (closeTimer.current) window.clearTimeout(closeTimer.current);
		};
	}, []);

	const handleClose = () => {
		setIsClosing(true);
		closeTimer.current = window.setTimeout(() => {
			onClose();
		}, 200); // Corresponds to animation duration
	};

	const handleSkip = () => {
		setActiveYear(startYear);
		handleClose();
	};

	const handleSubmit = async () => {
		if (!firstPerson.name.trim().length || !Number.isFinite(startYear)) return;

		const personData: Person = {
			id: crypto.randomUUID(),
			name: firstPerson.name.trim(),
			year: startYear,
			firstInteraction: firstPerson.firstInteraction.trim(),
			lastInteraction: firstPerson.lastInteraction.trim(),
			description: firstPerson.description.trim(),
			lore: firstPerson.lore.trim(),
			// Default empty values
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
			events: [],
		};

		await addPerson(personData);
		setActiveYear(startYear);
		handleClose();
	};

	const isSubmitDisabled =
		!firstPerson.name.trim().length || !Number.isFinite(startYear);

	return (
		<div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
			<div
				role="dialog"
				aria-modal="true"
				aria-label="First-time setup"
				className={[
					"w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden rounded-2xl border border-(--border) bg-(--panel-bg) shadow-[0_0_80px_rgba(var(--accent-rgb),0.24)]",
					isClosing ? "animate-fadeOut" : "animate-fadeIn", // Use your animation classes
				].join(" ")}>
				<div className="flex-none border-b border-(--border) p-4">
					<h2 className="text-lg font-bold text-slate-100">
						Relationship Map Setup
					</h2>
					<p className="mt-1 text-xs text-slate-400">
						Two quick steps to set your starting year and first contact.
					</p>
				</div>

				<div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
					<div className="space-y-1">
						<label
							htmlFor="start-year"
							className="block text-sm font-medium text-slate-300">
							What year are you starting from?
						</label>
						<input
							id="start-year"
							type="number"
							min={1900}
							max={new Date().getFullYear() + 1}
							className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-(--accent) focus:ring-1 focus:ring-(--accent) outline-none"
							value={startYear}
							onChange={(e) => setStartYear(Number(e.target.value))}
						/>
						<p className="text-[11px] text-slate-500">
							This sets the default year filter for the graph.
						</p>
					</div>

					<div className="rounded-xl border border-(--border) bg-slate-900/40 p-3 space-y-3">
						<h3 className="text-sm font-semibold text-slate-100">
							Add your first person
						</h3>
						<div className="space-y-1">
							<label
								htmlFor="person-name"
								className="block text-xs font-medium text-slate-300">
								Name
							</label>
							<input
								id="person-name"
								className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100"
								value={firstPerson.name}
								placeholder="e.g. Sam"
								onChange={(e) =>
									setFirstPerson((p) => ({ ...p, name: e.target.value }))
								}
							/>
						</div>
						<div className="space-y-1">
							<label
								htmlFor="first-interaction"
								className="block text-xs font-medium text-slate-300">
								First interaction
							</label>
							<textarea
								id="first-interaction"
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
					</div>
					<p className="pt-1 text-[11px] text-slate-500">
						Tip: You can add more details like notes, lore, and social links
						later from the details panel.
					</p>
				</div>

				<div className="flex-none flex gap-3 justify-end border-t border-(--border) p-4">
					<button
						type="button"
						className="rounded-lg border border-(--border) bg-slate-900 px-4 py-2 text-sm text-slate-200 transition-colors hover:bg-slate-800"
						onClick={handleSkip}
						disabled={!Number.isFinite(startYear)}>
						Continue without adding
					</button>
					<button
						type="button"
						className="rounded-lg border border-transparent bg-(--accent) px-4 py-2 text-sm font-semibold text-white shadow-[0_0_35px_rgba(var(--accent-rgb),0.32)] transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
						disabled={isSubmitDisabled}
						onClick={handleSubmit}>
						Create First Person
					</button>
				</div>
			</div>
		</div>
	);
}
