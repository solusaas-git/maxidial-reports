'use client';

import { useState } from 'react';
import DateRangePicker from '@/components/DateRangePicker';
import ReportViewer from '@/components/ReportViewer';
import ProtectedRoute from '@/components/ProtectedRoute';
import { format } from 'date-fns';
import { BarChart3, Calendar, Users, Target, FileText } from 'lucide-react';
import { ReportData } from '@/lib/report-generator';
import { ClientChartGenerator } from '@/lib/chart-generator-client';

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

  // Status colors for charts
  const STATUS_COLORS = {
    'answered': '#10b981',      // Green
    'busy': '#f59e0b',         // Yellow
    'no-answer': '#ef4444',    // Red
    'failed': '#ef4444',        // Red
    'congestion': '#64748b',   // Gray
    'unknown': '#64748b',       // Gray
  };

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

  const generateChartsForReport = async (): Promise<Record<string, string>> => {
    const charts: Record<string, string> = {};
    console.log('🎯 Starting chart generation for report:', selectedReport);

    try {
      // First, fetch the report data to generate accurate charts
      console.log('Fetching report data for chart generation...');
      
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

      if (!response.ok) {
        throw new Error('Failed to fetch report data for charts');
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.message || 'Failed to fetch report data');
      }

      const reportData = result.data;
      console.log('Report data fetched, generating charts...');

      if (selectedReport === 'agent-performance') {
        // Generate Agent Performance bar chart
        if (reportData.data.agentPerformance && reportData.data.agentPerformance.length > 0) {
          const chartData = reportData.data.agentPerformance
            .filter((agent: any) => agent.totalCalls >= 5 && agent.agentId !== 0)
            .slice(0, 10);
          
          if (chartData.length > 0) {
            const labels = chartData.map((agent: any) => agent.agentName || `Agent ${agent.agentId}`);
            const values = chartData.map((agent: any) => agent.totalCalls);
            
            charts['agent-performance-bar'] = await ClientChartGenerator.generateBarChart({
              labels,
              datasets: [{ label: 'Total Calls', data: values, backgroundColor: '#3b82f6' }]
            }, {
              plugins: { legend: { display: false } }
            });
          }
        }
      }

      if (selectedReport === 'call-summary') {
      console.log('📊 Generating Call Summary charts...');
      console.log('Outbound calls data:', reportData.data.outboundCalls?.length || 0);
      console.log('Inbound calls data:', reportData.data.inboundCalls?.length || 0);
      console.log('Full report data structure:', reportData.data);
      console.log('Available data keys:', Object.keys(reportData.data));
        
        // Generate Call Summary charts
        if (reportData.data.calls && reportData.data.calls.length > 0) {
          // Use same logic as ReportViewer to determine call direction
          const getDirection = (c: any) => (c.direction || c.type || '').toString().toLowerCase();
          
          // Separate outbound and inbound calls
          const outboundCalls = reportData.data.calls.filter((call: any) => getDirection(call) === 'outbound');
          const inboundCalls = reportData.data.calls.filter((call: any) => getDirection(call) === 'inbound');
          
          console.log('📞 Outbound calls:', outboundCalls.length);
          console.log('📞 Inbound calls:', inboundCalls.length);
          console.log('📞 Sample call data:', reportData.data.calls[0]);
          console.log('📞 All call directions:', [...new Set(reportData.data.calls.map((call: any) => getDirection(call)))]);
          console.log('📞 Sample call type:', reportData.data.calls[0].type);
          
          // Daily outbound calls chart
          if (outboundCalls.length > 0) {
            const dailyData = outboundCalls.reduce((acc: any, call: any) => {
              const date = new Date(call.startTime).toISOString().split('T')[0];
              if (!acc[date]) {
                acc[date] = { total: 0, answered: 0 };
              }
              acc[date].total++;
              if (call.disposition === 'answered') {
                acc[date].answered++;
              }
              return acc;
            }, {});

            const dates = Object.keys(dailyData).sort();
            const totalCalls = dates.map(date => dailyData[date].total);
            const answeredCalls = dates.map(date => dailyData[date].answered);

            console.log('📈 Generating daily-outbound-bar chart...');
            charts['daily-outbound-bar'] = await ClientChartGenerator.generateBarChart({
              labels: dates,
              datasets: [
                { label: 'Total Calls', data: totalCalls, backgroundColor: '#3b82f6' },
                { label: 'Answered', data: answeredCalls, backgroundColor: '#10b981' }
              ]
            }, {
              plugins: { legend: { display: true } }
            });
            console.log('✅ Generated daily-outbound-bar chart');
          }

          // Generate pie charts for call status distribution
          if (outboundCalls.length > 0) {
            const statusCounts = outboundCalls.reduce((acc: any, call: any) => {
              const status = call.disposition || 'unknown';
              acc[status] = (acc[status] || 0) + 1;
              return acc;
            }, {});

            const statusData = Object.entries(statusCounts).map(([label, value]) => ({
              label,
              value: value as number,
              color: STATUS_COLORS[label as keyof typeof STATUS_COLORS] || '#64748b'
            }));

            if (statusData.length > 0) {
              const total = statusData.reduce((sum, item) => sum + item.value, 0);
              console.log('🥧 Generating outbound-status-pie chart...');
              charts['outbound-status-pie'] = await ClientChartGenerator.generatePieChart({
                labels: statusData.map(d => `${d.label} (${total ? ((d.value / total) * 100).toFixed(1) : '0.0'}%)`),
                datasets: [{
                  label: 'Outbound Calls',
                  data: statusData.map(d => d.value),
                  backgroundColor: statusData.map(d => d.color),
                }]
              }, {
                plugins: {
                  legend: { position: 'right' },
                  title: { display: false }
                }
              });
              console.log('✅ Generated outbound-status-pie chart');
            }
          }
        }

        // Generate inbound charts
        if (reportData.data.calls && reportData.data.calls.length > 0) {
          const inboundCalls = reportData.data.calls.filter((call: any) => call.direction === 'inbound');
          
          if (inboundCalls.length > 0) {
            // Daily inbound calls chart
            const dailyInboundData = inboundCalls.reduce((acc: any, call: any) => {
              const date = new Date(call.startTime).toISOString().split('T')[0];
              if (!acc[date]) {
                acc[date] = { total: 0, answered: 0 };
              }
              acc[date].total++;
              if (call.disposition === 'answered') {
                acc[date].answered++;
              }
              return acc;
            }, {});

            const inboundDates = Object.keys(dailyInboundData).sort();
            const inboundTotalCalls = inboundDates.map(date => dailyInboundData[date].total);
            const inboundAnsweredCalls = inboundDates.map(date => dailyInboundData[date].answered);

            console.log('📈 Generating daily-inbound-bar chart...');
            charts['daily-inbound-bar'] = await ClientChartGenerator.generateBarChart({
              labels: inboundDates,
              datasets: [
                { label: 'Total Calls', data: inboundTotalCalls, backgroundColor: '#3b82f6' },
                { label: 'Answered', data: inboundAnsweredCalls, backgroundColor: '#10b981' }
              ]
            }, {
              plugins: { legend: { display: true } }
            });
            console.log('✅ Generated daily-inbound-bar chart');

            // Inbound status pie chart
            const inboundStatusCounts = inboundCalls.reduce((acc: any, call: any) => {
              const status = call.disposition || 'unknown';
              acc[status] = (acc[status] || 0) + 1;
              return acc;
            }, {});

            const inboundStatusData = Object.entries(inboundStatusCounts).map(([label, value]) => ({
              label,
              value: value as number,
              color: STATUS_COLORS[label as keyof typeof STATUS_COLORS] || '#64748b'
            }));

            if (inboundStatusData.length > 0) {
              const inboundTotal = inboundStatusData.reduce((sum, item) => sum + item.value, 0);
              console.log('🥧 Generating inbound-status-pie chart...');
              charts['inbound-status-pie'] = await ClientChartGenerator.generatePieChart({
                labels: inboundStatusData.map(d => `${d.label} (${inboundTotal ? ((d.value / inboundTotal) * 100).toFixed(1) : '0.0'}%)`),
                datasets: [{
                  label: 'Inbound Calls',
                  data: inboundStatusData.map(d => d.value),
                  backgroundColor: inboundStatusData.map(d => d.color),
                }]
              }, {
                plugins: {
                  legend: { position: 'right' },
                  title: { display: false }
                }
              });
              console.log('✅ Generated inbound-status-pie chart');
            }
          }
        }

        // Generate comparison charts (VS section)
        if (reportData.data.calls && reportData.data.calls.length > 0) {
          const getDirection = (c: any) => (c.direction || c.type || '').toString().toLowerCase();
          const outboundCalls = reportData.data.calls.filter((call: any) => getDirection(call) === 'outbound');
          const inboundCalls = reportData.data.calls.filter((call: any) => getDirection(call) === 'inbound');
          
          if (outboundCalls.length > 0 || inboundCalls.length > 0) {
            // Daily comparison line chart
            const allCalls = [...outboundCalls, ...inboundCalls];
            const dailyComparisonData = allCalls.reduce((acc: any, call: any) => {
              const date = new Date(call.startTime).toISOString().split('T')[0];
              if (!acc[date]) {
                acc[date] = { outbound: 0, inbound: 0 };
              }
              if (getDirection(call) === 'outbound') {
                acc[date].outbound++;
              } else if (getDirection(call) === 'inbound') {
                acc[date].inbound++;
              }
              return acc;
            }, {});

            const comparisonDates = Object.keys(dailyComparisonData).sort();
            const outboundComparisonData = comparisonDates.map(date => dailyComparisonData[date].outbound);
            const inboundComparisonData = comparisonDates.map(date => dailyComparisonData[date].inbound);

            console.log('📈 Generating daily-comparison-line chart...');
            charts['daily-comparison-line'] = await ClientChartGenerator.generateLineChart({
              labels: comparisonDates,
              datasets: [
                { label: 'Outbound', data: outboundComparisonData, borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)' },
                { label: 'Inbound', data: inboundComparisonData, borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)' }
              ]
            }, {
              plugins: { legend: { display: true } }
            });
            console.log('✅ Generated daily-comparison-line chart');

            // Comparison status pie chart
            const comparisonStatusCounts = allCalls.reduce((acc: any, call: any) => {
              const status = call.disposition || 'unknown';
              acc[status] = (acc[status] || 0) + 1;
              return acc;
            }, {});

            const comparisonStatusData = Object.entries(comparisonStatusCounts).map(([label, value]) => ({
              label,
              value: value as number,
              color: STATUS_COLORS[label as keyof typeof STATUS_COLORS] || '#64748b'
            }));

            if (comparisonStatusData.length > 0) {
              const comparisonTotal = comparisonStatusData.reduce((sum, item) => sum + item.value, 0);
              console.log('🥧 Generating comparison-status-pie chart...');
              charts['comparison-status-pie'] = await ClientChartGenerator.generatePieChart({
                labels: comparisonStatusData.map(d => `${d.label} (${comparisonTotal ? ((d.value / comparisonTotal) * 100).toFixed(1) : '0.0'}%)`),
                datasets: [{
                  label: 'All Calls',
                  data: comparisonStatusData.map(d => d.value),
                  backgroundColor: comparisonStatusData.map(d => d.color),
                }]
              }, {
                plugins: {
                  legend: { position: 'right' },
                  title: { display: false }
                }
              });
              console.log('✅ Generated comparison-status-pie chart');
            }
          }
        }
      }

      if (selectedReport === 'campaign-analytics') {
        // Generate Campaign Analytics charts
        console.log('Generating charts for Campaign Analytics Report...');
        
        if (reportData.data.campaignAnalytics && reportData.data.campaignAnalytics.length > 0) {
          // Calls by Campaign chart
          const campaignsWithCalls = reportData.data.campaignAnalytics.filter((c: any) => c.totalCalls > 0);
          const topCampaigns = campaignsWithCalls.slice(0, 10);
          
          if (topCampaigns.length > 0) {
            charts['campaign-calls-bar'] = await ClientChartGenerator.generateBarChart({
              labels: topCampaigns.map((campaign: any) => campaign.campaignName),
              datasets: [
                { label: 'Total Calls', data: topCampaigns.map((c: any) => c.totalCalls), backgroundColor: '#3b82f6' },
                { label: 'Answered', data: topCampaigns.map((c: any) => c.answeredCalls || 0), backgroundColor: '#10b981' }
              ]
            }, {
              plugins: { legend: { display: true } }
            });
          }
          
          // Lead Conversion Rate chart
          const campaignsWithLeads = reportData.data.campaignAnalytics.filter((c: any) => c.totalLeads > 0);
          const topCampaignsByLeads = campaignsWithLeads.slice(0, 10);
          
          if (topCampaignsByLeads.length > 0) {
            charts['campaign-conversion-bar'] = await ClientChartGenerator.generateBarChart({
              labels: topCampaignsByLeads.map((campaign: any) => campaign.campaignName),
              datasets: [{ label: 'Conversion Rate %', data: topCampaignsByLeads.map((c: any) => parseFloat(c.conversionRate || '0')), backgroundColor: '#10b981' }]
            }, {
              plugins: { legend: { display: false } }
            });
            
            // Leads vs Conversions chart
            charts['campaign-leads-bar'] = await ClientChartGenerator.generateBarChart({
              labels: topCampaignsByLeads.map((campaign: any) => campaign.campaignName),
              datasets: [
                { label: 'Total Leads', data: topCampaignsByLeads.map((c: any) => c.totalLeads), backgroundColor: '#3b82f6' },
                { label: 'Converted', data: topCampaignsByLeads.map((c: any) => c.convertedLeads || 0), backgroundColor: '#10b981' }
              ]
            }, {
              plugins: { legend: { display: true } }
            });
          }
        }
      }

    } catch (error) {
      console.error('Error generating charts:', error);
      console.error('Chart generation error details:', error);
      // Continue without charts rather than failing completely
    }

    return charts;
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
      console.log('Step 1: Generating charts client-side...');

      // Generate charts client-side first
      let chartImages: Record<string, string> = {};
      try {
        console.log('🚀 Calling generateChartsForReport function...');
        console.log('ClientChartGenerator available:', typeof ClientChartGenerator);
        chartImages = await generateChartsForReport();
        console.log(`✅ Generated ${Object.keys(chartImages).length} chart images`);
        console.log('Chart keys:', Object.keys(chartImages));
      } catch (chartError) {
        console.error('❌ Error in generateChartsForReport:', chartError);
        console.error('Chart generation failed, continuing without charts');
        chartImages = {};
      }
      
      console.log('Step 2: Calling server-side PDF generation API...');
      
      // Call server-side PDF generation API with pre-generated chart images
      const response = await fetch('/api/reports/generate-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reportType: selectedReport,
          startDate,
          endDate,
          chartImages, // Send pre-generated chart images
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to generate PDF');
      }

      console.log('Step 3: Downloading PDF...');

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