import { useEffect, useState } from "react";

export function useGraphDimensions(container: HTMLDivElement | null) {
	const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

	useEffect(() => {
		if (!container) return;

		const observer = new ResizeObserver((entries) => {
			const entry = entries[0];
			if (!entry) return;

			const { width, height } = entry.contentRect;
			setDimensions((prev) => {
				if (
					Math.abs(prev.width - width) > 2 ||
					Math.abs(prev.height - height) > 2
				) {
					return { width, height };
				}
				return prev;
			});
		});

		observer.observe(container);

		const rect = container.getBoundingClientRect();
		setDimensions({
			width: rect.width,
			height: rect.height,
		});

		return () => observer.disconnect();
	}, [container]);

	return dimensions;
}
