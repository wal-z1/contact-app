import { Handle, Position, type NodeProps } from "reactflow";

export default function TagNode({ data }: NodeProps<any>) {
	const name = data?.name ?? "tag";

	return (
		<div className="relative px-3 py-1 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-100 font-medium">
			<Handle
				type="source"
				position={Position.Bottom}
				className="w-2! h-2! bg-cyan-400! border-0!"
			/>
			<Handle
				type="target"
				position={Position.Top}
				className="w-2! h-2! bg-cyan-400! border-0!"
			/>
			{name}
		</div>
	);
}
