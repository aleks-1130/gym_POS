import React from 'react';

export default function DataTable({
    columns,
    data,
    onRowClick,
    actions,
    isLoading,
    emptyMessage = "No records found.",
    className = ""
}) {
    if (isLoading) {
        return (
            <div className={`bg-surface rounded-3xl border border-white/5 p-12 flex justify-center items-center ${className}`}>
                <p className="text-text-muted">Loading...</p>
            </div>
        );
    }

    return (
        <div className={`bg-surface rounded-3xl border border-white/5 overflow-hidden shadow-sm animate-fade-in ${className}`}>
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-white/5 text-text-muted text-sm bg-white/5">
                            {columns.map((col, idx) => (
                                <th key={idx} className={`p-6 font-medium ${col.className || ''}`}>
                                    {col.header}
                                </th>
                            ))}
                            {actions && <th className="p-6 font-medium text-right">Actions</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {data.map((row, rowIndex) => (
                            <tr
                                key={row.id || rowIndex}
                                onClick={onRowClick ? () => onRowClick(row) : undefined}
                                className={`transition-colors group ${onRowClick ? 'hover:bg-white/5 cursor-pointer' : ''}`}
                            >
                                {columns.map((col, colIndex) => (
                                    <td key={colIndex} className={`p-6 ${col.cellClassName || ''}`}>
                                        {typeof col.accessor === 'function'
                                            ? col.accessor(row)
                                            : row[col.accessor]}
                                    </td>
                                ))}
                                {actions && (
                                    <td className="p-6 text-right">
                                        {actions(row)}
                                    </td>
                                )}
                            </tr>
                        ))}
                        {data.length === 0 && (
                            <tr>
                                <td colSpan={columns.length + (actions ? 1 : 0)} className="p-12 text-center text-text-muted">
                                    {emptyMessage}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
