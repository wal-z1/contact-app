import { useState, useRef, type ChangeEvent, memo, useCallback } from "react";
import { useAppStore } from "../store/useAppStore";
import JSZip from "jszip";

// UPDATED: This example shows the structure of a file inside the .zip backup.
// It's more informative for the new, smarter export format.
const BACKUP_FILE_EXAMPLE = `// This is an example of 'tags.json' inside the .zip
{
	"type": "tags",
	"version": 1,
	"data": [
		{ "id": "tag-work", "name": "work", "normalized": "work" },
		{ "id": "tag-frontend", "name": "frontend", "normalized": "frontend" }
	]
}`;

// Helper to safely parse a JSON string
const safeJsonParse = (text: string): Record<string, unknown> | null => {
	try {
		const data = JSON.parse(text);
		// Basic validation to ensure it's an object
		if (data && typeof data === "object" && !Array.isArray(data)) {
			return data;
		}
		return null;
	} catch {
		return null;
	}
};

function DataManagementComponent() {
	// UPDATED: Using the new, more capable `importBackup` function
	const importBackup = useAppStore((s) => s.importBackup);
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

	// ENHANCED: This handler now accepts a format for the export.
	const handleExport = useCallback(
		async (format: "single-file" | "multi-file-zip") => {
			setUploadMessage("");
			setUploadError(false);
			try {
				const message = await exportBackup(format);
				setUploadMessage(message);
			} catch (error) {
				setUploadError(true);
				setUploadMessage(
					error instanceof Error ? error.message : "Could not export data.",
				);
			}
		},
		[exportBackup],
	);

	// ENHANCED: This handler can now process .json and .zip files.
	const handleFileImport = useCallback(
		async (e: ChangeEvent<HTMLInputElement>) => {
			const files = e.target.files;
			if (!files || files.length === 0) return;

			setUploading(true);
			setUploadError(false);
			setUploadMessage("Processing file(s)...");

			try {
				const parsedFiles: Record<string, unknown>[] = [];
				const file = files[0]; // We'll process one file at a time for simplicity

				if (file.name.endsWith(".zip")) {
					const zip = await JSZip.loadAsync(file);
					const jsonFilePromises = Object.values(zip.files)
						.filter((f) => !f.dir && f.name.endsWith(".json"))
						.map(async (zipEntry) => {
							const content = await zipEntry.async("string");
							return safeJsonParse(content);
						});

					const results = await Promise.all(jsonFilePromises);
					parsedFiles.push(
						...results.filter((p): p is Record<string, unknown> => p !== null),
					);
				} else if (file.name.endsWith(".json")) {
					const text = await file.text();
					const parsed = safeJsonParse(text);
					if (parsed) {
						parsedFiles.push(parsed);
					}
				}

				if (parsedFiles.length === 0) {
					throw new Error("No valid JSON data found in the selected file.");
				}

				const result = await importBackup(parsedFiles);
				setUploadMessage(
					`Import complete: ${result.added} added, ${result.updated} updated. Tags: ${result.tagsImported}, Relationships: ${result.relationshipsImported}.`,
				);
			} catch (error) {
				setUploadError(true);
				setUploadMessage(
					error instanceof Error
						? error.message
						: "Could not import file. Check format and try again.",
				);
			} finally {
				setUploading(false);
				if (e.target) e.target.value = ""; // Reset input
			}
		},
		[importBackup],
	);

	return (
		<>
			<div className="rm-action-grid">
				<button
					type="button"
					onClick={startManualReview}
					className="rm-sidebar-btn"
					aria-label="Start manual review">
					<span style={{ fontSize: 13 }}>👁️</span>
					Manual review
				</button>
				{/* NEW: Button for exporting as a .zip */}
				<button
					type="button"
					onClick={() => handleExport("multi-file-zip")}
					className="rm-sidebar-btn">
					<span style={{ fontSize: 13 }}>🗂️</span>
					Export .zip
				</button>
				<button
					type="button"
					onClick={() => handleExport("single-file")}
					className="rm-sidebar-btn">
					<span style={{ fontSize: 13 }}>📄</span>
					Export .json
				</button>
				<button
					type="button"
					onClick={openUploadPicker}
					disabled={uploading}
					className="rm-sidebar-btn">
					<span style={{ fontSize: 13 }}>⇪</span>
					{uploading ? "Importing..." : "Import File"}
				</button>
			</div>

			<input
				ref={fileInputRef}
				type="file"
				// UPDATED: Accept .zip files as well
				accept=".json,.zip,application/json"
				onChange={handleFileImport}
				tabIndex={-1}
				aria-hidden="true"
				style={{ display: "none" }}
			/>

			<div className="rm-upload-note" role="note">
				Your data is local-first. Use a .zip for robust backups or a .json for
				simple transfers.
			</div>

			<div className="rm-upload-card">
				<details>
					<summary className="rm-upload-summary">
						<span>How to Import & Export</span>
						<span className="rm-upload-summary-icon">▾</span>
					</summary>
					<div className="rm-upload-steps" aria-label="Import guide">
						<div>1. Use `Export .zip` for a complete, robust backup.</div>
						<div>2. Use `Export .json` for a simple, single-file backup.</div>
						<div>3. Move the file to another device.</div>
						<div>4. Use `Import File` to load the `.zip` or `.json` file.</div>
						<div>5. Existing items are updated, and new items are added.</div>
						<pre className="rm-upload-example">{BACKUP_FILE_EXAMPLE}</pre>
					</div>
				</details>
			</div>

			{uploadMessage && (
				<div
					role="status"
					aria-live="polite"
					className={`rm-upload-msg ${uploadError ? "err" : "ok"}`}>
					{uploadMessage}
				</div>
			)}
		</>
	);
}

export const DataManagement = memo(DataManagementComponent);
