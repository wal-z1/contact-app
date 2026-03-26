import { useState, useRef, type ChangeEvent, memo, useCallback } from "react";
import { useAppStore } from "../store/useAppStore";

const BULK_JSON_EXAMPLE = `{
	"tags": [
		{ "id": "tag-work", "name": "work", "normalized": "work" },
		{ "id": "tag-frontend", "name": "frontend", "normalized": "frontend" }
	],
	"people": [
		{
			"id": "sam-001",
			"name": "Sam Rivera",
			"year": 2024,
			"description": "Frontend engineer from meetup",
			"inrete": ["tag-work", "tag-frontend"]
		}
	]
}`;

function DataManagementComponent() {
	const importPeopleFromJson = useAppStore((s) => s.importPeopleFromJson);
	const exportBackup = useAppStore((s) => s.exportBackup);
	const startManualReview = useAppStore((s) => s.startManualReview);

	const [uploading, setUploading] = useState(false);
	const [uploadMessage, setUploadMessage] = useState<string>("");
	const [uploadError, setUploadError] = useState(false);
	const fileInputRef = useRef<HTMLInputElement | null>(null);

	const openUploadPicker = useCallback(() => {
		setUploadError(false);
		setUploadMessage("");
		fileInputRef.current?.click();
	}, []);

	const handleExport = useCallback(async () => {
		setUploadError(false);
		try {
			const message = await exportBackup();
			setUploadMessage(message);
		} catch (error) {
			setUploadError(true);
			setUploadMessage(
				error instanceof Error ? error.message : "Could not export data.",
			);
		}
	}, [exportBackup]);

	const handleUploadFile = useCallback(
		async (e: ChangeEvent<HTMLInputElement>) => {
			const file = e.target.files?.[0];
			if (!file) return;

			setUploading(true);
			setUploadError(false);
			setUploadMessage("");

			try {
				const text = await file.text();
				const parsed: unknown = JSON.parse(text);
				const result = await importPeopleFromJson(parsed);
				setUploadMessage(
					`Import complete: ${result.added} added, ${result.updated} updated, ${result.skipped} skipped.`,
				);
			} catch (error) {
				setUploadError(true);
				setUploadMessage(
					error instanceof Error
						? error.message
						: "Could not import file. Check JSON format and try again.",
				);
			} finally {
				setUploading(false);
				if (e.target) e.target.value = "";
			}
		},
		[importPeopleFromJson],
	);

	return (
		<>
			<div className="rm-action-grid">
				<button
					type="button"
					onClick={startManualReview}
					className="rm-sidebar-btn"
					aria-label="Start manual review"
				>
					<span style={{ fontSize: 13 }}>👁️</span>
					Manual review
				</button>
				<button
					type="button"
					onClick={openUploadPicker}
					disabled={uploading}
					aria-label="Import people from JSON file"
					className="rm-sidebar-btn"
				>
					<span style={{ fontSize: 13 }}>⇪</span>
					{uploading ? "Importing..." : "Import JSON"}
				</button>
				<button
					type="button"
					onClick={handleExport}
					aria-label="Export full data backup"
					className="rm-sidebar-btn"
				>
					<span style={{ fontSize: 13 }}>⎙</span>
					Export Backup
				</button>
			</div>

			<input
				ref={fileInputRef}
				type="file"
				accept=".json,application/json"
				onChange={handleUploadFile}
				tabIndex={-1}
				aria-hidden="true"
				style={{ display: "none" }}
			/>

			<div className="rm-upload-note" role="note">
				Your data is local-first. Import or export JSON to move your workspace
				between devices.
			</div>

			<div className="rm-upload-card">
				<details className="rm-upload-details">
					<summary className="rm-upload-summary">
						<span>How to Import & Export</span>
						<span className="rm-upload-summary-icon">▾</span>
					</summary>
					<div className="rm-upload-steps" aria-label="Import guide">
						<div>1. Use `Export Backup` to get a full JSON of your data.</div>
						<div>2. Move this file to another device.</div>
						<div>3. Use `Import JSON` to load the backup file.</div>
						<div>4. Existing items are updated, new items are added.</div>
						<pre className="rm-upload-example">{BULK_JSON_EXAMPLE}</pre>
					</div>
				</details>
			</div>

			{uploadMessage && (
				<div
					role="status"
					aria-live="polite"
					className={`rm-upload-msg ${uploadError ? "err" : "ok"}`}
				>
					{uploadMessage}
				</div>
			)}
		</>
	);
}

export const DataManagement = memo(DataManagementComponent);