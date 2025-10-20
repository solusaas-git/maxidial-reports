'use client';

import { useState } from 'react';
import DateRangePicker from '@/components/DateRangePicker';
import ReportViewer from '@/components/ReportViewer';
import ProtectedRoute from '@/components/ProtectedRoute';
import { format } from 'date-fns';
import { BarChart3, Calendar, Users, Target, FileText } from 'lucide-react';
import { ReportData } from '@/lib/report-generator';

export default function ReportsPage() {
  return (
    <ProtectedRoute>
      <ReportsPageContent />
    </ProtectedRoute>
  );
}

function ReportsPageContent() {
  // Initialize with datetime (start of day 30 days ago, end of today) - UTC timezone
  const [startDate, setStartDate] = useState(() => {
    const date = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}T00:00:00Z`;
  });
  const [endDate, setEndDate] = useState(() => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}T23:59:59Z`;
  });
  const [selectedReport, setSelectedReport] = useState('');
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  const reportTypes = [
    { 
      id: 'call-summary', 
      name: 'Call Summary Report', 
      description: 'Overview of all calls with duration and outcomes',
      icon: BarChart3,
      color: 'blue'
    },
    { 
      id: 'agent-performance', 
      name: 'Agent Performance Report', 
      description: 'Individual agent statistics and metrics',
      icon: Users,
      color: 'green'
    },
    { 
      id: 'campaign-analytics', 
      name: 'Campaign Analytics Report', 
      description: 'Campaign performance and conversion rates',
      icon: Target,
      color: 'purple'
    },
  ];

  const generateReport = async () => {
    if (!selectedReport) {
      alert('Please select a report type');
      return;
    }

    setLoading(true);
    setError('');
    setReportData(null);

    try {
      const response = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reportType: selectedReport,
          startDate,
          endDate,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setReportData(result.data);
      } else {
        setError(result.message || 'Failed to generate report');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while generating the report');
      console.error('Error generating report:', err);
    } finally {
      setLoading(false);
    }
  };

  const exportPDF = async () => {
    if (!selectedReport) {
      alert('Please select a report type');
      return;
    }

    setIsExporting(true);
    setError('');

    try {
      console.log('Starting PDF generation for:', selectedReport);
      
      // Call server-side PDF generation API directly
      const response = await fetch('/api/reports/generate-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reportType: selectedReport,
          startDate,
          endDate,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to generate PDF');
      }

      // Get the PDF blob
      const blob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Generate filename
      const reportTypeName = reportTypes.find(r => r.id === selectedReport)?.name || 'Report';
      const startDateStr = format(new Date(startDate), 'yyyy-MM-dd');
      const endDateStr = format(new Date(endDate), 'yyyy-MM-dd');
      link.download = `${reportTypeName.toLowerCase().replace(/\s+/g, '-')}-${startDateStr}-to-${endDateStr}.pdf`;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up
      window.URL.revokeObjectURL(url);
      
    } catch (err: any) {
      setError(err.message || 'An error occurred while exporting PDF');
      console.error('Error exporting PDF:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const getColorClasses = (color: string) => {
    const colors = {
      blue: 'border-blue-200 bg-blue-50 hover:border-blue-300 text-blue-700',
      green: 'border-green-200 bg-green-50 hover:border-green-300 text-green-700',
      purple: 'border-purple-200 bg-purple-50 hover:border-purple-300 text-purple-700',
      orange: 'border-orange-200 bg-orange-50 hover:border-orange-300 text-orange-700',
      indigo: 'border-indigo-200 bg-indigo-50 hover:border-indigo-300 text-indigo-700',
    };
    return colors[color as keyof typeof colors] || colors.blue;
  };

  const getSelectedColorClasses = (color: string) => {
    const colors = {
      blue: 'border-blue-500 bg-blue-100 ring-2 ring-blue-200',
      green: 'border-green-500 bg-green-100 ring-2 ring-green-200',
      purple: 'border-purple-500 bg-purple-100 ring-2 ring-purple-200',
      orange: 'border-orange-500 bg-orange-100 ring-2 ring-orange-200',
      indigo: 'border-indigo-500 bg-indigo-100 ring-2 ring-indigo-200',
    };
    return colors[color as keyof typeof colors] || colors.blue;
  };

  return (
    <div className="space-y-6 sm:space-y-8 px-4 sm:px-6 lg:px-8">
      {/* Page Header */}
      <div className="text-center px-4">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-2">Analytics Dashboard</h1>
      </div>

      {/* Report Configuration Card */}
      <div className="card fade-in">
        <div className="card-header">
          <div className="flex items-center">
            <FileText className="w-5 h-5 text-blue-600 mr-2" />
            <h2 className="text-xl font-semibold text-gray-900">Report Configuration</h2>
          </div>
        </div>
        <div className="card-body">
          <div className="space-y-8">
            {/* Date Range Selection */}
            <div className="space-y-3">
              <div className="flex items-center">
                <Calendar className="w-4 h-4 text-gray-500 mr-2" />
                <label className="form-label">Date Range</label>
              </div>
              <DateRangePicker
                startDate={startDate}
                endDate={endDate}
                onStartDateChange={setStartDate}
                onEndDateChange={setEndDate}
              />
            </div>

            {/* Report Type Selection */}
            <div className="space-y-4">
              <label className="form-label">Select Report Type</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {reportTypes.map((report) => {
                  const IconComponent = report.icon;
                  const isSelected = selectedReport === report.id;
                  return (
                    <div
                      key={report.id}
                      onClick={() => setSelectedReport(report.id)}
                      className={`p-4 sm:p-6 border-2 rounded-xl cursor-pointer transition-all duration-200 ${
                        isSelected
                          ? getSelectedColorClasses(report.color)
                          : `border-gray-200 hover:border-gray-300 ${getColorClasses(report.color)}`
                      }`}
                    >
                      <div className="flex items-start space-x-3 sm:space-x-4">
                        <div className={`p-2 rounded-lg flex-shrink-0 ${
                          isSelected 
                            ? 'bg-white shadow-sm' 
                            : 'bg-white/50'
                        }`}>
                          <IconComponent className={`w-5 h-5 sm:w-6 sm:h-6 ${
                            isSelected 
                              ? 'text-blue-600' 
                              : 'text-gray-500'
                          }`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 mb-1 text-sm sm:text-base">{report.name}</h3>
                          <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">{report.description}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4 pt-4">
              <button
                onClick={generateReport}
                disabled={loading || !selectedReport}
                className="btn btn-primary px-8 py-3 text-base font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <div className="spinner w-5 h-5 mr-2"></div>
                    Generating Report...
                  </>
                ) : (
                  <>
                    <BarChart3 className="w-5 h-5 mr-2" />
                    Generate Report
                  </>
                )}
              </button>
              
              <button
                onClick={exportPDF}
                disabled={loading || !selectedReport || isExporting}
                className="btn btn-success px-8 py-3 text-base font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isExporting ? (
                  <>
                    <div className="spinner w-5 h-5 mr-2"></div>
                    Exporting PDF...
                  </>
                ) : (
                  <>
                    <FileText className="w-5 h-5 mr-2" />
                    Export PDF
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 fade-in">
          <div className="flex items-center">
            <div className="w-5 h-5 text-red-600 mr-2">
              <svg fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <p className="text-red-800 font-medium">{error}</p>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="card fade-in">
          <div className="card-body">
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <div className="spinner w-12 h-12 mx-auto mb-4"></div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Generating Report</h3>
                <p className="text-gray-600">Please wait while we process your data...</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && !reportData && !error && (
        <div className="card fade-in">
          <div className="card-body">
            <div className="text-center py-16">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <BarChart3 className="w-10 h-10 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Ready to Generate Reports</h3>
              <p className="text-gray-600 max-w-md mx-auto">
                Select a report type and date range above, then click "Generate Report" to view your analytics
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Report Results */}
      {reportData && !loading && (
        <div className="fade-in">
          <ReportViewer reportData={reportData} onExport={() => {}} />
        </div>
      )}
    </div>
  );
}