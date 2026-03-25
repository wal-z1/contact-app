import { useState } from "react";

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
	// Merge passed platforms with icon data
	const resolvedPlatforms = (platforms ?? DEFAULT_PLATFORMS).map(
		([k, label]) => {
			const match = DEFAULT_PLATFORMS.find(([dk]) => dk === k);
			return [k, label, match ? match[2] : "•"] as [string, string, string];
		},
	);

	const [pending, setPending] = useState<Record<string, string>>(
		() =>
			Object.fromEntries(resolvedPlatforms.map(([k]) => [k, ""])) as Record<
				string,
				string
			>,
	);

	const commit = (k: string) => {
		const raw = String(pending[k] ?? "").trim();
		if (!raw) return;
		onAdd(k, raw);
		setPending((p) => ({ ...p, [k]: "" }));
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

			<div className="sh-grid">
				{resolvedPlatforms.map(([k, label, icon]) => {
					const list = (socials as any)?.[k] ?? [];
					const inputId = `social-handle-${k}`;
					return (
						<div key={k} className="sh-platform">
							<label className="sh-plat-label" htmlFor={inputId}>
								<span className="sh-icon">{icon}</span>
								{label}
							</label>
							<div className="sh-handles">
								{list.length === 0 ? (
									<span className="sh-empty">—</span>
								) : (
									list.map((v: string, idx: number) => (
										<div key={k + idx} className="sh-handle-chip">
											<span className="sh-handle-text">@{v}</span>
											<button
												type="button"
												className="sh-remove"
												onClick={() => onRemove(k, idx)}
												aria-label={`Remove ${label} handle`}>
												×
											</button>
										</div>
									))
								)}
							</div>
							<div className="sh-add-row">
								<input
									id={inputId}
									className="sh-add-input"
									placeholder="@handle or URL"
									aria-label={`Add ${label} handle`}
									value={pending[k] ?? ""}
									onChange={(e) =>
										setPending((p) => ({ ...p, [k]: e.target.value }))
									}
									onKeyDown={(e) => {
										if (e.key === "Enter") {
											e.preventDefault();
											commit(k);
										}
									}}
								/>
								<button
									type="button"
									className="sh-add-btn"
									aria-label={`Add ${label} handle`}
									onClick={() => commit(k)}>
									Add
								</button>
							</div>
						</div>
					);
				})}
			</div>
		</>
	);
}
