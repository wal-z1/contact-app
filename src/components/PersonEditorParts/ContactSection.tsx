import type { Person } from "../../models/types";
import SocialHandles from "../SocialHandles";
import {
	clearBtn,
	fieldBase,
	labelClass,
	sectionHeader,
	sectionHint,
	sectionTitle,
	SOCIAL_PLATFORMS,
} from "./constants";

type Props = {
	draft: Person;
	onPatch: (key: string, patch: Partial<Person>, delay?: number) => void;
	onCommitPatch: (patch: Partial<Person>) => void;
	onLocationChange: (value: string) => void;
	locationInput: string;
	onSaveLocation: () => void;
	onRemoveLocation: () => void;
	onAddSocial: (platform: string, raw: string) => void;
	onRemoveSocial: (platform: string, index: number) => void;
};

export default function ContactSection({
	draft,
	onPatch,
	onCommitPatch,
	onLocationChange,
	locationInput,
	onSaveLocation,
	onRemoveLocation,
	onAddSocial,
	onRemoveSocial,
}: Props) {
	const locationUnchanged =
		String(locationInput ?? "").trim() === String(draft.location ?? "").trim();

	return (
		<>
			<div className={sectionHeader}>
				<span className={sectionTitle}>Contact & Socials</span>
			</div>

			<div className={sectionHint}>
				Store direct channels and keep handles clean for fast lookup.
			</div>

			<div className="mb-4 flex flex-col gap-2.5">
				{/* Email + Phone row */}
				<div className="grid grid-cols-2 gap-2.5">
					{(
						[
							{
								key: "email",
								label: "Email",
								placeholder: "name@example.com",
								value: draft.email ?? "",
							},
							{
								key: "phone",
								label: "Phone",
								placeholder: "+1 555 000 0000",
								value: draft.phone ?? "",
							},
						] as const
					).map(({ key, label, placeholder, value }) => (
						<div key={key} className="flex flex-col gap-1">
							<label className={labelClass}>{label}</label>
							<div className="group relative flex items-center">
								<input
									className={`${fieldBase} pr-7`}
									value={value}
									onChange={(e) =>
										onPatch(key, { [key]: e.target.value } as Partial<Person>)
									}
									placeholder={placeholder}
								/>
								{value && (
									<button
										type="button"
										className={`${clearBtn} absolute right-1.5 opacity-0 transition-opacity duration-100 group-focus-within:opacity-100 group-hover:opacity-100`}
										aria-label={`Clear ${label}`}
										title={`Clear ${label}`}
										onClick={() =>
											onCommitPatch({ [key]: "" } as Partial<Person>)
										}>
										✕
									</button>
								)}
							</div>
						</div>
					))}
				</div>

				{/* Location row */}
				<div className="flex flex-col gap-1">
					<label className={labelClass}>Location</label>
					<div className="group relative flex items-center gap-1.5">
						<input
							className={`${fieldBase} flex-1 pr-7`}
							value={locationInput}
							onChange={(e) => onLocationChange(e.target.value)}
							placeholder="City, Country"
						/>

						{(Boolean(draft.location) || Boolean(locationInput)) && (
							<button
								type="button"
								className={`${clearBtn} absolute right-[calc(4rem+6px)] opacity-0 transition-opacity duration-100 group-focus-within:opacity-100 group-hover:opacity-100`}
								aria-label="Remove location"
								title="Remove location"
								onClick={onRemoveLocation}>
								✕
							</button>
						)}

						<button
							type="button"
							className="shrink-0 rounded px-3 py-[5px] text-xs font-medium
                bg-[color:var(--muted-bg)] text-[color:var(--text-h)]
                border border-transparent
                transition-all duration-150
                hover:border-[color:var(--border)] hover:brightness-110
                disabled:cursor-not-allowed disabled:opacity-40"
							onClick={onSaveLocation}
							disabled={locationUnchanged}>
							Save
						</button>
					</div>
				</div>
			</div>

			<SocialHandles
				socials={draft.socials as Partial<Record<string, string[]>>}
				platforms={SOCIAL_PLATFORMS as any}
				onAdd={onAddSocial}
				onRemove={onRemoveSocial}
			/>
		</>
	);
}
