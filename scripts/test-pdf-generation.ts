/**
 * Test script for PDF generation
 * 
 * This script tests the server-side PDF generation functionality
 * Run with: npx ts-node scripts/test-pdf-generation.ts
 */

import { ServerPDFGenerator } from '../lib/pdf-generator-server';
import { ReportData } from '../lib/report-generator';
import fs from 'fs';
import path from 'path';

// Sample report data for testing
const sampleCallSummaryData: ReportData = {
  reportType: 'call-summary',
  dateRange: {
    startDate: '2024-01-01T00:00:00Z',
    endDate: '2024-01-31T23:59:59Z'
  },
  data: {
    calls: [],
    dailyStats: [
      { date: '2024-01-01', total: 150, inbound: 80, outbound: 70, answered: 120, noAnswer: 30, duration: 7200, conversationTime: 5400, inboundAnswered: 65, inboundNoAnswer: 15, outboundAnswered: 55, outboundNoAnswer: 15, inboundDuration: 3800, inboundConversationTime: 2900, outboundDuration: 3400, outboundConversationTime: 2500 },
      { date: '2024-01-02', total: 175, inbound: 90, outbound: 85, answered: 140, noAnswer: 35, duration: 8400, conversationTime: 6300, inboundAnswered: 72, inboundNoAnswer: 18, outboundAnswered: 68, outboundNoAnswer: 17, inboundDuration: 4500, inboundConversationTime: 3400, outboundDuration: 3900, outboundConversationTime: 2900 },
      { date: '2024-01-03', total: 160, inbound: 85, outbound: 75, answered: 130, noAnswer: 30, duration: 7800, conversationTime: 5850, inboundAnswered: 68, inboundNoAnswer: 17, outboundAnswered: 62, outboundNoAnswer: 13, inboundDuration: 4200, inboundConversationTime: 3150, outboundDuration: 3600, outboundConversationTime: 2700 },
      { date: '2024-01-04', total: 190, inbound: 100, outbound: 90, answered: 155, noAnswer: 35, duration: 9200, conversationTime: 6900, inboundAnswered: 82, inboundNoAnswer: 18, outboundAnswered: 73, outboundNoAnswer: 17, inboundDuration: 5000, inboundConversationTime: 3750, outboundDuration: 4200, outboundConversationTime: 3150 },
      { date: '2024-01-05', total: 145, inbound: 75, outbound: 70, answered: 115, noAnswer: 30, duration: 6900, conversationTime: 5175, inboundAnswered: 60, inboundNoAnswer: 15, outboundAnswered: 55, outboundNoAnswer: 15, inboundDuration: 3600, inboundConversationTime: 2700, outboundDuration: 3300, outboundConversationTime: 2475 },
    ]
  },
  summary: {
    totalCalls: 820,
    inboundCalls: 430,
    outboundCalls: 390,
    answeredCalls: 660,
    noAnswerCalls: 160,
    busyCalls: 0,
    congestionCalls: 0,
    totalDuration: 39500,
    totalConversationTime: 29675,
    avgDuration: 48.17,
    avgConversationTime: 36.19,
    answerRate: 80.49
  },
  generatedAt: new Date().toISOString()
};

const sampleAgentPerformanceData: ReportData = {
  reportType: 'agent-performance',
  dateRange: {
    startDate: '2024-01-01T00:00:00Z',
    endDate: '2024-01-31T23:59:59Z'
  },
  data: {
    agentPerformance: [
      { agentId: 1, agentName: 'John Smith', email: 'john@example.com', totalCalls: 250, inboundCalls: 130, outboundCalls: 120, answeredCalls: 200, completedCalls: 200, missedCalls: 50, totalDuration: 12000, totalConversationTime: 9000, totalTalkTime: 9000, avgDuration: 48, avgConversationTime: 36, avgTalkTime: 36, answerRate: 80, completionRate: 80, totalLeads: 100, convertedLeads: 25, conversionRate: 25 },
      { agentId: 2, agentName: 'Sarah Johnson', email: 'sarah@example.com', totalCalls: 280, inboundCalls: 150, outboundCalls: 130, answeredCalls: 230, completedCalls: 230, missedCalls: 50, totalDuration: 13440, totalConversationTime: 10080, totalTalkTime: 10080, avgDuration: 48, avgConversationTime: 36, avgTalkTime: 36, answerRate: 82.14, completionRate: 82.14, totalLeads: 110, convertedLeads: 28, conversionRate: 25.45 },
      { agentId: 3, agentName: 'Mike Wilson', email: 'mike@example.com', totalCalls: 220, inboundCalls: 110, outboundCalls: 110, answeredCalls: 175, completedCalls: 175, missedCalls: 45, totalDuration: 10560, totalConversationTime: 7920, totalTalkTime: 7920, avgDuration: 48, avgConversationTime: 36, avgTalkTime: 36, answerRate: 79.55, completionRate: 79.55, totalLeads: 90, convertedLeads: 22, conversionRate: 24.44 },
      { agentId: 4, agentName: 'Emily Brown', email: 'emily@example.com', totalCalls: 70, inboundCalls: 40, outboundCalls: 30, answeredCalls: 55, completedCalls: 55, missedCalls: 15, totalDuration: 3360, totalConversationTime: 2520, totalTalkTime: 2520, avgDuration: 48, avgConversationTime: 36, avgTalkTime: 36, answerRate: 78.57, completionRate: 78.57, totalLeads: 80, convertedLeads: 15, conversionRate: 18.75 },
    ]
  },
  summary: {
    totalAgents: 4,
    activeAgents: 4,
    totalCalls: 820,
    totalLeads: 380,
    totalConvertedLeads: 90
  },
  generatedAt: new Date().toISOString()
};

const sampleCampaignAnalyticsData: ReportData = {
  reportType: 'campaign-analytics',
  dateRange: {
    startDate: '2024-01-01T00:00:00Z',
    endDate: '2024-01-31T23:59:59Z'
  },
  data: {
    campaignAnalytics: [
      { campaignId: 1, campaignName: 'Summer Sales 2024', status: 'active', totalCalls: 350, inboundCalls: 180, outboundCalls: 170, answeredCalls: 280, completedCalls: 280, missedCalls: 70, busyCalls: 0, congestionCalls: 0, totalDuration: 16800, totalConversationTime: 12600, totalTalkTime: 12600, avgDuration: 48, avgConversationTime: 36, avgTalkTime: 36, answerRate: 80, completionRate: 80, uniqueCallersCount: 150, uniqueDestinationsCount: 200, totalLeads: 200, convertedLeads: 50, conversionRate: 25 },
      { campaignId: 2, campaignName: 'Product Launch Q1', status: 'active', totalCalls: 280, inboundCalls: 140, outboundCalls: 140, answeredCalls: 225, completedCalls: 225, missedCalls: 55, busyCalls: 0, congestionCalls: 0, totalDuration: 13440, totalConversationTime: 10080, totalTalkTime: 10080, avgDuration: 48, avgConversationTime: 36, avgTalkTime: 36, answerRate: 80.36, completionRate: 80.36, uniqueCallersCount: 120, uniqueDestinationsCount: 160, totalLeads: 150, convertedLeads: 35, conversionRate: 23.33 },
      { campaignId: 3, campaignName: 'Customer Retention', status: 'active', totalCalls: 190, inboundCalls: 110, outboundCalls: 80, answeredCalls: 155, completedCalls: 155, missedCalls: 35, busyCalls: 0, congestionCalls: 0, totalDuration: 9120, totalConversationTime: 6840, totalTalkTime: 6840, avgDuration: 48, avgConversationTime: 36, avgTalkTime: 36, answerRate: 81.58, completionRate: 81.58, uniqueCallersCount: 85, uniqueDestinationsCount: 110, totalLeads: 100, convertedLeads: 28, conversionRate: 28 },
    ]
  },
  summary: {
    totalCampaigns: 3,
    activeCampaigns: 3,
    totalCalls: 820,
    totalAnsweredCalls: 660,
    totalDuration: 39360,
    totalLeads: 450,
    totalConvertedLeads: 113
  },
  generatedAt: new Date().toISOString()
};

async function testPDFGeneration() {
  console.log('🧪 Starting PDF Generation Tests...\n');

  const outputDir = path.join(__dirname, '../test-outputs');
  
  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`📁 Created output directory: ${outputDir}\n`);
  }

  const tests = [
    { name: 'Call Summary Report', data: sampleCallSummaryData, filename: 'test-call-summary.pdf' },
    { name: 'Agent Performance Report', data: sampleAgentPerformanceData, filename: 'test-agent-performance.pdf' },
    { name: 'Campaign Analytics Report', data: sampleCampaignAnalyticsData, filename: 'test-campaign-analytics.pdf' },
  ];

  for (const test of tests) {
    try {
      console.log(`📊 Testing: ${test.name}`);
      const startTime = Date.now();

      const generator = new ServerPDFGenerator();
      const pdfDoc = await generator.generatePDF(test.data, {
        title: test.name,
        dateRange: test.data.dateRange
      });

      const outputPath = path.join(outputDir, test.filename);
      const writeStream = fs.createWriteStream(outputPath);

      pdfDoc.pipe(writeStream);
      generator.end();

      await new Promise<void>((resolve, reject) => {
        writeStream.on('finish', () => {
          const endTime = Date.now();
          const duration = ((endTime - startTime) / 1000).toFixed(2);
          const fileSize = (fs.statSync(outputPath).size / 1024).toFixed(2);
          
          console.log(`   ✅ Generated successfully`);
          console.log(`   ⏱️  Time: ${duration}s`);
          console.log(`   📦 Size: ${fileSize} KB`);
          console.log(`   📄 Output: ${outputPath}\n`);
          resolve();
        });
        writeStream.on('error', reject);
      });

    } catch (error) {
      console.error(`   ❌ Failed: ${error}\n`);
    }
  }

  console.log('✨ All tests completed!');
  console.log(`\n📂 Check outputs in: ${outputDir}`);
}

// Run tests
testPDFGeneration().catch(console.error);

