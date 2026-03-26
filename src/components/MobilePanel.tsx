import { motion, AnimatePresence } from "framer-motion";
import type { ReactNode } from "react";

type MobilePanelProps = {
	isOpen: boolean;
	onClose: () => void;
	position: "left" | "right";
	title: string;
	children: ReactNode;
};

export default function MobilePanel({ isOpen, onClose, position, title, children }: MobilePanelProps) {
	const variants = {
		open: { x: 0 },
		closed: { x: position === "left" ? "-100%" : "100%" },
	};

	return (
		<AnimatePresence>
			{isOpen && (
				<div className="fixed inset-0 z-50 md:hidden">
					{/* Backdrop */}
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.2 }}
						className="absolute inset-0 bg-black/60"
						onClick={onClose}
					/>
					{/* Panel */}
					<motion.div
						role="dialog"
						aria-modal="true"
						aria-label={`${title} panel`}
						initial="closed"
						animate="open"
						exit="closed"
						variants={variants}
						transition={{ type: "spring", stiffness: 300, damping: 30 }}
						className={`absolute top-0 h-full w-[92vw] max-w-sm bg-(--panel-bg) ${position === "left" ? "left-0 border-r" : "right-0 border-l"} border-(--border)`}>
						<div className="flex items-center justify-between gap-3 border-b border-(--border) px-3 py-3">
							<span className="text-sm font-semibold text-slate-100">{title}</span>
							<button type="button" className="rounded-lg border border-(--border) bg-slate-900/40 px-3 py-2 text-xs text-slate-200 hover:bg-slate-900/60" onClick={onClose}>
								Close
							</button>
						</div>
						<div className="h-[calc(100%-56px)] overflow-y-auto">{children}</div>
					</motion.div>
				</div>
			)}
		</AnimatePresence>
	);
}