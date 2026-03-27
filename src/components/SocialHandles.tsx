import { useMemo, useState } from "react";

const DEFAULT_PLATFORMS = [
	["instagram", "Instagram", "📸"] as const,
	["linkedin", "LinkedIn", "💼"] as const,
	["twitter", "Twitter/X", "𝕏"] as const,
	["github", "GitHub", "⌥"] as const,
	["mastodon", "Mastodon", "🐘"] as const,
	["website", "Website", "🌐"] as const,
];

export default function SocialHandles({
	socials,
	platforms,
	onAdd,
	onRemove,
}: {
	socials: Partial<Record<string, string[]>>;
	platforms?: readonly (readonly [string, string])[];
	onAdd: (platform: string, value: string) => void;
	onRemove: (platform: string, index: number) => void;
}) {
	const suggestedPlatforms = (platforms ?? DEFAULT_PLATFORMS).map(
		([k, label]) => {
			const match = DEFAULT_PLATFORMS.find(([dk]) => dk === k);
			return [k, label, match ? match[2] : "•"] as const;
		},
	);

	const [platformInput, setPlatformInput] = useState("");
	const [valueInput, setValueInput] = useState("");

	const normalizePlatform = (value: string) =>
		String(value ?? "")
			.trim()
			.toLowerCase()
			.replace(/\s+/g, "_");

	const entries = useMemo(() => {
		const list: Array<{ platform: string; value: string; index: number }> = [];
		for (const [platform, values] of Object.entries(socials ?? {})) {
			if (!Array.isArray(values)) continue;
			values.forEach((value, index) => {
				const trimmed = String(value ?? "").trim();
				if (!trimmed) return;
				list.push({
					platform,
					value: trimmed,
					index,
				});
			});
		}
		return list.sort((a, b) => {
			const pa = a.platform.localeCompare(b.platform);
			if (pa !== 0) return pa;
			return a.value.localeCompare(b.value);
		});
	}, [socials]);

	const commit = () => {
		const platform = normalizePlatform(platformInput);
		const value = String(valueInput ?? "").trim();
		if (!platform || !value) return;
		onAdd(platform, value);
		setValueInput("");
	};

	return (
		<>
			<style>{`
				.sh-grid {
					display: grid;
					grid-template-columns: 1fr;
					gap: 10px;
				}
				@media (min-width: 520px) {
					.sh-grid { grid-template-columns: 1fr 1fr; }
				}
				@media (min-width: 900px) {
					.sh-grid { grid-template-columns: 1fr 1fr 1fr; }
				}
				.sh-platform { display: flex; flex-direction: column; gap: 6px; }
				.sh-plat-label {
					display: flex;
					align-items: center;
					gap: 5px;
					font-size: 10px;
					font-weight: 700;
					letter-spacing: 0.07em;
					text-transform: uppercase;
					color: #6b7280;
				}
				.sh-icon { font-size: 12px; line-height: 1; }
				.sh-handles { display: flex; flex-direction: column; gap: 4px; min-height: 24px; }
				.sh-handle-chip {
					display: flex;
					align-items: center;
					gap: 6px;
					background: rgba(255,255,255,0.04);
					border: 1px solid #2e303a;
					border-radius: 6px;
					padding: 4px 8px;
					font-size: 12px;
					color: #e2e8f0;
				}
				.sh-handle-text { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
				.sh-remove {
					background: none;
					border: none;
					color: #6b7280;
					cursor: pointer;
					font-size: 14px;
					line-height: 1;
					padding: 0 2px;
					flex-shrink: 0;
					transition: color 0.1s;
				}
				.sh-remove:hover { color: #ef4444; }
				.sh-empty { font-size: 11px; color: #4b5563; font-style: italic; }
				.sh-add-row { display: flex; gap: 5px; }
				.sh-add-input {
					flex: 1;
					min-width: 0;
					background: rgba(255,255,255,0.03);
					border: 1px solid #2e303a;
					border-radius: 6px;
					padding: 5px 8px;
					font-size: 12px;
					color: #f1f5f9;
					font-family: inherit;
					transition: border-color 0.15s;
				}
				.sh-add-input::placeholder { color: rgba(255,255,255,0.18); }
				.sh-add-input:focus { outline: none; border-color: var(--accent); }
				.sh-add-btn {
					background: rgba(var(--accent-rgb), 0.12);
					border: 1px solid var(--accent-border);
					color: var(--accent);
					border-radius: 6px;
					padding: 5px 9px;
					font-size: 11px;
					font-weight: 700;
					cursor: pointer;
					flex-shrink: 0;
					transition: background 0.15s;
					white-space: nowrap;
				}
				.sh-add-btn:hover { background: rgba(var(--accent-rgb), 0.22); }
				.sh-add-btn:focus-visible,
				.sh-remove:focus-visible,
				.sh-add-input:focus-visible {
					outline: 2px solid rgba(var(--accent-rgb), 0.95);
					outline-offset: 2px;
				}
			`}</style>

			<div className="sh-platform">
				<div className="sh-plat-label">Add social link</div>
				<div className="sh-add-row">
					<input
						id="social-platform-input"
						className="sh-add-input"
						placeholder="Platform (e.g. instagram, bluesky, youtube)"
						aria-label="Social platform"
						value={platformInput}
						onChange={(e) => setPlatformInput(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								e.preventDefault();
								commit();
							}
						}}
					/>
					<input
						id="social-value-input"
						className="sh-add-input"
						placeholder="Link or handle"
						aria-label="Social link or handle"
						value={valueInput}
						onChange={(e) => setValueInput(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								e.preventDefault();
								commit();
							}
						}}
					/>
					<button
						type="button"
						className="sh-add-btn"
						aria-label="Add social link"
						onClick={commit}>
						Add
					</button>
				</div>

				{suggestedPlatforms.length > 0 && (
					<div className="mt-2 flex flex-wrap gap-1.5">
						{suggestedPlatforms.map(([key, label, icon]) => (
							<button
								key={key}
								type="button"
								onClick={() => setPlatformInput(key)}
								className="rounded border border-[#2e303a] bg-white/5 px-2 py-1 text-[11px] text-[#cbd5e1] hover:bg-white/10">
								{icon} {label}
							</button>
						))}
					</div>
				)}

				<div className="sh-handles mt-3">
					{entries.length === 0 ? (
						<span className="sh-empty">No social links yet.</span>
					) : (
						entries.map((entry) => (
							<div
								key={`${entry.platform}-${entry.index}-${entry.value}`}
								className="sh-handle-chip">
								<span className="sh-handle-text">
									<strong>{entry.platform}</strong>: {entry.value}
								</span>
								<button
									type="button"
									className="sh-remove"
									onClick={() => onRemove(entry.platform, entry.index)}
									aria-label={`Remove ${entry.platform} link`}>
									×
								</button>
							</div>
						))
					)}
				</div>
			</div>
		</>
	);
}
