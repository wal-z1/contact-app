import type { Person, Tag } from "../../models/types";
import { DEFAULT_NODE_COLOR } from "../../utils/nodeColors";
import {
	accentPill,
	fieldBase,
	mutedPill,
	NODE_COLOR_OPTIONS,
	primaryButton,
} from "./constants";
import { normalizeTag } from "./utils";

type Props = {
	draft: Person;
	tags: Tag[];
	yearsKnown: number | null;
	newInterestInput: string;
	setNewInterestInput: (value: string) => void;
	onAddInterest: () => void;
	onRemoveTagAtIndex: (index: number) => void;
	onAddSuggestedTag: (tagId: string) => void;
	onChangeNodeColor: (color: string) => void;
	onDeletePerson: () => void;
};

export default function HeaderSection({
	draft,
	tags,
	yearsKnown,
	newInterestInput,
	setNewInterestInput,
	onAddInterest,
	onRemoveTagAtIndex,
	onAddSuggestedTag,
	onChangeNodeColor,
	onDeletePerson,
}: Props) {
	const filteredSuggestions =
		newInterestInput.trim().length > 0
			? tags
					.filter((tag) => {
						const query = normalizeTag(newInterestInput);
						const normalized = tag.normalized ?? normalizeTag(tag.name);
						return (
							normalized.includes(query) ||
							tag.name.toLowerCase().includes(query)
						);
					})
					.slice(0, 8)
			: [];

	return (
		<div className="border-b border-[color:var(--border)] bg-white/[0.02] px-5 pb-5 pt-5">
			<div className="flex items-start gap-4">
				<div
					className="flex h-12 w-12 shrink-0 select-none items-center justify-center rounded-full bg-gradient-to-br from-[color:var(--person-color,#7c3aed)] to-[#c026d3] text-lg font-bold text-white shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_0_0_4px_rgba(192,132,252,0.14)]"
					style={{
						["--person-color" as any]: draft.nodeColor ?? DEFAULT_NODE_COLOR,
					}}>
					{draft.name ? draft.name.charAt(0).toUpperCase() : "?"}
				</div>

				<div className="min-w-0 flex-1">
					<div className="truncate text-[16px] font-bold leading-tight tracking-[-0.015em] text-[color:var(--text-h)]">
						{draft.name || "Untitled"}
					</div>

					{draft.description && (
						<div className="mt-1 truncate text-xs text-[color:var(--text)]/85">
							{draft.description}
						</div>
					)}

					<div className="mt-3 flex flex-wrap items-center gap-2">
						{draft.year && <span className={mutedPill}>{draft.year}</span>}
						{yearsKnown != null && (
							<span className={mutedPill}>{yearsKnown}y known</span>
						)}

						{(draft.inrete ?? []).map((tagId, index) => {
							const tag = tags.find((item) => item.id === tagId);
							const label = tag ? tag.name : tagId;

							return (
								<span key={`${tagId}-${index}`} className={accentPill}>
									{label}
									<button
										type="button"
										className="m-0 border-none bg-transparent p-0 text-[13px] leading-none text-current opacity-55 transition-opacity duration-100 hover:opacity-100"
										onClick={() => onRemoveTagAtIndex(index)}
										aria-label="Remove tag">
										×
									</button>
								</span>
							);
						})}
					</div>

					<div className="mt-3 flex items-center gap-2">
						<input
							className={`${fieldBase} py-[9px] text-xs`}
							placeholder="Add tag…"
							value={newInterestInput}
							onChange={(e) => setNewInterestInput(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter") {
									e.preventDefault();
									onAddInterest();
								}
							}}
						/>
						<button
							type="button"
							className={`${primaryButton} shrink-0 px-3 py-[9px] text-[11px] font-bold`}
							aria-label="Add tag"
							title="Add tag"
							onClick={onAddInterest}>
							+
						</button>
					</div>

					<div className="mt-3 flex flex-wrap gap-2">
						{NODE_COLOR_OPTIONS.map((option) => {
							const active =
								(draft.nodeColor ?? DEFAULT_NODE_COLOR).toLowerCase() ===
								option.color.toLowerCase();

							return (
								<button
									key={option.id}
									type="button"
									title={option.label}
									aria-label={`Node color ${option.label}`}
									className={`h-5 w-5 rounded-full border border-white/25 p-0 transition-all duration-150 hover:-translate-y-[1px] hover:scale-105 ${
										active
											? "shadow-[0_0_0_1px_rgba(255,255,255,0.35),0_0_0_4px_rgba(255,255,255,0.12)]"
											: ""
									}`}
									style={{ backgroundColor: option.color }}
									onClick={() => onChangeNodeColor(option.color)}
								/>
							);
						})}
					</div>

					{filteredSuggestions.length > 0 && (
						<div className="mt-2 flex flex-wrap gap-2">
							{filteredSuggestions.map((tag) => (
								<button
									key={tag.id}
									type="button"
									className="rounded-lg border border-[color:var(--border)] bg-white/[0.04] px-3.5 py-2 text-xs font-semibold text-[color:var(--text)] transition-all duration-150 hover:bg-white/[0.07] hover:text-[color:var(--text-h)] disabled:cursor-not-allowed disabled:opacity-40"
									title={`Add tag ${tag.name}`}
									onClick={() => onAddSuggestedTag(tag.id)}>
									{tag.name}
								</button>
							))}
						</div>
					)}
				</div>

				<div className="flex shrink-0 flex-col items-end gap-2">
					<button
						type="button"
						className="rounded-md border border-transparent bg-transparent px-2 py-1 text-[11px] font-semibold text-gray-500 transition-all duration-150 hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-500"
						onClick={onDeletePerson}>
						Delete
					</button>
				</div>
			</div>
		</div>
	);
}
