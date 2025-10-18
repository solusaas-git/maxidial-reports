'use client';

interface Column {
  header: string;
  accessor: string;
  render?: (value: any, row: any) => React.ReactNode;
  className?: string;
}

interface DataTableProps {
  columns: Column[];
  data: any[];
  loading?: boolean;
  emptyMessage?: string;
  className?: string;
}

export default function DataTable({
  columns,
  data,
  loading = false,
  emptyMessage = 'No data available',
  className = '',
}: DataTableProps) {
  if (loading) {
    return (
      <div className="card">
        <div className="card-body">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="spinner w-8 h-8 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading data...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="card">
        <div className="card-body">
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Data Available</h3>
            <p className="text-gray-600">{emptyMessage}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`card ${className}`}>
      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.accessor}
                  className={`${column.className || ''}`}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {columns.map((column) => (
                  <td
                    key={`${rowIndex}-${column.accessor}`}
                    className={`${column.className || ''}`}
                  >
                    {column.render
                      ? column.render(row[column.accessor], row)
                      : row[column.accessor]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}