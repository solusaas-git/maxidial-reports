import PDFDocument from 'pdfkit';
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import { format } from 'date-fns';
import { ReportData } from './report-generator';
import path from 'path';
import fs from 'fs';

interface PDFGeneratorOptions {
  title?: string;
  dateRange?: {
    startDate: string;
    endDate: string;
  };
}

export class ServerPDFGenerator {
  private doc: PDFKit.PDFDocument;
  private chartGenerator: ChartJSNodeCanvas;
  private pageMargin = 50;
  private pageWidth = 595.28; // A4 width in points
  private pageHeight = 841.89; // A4 height in points
  private contentWidth: number;
  private currentY: number;
  
  // Color palette
  private colors = {
    primary: '#3b82f6',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    info: '#06b6d4',
    purple: '#8b5cf6',
    indigo: '#6366f1',
    orange: '#f97316',
    gray: '#64748b',
    lightGray: '#f1f5f9',
    darkGray: '#1e293b',
    white: '#ffffff',
  };

  constructor() {
    // Configure font path for both Vercel and local environments
    // On Vercel, fonts are copied to /tmp/data by the API route
    const possibleFontPaths = [
      path.join('/tmp', 'data'), // Vercel - fonts copied here by API route
      path.join(process.cwd(), 'public', 'fonts'), // Vercel fallback
      path.join(process.cwd(), 'node_modules', 'pdfkit', 'js', 'data'), // Local dev
      path.join(__dirname, '..', '..', 'public', 'fonts'), // Alternative path
    ];
    
    // Find and set the first valid font path
    for (const fontPath of possibleFontPaths) {
      if (fs.existsSync(fontPath)) {
        const helveticaPath = path.join(fontPath, 'Helvetica.afm');
        if (fs.existsSync(helveticaPath)) {
          console.log(`[PDF Generator] Using font path: ${fontPath}`);
          // Change working directory so PDFKit can find fonts in ./data
          try {
            const dataDir = path.dirname(fontPath);
            if (process.cwd() !== dataDir) {
              // PDFKit looks for data/ relative to cwd, so we create a symlink or copy
              const targetDataPath = path.join(process.cwd(), 'data');
              if (!fs.existsSync(targetDataPath)) {
                fs.symlinkSync(fontPath, targetDataPath, 'dir');
                console.log(`[PDF Generator] Created symlink: ${targetDataPath} -> ${fontPath}`);
              }
            }
          } catch (symlinkError) {
            // Symlink failed, try copying
            try {
              const targetDataPath = path.join(process.cwd(), 'data');
              if (!fs.existsSync(targetDataPath)) {
                fs.mkdirSync(targetDataPath, { recursive: true });
                const files = fs.readdirSync(fontPath);
                files.forEach(file => {
                  fs.copyFileSync(path.join(fontPath, file), path.join(targetDataPath, file));
                });
                console.log(`[PDF Generator] Copied fonts to: ${targetDataPath}`);
              }
            } catch (copyError) {
              console.error('[PDF Generator] Failed to setup fonts:', copyError);
            }
          }
          break;
        }
      }
    }
    
    this.doc = new PDFDocument({ 
      size: 'A4',
      margins: { 
        top: this.pageMargin, 
        bottom: this.pageMargin, 
        left: this.pageMargin, 
        right: this.pageMargin 
      },
      bufferPages: true,
      autoFirstPage: true
    });
    this.contentWidth = this.pageWidth - (this.pageMargin * 2);
    this.currentY = this.pageMargin;
    
    // Initialize chart generator with better aspect ratio
    this.chartGenerator = new ChartJSNodeCanvas({ 
      width: 800, 
      height: 300, // Reduced from 400 for more compact charts
      backgroundColour: 'white'
    });
  }

  /**
   * Generate PDF for any report type
   */
  async generatePDF(reportData: ReportData, options: PDFGeneratorOptions = {}): Promise<PDFKit.PDFDocument> {
    // Add header to first page
    this.addHeader(reportData, options);
    
    // Generate report based on type
    switch (reportData.reportType) {
      case 'call-summary':
        await this.generateCallSummaryPDF(reportData);
        break;
      case 'agent-performance':
        await this.generateAgentPerformancePDF(reportData);
        break;
      case 'campaign-analytics':
        await this.generateCampaignAnalyticsPDF(reportData);
        break;
      default:
        throw new Error(`Unknown report type: ${reportData.reportType}`);
    }
    
    // Add page numbers
    this.addPageNumbers();
    
    return this.doc;
  }

  /**
   * Add header to the document
   */
  private addHeader(reportData: ReportData, options: PDFGeneratorOptions) {
    const title = options.title || this.getReportTitle(reportData.reportType);
    
    // Logo and App Name
    const logoPath = path.join(process.cwd(), 'public', 'logos', 'logo_maxidial.png');
    const logoSize = 40;
    
    try {
      if (fs.existsSync(logoPath)) {
        // Draw logo
        this.doc.image(logoPath, this.pageMargin, this.currentY, {
          width: logoSize,
          height: logoSize
        });
        
        // App name next to logo
        this.doc
          .fontSize(20)
          .fillColor(this.colors.primary)
          .font('Helvetica-Bold')
          .text('Maxi Dial Reports', this.pageMargin + logoSize + 15, this.currentY + 10, {
            width: this.contentWidth - logoSize - 15
          });
      } else {
        // Fallback if logo doesn't exist - just show app name
        this.doc
          .fontSize(20)
          .fillColor(this.colors.primary)
          .font('Helvetica-Bold')
          .text('Maxi Dial Reports', this.pageMargin, this.currentY, {
            width: this.contentWidth
          });
      }
    } catch (error) {
      console.warn('Failed to load logo, using text only');
      // Fallback to text only
      this.doc
        .fontSize(20)
        .fillColor(this.colors.primary)
        .font('Helvetica-Bold')
        .text('Maxi Dial Reports', this.pageMargin, this.currentY, {
          width: this.contentWidth
        });
    }
    
    this.currentY += logoSize + 20;
    
    // Report Title
    this.doc
      .fontSize(24)
      .fillColor(this.colors.darkGray)
      .font('Helvetica-Bold')
      .text(title, this.pageMargin, this.currentY, { 
        width: this.contentWidth,
        align: 'left'
      });
    
    this.currentY += 35;
    
    // Date range
    this.doc
      .fontSize(12)
      .fillColor(this.colors.gray)
      .font('Helvetica')
      .text(
        `Report Period: ${this.formatDate(reportData.dateRange.startDate)} to ${this.formatDate(reportData.dateRange.endDate)}`,
        this.pageMargin,
        this.currentY
      );
    
    this.currentY += 18;
    
    // Generated timestamp
    this.doc
      .fontSize(10)
      .fillColor(this.colors.gray)
      .text(
        `Generated: ${new Date(reportData.generatedAt).toLocaleString()}`,
        this.pageMargin,
        this.currentY
      );
    
    this.currentY += 30;
    
    // Horizontal line
    this.doc
      .strokeColor(this.colors.lightGray)
      .lineWidth(1)
      .moveTo(this.pageMargin, this.currentY)
      .lineTo(this.pageWidth - this.pageMargin, this.currentY)
      .stroke();
    
    this.currentY += 30;
  }

  /**
   * Generate Call Summary PDF
   */
  private async generateCallSummaryPDF(reportData: ReportData) {
    const { summary, data } = reportData;
    
    // Page 1: Outbound Calls
    await this.generateOutboundPage(reportData);
    
    // Page 2: Inbound Calls
    this.addPage();
    await this.generateInboundPage(reportData);
    
    // Page 3: VS (Comparison)
    this.addPage();
    await this.generateComparisonPage(reportData);
  }

  /**
   * Generate Outbound page
   */
  private async generateOutboundPage(reportData: ReportData) {
    const { summary, data } = reportData;
    
    // Filter outbound data
    const allCalls = data.calls || [];
    const outboundCalls = allCalls.filter((call: any) => call.type === 'outbound');
    
    // Calculate outbound summary
    const outboundSummary = {
      totalCalls: outboundCalls.length,
      answeredCalls: outboundCalls.filter((c: any) => c.disposition === 'answered').length,
      noAnswerCalls: outboundCalls.filter((c: any) => c.disposition === 'noAnswer').length,
      busyCalls: outboundCalls.filter((c: any) => c.disposition === 'busy').length,
      congestionCalls: outboundCalls.filter((c: any) => c.disposition === 'congestion').length,
      totalDuration: outboundCalls.reduce((sum: number, c: any) => sum + (parseInt(c.durationSeconds) || 0), 0),
      totalConversationTime: outboundCalls.reduce((sum: number, c: any) => sum + (parseInt(c.conversationSeconds) || 0), 0),
      avgDuration: outboundCalls.length > 0 ? outboundCalls.reduce((sum: number, c: any) => sum + (parseInt(c.durationSeconds) || 0), 0) / outboundCalls.length : 0,
      avgConversationTime: outboundCalls.length > 0 ? outboundCalls.reduce((sum: number, c: any) => sum + (parseInt(c.conversationSeconds) || 0), 0) / outboundCalls.length : 0,
      answerRate: outboundCalls.length > 0 ? ((outboundCalls.filter((c: any) => c.disposition === 'answered').length / outboundCalls.length) * 100).toFixed(2) : 0,
    };
    
    // Page title
    this.addSectionTitle('📞 Outbound Calls Report');
    
    // Summary cards
    const summaryCards = [
      { label: 'Outbound Calls', value: outboundSummary.totalCalls?.toLocaleString() || '0', color: this.colors.orange },
      { label: 'Answered', value: outboundSummary.answeredCalls?.toLocaleString() || '0', color: this.colors.success },
      { label: 'No Answer', value: outboundSummary.noAnswerCalls?.toLocaleString() || '0', color: this.colors.danger },
      { label: 'Avg Duration', value: this.formatDuration(outboundSummary.avgDuration || 0), color: this.colors.purple },
    ];
    
    this.addMetricCards(summaryCards, 4);
    this.currentY += 15;
    
    // Daily volume chart
    if (this.needsNewPage(220)) {
      this.addPage();
    }
    
    this.addSectionTitle('Daily Outbound Call Volume');
    
    if (data.dailyStats && data.dailyStats.length > 0) {
      const recentStats = data.dailyStats.slice(-7);
      await this.addBarChart(
        recentStats.map((day: any) => ({
          label: this.formatDate(day.date, 'MM/dd'),
          value: day.outbound || 0,
          color: this.colors.orange
        })),
        'Date',
        'Outbound Calls'
      );
    }
    
    this.currentY += 15;
    
    // Status distribution
    if (this.needsNewPage(220)) {
      this.addPage();
    }
    
    this.addSectionTitle('Call Status Distribution');
    
    const statusData = [
      { label: 'Answered', value: outboundSummary.answeredCalls || 0, color: this.colors.success },
      { label: 'No Answer', value: outboundSummary.noAnswerCalls || 0, color: this.colors.danger },
      { label: 'Busy', value: outboundSummary.busyCalls || 0, color: this.colors.warning },
      { label: 'Congestion', value: outboundSummary.congestionCalls || 0, color: this.colors.gray },
    ].filter(item => item.value > 0);
    
    if (statusData.length > 0) {
      await this.addPieChart(statusData);
    }
    
    this.currentY += 15;
    
    // Status breakdown table
    if (this.needsNewPage(150)) {
      this.addPage();
    }
    
    this.addSectionTitle('Lead Status Breakdown');
    
    if (data.leadStatusBreakdown && data.leadStatusBreakdown.length > 0) {
      const totalLeads = data.leadStatusBreakdown.reduce((sum: number, item: any) => sum + item.count, 0);
      
      const tableHeaders = ['Status', 'Count', 'Percentage'];
      const tableRows = data.leadStatusBreakdown.map((item: any) => [
        this.formatStatusName(item.status),
        item.count.toString(),
        `${totalLeads > 0 ? ((item.count / totalLeads) * 100).toFixed(1) : '0.0'}%`
      ]);
      
      this.addTable(tableHeaders, tableRows, [200, 120, 120]);
    }
  }

  /**
   * Generate Inbound page
   */
  private async generateInboundPage(reportData: ReportData) {
    const { summary, data } = reportData;
    
    // Filter inbound data
    const allCalls = data.calls || [];
    const inboundCalls = allCalls.filter((call: any) => call.type === 'inbound');
    
    // Calculate inbound summary
    const inboundSummary = {
      totalCalls: inboundCalls.length,
      answeredCalls: inboundCalls.filter((c: any) => c.disposition === 'answered').length,
      noAnswerCalls: inboundCalls.filter((c: any) => c.disposition === 'noAnswer').length,
      busyCalls: inboundCalls.filter((c: any) => c.disposition === 'busy').length,
      congestionCalls: inboundCalls.filter((c: any) => c.disposition === 'congestion').length,
      totalDuration: inboundCalls.reduce((sum: number, c: any) => sum + (parseInt(c.durationSeconds) || 0), 0),
      totalConversationTime: inboundCalls.reduce((sum: number, c: any) => sum + (parseInt(c.conversationSeconds) || 0), 0),
      avgDuration: inboundCalls.length > 0 ? inboundCalls.reduce((sum: number, c: any) => sum + (parseInt(c.durationSeconds) || 0), 0) / inboundCalls.length : 0,
      avgConversationTime: inboundCalls.length > 0 ? inboundCalls.reduce((sum: number, c: any) => sum + (parseInt(c.conversationSeconds) || 0), 0) / inboundCalls.length : 0,
      answerRate: inboundCalls.length > 0 ? ((inboundCalls.filter((c: any) => c.disposition === 'answered').length / inboundCalls.length) * 100).toFixed(2) : 0,
    };
    
    // Page title
    this.addSectionTitle('📱 Inbound Calls Report');
    
    // Summary cards
    const summaryCards = [
      { label: 'Inbound Calls', value: inboundSummary.totalCalls?.toLocaleString() || '0', color: this.colors.indigo },
      { label: 'Answered', value: inboundSummary.answeredCalls?.toLocaleString() || '0', color: this.colors.success },
      { label: 'No Answer', value: inboundSummary.noAnswerCalls?.toLocaleString() || '0', color: this.colors.danger },
      { label: 'Avg Duration', value: this.formatDuration(inboundSummary.avgDuration || 0), color: this.colors.purple },
    ];
    
    this.addMetricCards(summaryCards, 4);
    this.currentY += 15;
    
    // Daily volume chart
    if (this.needsNewPage(220)) {
      this.addPage();
    }
    
    this.addSectionTitle('Daily Inbound Call Volume');
    
    if (data.dailyStats && data.dailyStats.length > 0) {
      const recentStats = data.dailyStats.slice(-7);
      await this.addBarChart(
        recentStats.map((day: any) => ({
          label: this.formatDate(day.date, 'MM/dd'),
          value: day.inbound || 0,
          color: this.colors.indigo
        })),
        'Date',
        'Inbound Calls'
      );
    }
    
    this.currentY += 15;
    
    // Status distribution
    if (this.needsNewPage(220)) {
      this.addPage();
    }
    
    this.addSectionTitle('Call Status Distribution');
    
    const statusData = [
      { label: 'Answered', value: inboundSummary.answeredCalls || 0, color: this.colors.success },
      { label: 'No Answer', value: inboundSummary.noAnswerCalls || 0, color: this.colors.danger },
      { label: 'Busy', value: inboundSummary.busyCalls || 0, color: this.colors.warning },
      { label: 'Congestion', value: inboundSummary.congestionCalls || 0, color: this.colors.gray },
    ].filter(item => item.value > 0);
    
    if (statusData.length > 0) {
      await this.addPieChart(statusData);
    }
    
    this.currentY += 15;
    
    // Status breakdown table
    if (this.needsNewPage(150)) {
      this.addPage();
    }
    
    this.addSectionTitle('Lead Status Breakdown');
    
    if (data.leadStatusBreakdown && data.leadStatusBreakdown.length > 0) {
      const totalLeads = data.leadStatusBreakdown.reduce((sum: number, item: any) => sum + item.count, 0);
      
      const tableHeaders = ['Status', 'Count', 'Percentage'];
      const tableRows = data.leadStatusBreakdown.map((item: any) => [
        this.formatStatusName(item.status),
        item.count.toString(),
        `${totalLeads > 0 ? ((item.count / totalLeads) * 100).toFixed(1) : '0.0'}%`
      ]);
      
      this.addTable(tableHeaders, tableRows, [200, 120, 120]);
    }
  }

  /**
   * Generate Comparison (VS) page
   */
  private async generateComparisonPage(reportData: ReportData) {
    const { summary, data } = reportData;
    
    // Page title
    this.addSectionTitle('📊 Inbound vs Outbound Comparison');
    
    // Overall summary cards
    const summaryCards = [
      { label: 'Total Calls', value: summary.totalCalls?.toLocaleString() || '0', color: this.colors.primary },
      { label: 'Answered', value: summary.answeredCalls?.toLocaleString() || '0', color: this.colors.success },
      { label: 'No Answer', value: summary.noAnswerCalls?.toLocaleString() || '0', color: this.colors.danger },
      { label: 'Avg Duration', value: this.formatDuration(summary.avgDuration || 0), color: this.colors.purple },
    ];
    
    this.addMetricCards(summaryCards, 4);
    this.currentY += 15;
    
    // Inbound vs Outbound breakdown
    if (this.needsNewPage(100)) {
      this.addPage();
    }
    
    this.addSectionTitle('Call Type Breakdown');
    
    // Side-by-side comparison cards
    const comparisonCards = [
      { 
        label: 'Inbound Calls', 
        value: summary.inboundCalls?.toLocaleString() || '0', 
        color: this.colors.indigo,
        subtitle: `${summary.totalCalls ? ((summary.inboundCalls / summary.totalCalls) * 100).toFixed(1) : 0}% of total`
      },
      { 
        label: 'Outbound Calls', 
        value: summary.outboundCalls?.toLocaleString() || '0', 
        color: this.colors.orange,
        subtitle: `${summary.totalCalls ? ((summary.outboundCalls / summary.totalCalls) * 100).toFixed(1) : 0}% of total`
      },
    ];
    
    this.addMetricCards(comparisonCards, 2);
    this.currentY += 15;
    
    // Inbound vs Outbound comparison chart
    if (this.needsNewPage(220)) {
      this.addPage();
    }
    
    this.addSectionTitle('Daily Comparison');
    
    if (data.dailyStats && data.dailyStats.length > 0) {
      const recentStats = data.dailyStats.slice(-7);
      await this.addLineChart(
        recentStats.map((day: any) => ({
          label: this.formatDate(day.date, 'MM/dd'),
          values: [
            { name: 'Inbound', value: day.inbound || 0, color: this.colors.indigo },
            { name: 'Outbound', value: day.outbound || 0, color: this.colors.orange },
          ]
        })),
        'Date',
        'Calls'
      );
    }
    
    this.currentY += 15;
    
    // Overall status distribution
    if (this.needsNewPage(220)) {
      this.addPage();
    }
    
    this.addSectionTitle('Overall Call Status Distribution');
    
    const statusData = [
      { label: 'Answered', value: summary.answeredCalls || 0, color: this.colors.success },
      { label: 'No Answer', value: summary.noAnswerCalls || 0, color: this.colors.danger },
      { label: 'Busy', value: summary.busyCalls || 0, color: this.colors.warning },
      { label: 'Congestion', value: summary.congestionCalls || 0, color: this.colors.gray },
    ].filter(item => item.value > 0);
    
    if (statusData.length > 0) {
      await this.addPieChart(statusData);
    }
    
    this.currentY += 15;
    
    // Daily breakdown table (last 7 days)
    if (this.needsNewPage(200)) {
      this.addPage();
    }
    
    this.addSectionTitle('Daily Breakdown (Last 7 Days)');
    
    if (data.dailyStats && data.dailyStats.length > 0) {
      const tableData = data.dailyStats.slice(-7).map((day: any) => [
        this.formatDate(day.date),
        day.total?.toLocaleString() || '0',
        day.inbound?.toLocaleString() || '0',
        day.outbound?.toLocaleString() || '0',
        day.answered?.toLocaleString() || '0',
        day.noAnswer?.toLocaleString() || '0',
      ]);
      
      this.addTable(
        ['Date', 'Total', 'Inbound', 'Outbound', 'Answered', 'No Answer'],
        tableData,
        [80, 55, 60, 65, 60, 65]
      );
    }
  }

  /**
   * Generate Agent Performance PDF
   */
  private async generateAgentPerformancePDF(reportData: ReportData) {
    const { summary, data } = reportData;
    
    // Summary cards
    this.addSectionTitle('Summary');
    
    const summaryCards = [
      { label: 'Total Agents', value: summary.totalAgents?.toString() || '0', color: this.colors.primary },
      { label: 'Active Agents', value: summary.activeAgents?.toString() || '0', color: this.colors.success },
      { label: 'Total Calls', value: summary.totalCalls?.toLocaleString() || '0', color: this.colors.purple },
      { label: 'Total Leads', value: summary.totalLeads?.toLocaleString() || '0', color: this.colors.indigo },
      { label: 'Converted Leads', value: summary.totalConvertedLeads?.toLocaleString() || '0', color: this.colors.success },
    ];
    
    this.addMetricCards(summaryCards, 4);
    
    this.currentY += 30;
    
    // Top performers section
    if (this.needsNewPage(250)) {
      this.addPage();
    }
    
    this.addSectionTitle('Top Performers by Conversion Rate');
    
    const topAgents = data.agentPerformance
      .filter((agent: any) => 
        agent.totalCalls >= 5 && 
        agent.convertedLeads > 0 && 
        agent.agentId !== 0
      )
      .sort((a: any, b: any) => {
        const aConversionRate = parseFloat(a.conversionRate || '0');
        const bConversionRate = parseFloat(b.conversionRate || '0');
        if (aConversionRate !== bConversionRate) {
          return bConversionRate - aConversionRate;
        }
        return a.totalCalls - b.totalCalls;
      })
      .slice(0, 5);
    
    if (topAgents.length > 0) {
      // Top performers cards
      const topPerformerCards = topAgents.map((agent: any, index: number) => ({
        label: `${index + 1}. ${agent.agentName}`,
        value: `${agent.conversionRate}%`,
        color: index === 0 ? '#fbbf24' : index === 1 ? '#9ca3af' : index === 2 ? '#fb923c' : this.colors.primary,
        subtitle: `${agent.convertedLeads} conversions / ${agent.totalCalls} calls`
      }));
      
      this.addTopPerformerCards(topPerformerCards);
    }
    
    this.currentY += 30;
    
    // Agent performance comparison chart
    if (this.needsNewPage(300)) {
      this.addPage();
    }
    
    this.addSectionTitle('Agent Performance Comparison (Top 10)');
    
    const chartAgents = data.agentPerformance
      .filter((a: any) => a.totalCalls > 0)
      .slice(0, 10);
    
    if (chartAgents.length > 0) {
      await this.addBarChart(
        chartAgents.map((agent: any) => ({
          label: this.truncateText(agent.agentName, 12),
          value: agent.answeredCalls || 0,
          color: this.colors.success
        })),
        'Agent',
        'Answered Calls'
      );
    }
    
    this.currentY += 30;
    
    // Agent details table
    if (this.needsNewPage(200)) {
      this.addPage();
    }
    
    this.addSectionTitle('Agent Performance Details');
    
    const tableData = data.agentPerformance
      .filter((a: any) => a.totalCalls > 0)
      .slice(0, 20)
      .map((agent: any) => [
        this.truncateText(agent.agentName, 20),
        agent.totalCalls?.toLocaleString() || '0',
        agent.answeredCalls?.toLocaleString() || '0',
        agent.missedCalls?.toLocaleString() || '0',
        `${agent.answerRate || 0}%`,
        this.formatDuration(agent.avgTalkTime || agent.avgConversationTime || 0),
        agent.convertedLeads?.toLocaleString() || '0',
        `${agent.conversionRate || 0}%`,
      ]);
    
    this.addTable(
      ['Agent', 'Calls', 'Answered', 'Missed', 'Answer %', 'Avg Talk', 'Converted', 'Conv %'],
      tableData,
      [80, 50, 60, 50, 55, 60, 60, 55]
    );
  }

  /**
   * Generate Campaign Analytics PDF
   */
  private async generateCampaignAnalyticsPDF(reportData: ReportData) {
    const { summary, data } = reportData;
    
    // Summary cards
    this.addSectionTitle('Campaign Overview');
    
    const summaryCards = [
      { label: 'Total Campaigns', value: summary.totalCampaigns?.toString() || '0', color: this.colors.primary },
      { label: 'Active Campaigns', value: summary.activeCampaigns?.toString() || '0', color: this.colors.success },
      { label: 'Total Calls', value: summary.totalCalls?.toLocaleString() || '0', color: this.colors.purple },
      { label: 'Total Leads', value: summary.totalLeads?.toLocaleString() || '0', color: this.colors.indigo },
      { label: 'Converted Leads', value: summary.totalConvertedLeads?.toLocaleString() || '0', color: this.colors.success },
      { label: 'Total Duration', value: this.formatDuration(summary.totalDuration || 0), color: this.colors.warning },
    ];
    
    this.addMetricCards(summaryCards, 4);
    
    this.currentY += 30;
    
    // Campaign calls comparison
    if (this.needsNewPage(300)) {
      this.addPage();
    }
    
    this.addSectionTitle('Calls by Campaign (Top 10)');
    
    const campaigns = data.campaignAnalytics || [];
    const topCampaigns = campaigns
      .filter((c: any) => c.totalCalls > 0)
      .slice(0, 10);
    
    if (topCampaigns.length > 0) {
      await this.addBarChart(
        topCampaigns.map((campaign: any) => ({
          label: this.truncateText(campaign.campaignName, 15),
          value: campaign.totalCalls || 0,
          color: this.colors.primary
        })),
        'Campaign',
        'Total Calls'
      );
    }
    
    this.currentY += 30;
    
    // Conversion rate comparison
    if (this.needsNewPage(300)) {
      this.addPage();
    }
    
    this.addSectionTitle('Conversion Rate by Campaign');
    
    const campaignsWithLeads = campaigns.filter((c: any) => c.totalLeads > 0).slice(0, 10);
    
    if (campaignsWithLeads.length > 0) {
      await this.addBarChart(
        campaignsWithLeads.map((campaign: any) => ({
          label: this.truncateText(campaign.campaignName, 15),
          value: parseFloat(campaign.conversionRate || '0'),
          color: this.colors.success
        })),
        'Campaign',
        'Conversion Rate (%)'
      );
    }
    
    this.currentY += 30;
    
    // Campaign details table
    if (this.needsNewPage(200)) {
      this.addPage();
    }
    
    this.addSectionTitle('Campaign Performance Details');
    
    const tableData = campaigns
      .slice(0, 15)
      .map((campaign: any) => [
        this.truncateText(campaign.campaignName, 25),
        campaign.status || 'N/A',
        campaign.totalCalls?.toLocaleString() || '0',
        campaign.answeredCalls?.toLocaleString() || '0',
        `${campaign.answerRate || 0}%`,
        campaign.totalLeads?.toLocaleString() || '0',
        campaign.convertedLeads?.toLocaleString() || '0',
        `${campaign.conversionRate || 0}%`,
      ]);
    
    this.addTable(
      ['Campaign', 'Status', 'Calls', 'Answered', 'Answer %', 'Leads', 'Converted', 'Conv %'],
      tableData,
      [110, 50, 50, 60, 55, 50, 60, 55]
    );
  }

  /**
   * Add section title
   */
  private addSectionTitle(title: string) {
    if (this.needsNewPage(100)) {
      this.addPage();
    }
    
    // Add top spacing
    this.currentY += 15;
    
    // Check if title starts with an emoji by checking specific emojis
    let emoji = '';
    let text = title;
    
    if (title.startsWith('📞')) {
      emoji = '📞';
      text = title.substring(2).trim();
    } else if (title.startsWith('📱')) {
      emoji = '📱';
      text = title.substring(2).trim();
    } else if (title.startsWith('📊')) {
      emoji = '📊';
      text = title.substring(2).trim();
    }
    
    if (emoji) {
      // Calculate centered position
      const iconSize = 28;
      const fontSize = 22;
      this.doc.font('Helvetica-Bold').fontSize(fontSize);
      const textWidth = this.doc.widthOfString(text);
      const totalWidth = iconSize + 10 + textWidth; // icon + gap + text
      const startX = this.pageMargin + (this.contentWidth - totalWidth) / 2;
      
      const iconX = startX;
      const iconY = this.currentY;
      
      try {
        const iconPath = this.getIconPath(emoji);
        if (fs.existsSync(iconPath)) {
          // Draw PNG icon
          this.doc.image(iconPath, iconX, iconY, {
            width: iconSize,
            height: iconSize
          });
        } else {
          // Fallback to custom drawn icon
          const iconColor = this.getEmojiColor(emoji);
          this.doc
            .save()
            .fillColor(iconColor)
            .roundedRect(iconX, iconY, iconSize, iconSize, 4)
            .fill()
            .restore();
          this.drawIcon(emoji, iconX, iconY, iconSize);
        }
      } catch (error) {
        console.warn(`Failed to load icon for ${emoji}, using fallback`);
        // Fallback to custom drawn icon
        const iconColor = this.getEmojiColor(emoji);
        this.doc
          .save()
          .fillColor(iconColor)
          .roundedRect(iconX, iconY, iconSize, iconSize, 4)
          .fill()
          .restore();
        this.drawIcon(emoji, iconX, iconY, iconSize);
      }
      
      // Draw text (centered)
      this.doc
        .fontSize(fontSize)
        .fillColor(this.colors.darkGray)
        .font('Helvetica-Bold')
        .text(text, startX + iconSize + 10, this.currentY + 4, {
          width: textWidth,
          align: 'left'
        });
    } else {
      // No emoji, just render centered text
      this.doc
        .fontSize(22)
        .fillColor(this.colors.darkGray)
        .font('Helvetica-Bold')
        .text(title, this.pageMargin, this.currentY, {
          width: this.contentWidth,
          align: 'center'
        });
    }
    
    // Add bottom spacing before content
    this.currentY += 50;
  }
  
  /**
   * Draw icon shape
   */
  private drawIcon(emoji: string, x: number, y: number, size: number) {
    const center = size / 2;
    const cx = x + center;
    const cy = y + center;
    
    this.doc.save().fillColor(this.colors.white).strokeColor(this.colors.white).lineWidth(1.5);
    
    if (emoji === '📞') {
      // Outbound: Arrow pointing right (outgoing call)
      const arrowSize = size * 0.5;
      const startX = cx - arrowSize / 2;
      const endX = cx + arrowSize / 2;
      
      // Arrow line
      this.doc.moveTo(startX, cy).lineTo(endX, cy).stroke();
      
      // Arrow head
      this.doc
        .moveTo(endX, cy)
        .lineTo(endX - 4, cy - 3)
        .moveTo(endX, cy)
        .lineTo(endX - 4, cy + 3)
        .stroke();
        
    } else if (emoji === '📱') {
      // Inbound: Arrow pointing left (incoming call)
      const arrowSize = size * 0.5;
      const startX = cx - arrowSize / 2;
      const endX = cx + arrowSize / 2;
      
      // Arrow line
      this.doc.moveTo(endX, cy).lineTo(startX, cy).stroke();
      
      // Arrow head
      this.doc
        .moveTo(startX, cy)
        .lineTo(startX + 4, cy - 3)
        .moveTo(startX, cy)
        .lineTo(startX + 4, cy + 3)
        .stroke();
        
    } else if (emoji === '📊') {
      // Comparison: Bar chart icon (3 vertical bars)
      const barWidth = 2;
      const spacing = 3;
      const baseY = cy + 5;
      
      // Short bar
      this.doc.rect(cx - spacing - barWidth, baseY - 4, barWidth, 4).fill();
      
      // Medium bar
      this.doc.rect(cx - barWidth/2, baseY - 7, barWidth, 7).fill();
      
      // Tall bar
      this.doc.rect(cx + spacing, baseY - 5, barWidth, 5).fill();
    }
    
    this.doc.restore();
  }
  
  /**
   * Get icon file path
   */
  private getIconPath(emoji: string): string {
    const iconMap: { [key: string]: string } = {
      '📞': 'outbound.png',
      '📱': 'inbound.png',
      '📊': 'two-way-communication.png',
    };
    const filename = iconMap[emoji] || 'default.png';
    return path.join(process.cwd(), 'public', 'icons', filename);
  }
  
  /**
   * Get color for emoji icon
   */
  private getEmojiColor(emoji: string): string {
    const colorMap: { [key: string]: string } = {
      '📞': this.colors.orange,   // Outbound = orange
      '📱': this.colors.indigo,   // Inbound = indigo
      '📊': this.colors.primary,  // Comparison = blue
    };
    return colorMap[emoji] || this.colors.primary;
  }

  /**
   * Add metric cards in a grid layout
   */
  private addMetricCards(cards: Array<{label: string; value: string; color: string; subtitle?: string}>, cardsPerRow: number = 4) {
    const cardWidth = (this.contentWidth - ((cardsPerRow - 1) * 10)) / cardsPerRow;
    const cardHeight = 70;
    
    cards.forEach((card, index) => {
      const row = Math.floor(index / cardsPerRow);
      const col = index % cardsPerRow;
      
      const x = this.pageMargin + (col * (cardWidth + 10));
      const y = this.currentY + (row * (cardHeight + 10));
      
      // Check if we need a new page
      if (y + cardHeight > this.pageHeight - this.pageMargin) {
        this.addPage();
        return;
      }
      
      // Card background
      this.doc
        .roundedRect(x, y, cardWidth, cardHeight, 5)
        .fillAndStroke(this.colors.white, this.colors.lightGray);
      
      // Label
      this.doc
        .fontSize(9)
        .fillColor(this.colors.gray)
        .font('Helvetica')
        .text(card.label, x + 10, y + 15, {
          width: cardWidth - 20,
          align: 'left'
        });
      
      // Value
      this.doc
        .fontSize(18)
        .fillColor(card.color)
        .font('Helvetica-Bold')
        .text(card.value, x + 10, y + 32, {
          width: cardWidth - 20,
          align: 'left'
        });
      
      // Subtitle if provided
      if (card.subtitle) {
        this.doc
          .fontSize(7)
          .fillColor(this.colors.gray)
          .font('Helvetica')
          .text(card.subtitle, x + 10, y + 54, {
            width: cardWidth - 20,
            align: 'left'
          });
      }
    });
    
    const totalRows = Math.ceil(cards.length / cardsPerRow);
    this.currentY += (totalRows * (cardHeight + 10));
  }

  /**
   * Add top performer cards (larger, more prominent)
   */
  private addTopPerformerCards(cards: Array<{label: string; value: string; color: string; subtitle?: string}>) {
    const cardWidth = (this.contentWidth - 20) / 3; // 3 cards per row for top performers
    const cardHeight = 90;
    
    cards.forEach((card, index) => {
      const row = Math.floor(index / 3);
      const col = index % 3;
      
      const x = this.pageMargin + (col * (cardWidth + 10));
      const y = this.currentY + (row * (cardHeight + 10));
      
      if (y + cardHeight > this.pageHeight - this.pageMargin) {
        this.addPage();
        return;
      }
      
      // Card background with color accent
      this.doc
        .roundedRect(x, y, cardWidth, cardHeight, 5)
        .fillAndStroke(this.colors.white, card.color);
      
      // Rank badge (top 3)
      if (index < 3) {
        const emoji = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';
        this.doc
          .fontSize(20)
          .text(emoji, x + cardWidth - 35, y + 10);
      }
      
      // Label (agent name)
      this.doc
        .fontSize(11)
        .fillColor(this.colors.darkGray)
        .font('Helvetica-Bold')
        .text(card.label, x + 10, y + 15, {
          width: cardWidth - 50,
          align: 'left'
        });
      
      // Value (conversion rate)
      this.doc
        .fontSize(22)
        .fillColor(card.color)
        .font('Helvetica-Bold')
        .text(card.value, x + 10, y + 35, {
          width: cardWidth - 20,
          align: 'left'
        });
      
      // Subtitle
      if (card.subtitle) {
        this.doc
          .fontSize(8)
          .fillColor(this.colors.gray)
          .font('Helvetica')
          .text(card.subtitle, x + 10, y + 65, {
            width: cardWidth - 20,
            align: 'left'
          });
      }
    });
    
    const totalRows = Math.ceil(cards.length / 3);
    this.currentY += (totalRows * (cardHeight + 10));
  }

  /**
   * Add pie chart
   */
  private async addPieChart(data: Array<{label: string; value: number; color: string}>) {
    const chartHeight = 200; // Reduced from 250
    
    if (this.needsNewPage(chartHeight)) {
      this.addPage();
    }
    
    const total = data.reduce((sum, item) => sum + item.value, 0);
    
    const configuration = {
      type: 'pie' as const,
      data: {
        labels: data.map(item => item.label),
        datasets: [{
          data: data.map(item => item.value),
          backgroundColor: data.map(item => item.color),
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right' as const,
            labels: {
              font: {
                size: 12
              },
              padding: 10,
              generateLabels: (chart: any) => {
                const dataset = chart.data.datasets[0];
                return chart.data.labels.map((label: string, i: number) => {
                  const value = dataset.data[i];
                  const percentage = ((value / total) * 100).toFixed(1);
                  return {
                    text: `${label}: ${value.toLocaleString()} (${percentage}%)`,
                    fillStyle: dataset.backgroundColor[i],
                    hidden: false,
                    index: i
                  };
                });
              }
            }
          },
          title: {
            display: false
          }
        }
      }
    };
    
    const imageBuffer = await this.chartGenerator.renderToBuffer(configuration as any);
    
    const imgWidth = this.contentWidth * 0.9; // 90% of content width
    const imgHeight = (300 * imgWidth) / 800; // Use actual chart height
    
    this.doc.image(imageBuffer, this.pageMargin, this.currentY, {
      width: imgWidth,
      height: imgHeight
    });
    
    this.currentY += imgHeight + 10;
  }

  /**
   * Add bar chart
   */
  private async addBarChart(
    data: Array<{label: string; value: number; color: string}>, 
    xLabel: string = '',
    yLabel: string = ''
  ) {
    const chartHeight = 200; // Reduced from 250
    
    if (this.needsNewPage(chartHeight)) {
      this.addPage();
    }
    
    const configuration = {
      type: 'bar' as const,
      data: {
        labels: data.map(item => item.label),
        datasets: [{
          label: yLabel,
          data: data.map(item => item.value),
          backgroundColor: data.map(item => item.color),
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          title: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              font: {
                size: 10
              }
            },
            title: {
              display: !!yLabel,
              text: yLabel,
              font: {
                size: 12
              }
            }
          },
          x: {
            ticks: {
              font: {
                size: 10
              }
            },
            title: {
              display: !!xLabel,
              text: xLabel,
              font: {
                size: 12
              }
            }
          }
        }
      }
    };
    
    const imageBuffer = await this.chartGenerator.renderToBuffer(configuration as any);
    
    const imgWidth = this.contentWidth * 0.95; // 95% of content width
    const imgHeight = (300 * imgWidth) / 800; // Use actual chart height
    
    this.doc.image(imageBuffer, this.pageMargin, this.currentY, {
      width: imgWidth,
      height: imgHeight
    });
    
    this.currentY += imgHeight + 10;
  }

  /**
   * Add line chart
   */
  private async addLineChart(
    data: Array<{label: string; values: Array<{name: string; value: number; color: string}>}>,
    xLabel: string = '',
    yLabel: string = ''
  ) {
    const chartHeight = 200; // Reduced from 250
    
    if (this.needsNewPage(chartHeight)) {
      this.addPage();
    }
    
    const datasets = data[0].values.map((_, index) => ({
      label: data[0].values[index].name,
      data: data.map(item => item.values[index].value),
      borderColor: data[0].values[index].color,
      backgroundColor: data[0].values[index].color,
      tension: 0.3,
      borderWidth: 2
    }));
    
    const configuration = {
      type: 'line' as const,
      data: {
        labels: data.map(item => item.label),
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top' as const,
            labels: {
              font: {
                size: 11
              },
              padding: 8
            }
          },
          title: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              font: {
                size: 10
              }
            },
            title: {
              display: !!yLabel,
              text: yLabel,
              font: {
                size: 12
              }
            }
          },
          x: {
            ticks: {
              font: {
                size: 10
              }
            },
            title: {
              display: !!xLabel,
              text: xLabel,
              font: {
                size: 12
              }
            }
          }
        }
      }
    };
    
    const imageBuffer = await this.chartGenerator.renderToBuffer(configuration as any);
    
    const imgWidth = this.contentWidth * 0.95; // 95% of content width
    const imgHeight = (300 * imgWidth) / 800; // Use actual chart height
    
    this.doc.image(imageBuffer, this.pageMargin, this.currentY, {
      width: imgWidth,
      height: imgHeight
    });
    
    this.currentY += imgHeight + 10;
  }

  /**
   * Add table to document
   */
  private addTable(headers: string[], rows: string[][], columnWidths?: number[]) {
    const tableWidth = this.contentWidth;
    const numColumns = headers.length;
    
    // Calculate column widths if not provided
    if (!columnWidths) {
      columnWidths = Array(numColumns).fill(tableWidth / numColumns);
    }
    
    const rowHeight = 25;
    const headerHeight = 30;
    
    // Check if we need a new page for the table header
    if (this.needsNewPage(headerHeight + rowHeight * 2)) {
      this.addPage();
    }
    
    // Draw header
    this.doc
      .fillColor(this.colors.primary)
      .rect(this.pageMargin, this.currentY, tableWidth, headerHeight)
      .fill();
    
    let xPos = this.pageMargin;
    headers.forEach((header, i) => {
      this.doc
        .fontSize(9)
        .fillColor(this.colors.white)
        .font('Helvetica-Bold')
        .text(header, xPos + 5, this.currentY + 10, {
          width: columnWidths![i] - 10,
          align: 'left'
        });
      xPos += columnWidths![i];
    });
    
    this.currentY += headerHeight;
    
    // Draw rows
    rows.forEach((row, rowIndex) => {
      // Check if we need a new page
      if (this.needsNewPage(rowHeight)) {
        this.addPage();
        
        // Redraw header on new page
        this.doc
          .fillColor(this.colors.primary)
          .rect(this.pageMargin, this.currentY, tableWidth, headerHeight)
          .fill();
        
        let xPos = this.pageMargin;
        headers.forEach((header, i) => {
          this.doc
            .fontSize(9)
            .fillColor(this.colors.white)
            .font('Helvetica-Bold')
            .text(header, xPos + 5, this.currentY + 10, {
              width: columnWidths![i] - 10,
              align: 'left'
            });
          xPos += columnWidths![i];
        });
        
        this.currentY += headerHeight;
      }
      
      // Alternating row colors
      const bgColor = rowIndex % 2 === 0 ? this.colors.white : this.colors.lightGray;
      this.doc
        .fillColor(bgColor)
        .rect(this.pageMargin, this.currentY, tableWidth, rowHeight)
        .fill();
      
      xPos = this.pageMargin;
      row.forEach((cell, i) => {
        this.doc
          .fontSize(8)
          .fillColor(this.colors.darkGray)
          .font('Helvetica')
          .text(cell, xPos + 5, this.currentY + 8, {
            width: columnWidths![i] - 10,
            align: 'left',
            ellipsis: true
          });
        xPos += columnWidths![i];
      });
      
      this.currentY += rowHeight;
    });
  }

  /**
   * Add page numbers to all pages
   */
  private addPageNumbers() {
    const pageCount = (this.doc as any).bufferedPageRange().count;
    
    for (let i = 0; i < pageCount; i++) {
      this.doc.switchToPage(i);
      
      this.doc
        .fontSize(9)
        .fillColor(this.colors.gray)
        .font('Helvetica')
        .text(
          `Page ${i + 1} of ${pageCount}`,
          this.pageMargin,
          this.pageHeight - this.pageMargin + 10,
          {
            width: this.contentWidth,
            align: 'center'
          }
        );
    }
  }

  /**
   * Add new page
   */
  private addPage() {
    this.doc.addPage();
    this.currentY = this.pageMargin;
  }

  /**
   * Check if we need a new page
   */
  private needsNewPage(contentHeight: number): boolean {
    return (this.currentY + contentHeight) > (this.pageHeight - this.pageMargin - 30);
  }

  /**
   * Helper: Format date
   */
  private formatDate(date: string, formatStr: string = 'MMM dd, yyyy'): string {
    try {
      return format(new Date(date), formatStr);
    } catch {
      return date;
    }
  }

  /**
   * Helper: Format duration in seconds to HH:MM:SS
   */
  private formatDuration(seconds: number): string {
    if (isNaN(seconds) || seconds < 0) return '00:00:00';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  /**
   * Helper: Get report title
   */
  private getReportTitle(reportType: string): string {
    switch (reportType) {
      case 'call-summary': return 'Call Summary Report';
      case 'agent-performance': return 'Agent Performance Report';
      case 'campaign-analytics': return 'Campaign Analytics Report';
      default: return 'Report';
    }
  }

  /**
   * Helper: Truncate text
   */
  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }

  /**
   * Helper: Format status name
   */
  private formatStatusName(status: string): string {
    if (!status) return 'Unknown';
    
    // Map specific status values to readable names
    const statusMap: { [key: string]: string } = {
      'new': 'New',
      'automaticRedial': 'Automatic Redial',
      'privateRedial': 'Private Callback',
      'notInterested': 'Not Interested',
      'success': 'Success',
      'invalid': 'Invalid',
      'unqualified': 'Unqualified',
      'callback': 'Callback',
      'sharedCallback': 'Shared Callback',
      'vipCallback': 'VIP Callback',
      'unprocessed': 'Unprocessed',
      'unknown': 'Unknown'
    };
    
    // Return mapped name if exists, otherwise format camelCase
    if (statusMap[status]) {
      return statusMap[status];
    }
    
    // Fallback: Convert camelCase to Title Case
    const formatted = status
      .replace(/([A-Z])/g, ' $1') // Add space before capital letters
      .replace(/^./, (str) => str.toUpperCase()) // Capitalize first letter
      .trim();
    
    return formatted;
  }

  /**
   * Get the PDFDocument stream
   */
  getStream(): PDFKit.PDFDocument {
    return this.doc;
  }

  /**
   * Finalize the document
   */
  end() {
    this.doc.end();
  }
}

