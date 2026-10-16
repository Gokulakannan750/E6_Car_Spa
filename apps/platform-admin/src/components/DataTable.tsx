import { useState } from 'react';
import { flexRender, getCoreRowModel, getPaginationRowModel, getSortedRowModel, useReactTable, type ColumnDef, type SortingState } from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from 'lucide-react';

interface DataTableProps<T> {
	data: T[];
	columns: ColumnDef<T, unknown>[];
	onRowClick?: (row: T) => void;
	pageSize?: number;
	initialSorting?: SortingState;
	empty?: React.ReactNode;
	rowLabel?: (row: T) => string;
	noun?: string;
}

/** The dense list table from the design: 44px rows, uppercase headers, sortable columns, simple paging. */
export function DataTable<T>({ data, columns, onRowClick, pageSize = 25, initialSorting = [], empty, rowLabel, noun = 'rows' }: DataTableProps<T>) {
	const [sorting, setSorting] = useState<SortingState>(initialSorting);
	const table = useReactTable({
		data,
		columns,
		state: { sorting },
		onSortingChange: setSorting,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		initialState: { pagination: { pageSize } },
		autoResetPageIndex: true,
	});

	if (data.length === 0 && empty) return <>{empty}</>;

	const { pageIndex } = table.getState().pagination;
	const from = data.length === 0 ? 0 : pageIndex * pageSize + 1;
	const to = Math.min((pageIndex + 1) * pageSize, data.length);

	return (
		<div>
			<div className="overflow-x-auto">
				<table className="w-full border-collapse text-table">
					<thead>
						{table.getHeaderGroups().map((group) => (
							<tr key={group.id} className="border-b border-border-subtle">
								{group.headers.map((header) => {
									const sortable = header.column.getCanSort();
									const sorted = header.column.getIsSorted();
									const align = (header.column.columnDef.meta as { align?: string } | undefined)?.align === 'right' ? 'text-right' : 'text-left';
									return (
										<th
											key={header.id}
											scope="col"
											aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : undefined}
											className={`relative h-10 px-4 text-label font-semibold tracking-[0.04em] whitespace-nowrap text-text-muted uppercase ${align}`}
										>
											{header.isPlaceholder ? null : sortable ? (
												<button type="button" onClick={header.column.getToggleSortingHandler()} className="inline-flex items-center gap-1 uppercase hover:text-text-heading">
													{flexRender(header.column.columnDef.header, header.getContext())}
													{sorted === 'asc' ? <ArrowUp className="size-3" /> : sorted === 'desc' ? <ArrowDown className="size-3" /> : null}
												</button>
											) : (
												flexRender(header.column.columnDef.header, header.getContext())
											)}
										</th>
									);
								})}
							</tr>
						))}
					</thead>
					<tbody>
						{table.getRowModel().rows.map((row) => (
							<tr
								key={row.id}
								onClick={onRowClick ? () => onRowClick(row.original) : undefined}
								onKeyDown={
									onRowClick
										? (e) => {
												if (e.key === 'Enter') onRowClick(row.original);
											}
										: undefined
								}
								tabIndex={onRowClick ? 0 : undefined}
								aria-label={onRowClick && rowLabel ? rowLabel(row.original) : undefined}
								className={`h-11 border-b border-border-hairline last:border-b-0 ${onRowClick ? 'cursor-pointer hover:bg-surface-raised/60 focus-visible:bg-surface-raised/60' : ''}`}
							>
								{row.getVisibleCells().map((cell) => {
									const align = (cell.column.columnDef.meta as { align?: string } | undefined)?.align === 'right' ? 'text-right' : 'text-left';
									return (
										<td key={cell.id} className={`px-4 py-2 align-middle text-text-primary ${align}`}>
											{flexRender(cell.column.columnDef.cell, cell.getContext())}
										</td>
									);
								})}
							</tr>
						))}
					</tbody>
				</table>
			</div>
			{data.length > pageSize && (
				<div className="flex items-center justify-between border-t border-border-subtle px-4 py-3 text-label text-text-muted">
					<span className="tabular">
						Showing {from}–{to} of {data.length} {noun}
					</span>
					<div className="flex items-center gap-1">
						<button
							type="button"
							aria-label="Previous page"
							disabled={!table.getCanPreviousPage()}
							onClick={() => table.previousPage()}
							className="inline-flex size-8 items-center justify-center rounded-md hover:bg-surface-raised disabled:opacity-40"
						>
							<ChevronLeft className="size-4" />
						</button>
						<span className="tabular px-2">
							Page {pageIndex + 1} of {table.getPageCount()}
						</span>
						<button
							type="button"
							aria-label="Next page"
							disabled={!table.getCanNextPage()}
							onClick={() => table.nextPage()}
							className="inline-flex size-8 items-center justify-center rounded-md hover:bg-surface-raised disabled:opacity-40"
						>
							<ChevronRight className="size-4" />
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
