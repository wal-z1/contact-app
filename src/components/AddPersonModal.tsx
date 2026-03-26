import {
	useState,
	useMemo,
	useEffect,
	type FC,
	type KeyboardEvent,
	type ComponentProps,
} from "react";
import { useAppStore } from "../store/useAppStore";
import type { Socials } from "../models/types";
import type { PersonFormData } from "../store/useAppStore";

type FormState = Omit<PersonFormData, "nodeColor" | "events">;

const SOCIAL_PLATFORMS: Array<keyof Socials> = [
	"instagram",
	"linkedin",
	"twitter",
	"github",
	"mastodon",
	"website",
];
const SOCIAL_LABELS: Record<string, string> = {
	instagram: "Instagram",
	linkedin: "LinkedIn",
	twitter: "Twitter / X",
	github: "GitHub",
	mastodon: "Mastodon",
	website: "Website",
};
const SOCIAL_ICONS: Record<string, string> = {
	instagram: "📸",
	linkedin: "💼",
	twitter: "𝕏",
	github: "⌥",
	mastodon: "🐘",
	website: "🌐",
};

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

	const handleSocialChange = (key: keyof Socials, value: string) => {
		setForm((s) => ({
			...s,
			socials: {
				...s.socials,
				[key]: value
					.split(",")
					.map((v) => v.trim())
					.filter(Boolean),
			},
		}));
	};

	if (!isOpen) return null;

	return (
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
						<div className={`rm-step ${step === "contact" ? "active" : ""}`} />
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
										setForm((s) => ({ ...s, lastInteraction: e.target.value }))
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
								<div className="rm-socials-grid" style={{ marginTop: 12 }}>
									{SOCIAL_PLATFORMS.map((key) => (
										<div key={key} className="rm-social-item">
											<span className="rm-social-label">
												<span>{SOCIAL_ICONS[key]}</span>
												{SOCIAL_LABELS[key]}
											</span>
											<input
												className="rm-input"
												value={(form.socials[key] ?? []).join(", ")}
												onChange={(e) =>
													handleSocialChange(key, e.target.value)
												}
												placeholder="@handle"
											/>
										</div>
									))}
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
	);
}
