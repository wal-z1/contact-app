import type { Person } from "../../models/types";
import {
	fieldBase,
	labelClass,
	sectionHeader,
	sectionHint,
	sectionTitle,
	textareaBase,
} from "./constants";

type Props = {
	draft: Person;
	onPatch: (key: string, patch: Partial<Person>, delay?: number) => void;
};

export default function DetailsSection({ draft, onPatch }: Props) {
	return (
		<>
			<div className={sectionHeader}>
				<span className={sectionTitle}>Details</span>
			</div>

			<div className={sectionHint}>
				Keep this concise so cards and graph labels stay readable.
			</div>

			<div className="flex flex-col gap-3">
				<div className="grid grid-cols-2 gap-3">
					<div className="flex flex-col gap-1.5">
						<label className={labelClass}>Name</label>
						<input
							className={fieldBase}
							value={draft.name ?? ""}
							onChange={(e) => onPatch("name", { name: e.target.value })}
						/>
					</div>

					<div className="flex flex-col gap-1.5">
						<label className={labelClass}>Year met</label>
						<input
							type="number"
							className={fieldBase}
							value={draft.year ?? ""}
							onChange={(e) => {
								const raw = e.target.value;

								if (!raw.trim()) {
									onPatch("year", { year: undefined as any });
									return;
								}

								const value = Number(raw);
								if (Number.isFinite(value)) {
									onPatch("year", { year: value });
								}
							}}
						/>
					</div>
				</div>

				<div className="flex flex-col gap-1.5">
					<label className={labelClass}>Description</label>
					<textarea
						className={textareaBase}
						rows={2}
						value={draft.description ?? ""}
						onChange={(e) =>
							onPatch("description", { description: e.target.value })
						}
						placeholder="Short note…"
					/>
				</div>

				<div className="flex flex-col gap-1.5">
					<label className={labelClass}>Lore</label>
					<textarea
						className={textareaBase}
						rows={3}
						value={draft.lore ?? ""}
						onChange={(e) => onPatch("lore", { lore: e.target.value })}
						placeholder="Longer backstory…"
					/>
				</div>

				<div className="grid grid-cols-2 gap-3">
					<div className="flex flex-col gap-1.5">
						<label className={labelClass}>First interaction</label>
						<textarea
							className={textareaBase}
							rows={2}
							value={draft.firstInteraction ?? ""}
							onChange={(e) =>
								onPatch("firstInteraction", {
									firstInteraction: e.target.value,
								})
							}
						/>
					</div>

					<div className="flex flex-col gap-1.5">
						<label className={labelClass}>Last interaction</label>
						<textarea
							className={textareaBase}
							rows={2}
							value={draft.lastInteraction ?? ""}
							onChange={(e) =>
								onPatch("lastInteraction", {
									lastInteraction: e.target.value,
								})
							}
						/>
					</div>
				</div>
			</div>
		</>
	);
}
