import { Handle, Position, type NodeProps } from "reactflow";
import type { PersonNodeData } from "../utils/graph";

export default function PersonNode({
	data,
	selected,
}: NodeProps<PersonNodeData>) {
	const name = data?.name ?? "Unknown";
	const firstName = String(name).trim().split(/\s+/)[0] || name;
	const initial =
		data?.initial ??
		(typeof name === "string" && name[0] ? name[0].toUpperCase() : "?");

	return (
		<div
			className={`relative flex flex-col items-center justify-center gap-1 rounded-full border shadow-md transition-transform hover:scale-105 ${
				selected
					? "border-violet-400 ring-2 ring-violet-500"
					: "border-slate-600"
			}`}
			style={{
				width: 84,
				height: 84,
				background:
					"radial-gradient(circle at 30% 30%, rgba(167,139,250,0.35), rgba(15,23,42,0.95) 60%)",
				boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
			}}>
			<Handle
				type="target"
				position={Position.Top}
				className="h-2! w-2! border-0! bg-violet-300!"
			/>
			<Handle
				type="source"
				position={Position.Bottom}
				className="h-2! w-2! border-0! bg-violet-300!"
			/>

			<div className="flex h-8 w-8 items-center justify-center rounded-full bg-linear-to-br from-violet-600 to-fuchsia-600 text-xs font-bold text-white">
				{initial}
			</div>
			<div className="max-w-18 truncate text-center text-[11px] font-semibold text-slate-100">
				{firstName}
			</div>
		</div>
	);
}
