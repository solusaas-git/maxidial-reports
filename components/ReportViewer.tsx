'use client';

import { useState } from 'react';
import { ReportData } from '@/lib/report-generator';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Download, Users, Target, Phone, CheckCircle, XCircle, AlertCircle, ArrowLeftRight, Clock } from 'lucide-react';
import { ClientChartGenerator } from '@/lib/chart-generator-client';

interface ReportViewerProps {
  reportData: ReportData | null;
  onExport: () => void;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

// Status-specific colors
const STATUS_COLORS: { [key: string]: string } = {
  'Answered': '#10b981',      // Green
  'No Answer': '#ef4444',     // Red
  'Busy': '#f59e0b',          // Orange/Amber
  'Congestion': '#64748b',    // Gray
};

type TabType = 'outbound' | 'inbound' | 'vs';

export default function ReportViewer({ reportData, onExport }: ReportViewerProps) {
  const [activeTab, setActiveTab] = useState<TabType>('outbound');

  if (!reportData) {
    return null;
  }

  // Generate charts for PDF export
  const generateChartsForReport = async (): Promise<Record<string, string>> => {
    const charts: Record<string, string> = {};

    if (reportData.reportType === 'call-summary') {
      const calls = reportData.data.calls || [];
      const getDirection = (c: any) => (c.direction || c.type || '').toString().toLowerCase();
      const outboundCalls = calls.filter((call: any) => getDirection(call) === 'outbound');
      const inboundCalls = calls.filter((call: any) => getDirection(call) === 'inbound');

      // Helper to count calls by status
      const countByStatus = (callList: any[]) => {
        const norm = (v: any) => (v || '').toString().trim().toLowerCase().replace(/[_\s-]+/g, '');
        let answered = 0, noAnswer = 0, busy = 0, congestion = 0;
        for (const c of callList) {
          const d = norm(c.disposition);
          if (d === 'answered') answered++;
          else if (d === 'noanswer') noAnswer++;
          else if (d === 'busy') busy++;
          else if (d === 'congestion') congestion++;
        }
        return { answered, noAnswer, busy, congestion };
      };

      const outboundStatus = countByStatus(outboundCalls);
      const inboundStatus = countByStatus(inboundCalls);
      const overallStatus = countByStatus(calls);

      // Daily charts (last 7 days)
      if (reportData.data.dailyStats && reportData.data.dailyStats.length > 0) {
        const recent = reportData.data.dailyStats.slice(-7);

        // Daily outbound bar chart (Total vs Answered)
        const labels = recent.map((d: any) => new Date(d.date).toLocaleDateString(undefined, { month: '2-digit', day: '2-digit' }));
        const outboundValues = recent.map((d: any) => d.outbound || 0);
        // Derive answered per day from calls if not present on dailyStats
        const dateKey = (iso: string) => new Date(iso).toISOString().slice(0, 10);
        const answeredByDate: Record<string, number> = {};
        for (const c of outboundCalls) {
          const disp = (c.disposition || '').toString().trim().toLowerCase().replace(/[_\s-]+/g, '');
          if (disp === 'answered') {
            const k = dateKey(c.startTime || c.created || c.time || c.timestamp || c.date || c.startedAt || c.callStartTime || new Date().toISOString());
            answeredByDate[k] = (answeredByDate[k] || 0) + 1;
          }
        }
        const answeredValues = recent.map((d: any) => answeredByDate[dateKey(d.date)] || 0);
        charts['daily-outbound-bar'] = await ClientChartGenerator.generateBarChart({
          labels,
          datasets: [
            { label: 'Outbound (Total)', data: outboundValues, backgroundColor: '#f97316' },
            { label: 'Answered', data: answeredValues, backgroundColor: '#10b981' }
          ]
        }, {
          plugins: { legend: { position: 'top' } },
          scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } }
        });

        // Daily comparison line chart
        const inboundValues = recent.map((d: any) => d.inbound || 0);
        charts['daily-comparison-line'] = await ClientChartGenerator.generateLineChart({
          labels,
          datasets: [
            { label: 'Inbound', data: inboundValues, borderColor: '#6366f1' },
            { label: 'Outbound', data: outboundValues, borderColor: '#f97316' }
          ]
        }, {
          plugins: { legend: { position: 'top' } }
        });

        // Daily inbound bar chart (used on inbound page)
        charts['daily-inbound-bar'] = await ClientChartGenerator.generateBarChart({
          labels,
          datasets: [{ label: 'Inbound Calls', data: inboundValues, backgroundColor: '#6366f1' }]
        }, {
          plugins: { legend: { display: false } }
        });
      }

      // Generate outbound status pie chart
      const outboundData = [
        { label: 'Answered', value: outboundStatus.answered, color: '#10b981' },
        { label: 'No Answer', value: outboundStatus.noAnswer, color: '#ef4444' },
        { label: 'Busy', value: outboundStatus.busy, color: '#f59e0b' },
        { label: 'Congestion', value: outboundStatus.congestion, color: '#64748b' },
      ].filter(item => item.value > 0);

      if (outboundData.length > 0) {
        const total = outboundData.reduce((s, i) => s + i.value, 0);
        charts['outbound-status-pie'] = await ClientChartGenerator.generatePieChart({
          labels: outboundData.map(d => `${d.label} (${total ? ((d.value / total) * 100).toFixed(1) : '0.0'}%)`),
          datasets: [{
            label: 'Outbound Calls',
            data: outboundData.map(d => d.value),
            backgroundColor: outboundData.map(d => d.color),
          }]
        }, {
          plugins: {
            legend: { position: 'right' },
            title: { display: false }
          }
        });
      }

      // Generate inbound status pie chart
      const inboundData = [
        { label: 'Answered', value: inboundStatus.answered, color: '#10b981' },
        { label: 'No Answer', value: inboundStatus.noAnswer, color: '#ef4444' },
        { label: 'Busy', value: inboundStatus.busy, color: '#f59e0b' },
        { label: 'Congestion', value: inboundStatus.congestion, color: '#64748b' },
      ].filter(item => item.value > 0);

      if (inboundData.length > 0) {
        const total = inboundData.reduce((s, i) => s + i.value, 0);
        charts['inbound-status-pie'] = await ClientChartGenerator.generatePieChart({
          labels: inboundData.map(d => `${d.label} (${total ? ((d.value / total) * 100).toFixed(1) : '0.0'}%)`),
          datasets: [{
            label: 'Inbound Calls',
            data: inboundData.map(d => d.value),
            backgroundColor: inboundData.map(d => d.color),
          }]
        }, {
          plugins: {
            legend: { position: 'right' },
            title: { display: false }
          }
        });
      }

      // Generate comparison status pie chart
      const comparisonData = [
        { label: 'Answered', value: overallStatus.answered, color: '#10b981' },
        { label: 'No Answer', value: overallStatus.noAnswer, color: '#ef4444' },
        { label: 'Busy', value: overallStatus.busy, color: '#f59e0b' },
        { label: 'Congestion', value: overallStatus.congestion, color: '#64748b' },
      ].filter(item => item.value > 0);

      if (comparisonData.length > 0) {
        const total = comparisonData.reduce((s, i) => s + i.value, 0);
        charts['comparison-status-pie'] = await ClientChartGenerator.generatePieChart({
          labels: comparisonData.map(d => `${d.label} (${total ? ((d.value / total) * 100).toFixed(1) : '0.0'}%)`),
          datasets: [{
            label: 'All Calls',
            data: comparisonData.map(d => d.value),
            backgroundColor: comparisonData.map(d => d.color),
          }]
        }, {
          plugins: {
            legend: { position: 'right' },
            title: { display: false }
          }
        });
      }
    }

    if (reportData.reportType === 'agent-performance') {
      // Agent Performance bar chart
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

    return charts;
  };

  const handlePDFExport = async () => {
    setIsExporting(true);
    try {
      console.log('Starting PDF generation for:', reportData.reportType);
      console.log('Step 1: Generating charts client-side...');
      
      // Generate charts client-side
      const chartImages = await generateChartsForReport();
      console.log(`Generated ${Object.keys(chartImages).length} chart images`);
      
      console.log('Step 2: Calling server-side PDF generation API...');
      
      // Call server-side PDF generation API with pre-generated chart images
      const response = await fetch('/api/reports/generate-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reportType: reportData.reportType,
          startDate: reportData.dateRange.startDate,
          endDate: reportData.dateRange.endDate,
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
      const a = document.createElement('a');
      a.href = url;
      
      // Get filename from Content-Disposition header or create one
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `${getReportTitle(reportData.reportType).toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`;
      
      if (contentDisposition) {
        // Extract filename from Content-Disposition header
        const filenameMatch = contentDisposition.match(/filename="([^"]+)"/i);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1];
        } else {
          // Try without quotes
          const altMatch = contentDisposition.match(/filename=([^;]+)/i);
          if (altMatch && altMatch[1]) {
            filename = altMatch[1].trim();
          }
        }
      }
      
      // Remove any trailing underscores or special characters
      filename = filename.replace(/[_\s]+$/, '');
      
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      console.log('Server-side PDF export completed successfully');
    } catch (error: any) {
      console.error('PDF export failed:', error);
      alert(`Failed to export PDF: ${error.message}. Please try again.`);
    } finally {
      setIsExporting(false);
    }
  };

  const getReportTitle = (reportType: string) => {
    switch (reportType) {
      case 'call-summary': return 'Call Summary Report';
      case 'agent-performance': return 'Agent Performance Report';
      case 'campaign-analytics': return 'Campaign Analytics Report';
      default: return 'Report';
    }
  };

  const formatDuration = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '00:00:00';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const renderCallSummaryReport = () => {
    const { summary, data } = reportData;

    // Filter data based on active tab
    const getFilteredData = () => {
      if (activeTab === 'vs') {
        return { data, summary };
      }
      
      // Get all calls from data
      const allCalls = data.calls || [];
      
      // Filter calls by type
      const tabCalls = allCalls.filter((call: any) => call.type === activeTab);
      
      // Calculate summary for this tab
      const answeredCount = tabCalls.filter((c: any) => c.disposition === 'answered').length;
      const noAnswerCount = tabCalls.filter((c: any) => c.disposition === 'noAnswer').length;
      const busyCount = tabCalls.filter((c: any) => c.disposition === 'busy').length;
      const congestionCount = tabCalls.filter((c: any) => c.disposition === 'congestion').length;
      
      const tabSummary = {
        totalCalls: tabCalls.length,
        answeredCalls: answeredCount,
        noAnswerCalls: noAnswerCount,
        busyCalls: busyCount,
        congestionCalls: congestionCount,
        totalDuration: tabCalls.reduce((sum: number, c: any) => sum + (parseInt(c.durationSeconds) || 0), 0),
        totalConversationTime: tabCalls.reduce((sum: number, c: any) => sum + (parseInt(c.conversationSeconds) || 0), 0),
        avgDuration: tabCalls.length > 0 
          ? tabCalls.reduce((sum: number, c: any) => sum + (parseInt(c.durationSeconds) || 0), 0) / tabCalls.length 
          : 0,
        avgConversationTime: tabCalls.length > 0 
          ? tabCalls.reduce((sum: number, c: any) => sum + (parseInt(c.conversationSeconds) || 0), 0) / tabCalls.length 
          : 0,
        answerRate: tabCalls.length > 0 
          ? ((answeredCount / tabCalls.length) * 100).toFixed(2)
          : 0,
      };
      
      console.log(`[${activeTab}] Calculated counts:`, {
        total: tabCalls.length,
        answered: answeredCount,
        noAnswer: noAnswerCount,
        busy: busyCount,
        congestion: congestionCount
      });
      
      // Filter daily stats by type - ONLY show data for the selected tab
      const filteredDailyStats = data.dailyStats?.map((day: any) => {
        // For each day, only show data for the selected type
        const typePrefix = activeTab; // 'inbound' or 'outbound'
        return {
          date: day.date,
          total: day[typePrefix] || 0, // day.inbound or day.outbound
          answered: day[`${typePrefix}Answered`] || 0, // day.inboundAnswered or day.outboundAnswered
          noAnswer: day[`${typePrefix}NoAnswer`] || 0, // day.inboundNoAnswer or day.outboundNoAnswer
          // Only include the selected type, not both
          [activeTab]: day[typePrefix] || 0,
          duration: day[`${typePrefix}Duration`] || 0, // day.inboundDuration or day.outboundDuration
          conversationTime: day[`${typePrefix}ConversationTime`] || 0, // day.inboundConversationTime or day.outboundConversationTime
        };
      }) || [];

      return {
        data: {
          calls: tabCalls,
          dailyStats: filteredDailyStats,
        },
        summary: tabSummary,
      };
    };

    const filteredResult = getFilteredData();
    const displaySummary = filteredResult.summary;
    const displayData = filteredResult.data;

    // Debug logging
    if (activeTab !== 'vs') {
      console.log(`[${activeTab.toUpperCase()}] Summary:`, displaySummary);
      console.log(`[${activeTab.toUpperCase()}] Sample calls:`, displayData.calls?.slice(0, 5));
      console.log(`[${activeTab.toUpperCase()}] Daily stats sample:`, displayData.dailyStats?.slice(0, 3));
    }

    return (
      <div className="space-y-8">
        {/* Tabs */}
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('outbound')}
            className={`px-4 sm:px-6 py-3 text-sm font-medium transition-all duration-200 border-b-2 ${
              activeTab === 'outbound'
                ? 'border-orange-500 text-orange-600 bg-orange-50'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between gap-2 w-full">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 3h5m0 0v5m0-5l-6 6M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
                </svg>
                <span>Outbound</span>
              </div>
              <span className="badge badge-warning">{summary.outboundCalls || 0}</span>
            </div>
          </button>
          
          <button
            onClick={() => setActiveTab('inbound')}
            className={`px-4 sm:px-6 py-3 text-sm font-medium transition-all duration-200 border-b-2 ${
              activeTab === 'inbound'
                ? 'border-indigo-500 text-indigo-600 bg-indigo-50'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between gap-2 w-full">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                <span>Inbound</span>
              </div>
              <span className="badge badge-primary">{summary.inboundCalls || 0}</span>
            </div>
          </button>
          
          <button
            onClick={() => setActiveTab('vs')}
            className={`px-4 sm:px-6 py-3 text-sm font-medium transition-all duration-200 border-b-2 ${
              activeTab === 'vs'
                ? 'border-blue-500 text-blue-600 bg-blue-50'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between gap-2 w-full">
              <div className="flex items-center gap-2">
                <ArrowLeftRight className="w-4 h-4" />
                <span>Inbound vs Outbound</span>
              </div>
              <span className="badge badge-gray">{summary.totalCalls || 0}</span>
            </div>
          </button>
        </div>
        {/* Tab Content */}
        {activeTab !== 'vs' ? (
          // Outbound or Inbound Tab Content
          <>
            {/* Info Banner */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-blue-800">
                  Viewing <strong>{activeTab === 'outbound' ? 'Outbound' : 'Inbound'}</strong> calls only. 
                  Total: <strong>{displaySummary.totalCalls?.toLocaleString()}</strong> calls
                  {' '}({displaySummary.answeredCalls} answered, {displaySummary.noAnswerCalls} not answered)
                </p>
              </div>
            </div>

            {/* Summary for Selected Tab */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              <div className="card">
                <div className="card-body">
                  <div className="flex items-center">
                    <div className={`p-3 rounded-lg ${activeTab === 'outbound' ? 'bg-orange-100' : 'bg-indigo-100'}`}>
                      {activeTab === 'outbound' ? (
                        <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 3h5m0 0v5m0-5l-6 6M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
                        </svg>
                      ) : (
                        <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                      )}
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">{activeTab === 'outbound' ? 'Outbound' : 'Inbound'} Calls</p>
                      <p className="text-2xl font-bold text-gray-900">{displaySummary.totalCalls?.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="card">
                <div className="card-body">
                  <div className="flex items-center">
                    <div className="p-3 bg-green-100 rounded-lg">
                      <CheckCircle className="w-6 h-6 text-green-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Answered</p>
                      <p className="text-2xl font-bold text-gray-900">{displaySummary.answeredCalls?.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="card">
                <div className="card-body">
                  <div className="flex items-center">
                    <div className="p-3 bg-red-100 rounded-lg">
                      <XCircle className="w-6 h-6 text-red-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">No Answer</p>
                      <p className="text-2xl font-bold text-gray-900">{displaySummary.noAnswerCalls?.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="card">
                <div className="card-body">
                  <div className="flex items-center">
                    <div className="p-3 bg-purple-100 rounded-lg">
                      <Clock className="w-6 h-6 text-purple-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Avg Duration</p>
                      <p className="text-2xl font-bold text-gray-900">{formatDuration(displaySummary.avgDuration || 0)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Charts for Single Type */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
              <div className="card">
                <div className="card-header">
                  <h3 className="text-lg font-semibold text-gray-900">Daily {activeTab === 'outbound' ? 'Outbound' : 'Inbound'} Call Volume</h3>
                  {displayData.dailyStats && displayData.dailyStats.length > 7 && (
                    <p className="text-sm text-gray-500 mt-1">Showing last 7 days of data</p>
                  )}
                </div>
                <div className="card-body">
                  <ResponsiveContainer width="100%" height={360}>
                    <BarChart data={(displayData.dailyStats || []).slice(-7)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="date" 
                        stroke="#64748b" 
                        fontSize={10}
                        tick={{ fontSize: 10 }}
                        angle={-45}
                        textAnchor="end"
                        height={100}
                        interval={0}
                        tickCount={7}
                        tickFormatter={(value) => {
                          // Convert YYYY-MM-DD to DD/MM format
                          const date = new Date(value);
                          return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}`;
                        }}
                      />
                      <YAxis stroke="#64748b" />
                      <Tooltip 
                        contentStyle={{
                          backgroundColor: 'white',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                        }}
                      />
                      <Legend />
                      <Bar 
                        dataKey="total" 
                        fill={activeTab === 'outbound' ? '#f97316' : '#6366f1'} 
                        name="Total Calls" 
                        radius={[4, 4, 0, 0]} 
                      />
                      <Bar 
                        dataKey="answered" 
                        fill="#10b981" 
                        name="Answered" 
                        radius={[4, 4, 0, 0]} 
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <h3 className="text-lg font-semibold text-gray-900">Call Status Distribution</h3>
                </div>
                <div className="card-body">
                  <ResponsiveContainer width="100%" height={350}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Answered', value: displaySummary.answeredCalls || 0 },
                          { name: 'No Answer', value: displaySummary.noAnswerCalls || 0 },
                          { name: 'Busy', value: displaySummary.busyCalls || 0 },
                          { name: 'Congestion', value: displaySummary.congestionCalls || 0 },
                        ].filter(item => item.value > 0)}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={false}
                        outerRadius={60}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {[
                          { name: 'Answered', value: displaySummary.answeredCalls || 0 },
                          { name: 'No Answer', value: displaySummary.noAnswerCalls || 0 },
                          { name: 'Busy', value: displaySummary.busyCalls || 0 },
                          { name: 'Congestion', value: displaySummary.congestionCalls || 0 },
                        ].filter(item => item.value > 0).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.name] || COLORS[index]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{
                          backgroundColor: 'white',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                        }}
                        formatter={(value: any, name: any, props: any) => [
                          `${value} (${((value / displaySummary.totalCalls) * 100).toFixed(1)}%)`,
                          name
                        ]}
                      />
                      <Legend 
                        verticalAlign="bottom" 
                        height={80}
                        wrapperStyle={{ fontSize: '11px', paddingTop: '15px' }}
                        layout="horizontal"
                        formatter={(value, entry: any) => {
                          const percent = ((entry.payload.value / displaySummary.totalCalls) * 100).toFixed(1);
                          return `${value}: ${entry.payload.value} (${percent}%)`;
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Lead Status Breakdown Table */}
              <div className="card">
                <div className="card-header">
                  <h3 className="text-lg font-semibold text-gray-900">Lead Status Breakdown</h3>
                </div>
                <div className="card-body">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Count
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Percentage
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {(() => {
                          // Use lead status breakdown from data
                          if (!data.leadStatusBreakdown || data.leadStatusBreakdown.length === 0) {
                            return (
                              <tr>
                                <td colSpan={3} className="px-6 py-4 text-center text-sm text-gray-500">
                                  No lead status data available
                                </td>
                              </tr>
                            );
                          }
                          
                          const totalLeads = data.leadStatusBreakdown.reduce((sum: number, item: any) => sum + item.count, 0);
                          
                          return data.leadStatusBreakdown.map((item: any, index: number) => {
                            const percentage = totalLeads > 0 ? ((item.count / totalLeads) * 100).toFixed(1) : '0.0';
                            return (
                              <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 capitalize">
                                  {item.status.replace(/([A-Z])/g, ' $1').trim()}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {item.count.toLocaleString()}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {percentage}%
                                </td>
                              </tr>
                            );
                          });
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          // VS Tab Content (Comparison View)
          <>
            {/* Overall Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="card">
                <div className="card-body">
                  <div className="flex items-center">
                    <div className="p-3 bg-blue-100 rounded-lg">
                      <Phone className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Total Calls</p>
                      <p className="text-2xl font-bold text-gray-900">{summary.totalCalls?.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="card">
                <div className="card-body">
                  <div className="flex items-center">
                    <div className="p-3 bg-green-100 rounded-lg">
                      <CheckCircle className="w-6 h-6 text-green-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Answered</p>
                      <p className="text-2xl font-bold text-gray-900">{summary.answeredCalls?.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="card">
                <div className="card-body">
                  <div className="flex items-center">
                    <div className="p-3 bg-red-100 rounded-lg">
                      <XCircle className="w-6 h-6 text-red-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">No Answer</p>
                      <p className="text-2xl font-bold text-gray-900">{summary.noAnswerCalls?.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="card">
                <div className="card-body">
                  <div className="flex items-center">
                    <div className="p-3 bg-purple-100 rounded-lg">
                      <Clock className="w-6 h-6 text-purple-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Avg Duration</p>
                      <p className="text-2xl font-bold text-gray-900">{formatDuration(summary.avgDuration || 0)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

        {/* Inbound vs Outbound Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Inbound Calls */}
          <div className="card">
            <div className="card-header">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-indigo-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                <h3 className="text-lg font-semibold text-gray-900">Inbound Calls</h3>
              </div>
            </div>
            <div className="card-body">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Total Inbound</span>
                  <span className="text-2xl font-bold text-indigo-600">{summary.inboundCalls?.toLocaleString() || 0}</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                    style={{ width: `${summary.totalCalls ? (summary.inboundCalls / summary.totalCalls * 100) : 0}%` }}
                  ></div>
                </div>
                <p className="text-sm text-gray-500">
                  {summary.totalCalls ? ((summary.inboundCalls / summary.totalCalls * 100).toFixed(1)) : 0}% of total calls
                </p>
              </div>
            </div>
          </div>

          {/* Outbound Calls */}
          <div className="card">
            <div className="card-header">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-orange-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 3h5m0 0v5m0-5l-6 6M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
                </svg>
                <h3 className="text-lg font-semibold text-gray-900">Outbound Calls</h3>
              </div>
            </div>
            <div className="card-body">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Total Outbound</span>
                  <span className="text-2xl font-bold text-orange-600">{summary.outboundCalls?.toLocaleString() || 0}</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-orange-600 rounded-full transition-all duration-300"
                    style={{ width: `${summary.totalCalls ? (summary.outboundCalls / summary.totalCalls * 100) : 0}%` }}
                  ></div>
                </div>
                <p className="text-sm text-gray-500">
                  {summary.totalCalls ? ((summary.outboundCalls / summary.totalCalls * 100).toFixed(1)) : 0}% of total calls
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Inbound vs Outbound Comparison Chart */}
        <div className="card">
          <div className="card-header">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Inbound vs Outbound - Daily Comparison</h3>
                {data.dailyStats && data.dailyStats.length > 7 && (
                  <p className="text-sm text-gray-500 mt-1">Showing last 7 days of data</p>
                )}
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-indigo-600 rounded"></div>
                  <span className="text-gray-600">Inbound</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-orange-600 rounded"></div>
                  <span className="text-gray-600">Outbound</span>
                </div>
              </div>
            </div>
          </div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={(data.dailyStats || []).filter((day: any) => (day.inbound + day.outbound) > 0).slice(-7)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                />
                <Legend />
                <Bar dataKey="inbound" fill="#6366f1" name="Inbound" radius={[4, 4, 0, 0]} />
                <Bar dataKey="outbound" fill="#f97316" name="Outbound" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Additional Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-semibold text-gray-900">Daily Call Volume with Status</h3>
              {data.dailyStats && data.dailyStats.length > 7 && (
                <p className="text-sm text-gray-500 mt-1">Showing last 7 days of data</p>
              )}
            </div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={(data.dailyStats || []).filter((day: any) => day.total > 0).slice(-7)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" stroke="#64748b" />
                  <YAxis stroke="#64748b" />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}
                  />
                  <Legend />
                  <Bar dataKey="answered" fill="#10b981" name="Answered" radius={[4, 4, 0, 0]} stackId="a" />
                  <Bar dataKey="noAnswer" fill="#ef4444" name="No Answer" radius={[4, 4, 0, 0]} stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-semibold text-gray-900">Call Status Distribution</h3>
            </div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={350}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Answered', value: summary.answeredCalls },
                      { name: 'No Answer', value: summary.noAnswerCalls },
                      { name: 'Busy', value: summary.busyCalls },
                      { name: 'Congestion', value: summary.congestionCalls },
                    ].filter(item => item.value > 0)}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={false}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {[
                      { name: 'Answered', value: summary.answeredCalls },
                      { name: 'No Answer', value: summary.noAnswerCalls },
                      { name: 'Busy', value: summary.busyCalls },
                      { name: 'Congestion', value: summary.congestionCalls },
                    ].filter(item => item.value > 0).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.name] || COLORS[index]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}
                    formatter={(value: any, name: any, props: any) => [
                      `${value} (${((value / summary.totalCalls) * 100).toFixed(1)}%)`,
                      name
                    ]}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={80}
                    wrapperStyle={{ fontSize: '11px', paddingTop: '15px' }}
                    formatter={(value, entry: any) => {
                      const percent = ((entry.payload.value / summary.totalCalls) * 100).toFixed(1);
                      return `${value}: ${entry.payload.value} (${percent}%)`;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
          </>
        )}
      </div>
    );
  };

  const renderAgentPerformanceReport = () => {
    const { data, summary } = reportData;

    return (
      <div className="space-y-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <div className="card">
            <div className="card-body">
              <div className="flex items-center">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Agents</p>
                  <p className="text-2xl font-bold text-gray-900">{summary.totalAgents}</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="card">
            <div className="card-body">
              <div className="flex items-center">
                <div className="p-3 bg-green-100 rounded-lg">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Active Agents</p>
                  <p className="text-2xl font-bold text-gray-900">{summary.activeAgents}</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="card">
            <div className="card-body">
              <div className="flex items-center">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <Phone className="w-6 h-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Calls</p>
                  <p className="text-2xl font-bold text-gray-900">{summary.totalCalls?.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="card">
            <div className="card-body">
              <div className="flex items-center">
                <div className="p-3 bg-indigo-100 rounded-lg">
                  <Target className="w-6 h-6 text-indigo-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Leads</p>
                  <p className="text-2xl font-bold text-gray-900">{summary.totalLeads?.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Top Agents Classification */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-gray-900">🏆 Top Agents by Efficiency</h3>
            <p className="text-sm text-gray-600 mt-1">Best performers by conversion rate (converted leads / total calls), with efficiency tiebreaker (minimum 5 calls, must have conversions)</p>
          </div>
          <div className="card-body">
            {(() => {
              // Filter agents with minimum 5 calls, conversions, and exclude system user
              const topAgents = data.agentPerformance
                .filter((agent: any) => 
                  agent.totalCalls >= 5 && 
                  agent.convertedLeads > 0 && 
                  agent.agentId !== 0 // Exclude system user
                )
                .sort((a: any, b: any) => {
                  const aConversionRate = parseFloat(a.conversionRate || '0');
                  const bConversionRate = parseFloat(b.conversionRate || '0');
                  
                  // First priority: Higher conversion rate
                  if (aConversionRate !== bConversionRate) {
                    return bConversionRate - aConversionRate;
                  }
                  
                  // Second priority: If conversion rates are equal, prefer agent with fewer calls
                  // This shows efficiency - achieving same conversions with fewer attempts
                  const aCalls = a.totalCalls || 0;
                  const bCalls = b.totalCalls || 0;
                  return aCalls - bCalls;
                })
                .slice(0, 5); // Top 5 agents

              if (topAgents.length === 0) {
                return (
                  <div className="text-center py-8">
                    <div className="text-gray-500">
                      <Target className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No agents with sufficient calls and conversions for ranking</p>
                      <p className="text-sm">Minimum 5 calls and conversions required</p>
                    </div>
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
                  {topAgents.map((agent: any, index: number) => {
                    const rank = index + 1;
                    const isTopPerformer = rank <= 3;
                    const medalColors = {
                      1: 'bg-gradient-to-br from-yellow-400 to-yellow-500 text-white',
                      2: 'bg-gradient-to-br from-gray-400 to-gray-500 text-white', 
                      3: 'bg-gradient-to-br from-orange-400 to-orange-500 text-white',
                      default: 'bg-gradient-to-br from-blue-400 to-blue-500 text-white'
                    };
                    
                    const medalColor = medalColors[rank as keyof typeof medalColors] || medalColors.default;
                    
                    return (
                      <div key={agent.agentId} className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 hover:shadow-lg hover:border-gray-300 transition-all duration-200">
                        {/* Header with rank and name */}
                        <div className="flex items-center justify-between mb-3 sm:mb-4">
                          <div className="flex items-center space-x-2 sm:space-x-3">
                            <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold ${medalColor}`}>
                              {rank}
                            </div>
                            <div>
                              <h4 className="font-semibold text-gray-900 text-sm sm:text-lg">{agent.agentName}</h4>
                            </div>
                          </div>
                          {isTopPerformer && (
                            <div className="text-lg sm:text-2xl">🏆</div>
                          )}
                        </div>
                        
                        {/* Main conversion metric */}
                        <div className="text-center mb-3 sm:mb-4">
                          <div className="text-2xl sm:text-4xl font-bold text-green-600 mb-1">
                            {agent.conversionRate}%
                          </div>
                          <div className="text-xs sm:text-sm text-gray-600">Conversion Rate</div>
                        </div>
                        
                        {/* Key metrics in clean layout */}
                        <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-3 sm:mb-4">
                          <div className="text-center">
                            <div className="text-sm sm:text-lg font-semibold text-green-600">{agent.convertedLeads?.toLocaleString()}</div>
                            <div className="text-xs text-gray-500">Converted</div>
                          </div>
                          <div className="text-center">
                            <div className="text-sm sm:text-lg font-semibold text-blue-600">{agent.totalCalls?.toLocaleString()}</div>
                            <div className="text-xs text-gray-500">Calls</div>
                          </div>
                        </div>
                        
                        {/* Efficiency indicator */}
                        <div className="text-center">
                          <div className="text-xs sm:text-sm font-medium text-gray-700">
                            {agent.totalCalls > 0 ? 
                              `${(agent.totalCalls / agent.convertedLeads).toFixed(1)} calls per conversion` : 
                              'No conversions'
                            }
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>

        {/* Agent Performance Table */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-gray-900">Agent Performance Details</h3>
          </div>
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <div className="min-w-full px-4 sm:px-0">
              <table className="table w-full">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Agent</th>
                  <th>Total Calls</th>
                  <th>Inbound</th>
                  <th>Outbound</th>
                  <th>Answered</th>
                  <th>Missed</th>
                  <th>Total Talk Time</th>
                  <th>Avg Duration</th>
                  <th>Avg Talk Time</th>
                  <th>Answer Rate</th>
                  <th>Total Leads</th>
                  <th>Converted</th>
                  <th>Conversion Rate</th>
                </tr>
              </thead>
              <tbody>
                {data.agentPerformance.map((agent: any, index: number) => {
                  // Calculate rank based on efficiency (conversion rate + call efficiency)
                  const agentsWithCalls = data.agentPerformance.filter((a: any) => 
                    a.totalCalls >= 5 && 
                    a.convertedLeads > 0 && 
                    a.agentId !== 0 // Exclude system user
                  );
                  const sortedByEfficiency = agentsWithCalls.sort((a: any, b: any) => {
                    const aConversionRate = parseFloat(a.conversionRate || '0');
                    const bConversionRate = parseFloat(b.conversionRate || '0');
                    
                    // First priority: Higher conversion rate
                    if (aConversionRate !== bConversionRate) {
                      return bConversionRate - aConversionRate;
                    }
                    
                    // Second priority: If conversion rates are equal, prefer agent with fewer calls
                    const aCalls = a.totalCalls || 0;
                    const bCalls = b.totalCalls || 0;
                    return aCalls - bCalls;
                  });
                  const rank = (agent.totalCalls >= 5 && agent.convertedLeads > 0 && agent.agentId !== 0) 
                    ? sortedByEfficiency.findIndex((a: any) => a.agentId === agent.agentId) + 1 
                    : null;
                  
                  const isTopPerformer = rank && rank <= 3;
                  
                  return (
                    <tr key={agent.agentId} className={isTopPerformer ? 'bg-yellow-50' : ''}>
                      <td>
                        {rank ? (
                          <div className="flex items-center space-x-2">
                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                              rank === 1 ? 'bg-yellow-100 text-yellow-800' :
                              rank === 2 ? 'bg-gray-100 text-gray-800' :
                              rank === 3 ? 'bg-orange-100 text-orange-800' :
                              'bg-blue-100 text-blue-800'
                            }`}>
                              #{rank}
                            </span>
                            {isTopPerformer && <span className="text-yellow-500">🏆</span>}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">-</span>
                        )}
                      </td>
                      <td>
                        <div className="font-medium text-gray-900">{agent.agentName}</div>
                      </td>
                    <td className="font-medium">{agent.totalCalls}</td>
                    <td>
                      <span className="badge badge-primary">{agent.inboundCalls || 0}</span>
                    </td>
                    <td>
                      <span className="badge badge-warning">{agent.outboundCalls || 0}</span>
                    </td>
                    <td>
                      <span className="badge badge-success">{agent.answeredCalls}</span>
                    </td>
                    <td>
                      <span className="badge badge-danger">{agent.missedCalls}</span>
                    </td>
                    <td className="font-medium text-blue-600">{formatDuration(agent.totalTalkTime || agent.totalConversationTime)}</td>
                    <td>{formatDuration(agent.avgDuration)}</td>
                    <td>{formatDuration(agent.avgTalkTime || agent.avgConversationTime)}</td>
                    <td>
                      <span className={`badge ${
                        parseFloat(agent.answerRate) >= 70 ? 'badge-success' : 
                        parseFloat(agent.answerRate) >= 50 ? 'badge-warning' : 'badge-danger'
                      }`}>
                        {agent.answerRate}%
                      </span>
                    </td>
                    <td>{agent.totalLeads?.toLocaleString() || 0}</td>
                    <td>
                      <span className="badge badge-success">{agent.convertedLeads?.toLocaleString() || 0}</span>
                    </td>
                    <td>
                      <span className={`font-medium ${
                        parseFloat(agent.conversionRate || '0') > 10 
                          ? 'text-green-600' 
                          : parseFloat(agent.conversionRate || '0') > 5 
                            ? 'text-yellow-600' 
                            : 'text-red-600'
                      }`}>
                        {agent.conversionRate || '0'}%
                      </span>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>
        </div>

        {/* Performance Chart */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-gray-900">Agent Performance Comparison</h3>
          </div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={data.agentPerformance.slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis 
                  dataKey="agentName" 
                  angle={-45} 
                  textAnchor="end" 
                  height={100} 
                  stroke="#64748b" 
                  fontSize={10}
                  tick={{ fontSize: 10 }}
                  tickFormatter={(value) => {
                    // Truncate long agent names
                    return value.length > 12 ? value.substring(0, 12) + '...' : value;
                  }}
                />
                <YAxis stroke="#64748b" />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                />
                <Legend />
                <Bar dataKey="answeredCalls" fill="#10b981" name="Answered Calls" radius={[4, 4, 0, 0]} />
                <Bar dataKey="missedCalls" fill="#ef4444" name="Missed Calls" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    );
  };

  const renderCampaignAnalyticsReport = () => {
    const { data, summary } = reportData;

    return (
      <div className="space-y-8">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6">
              <div className="card">
                <div className="card-body">
                  <div className="flex items-center">
                    <div className="p-3 bg-blue-100 rounded-lg">
                      <Target className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Total Campaigns</p>
                      <p className="text-2xl font-bold text-gray-900">{summary.totalCampaigns}</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="card">
                <div className="card-body">
                  <div className="flex items-center">
                    <div className="p-3 bg-green-100 rounded-lg">
                      <CheckCircle className="w-6 h-6 text-green-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Active Campaigns</p>
                      <p className="text-2xl font-bold text-gray-900">{summary.activeCampaigns}</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="card">
                <div className="card-body">
                  <div className="flex items-center">
                    <div className="p-3 bg-purple-100 rounded-lg">
                      <Phone className="w-6 h-6 text-purple-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Total Calls</p>
                      <p className="text-2xl font-bold text-gray-900">{summary.totalCalls?.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="card">
                <div className="card-body">
                  <div className="flex items-center">
                    <div className="p-3 bg-indigo-100 rounded-lg">
                      <Users className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Total Leads</p>
                      <p className="text-2xl font-bold text-gray-900">{summary.totalLeads?.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="card">
                <div className="card-body">
                  <div className="flex items-center">
                    <div className="p-3 bg-orange-100 rounded-lg">
                      <Clock className="w-6 h-6 text-orange-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Total Duration</p>
                      <p className="text-2xl font-bold text-gray-900">{formatDuration(summary.totalDuration || 0)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Campaign Performance Table */}
            <div className="card">
              <div className="card-header">
                <h3 className="text-lg font-semibold text-gray-900">Campaign Performance Details</h3>
              </div>
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <div className="min-w-full px-4 sm:px-0">
                  <table className="table w-full">
                  <thead>
                    <tr>
                      <th>Campaign</th>
                      <th>Status</th>
                      <th>Total Calls</th>
                      <th>Inbound</th>
                      <th>Outbound</th>
                      <th>Answered</th>
                      <th>Missed</th>
                      <th>Busy</th>
                      <th>Congestion</th>
                      <th>Total Talk Time</th>
                      <th>Avg Duration</th>
                      <th>Answer Rate</th>
                      <th>Total Leads</th>
                      <th>Converted</th>
                      <th>Conversion Rate</th>
                      <th>Unique Callers</th>
                      <th>Unique Destinations</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.campaignAnalytics?.map((campaign: any) => (
                      <tr key={campaign.campaignId}>
                        <td className="font-medium text-gray-900">{campaign.campaignName}</td>
                        <td>
                          <span className={`badge ${
                            campaign.status === 'active' ? 'badge-success' : 'badge-gray'
                          }`}>
                            {campaign.status}
                          </span>
                        </td>
                        <td>{campaign.totalCalls?.toLocaleString()}</td>
                        <td>{campaign.inboundCalls?.toLocaleString()}</td>
                        <td>{campaign.outboundCalls?.toLocaleString()}</td>
                        <td>
                          <span className="badge badge-success">{campaign.answeredCalls?.toLocaleString()}</span>
                        </td>
                        <td>{campaign.missedCalls?.toLocaleString()}</td>
                        <td>{campaign.busyCalls?.toLocaleString()}</td>
                        <td>{campaign.congestionCalls?.toLocaleString()}</td>
                        <td>{formatDuration(campaign.totalTalkTime || 0)}</td>
                        <td>{formatDuration(campaign.avgDuration || 0)}</td>
                        <td>{campaign.answerRate}%</td>
                        <td>{campaign.totalLeads?.toLocaleString()}</td>
                        <td>
                          <span className="badge badge-success">{campaign.convertedLeads?.toLocaleString()}</span>
                        </td>
                        <td>
                          <span className={`font-medium ${
                            parseFloat(campaign.conversionRate || '0') > 10 
                              ? 'text-green-600' 
                              : parseFloat(campaign.conversionRate || '0') > 5 
                                ? 'text-yellow-600' 
                                : 'text-red-600'
                          }`}>
                            {campaign.conversionRate}%
                          </span>
                        </td>
                        <td>{campaign.uniqueCallersCount?.toLocaleString()}</td>
                        <td>{campaign.uniqueDestinationsCount?.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            </div>

        {/* Campaign Performance Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-semibold text-gray-900">Calls by Campaign</h3>
            </div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={data.campaignAnalytics?.filter((c: any) => c.totalCalls > 0) || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="campaignName" 
                    stroke="#64748b"
                    angle={-45}
                    textAnchor="end"
                    height={100}
                    fontSize={10}
                    tick={{ fontSize: 10 }}
                    tickFormatter={(value) => {
                      // Truncate long campaign names
                      return value.length > 15 ? value.substring(0, 15) + '...' : value;
                    }}
                  />
                  <YAxis stroke="#64748b" />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}
                  />
                  <Legend />
                  <Bar dataKey="totalCalls" fill="#3b82f6" name="Total Calls" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="answeredCalls" fill="#10b981" name="Answered" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-semibold text-gray-900">Lead Conversion Rate by Campaign</h3>
            </div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={data.campaignAnalytics?.filter((c: any) => c.totalLeads > 0) || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="campaignName" 
                    stroke="#64748b"
                    angle={-45}
                    textAnchor="end"
                    height={100}
                    fontSize={10}
                    tick={{ fontSize: 10 }}
                    tickFormatter={(value) => {
                      // Truncate long campaign names
                      return value.length > 15 ? value.substring(0, 15) + '...' : value;
                    }}
                  />
                  <YAxis stroke="#64748b" />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}
                    formatter={(value: any) => [`${value}%`, 'Conversion Rate']}
                  />
                  <Bar dataKey="conversionRate" fill="#10b981" name="Conversion Rate %" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Lead Conversion Chart */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-gray-900">Leads vs Conversions by Campaign</h3>
          </div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={data.campaignAnalytics?.filter((c: any) => c.totalLeads > 0) || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis 
                  dataKey="campaignName" 
                  stroke="#64748b"
                  angle={-45}
                  textAnchor="end"
                  height={100}
                  fontSize={10}
                  tick={{ fontSize: 10 }}
                  tickFormatter={(value) => {
                    // Truncate long campaign names
                    return value.length > 15 ? value.substring(0, 15) + '...' : value;
                  }}
                />
                <YAxis stroke="#64748b" />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                />
                <Legend />
                <Bar dataKey="totalLeads" fill="#6366f1" name="Total Leads" radius={[4, 4, 0, 0]} />
                <Bar dataKey="convertedLeads" fill="#10b981" name="Converted" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    );
  };



  return (
    <div id="report-content" className="space-y-6 sm:space-y-8 px-4 sm:px-6 lg:px-8">
      {/* Report Header */}
      <div className="card">
        <div className="card-header">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-4 sm:space-y-0">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900">{getReportTitle(reportData.reportType)}</h2>
              <p className="text-sm text-gray-600 mt-1">
                Generated for {reportData.dateRange.startDate} to {reportData.dateRange.endDate}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Generated at {new Date(reportData.generatedAt).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Report Content */}
      {reportData.reportType === 'call-summary' && renderCallSummaryReport()}
      {reportData.reportType === 'agent-performance' && renderAgentPerformanceReport()}
      {reportData.reportType === 'campaign-analytics' && renderCampaignAnalyticsReport()}
    </div>
  );
}