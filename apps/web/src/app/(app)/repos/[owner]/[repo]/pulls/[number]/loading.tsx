export default function PRDetailLoading() {
	return (
		<div className="animate-pulse">
			{/* PR header */}
			<div className="mb-4">
				<div className="flex items-center gap-2 mb-2">
					<div className="h-5 w-72 rounded bg-muted/50" />
					<div className="h-5 w-12 rounded bg-muted/30" />
				</div>
				<div className="flex items-center gap-2 mb-3">
					<div className="h-5 w-16 rounded-full bg-muted/40" />
					<div className="h-4 w-4 rounded-full bg-muted/30" />
					<div className="h-3 w-36 rounded bg-muted/20" />
					<div className="flex items-center gap-1 ml-4">
						<div className="h-3 w-16 rounded bg-muted/15" />
						<div className="h-3 w-4 rounded bg-muted/10" />
						<div className="h-3 w-16 rounded bg-muted/15" />
					</div>
				</div>
			</div>

			{/* Split view */}
			<div className="flex gap-0 border border-border rounded-md overflow-hidden min-h-[500px]">
				{/* Left: diff viewer */}
				<div className="flex-1 border-r border-border">
					{/* File header */}
					<div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/20">
						<div className="h-3 w-4 rounded bg-muted/30" />
						<div className="h-3 w-48 rounded bg-muted/30" />
						<div className="flex items-center gap-2 ml-auto">
							<div className="h-3 w-8 rounded bg-green-500/20" />
							<div className="h-3 w-8 rounded bg-red-500/20" />
						</div>
					</div>
					{/* Diff lines */}
					<div className="space-y-0">
						{Array.from({ length: 20 }).map((_, i) => (
							<div
								key={i}
								className={`flex items-center gap-0 h-5 ${
									i % 7 === 3
										? "bg-green-500/5"
										: i % 7 === 5
											? "bg-red-500/5"
											: ""
								}`}
							>
								<div className="w-10 h-full bg-muted/10" />
								<div className="w-10 h-full bg-muted/10" />
								<div
									className="h-3 rounded bg-muted/20 ml-2"
									style={{
										width: `${40 + Math.random() * 300}px`,
									}}
								/>
							</div>
						))}
					</div>
				</div>

				{/* Right: conversation */}
				<div className="hidden lg:block w-[35%] shrink-0 p-4 space-y-3">
					<div className="h-4 w-24 rounded bg-muted/30 mb-4" />
					{Array.from({ length: 3 }).map((_, i) => (
						<div
							key={i}
							className="border border-border/40 rounded-md p-3 space-y-2"
						>
							<div className="flex items-center gap-2">
								<div className="h-5 w-5 rounded-full bg-muted/40" />
								<div className="h-3 w-20 rounded bg-muted/30" />
								<div className="h-2.5 w-12 rounded bg-muted/20 ml-auto" />
							</div>
							<div className="space-y-1.5">
								<div className="h-3 w-full rounded bg-muted/25" />
								<div className="h-3 w-2/3 rounded bg-muted/25" />
							</div>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
