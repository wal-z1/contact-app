import {
	useState,
	useMemo,
	useEffect,
	type FC,
	type KeyboardEvent,
	type ComponentProps,
} from "react";
import { createPortal } from "react-dom";
import { useAppStore } from "../store/useAppStore";
import type { Socials } from "../models/types";
import type { PersonFormData } from "../store/useAppStore";
import SocialHandles from "./SocialHandles";

type FormState = Omit<PersonFormData, "nodeColor" | "events">;

type FormFieldProps = ComponentProps<"input"> & { label: string; id: string };
const FormField: FC<FormFieldProps> = ({ label, id, ...props }) => (
	<div className="rm-field">
		<label className="rm-label" htmlFor={id}>
			{label}
		</label>
		<input id={id} className="rm-input" {...props} />
	</div>
);

type TextareaFieldProps = ComponentProps<"textarea"> & {
	label: string;
	id: string;
};
const TextareaField: FC<TextareaFieldProps> = ({ label, id, ...props }) => (
	<div className="rm-field">
		<label className="rm-label" htmlFor={id}>
			{label}
		</label>
		<textarea id={id} className="rm-input" {...props} />
	</div>
);

type AddPersonModalProps = {
	isOpen: boolean;
	onClose: () => void;
};

export function AddPersonModal({ isOpen, onClose }: AddPersonModalProps) {
	const activeYear = useAppStore((s) => s.activeYear);
	const createPerson = useAppStore((s) => s.createPerson);
	const [loading, setLoading] = useState(false);
	const [step, setStep] = useState<"basic" | "contact">("basic");

	const initialYear = useMemo(
		() =>
			typeof activeYear === "number" ? activeYear : new Date().getFullYear(),
		[activeYear],
	);

	const emptyForm = (): FormState => ({
		name: "",
		year: initialYear,
		description: "",
		firstInteraction: "",
		lastInteraction: "",
		lore: "",
		inrete: "",
		email: "",
		phone: "",
		location: "",
		socials: {
			instagram: [],
			linkedin: [],
			twitter: [],
			github: [],
			mastodon: [],
			website: [],
		},
	});

	const [form, setForm] = useState<FormState>(emptyForm);

	// Reset form when modal opens
	useEffect(() => {
		if (isOpen) {
			setForm(emptyForm());
			setStep("basic");
			setLoading(false);
		}
	}, [isOpen, initialYear]);

	// Keyboard shortcuts
	useEffect(() => {
		if (!isOpen) return;
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") onClose();
		};
		window.addEventListener("keydown", onKeyDown as any);
		return () => window.removeEventListener("keydown", onKeyDown as any);
	}, [isOpen, onClose]);

	const handleCreate = async () => {
		if (!form.name.trim()) return;
		setLoading(true);
		try {
			await createPerson(form as PersonFormData);
			onClose();
		} catch (error) {
			console.error("Failed to create person:", error);
			// Optionally, show an error message to the user
		} finally {
			setLoading(false);
		}
	};

	const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter" && step === "basic") {
			e.preventDefault();
			if (form.name.trim()) setStep("contact");
		}
	};

	const normalizePlatform = (value: string) =>
		String(value ?? "")
			.trim()
			.toLowerCase()
			.replace(/\s+/g, "_");

	const normalizeSocialValue = (platform: string, raw: string) => {
		const value = String(raw ?? "").trim();
		if (!value) return "";

		if (platform === "website") {
			if (/^https?:\/\//i.test(value)) return value;
			if (/^[\w.-]+\.[a-z]{2,}(?:\/.*)?$/i.test(value)) {
				return `https://${value}`;
			}
			return value;
		}

		const withoutAt = value.replace(/^@/, "");
		const withoutProtocol = withoutAt.replace(/^https?:\/\//i, "");
		const withoutDomain = withoutProtocol.replace(
			/^(?:[a-z0-9-]+\.)+[a-z]{2,}\//i,
			"",
		);
		return withoutDomain.split(/[?#]/)[0].trim();
	};

	const handleSocialAdd = (platform: string, raw: string) => {
		const key = normalizePlatform(platform);
		const value = normalizeSocialValue(key, raw);
		if (!key || !value) return;

		setForm((s) => {
			const existing = Array.isArray((s.socials as any)[key])
				? ((s.socials as any)[key] as string[])
				: [];
			if (
				existing.some(
					(entry) =>
						String(entry ?? "")
							.trim()
							.toLowerCase() === value.toLowerCase(),
				)
			) {
				return s;
			}

			return {
				...s,
				socials: {
					...(s.socials as any),
					[key]: [...existing, value],
				} as Socials,
			};
		});
	};

	const handleSocialRemove = (platform: string, index: number) => {
		const key = normalizePlatform(platform);
		if (!key) return;

		setForm((s) => {
			const existing = Array.isArray((s.socials as any)[key])
				? [...((s.socials as any)[key] as string[])]
				: [];
			if (index < 0 || index >= existing.length) return s;
			existing.splice(index, 1);

			return {
				...s,
				socials: {
					...(s.socials as any),
					[key]: existing,
				} as Socials,
			};
		});
	};

	if (!isOpen) return null;
	if (typeof document === "undefined") return null;

	return createPortal(
		<>
			<style>{`
				.rm-overlay {
					position: fixed;
					inset: 0;
					z-index: 120;
					display: flex;
					align-items: center;
					justify-content: center;
					padding: 16px;
					background: rgba(0,0,0,0.72);
					backdrop-filter: blur(4px);
					-webkit-backdrop-filter: blur(4px);
				}
				.rm-modal {
					background: #0f1221;
					border: 1px solid var(--border);
					border-radius: 16px;
					width: 100%;
					max-width: 720px;
					max-height: 90vh;
					display: flex;
					flex-direction: column;
					overflow: hidden;
					box-shadow: 0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04);
				}
				.rm-modal-header {
					padding: 20px 24px 16px;
					border-bottom: 1px solid var(--border);
					flex-shrink: 0;
				}
				.rm-modal-title {
					font-size: 15px;
					font-weight: 700;
					color: var(--text-h);
				}
				.rm-modal-sub {
					font-size: 12px;
					color: var(--text);
					margin-top: 2px;
				}
				.rm-steps { display: flex; gap: 6px; margin-top: 14px; }
				.rm-step { height: 3px; border-radius: 2px; flex: 1; background: var(--border); }
				.rm-step.active { background: var(--accent); }
				.rm-modal-body {
					flex: 1;
					overflow-y: auto;
					padding: 20px 24px;
					display: flex;
					flex-direction: column;
					gap: 14px;
				}
				.rm-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
				.rm-field { display: flex; flex-direction: column; gap: 5px; }
				.rm-label {
					font-size: 11px;
					font-weight: 600;
					color: var(--text);
					letter-spacing: 0.06em;
					text-transform: uppercase;
				}
				.rm-input {
					background: rgba(255,255,255,0.035);
					border: 1px solid var(--border);
					border-radius: 8px;
					padding: 9px 12px;
					font-size: 13px;
					color: var(--text-h);
					width: 100%;
					box-sizing: border-box;
					resize: vertical;
				}
				.rm-input:focus { outline: none; border-color: var(--accent); }
				.rm-section-label {
					font-size: 11px;
					font-weight: 600;
					color: var(--text);
					letter-spacing: 0.08em;
					text-transform: uppercase;
					padding-bottom: 10px;
					border-bottom: 1px solid var(--border);
					margin-bottom: 2px;
				}
				.rm-modal-footer {
					padding: 16px 24px;
					border-top: 1px solid var(--border);
					display: flex;
					align-items: center;
					justify-content: space-between;
					gap: 8px;
					flex-shrink: 0;
				}
				.rm-btn-ghost, .rm-btn-next, .rm-btn-primary {
					padding: 8px 16px;
					border-radius: 8px;
					font-size: 13px;
					font-weight: 600;
					cursor: pointer;
				}
				.rm-btn-ghost {
					border: 1px solid var(--border);
					background: transparent;
					color: var(--text);
				}
				.rm-btn-next {
					border: 1px solid var(--accent-border);
					background: var(--accent-bg);
					color: var(--accent);
					margin-left: auto;
				}
				.rm-btn-primary {
					border: none;
					background: var(--accent);
					color: #fff;
				}
				.rm-btn-primary:disabled,
				.rm-btn-next:disabled,
				.rm-btn-ghost:disabled {
					opacity: 0.45;
					cursor: not-allowed;
				}
				@media (max-width: 640px) {
					.rm-row { grid-template-columns: 1fr; }
					.rm-modal { max-height: 95vh; }
				}
			`}</style>
			<div
				className="rm-overlay"
				onClick={(e) => e.target === e.currentTarget && onClose()}>
				<div
					role="dialog"
					aria-modal="true"
					aria-labelledby="rm-add-person-title"
					className="rm-modal">
					<div className="rm-modal-header">
						<div id="rm-add-person-title" className="rm-modal-title">
							Add person
						</div>
						<div className="rm-modal-sub">
							{step === "basic" ? "Basic info" : "Contact & socials (optional)"}
						</div>
						<div className="rm-steps">
							<div className="rm-step active" />
							<div
								className={`rm-step ${step === "contact" ? "active" : ""}`}
							/>
						</div>
					</div>

					<div className="rm-modal-body">
						{step === "basic" && (
							<>
								<FormField
									label="Name"
									id="name"
									placeholder="Full name"
									value={form.name}
									onChange={(e) =>
										setForm((s) => ({ ...s, name: e.target.value }))
									}
									onKeyDown={handleKeyDown}
								/>
								<div className="rm-row">
									<FormField
										label="Year met"
										id="year"
										type="number"
										value={form.year}
										onChange={(e) =>
											setForm((s) => ({
												...s,
												year: Number(e.target.value || initialYear),
											}))
										}
									/>
									<FormField
										label="Location"
										id="location"
										placeholder="City, Country"
										value={form.location}
										onChange={(e) =>
											setForm((s) => ({ ...s, location: e.target.value }))
										}
									/>
								</div>
								<div className="rm-row">
									<TextareaField
										label="First interaction"
										id="firstInteraction"
										rows={2}
										placeholder="How you first met..."
										value={form.firstInteraction}
										onChange={(e) =>
											setForm((s) => ({
												...s,
												firstInteraction: e.target.value,
											}))
										}
									/>
									<TextareaField
										label="Last interaction"
										id="lastInteraction"
										rows={2}
										placeholder="Most recent interaction..."
										value={form.lastInteraction}
										onChange={(e) =>
											setForm((s) => ({
												...s,
												lastInteraction: e.target.value,
											}))
										}
									/>
								</div>
								<TextareaField
									label="Description"
									id="description"
									rows={2}
									placeholder="Short note about this person…"
									value={form.description}
									onChange={(e) =>
										setForm((s) => ({ ...s, description: e.target.value }))
									}
								/>
								<TextareaField
									label="Lore"
									id="lore"
									rows={3}
									placeholder="Longer backstory, context, memories…"
									value={form.lore}
									onChange={(e) =>
										setForm((s) => ({ ...s, lore: e.target.value }))
									}
								/>
								<FormField
									label="Tags"
									id="inrete"
									placeholder="music, school, work (comma separated)"
									value={form.inrete}
									onChange={(e) =>
										setForm((s) => ({ ...s, inrete: e.target.value }))
									}
								/>
							</>
						)}

						{step === "contact" && (
							<>
								<div className="rm-row">
									<FormField
										label="Phone"
										id="phone"
										placeholder="+1 555 000 0000"
										autoComplete="tel"
										value={form.phone}
										onChange={(e) =>
											setForm((s) => ({ ...s, phone: e.target.value }))
										}
									/>
									<FormField
										label="Email"
										id="email"
										placeholder="name@example.com"
										autoComplete="email"
										value={form.email}
										onChange={(e) =>
											setForm((s) => ({ ...s, email: e.target.value }))
										}
									/>
								</div>

								<div>
									<div className="rm-section-label">Social handles</div>
									<div style={{ marginTop: 12 }}>
										<SocialHandles
											socials={
												form.socials as Partial<Record<string, string[]>>
											}
											onAdd={handleSocialAdd}
											onRemove={handleSocialRemove}
										/>
									</div>
								</div>
							</>
						)}
					</div>

					<div className="rm-modal-footer">
						<button
							onClick={step === "basic" ? onClose : () => setStep("basic")}
							className="rm-btn-ghost">
							{step === "basic" ? "Cancel" : "← Back"}
						</button>

						{step === "basic" ? (
							<button
								className="rm-btn-next"
								disabled={!form.name.trim()}
								onClick={() => setStep("contact")}>
								Next →
							</button>
						) : (
							<button
								className="rm-btn-primary"
								disabled={loading || !form.name.trim()}
								onClick={handleCreate}>
								{loading ? "Creating…" : "Create person"}
							</button>
						)}
					</div>
				</div>
			</div>
		</>,
		document.body,
	);
}
