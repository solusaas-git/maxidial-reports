import { getAdversusClient } from './adversus-client';
import { format, parseISO, startOfDay, endOfDay, eachDayOfInterval } from 'date-fns';

export interface ReportData {
  reportType: string;
  dateRange: {
    startDate: string;
    endDate: string;
  };
  data: any;
  summary: any;
  generatedAt: string;
}

export class ReportGenerator {
  private client;

  constructor() {
    this.client = getAdversusClient();
  }

  async generateCallSummaryReport(startDate: string, endDate: string): Promise<ReportData> {
    try {
      console.log(`[Report Generator] Fetching CDRs for range: ${startDate} to ${endDate}`);
      
      // First, fetch only calls
      const callsResponse = await this.client.getCalls({ startDate, endDate, limit: 10000 });
      
      const response = callsResponse;
      
      // Adversus returns CDR data
      const cdrArray = Array.isArray(response) ? response : (response.cdr || response.data || []);
      console.log(`[Report Generator] Received ${cdrArray.length} total CDR records`);
      
      // Filter by date range only (include all calls, including system calls)
      const startDateObj = new Date(startDate);
      const endDateObj = new Date(endDate);
      
      let outOfRange = 0;
      
      const allCalls = cdrArray.filter((c: any) => {
        // Use startTime for filtering (when the call actually started)
        const callDate = new Date(c.startTime);
        const inRange = callDate >= startDateObj && callDate <= endDateObj;
        
        if (!inRange) outOfRange++;
        
        return inRange;
      });
      
      // Detailed breakdown by type
      const outboundInRange = allCalls.filter((c: any) => c.type === 'outbound').length;
      const inboundInRange = allCalls.filter((c: any) => c.type === 'inbound').length;
      const systemCallsInRange = allCalls.filter((c: any) => parseInt(c.userId) === 0).length;
      
      console.log(`[Report Generator] Date Range Filter Results:
        - Total CDRs received: ${cdrArray.length}
        - Within date range: ${allCalls.length}
        - Out of date range: ${outOfRange}
        - Outbound calls in range: ${outboundInRange}
        - Inbound calls in range: ${inboundInRange}
        - System calls in range: ${systemCallsInRange}
        - Date range: ${startDateObj.toISOString()} to ${endDateObj.toISOString()}
      `);
      
      // Log sample records and check date boundaries
      if (allCalls.length > 0) {
        const sortedCalls = allCalls.sort((a: any, b: any) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
        console.log('[Report Generator] Date boundary check:');
        console.log(`  Earliest call: ${sortedCalls[0].startTime}`);
        console.log(`  Latest call: ${sortedCalls[sortedCalls.length - 1].startTime}`);
        console.log(`  Requested range: ${startDateObj.toISOString()} to ${endDateObj.toISOString()}`);
        
        // Check for calls outside range
        const beforeRange = sortedCalls.filter((c: any) => new Date(c.startTime) < startDateObj).length;
        const afterRange = sortedCalls.filter((c: any) => new Date(c.startTime) > endDateObj).length;
        console.log(`  Calls before range: ${beforeRange}`);
        console.log(`  Calls after range: ${afterRange}`);
        
        // Check date distribution
        const dateGroups = sortedCalls.reduce((acc: any, call: any) => {
          const date = call.startTime.substring(0, 10);
          acc[date] = (acc[date] || 0) + 1;
          return acc;
        }, {});
        console.log('  Date distribution:', dateGroups);
      }
      
      const totalCalls = allCalls.length;
      const inboundCalls = allCalls.filter((c: any) => c.type === 'inbound').length;
      const outboundCalls = allCalls.filter((c: any) => c.type === 'outbound').length;
      const answeredCalls = allCalls.filter((c: any) => c.disposition === 'answered').length;
      const noAnswerCalls = allCalls.filter((c: any) => c.disposition === 'noAnswer').length;
      const busyCalls = allCalls.filter((c: any) => c.disposition === 'busy').length;
      const congestionCalls = allCalls.filter((c: any) => c.disposition === 'congestion').length;
      
      // Extract unique lead IDs from CDRs
      const uniqueLeadIds = new Set<string>();
      allCalls.forEach((call: any) => {
        if (call.leadId) {
          uniqueLeadIds.add(call.leadId.toString());
        }
      });
      
      console.log(`[Report Generator] Found ${uniqueLeadIds.size} unique leads in CDRs`);
      
      // Fetch only these specific leads to get their statuses
      let leadStatusMap = new Map<string, string>();
      
      if (uniqueLeadIds.size > 0) {
        console.log(`[Report Generator] Fetching leads to get statuses for ${uniqueLeadIds.size} leads with calls`);
        
        // Fetch leads page by page and stop when we've found all the ones we need
        const remainingLeadIds = new Set(uniqueLeadIds);
        let currentPage = 1;
        const pageSize = 10000;
        
        while (remainingLeadIds.size > 0) {
          const leadsResponse = await this.client.getLeads({ 
            fetchAll: false,
            limit: pageSize,
            offset: (currentPage - 1) * pageSize
          });
          
          const pageLeads = Array.isArray(leadsResponse) ? leadsResponse : (leadsResponse.leads || leadsResponse.data || []);
          
          if (pageLeads.length === 0) {
            console.log(`[Report Generator] No more leads on page ${currentPage}, stopping`);
            break;
          }
          
          // Process this page of leads
          let foundInThisPage = 0;
          pageLeads.forEach((lead: any) => {
            const leadId = lead.id?.toString();
            if (leadId && remainingLeadIds.has(leadId)) {
              const status = lead.status || 'unknown';
              leadStatusMap.set(leadId, status);
              remainingLeadIds.delete(leadId);
              foundInThisPage++;
            }
          });
          
          console.log(`[Report Generator] Page ${currentPage}: Found ${foundInThisPage} matching leads (${leadStatusMap.size}/${uniqueLeadIds.size} total, ${remainingLeadIds.size} remaining)`);
          
          // Stop if we've found all leads we need
          if (remainingLeadIds.size === 0) {
            console.log(`[Report Generator] ✓ Found all ${uniqueLeadIds.size} leads after ${currentPage} pages`);
            break;
          }
          
          currentPage++;
        }
        
        console.log(`[Report Generator] Final: Matched ${leadStatusMap.size}/${uniqueLeadIds.size} leads with status information`);
        
        // Debug: Show sample lead data
        if (leadStatusMap.size > 0) {
          const firstEntry = Array.from(leadStatusMap.entries())[0];
          if (firstEntry) {
            const [sampleId, sampleStatus] = firstEntry;
            console.log(`[Report Generator] Sample lead status: ${sampleStatus}`);
          }
        }
      }
      
      // Group by status and count
      const leadStatusBreakdown: { [key: string]: number } = {};
      leadStatusMap.forEach((status) => {
        leadStatusBreakdown[status] = (leadStatusBreakdown[status] || 0) + 1;
      });
      
      // Convert to array and sort by count descending
      const leadStatusBreakdownArray = Object.entries(leadStatusBreakdown)
        .map(([status, count]) => ({ status, count }))
        .sort((a, b) => b.count - a.count);
      
      console.log(`[Report Generator] Lead status breakdown:`, leadStatusBreakdown);
      
      // Calculate duration stats
      const totalDuration = allCalls.reduce((sum: number, cdr: any) => sum + (parseInt(cdr.durationSeconds) || 0), 0);
      const totalConversationTime = allCalls.reduce((sum: number, cdr: any) => sum + (parseInt(cdr.conversationSeconds) || 0), 0);
      const avgDuration = totalCalls > 0 ? (totalDuration / totalCalls).toFixed(2) : '0';
      const avgConversationTime = totalCalls > 0 ? (totalConversationTime / totalCalls).toFixed(2) : '0';
      
      // Initialize all dates in the range with zero values
      const callsByDate: any = {};
      const allDatesInRange = eachDayOfInterval({
        start: startOfDay(startDateObj),
        end: endOfDay(endDateObj)
      });
      
      allDatesInRange.forEach(date => {
        const dateStr = format(date, 'yyyy-MM-dd');
        callsByDate[dateStr] = { 
          date: dateStr, 
          total: 0, 
          inbound: 0, 
          outbound: 0, 
          answered: 0, 
          noAnswer: 0,
          inboundAnswered: 0,
          inboundNoAnswer: 0,
          outboundAnswered: 0,
          outboundNoAnswer: 0,
          duration: 0, 
          conversationTime: 0,
          inboundDuration: 0,
          inboundConversationTime: 0,
          outboundDuration: 0,
          outboundConversationTime: 0
        };
      });

      // Process actual calls
      allCalls.forEach((cdr: any) => {
        const date = format(parseISO(cdr.startTime || new Date().toISOString()), 'yyyy-MM-dd');
        
        callsByDate[date].total++;
        
        // Track by type
        const disposition = cdr.disposition || 'unknown';
        
        if (cdr.type === 'inbound') {
          callsByDate[date].inbound++;
          callsByDate[date].inboundDuration += parseInt(cdr.durationSeconds) || 0;
          callsByDate[date].inboundConversationTime += parseInt(cdr.conversationSeconds) || 0;
          if (disposition === 'answered') {
            callsByDate[date].inboundAnswered++;
          } else {
            callsByDate[date].inboundNoAnswer++;
          }
        } else if (cdr.type === 'outbound') {
          callsByDate[date].outbound++;
          callsByDate[date].outboundDuration += parseInt(cdr.durationSeconds) || 0;
          callsByDate[date].outboundConversationTime += parseInt(cdr.conversationSeconds) || 0;
          if (disposition === 'answered') {
            callsByDate[date].outboundAnswered++;
          } else {
            callsByDate[date].outboundNoAnswer++;
          }
        }
        
        // Overall stats
        if (disposition === 'answered') {
          callsByDate[date].answered++;
        } else {
          callsByDate[date].noAnswer++;
        }
        
        callsByDate[date].duration += parseInt(cdr.durationSeconds) || 0;
        callsByDate[date].conversationTime += parseInt(cdr.conversationSeconds) || 0;
      });

      const dailyStats = Object.values(callsByDate).sort((a: any, b: any) => 
        a.date.localeCompare(b.date)
      );

      return {
        reportType: 'call-summary',
        dateRange: { startDate, endDate },
        data: {
          calls: allCalls, // Pass all calls including system calls
          dailyStats,
          leadStatusBreakdown: leadStatusBreakdownArray, // Lead status breakdown from CDRs
        },
        summary: {
          totalCalls,
          inboundCalls,
          outboundCalls,
          answeredCalls,
          noAnswerCalls,
          busyCalls,
          congestionCalls,
          totalDuration,
          totalConversationTime,
          avgDuration: parseFloat(avgDuration),
          avgConversationTime: parseFloat(avgConversationTime),
          answerRate: totalCalls > 0 ? ((answeredCalls / totalCalls) * 100).toFixed(2) : '0',
          totalLeads: leadStatusBreakdownArray.reduce((sum, item) => sum + item.count, 0), // Sum of all lead statuses
        },
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error generating call summary report:', error);
      throw error;
    }
  }

  async generateAgentPerformanceReport(startDate: string, endDate: string): Promise<ReportData> {
    try {
      console.log(`[Agent Performance] Fetching agents, CDRs, and leads for range: ${startDate} to ${endDate}`);
      
      // Fetch users (agents) and CDR data first
      const [usersResponse, cdrResponse] = await Promise.all([
        this.client.getAgents({ limit: 1000 }),
        this.client.getCalls({ startDate, endDate, limit: 10000 }), // Fetch all calls
      ]);

      const usersArray = Array.isArray(usersResponse) ? usersResponse : (usersResponse.users || usersResponse.data || []);
      const cdrArray = Array.isArray(cdrResponse) ? cdrResponse : (cdrResponse.cdr || cdrResponse.data || []);

      // Filter CDR data by date range (include all calls)
      const startDateObj = new Date(startDate);
      const endDateObj = new Date(endDate);
      
      const filteredCdrArray = cdrArray.filter((c: any) => {
        const callDate = new Date(c.startTime);
        const inRange = callDate >= startDateObj && callDate <= endDateObj;
        
        return inRange;
      });

      console.log(`[Agent Performance] Found ${filteredCdrArray.length} calls within date range`);

      // Extract unique lead IDs from filtered CDRs (only leads that were called)
      const uniqueLeadIds = new Set<string>();
      filteredCdrArray.forEach((call: any) => {
        if (call.leadId) {
          uniqueLeadIds.add(call.leadId.toString());
        }
      });

      console.log(`[Agent Performance] Found ${uniqueLeadIds.size} unique leads in CDRs`);

      // Fetch only these specific leads to get their statuses (much more efficient)
      let leadsArray: any[] = [];
      if (uniqueLeadIds.size > 0) {
        console.log(`[Agent Performance] Fetching leads for ${uniqueLeadIds.size} leads with calls`);
        
        // Fetch leads page by page and stop when we've found all the ones we need
        const remainingLeadIds = new Set(uniqueLeadIds);
        let currentPage = 1;
        const pageSize = 10000;
        
        while (remainingLeadIds.size > 0) {
          const leadsResponse = await this.client.getLeads({ 
            fetchAll: false,
            limit: pageSize,
            offset: (currentPage - 1) * pageSize
          });
          
          const pageLeads = Array.isArray(leadsResponse) ? leadsResponse : (leadsResponse.leads || leadsResponse.data || []);
          
          if (pageLeads.length === 0) {
            console.log(`[Agent Performance] No more leads on page ${currentPage}, stopping`);
            break;
          }
          
          // Process this page of leads
          let foundInThisPage = 0;
          pageLeads.forEach((lead: any) => {
            const leadId = lead.id?.toString();
            if (leadId && remainingLeadIds.has(leadId)) {
              leadsArray.push(lead);
              remainingLeadIds.delete(leadId);
              foundInThisPage++;
            }
          });
          
          console.log(`[Agent Performance] Page ${currentPage}: Found ${foundInThisPage} matching leads (${leadsArray.length}/${uniqueLeadIds.size} total, ${remainingLeadIds.size} remaining)`);
          
          // Stop if we've found all leads we need
          if (remainingLeadIds.size === 0) {
            console.log(`[Agent Performance] ✓ Found all ${uniqueLeadIds.size} leads after ${currentPage} pages`);
            break;
          }
          
          currentPage++;
        }
      }

      // Create a map of agent ID to agent info and initialize all agents with zero stats
      const agentMap: any = {};
      const agentStats: any = {};
      
      usersArray.forEach((user: any) => {
        agentMap[user.id] = {
          name: user.name || user.username || user.email || `User ${user.id}`,
          email: user.email || '',
        };
        
        // Initialize all agents with zero stats
        agentStats[user.id] = {
          agentId: user.id,
          agentName: user.name || user.username || user.email || `User ${user.id}`,
          email: user.email || '',
          totalCalls: 0,
          inboundCalls: 0,
          outboundCalls: 0,
          answeredCalls: 0,
          completedCalls: 0, // Alias for answeredCalls
          missedCalls: 0,
          totalDuration: 0,
          totalConversationTime: 0,
          totalTalkTime: 0, // Alias for totalConversationTime
          avgDuration: 0,
          avgConversationTime: 0,
          avgTalkTime: 0, // Alias for avgConversationTime
          answerRate: 0,
          completionRate: 0, // Alias for answerRate
          // Conversion metrics
          totalLeads: 0,
          convertedLeads: 0,
          conversionRate: 0,
        };
      });

      // Add entry for system calls (userId = 0)
      agentStats[0] = {
        agentId: 0,
        agentName: 'System/Automated',
        email: '',
        totalCalls: 0,
        inboundCalls: 0,
        outboundCalls: 0,
        answeredCalls: 0,
        completedCalls: 0,
        missedCalls: 0,
        totalDuration: 0,
        totalConversationTime: 0,
        totalTalkTime: 0,
        avgDuration: 0,
        avgConversationTime: 0,
        avgTalkTime: 0,
        answerRate: 0,
        completionRate: 0,
        // Conversion metrics
        totalLeads: 0,
        convertedLeads: 0,
        conversionRate: 0,
      };

      // Group CDRs by agent (userId) - include all calls
      filteredCdrArray.forEach((cdr: any) => {
        const agentId = parseInt(cdr.userId) || 0;
        
        // Count all calls (agents and system)
        if (agentStats[agentId]) {
          agentStats[agentId].totalCalls++;
          agentStats[agentId].totalDuration += parseInt(cdr.durationSeconds) || 0;
          agentStats[agentId].totalConversationTime += parseInt(cdr.conversationSeconds) || 0;
          agentStats[agentId].totalTalkTime += parseInt(cdr.conversationSeconds) || 0; // Alias for totalConversationTime
          
          // Track call type
          if (cdr.type === 'inbound') {
            agentStats[agentId].inboundCalls++;
          } else if (cdr.type === 'outbound') {
            agentStats[agentId].outboundCalls++;
          }
          
          if (cdr.disposition === 'answered') {
            agentStats[agentId].answeredCalls++;
            agentStats[agentId].completedCalls++; // Alias for answeredCalls
          } else {
            agentStats[agentId].missedCalls++;
          }
        }
      });

      // Process leads data for conversion metrics
      // Since we only fetched leads that were called, we can use them directly
      // Filter by date range for conversions (when lead was modified/converted)
      const filteredLeads = leadsArray.filter((lead: any) => {
        // Only include leads that were modified (converted) within the date range
        if (lead.lastModifiedTime) {
          const leadModifiedDate = new Date(lead.lastModifiedTime);
          return leadModifiedDate >= startDateObj && leadModifiedDate <= endDateObj;
        }
        return false;
      });

      console.log(`[Agent Performance] Found ${filteredLeads.length} leads modified within date range (from ${leadsArray.length} leads that were called)`);

      // Create a map of leadId to agents who called them
      const leadToAgentsMap = new Map<string, Set<number>>();
      
      // Build the mapping based on actual call activity
      filteredCdrArray.forEach((cdr: any) => {
        if (cdr.leadId) {
          const leadId = cdr.leadId.toString();
          const agentId = parseInt(cdr.userId) || 0;
          
          if (!leadToAgentsMap.has(leadId)) {
            leadToAgentsMap.set(leadId, new Set());
          }
          leadToAgentsMap.get(leadId)!.add(agentId);
        }
      });

      // Process filtered leads and associate with agents who actually called them
      filteredLeads.forEach((lead: any) => {
        const leadId = lead.id?.toString();
        if (leadId && leadToAgentsMap.has(leadId)) {
          const agentsWhoCalled = leadToAgentsMap.get(leadId)!;
          
          // Count this lead for each agent who called it
          agentsWhoCalled.forEach(agentId => {
            if (agentStats[agentId]) {
              agentStats[agentId].totalLeads++;
              if (lead.status === 'success') {
                agentStats[agentId].convertedLeads++;
              }
            }
          });
        }
      });

      // Calculate averages and rates
      Object.keys(agentStats).forEach((agentId) => {
        const stats = agentStats[agentId];
        stats.avgDuration = stats.totalCalls > 0 
          ? (stats.totalDuration / stats.totalCalls).toFixed(2)
          : 0;
        stats.avgConversationTime = stats.totalCalls > 0 
          ? (stats.totalConversationTime / stats.totalCalls).toFixed(2)
          : 0;
        stats.avgTalkTime = stats.avgConversationTime; // Alias for avgConversationTime
        stats.answerRate = stats.totalCalls > 0 
          ? ((stats.answeredCalls / stats.totalCalls) * 100).toFixed(2) 
          : 0;
        stats.completionRate = stats.answerRate; // Alias for answerRate
        
        // Calculate conversion rate based on calls (converted leads / total calls)
        stats.conversionRate = stats.totalCalls > 0 
          ? ((stats.convertedLeads / stats.totalCalls) * 100).toFixed(2)
          : 0;
      });

      // Sort by totalCalls (descending), showing all agents including those with 0 calls
      const agentPerformance = Object.values(agentStats)
        .sort((a: any, b: any) => b.totalCalls - a.totalCalls);

      return {
        reportType: 'agent-performance',
        dateRange: { startDate, endDate },
        data: {
          agentPerformance,
        },
        summary: {
          totalAgents: agentPerformance.length,
          activeAgents: agentPerformance.filter((a: any) => a.totalCalls > 0).length,
          totalCalls: filteredCdrArray.length,
          totalLeads: filteredLeads.length,
          totalConvertedLeads: filteredLeads.filter((l: any) => l.status === 'success').length,
        },
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error generating agent performance report:', error);
      throw error;
    }
  }

      async generateCampaignAnalyticsReport(startDate: string, endDate: string): Promise<ReportData> {
        try {
          console.log(`[Campaign Analytics] Fetching CDRs and Leads for range: ${startDate} to ${endDate}`);
          console.log(`[Campaign Analytics] Fetching all data for accurate reporting...`);
          
          // Fetch campaigns and CDR data first
          const [campaignsResponse, cdrResponse] = await Promise.all([
            this.client.getCampaigns({ limit: 50 }), // Campaigns are usually few
            this.client.getCalls({ startDate, endDate, limit: 10000 }), // Fetch all calls
          ]);

          const campaignsArray = Array.isArray(campaignsResponse) ? campaignsResponse : (campaignsResponse.campaigns || campaignsResponse.data || []);
          const cdrArray = Array.isArray(cdrResponse) ? cdrResponse : (cdrResponse.cdr || cdrResponse.data || []);

          // Filter CDR data by date range
          const startDateObj = new Date(startDate);
          const endDateObj = new Date(endDate);
          
          const filteredCdrArray = cdrArray.filter((c: any) => {
            const callDate = new Date(c.startTime);
            return callDate >= startDateObj && callDate <= endDateObj;
          });

          console.log(`[Campaign Analytics] Found ${filteredCdrArray.length} calls within date range`);

          // Extract unique lead IDs from filtered CDRs (only leads that were called)
          const uniqueLeadIds = new Set<string>();
          filteredCdrArray.forEach((call: any) => {
            if (call.leadId) {
              uniqueLeadIds.add(call.leadId.toString());
            }
          });

          console.log(`[Campaign Analytics] Found ${uniqueLeadIds.size} unique leads in CDRs`);

          // Fetch only these specific leads to get their statuses (much more efficient)
          let leadsArray: any[] = [];
          if (uniqueLeadIds.size > 0) {
            console.log(`[Campaign Analytics] Fetching leads for ${uniqueLeadIds.size} leads with calls`);
            
            // Fetch leads page by page and stop when we've found all the ones we need
            const remainingLeadIds = new Set(uniqueLeadIds);
            let currentPage = 1;
            const pageSize = 10000;
            
            while (remainingLeadIds.size > 0) {
              const leadsResponse = await this.client.getLeads({ 
                fetchAll: false,
                limit: pageSize,
                offset: (currentPage - 1) * pageSize
              });
              
              const pageLeads = Array.isArray(leadsResponse) ? leadsResponse : (leadsResponse.leads || leadsResponse.data || []);
              
              if (pageLeads.length === 0) {
                console.log(`[Campaign Analytics] No more leads on page ${currentPage}, stopping`);
                break;
              }
              
              let foundInThisPage = 0;
              pageLeads.forEach((lead: any) => {
                const leadId = lead.id?.toString();
                if (leadId && remainingLeadIds.has(leadId)) {
                  leadsArray.push(lead);
                  remainingLeadIds.delete(leadId);
                  foundInThisPage++;
                }
              });
              
              console.log(`[Campaign Analytics] Page ${currentPage}: Found ${foundInThisPage} matching leads (${leadsArray.length}/${uniqueLeadIds.size} total, ${remainingLeadIds.size} remaining)`);
              
              if (remainingLeadIds.size === 0) {
                console.log(`[Campaign Analytics] ✓ Found all ${uniqueLeadIds.size} leads after ${currentPage} pages`);
                break;
              }
              
              currentPage++;
            }
          }

          // Filter leads by date range - only include leads that were modified (converted) within the date range
          const filteredLeadsArray = leadsArray.filter((lead: any) => {
            // Only include leads that were modified (converted) within the date range
            if (lead.lastModifiedTime) {
              const leadModifiedDate = new Date(lead.lastModifiedTime);
              return leadModifiedDate >= startDateObj && leadModifiedDate <= endDateObj;
            }
            return false;
          });

          console.log(`[Campaign Analytics] Processing ${filteredCdrArray.length} CDR records and ${filteredLeadsArray.length} leads (modified within date range) across ${campaignsArray.length} campaigns`);
          
          // Debug: Log sample leads data
          if (filteredLeadsArray.length > 0) {
            console.log('[Campaign Analytics] Sample leads:', filteredLeadsArray.slice(0, 3).map((lead: any) => ({
              id: lead.id,
              campaignId: lead.campaignId,
              status: lead.status,
              lastModifiedTime: lead.lastModifiedTime
            })));
          }

          // Create campaign map for names
          const campaignMap: any = {};
          campaignsArray.forEach((campaign: any) => {
            campaignMap[campaign.id] = {
              name: campaign.settings?.name || `Campaign ${campaign.id}`,
              status: campaign.settings?.active ? 'active' : 'inactive',
            };
          });

          // Initialize campaign stats for all campaigns
          const campaignStats: any = {};
          campaignsArray.forEach((campaign: any) => {
            campaignStats[campaign.id] = {
              campaignId: campaign.id,
              campaignName: campaign.settings?.name || `Campaign ${campaign.id}`,
              status: campaign.settings?.active ? 'active' : 'inactive',
              totalCalls: 0,
              inboundCalls: 0,
              outboundCalls: 0,
              answeredCalls: 0,
              completedCalls: 0, // Alias for answeredCalls
              missedCalls: 0,
              busyCalls: 0,
              congestionCalls: 0,
              totalDuration: 0,
              totalConversationTime: 0,
              totalTalkTime: 0, // Alias for totalConversationTime
              avgDuration: 0,
              avgConversationTime: 0,
              avgTalkTime: 0, // Alias for avgConversationTime
              answerRate: 0,
              completionRate: 0, // Alias for answerRate
              uniqueCallers: new Set(),
              uniqueDestinations: new Set(),
              // Lead conversion metrics
              totalLeads: 0,
              convertedLeads: 0,
              conversionRate: 0,
            };
          });

          // Add entry for system calls (campaignId = 0)
          campaignStats[0] = {
            campaignId: 0,
            campaignName: 'System/Automated',
            status: 'active',
            totalCalls: 0,
            inboundCalls: 0,
            outboundCalls: 0,
            answeredCalls: 0,
            completedCalls: 0,
            missedCalls: 0,
            busyCalls: 0,
            congestionCalls: 0,
            totalDuration: 0,
            totalConversationTime: 0,
            totalTalkTime: 0,
            avgDuration: 0,
            avgConversationTime: 0,
            avgTalkTime: 0,
            answerRate: 0,
            completionRate: 0,
            uniqueCallers: new Set(),
            uniqueDestinations: new Set(),
            totalLeads: 0,
            convertedLeads: 0,
            conversionRate: 0,
          };

          // Process CDR data by campaign
          filteredCdrArray.forEach((cdr: any) => {
            const campaignId = parseInt(cdr.campaignId) || 0;
            
            if (campaignStats[campaignId]) {
              campaignStats[campaignId].totalCalls++;
              campaignStats[campaignId].totalDuration += parseInt(cdr.durationSeconds) || 0;
              campaignStats[campaignId].totalConversationTime += parseInt(cdr.conversationSeconds) || 0;
              campaignStats[campaignId].totalTalkTime += parseInt(cdr.conversationSeconds) || 0;
              
              // Track call type
              if (cdr.type === 'inbound') {
                campaignStats[campaignId].inboundCalls++;
              } else if (cdr.type === 'outbound') {
                campaignStats[campaignId].outboundCalls++;
              }
              
              // Track disposition
              const disposition = cdr.disposition || 'unknown';
              if (disposition === 'answered') {
                campaignStats[campaignId].answeredCalls++;
                campaignStats[campaignId].completedCalls++;
              } else if (disposition === 'noAnswer') {
                campaignStats[campaignId].missedCalls++;
              } else if (disposition === 'busy') {
                campaignStats[campaignId].busyCalls++;
              } else if (disposition === 'congestion') {
                campaignStats[campaignId].congestionCalls++;
              }
              
              // Track unique numbers
              if (cdr.source) campaignStats[campaignId].uniqueCallers.add(cdr.source);
              if (cdr.destination) campaignStats[campaignId].uniqueDestinations.add(cdr.destination);
            }
          });

          // Process leads data by campaign for conversion metrics
          filteredLeadsArray.forEach((lead: any) => {
            const campaignId = parseInt(lead.campaignId) || 0;
            
            if (campaignStats[campaignId]) {
              campaignStats[campaignId].totalLeads++;
              
              // Count converted leads (status = 'success')
              if (lead.status === 'success') {
                campaignStats[campaignId].convertedLeads++;
              }
            }
          });

          // Debug: Log lead processing results
          console.log('[Campaign Analytics] Lead processing results:');
          Object.keys(campaignStats).forEach((campaignId) => {
            const stats = campaignStats[campaignId];
            if (stats.totalLeads > 0) {
              console.log(`  Campaign ${campaignId} (${stats.campaignName}): ${stats.totalLeads} leads, ${stats.convertedLeads} converted`);
            }
          });

          // Calculate averages, rates, and conversion metrics
          Object.keys(campaignStats).forEach((campaignId) => {
            const stats = campaignStats[campaignId];
            
            // Call metrics
            stats.avgDuration = stats.totalCalls > 0 
              ? (stats.totalDuration / stats.totalCalls).toFixed(2)
              : 0;
            stats.avgConversationTime = stats.totalCalls > 0 
              ? (stats.totalConversationTime / stats.totalCalls).toFixed(2)
              : 0;
            stats.avgTalkTime = stats.avgConversationTime; // Alias
            stats.answerRate = stats.totalCalls > 0 
              ? ((stats.answeredCalls / stats.totalCalls) * 100).toFixed(2) 
              : 0;
            stats.completionRate = stats.answerRate; // Alias
            
            // Lead conversion metrics
            stats.conversionRate = stats.totalLeads > 0 
              ? ((stats.convertedLeads / stats.totalLeads) * 100).toFixed(2)
              : 0;
            
            // Convert Sets to counts
            stats.uniqueCallersCount = stats.uniqueCallers.size;
            stats.uniqueDestinationsCount = stats.uniqueDestinations.size;
            delete stats.uniqueCallers;
            delete stats.uniqueDestinations;
          });

          // Sort by totalCalls (descending)
          const campaignAnalytics = Object.values(campaignStats)
            .sort((a: any, b: any) => b.totalCalls - a.totalCalls);

          return {
            reportType: 'campaign-analytics',
            dateRange: { startDate, endDate },
            data: {
              campaignAnalytics,
            },
            summary: {
              totalCampaigns: campaignAnalytics.length,
              activeCampaigns: campaignAnalytics.filter((c: any) => c.status === 'active').length,
              totalCalls: filteredCdrArray.length,
              totalAnsweredCalls: filteredCdrArray.filter((c: any) => c.disposition === 'answered').length,
              totalDuration: filteredCdrArray.reduce((sum: number, c: any) => sum + (parseInt(c.durationSeconds) || 0), 0),
              totalLeads: filteredLeadsArray.length,
              totalConvertedLeads: filteredLeadsArray.filter((l: any) => l.status === 'success').length,
            },
            generatedAt: new Date().toISOString(),
          };
        } catch (error) {
          console.error('Error generating campaign analytics report:', error);
          throw error;
        }
      }



  async generateReport(reportType: string, startDate: string, endDate: string): Promise<ReportData> {
    switch (reportType) {
      case 'call-summary':
        return this.generateCallSummaryReport(startDate, endDate);
      case 'agent-performance':
        return this.generateAgentPerformanceReport(startDate, endDate);
      case 'campaign-analytics':
        return this.generateCampaignAnalyticsReport(startDate, endDate);
      default:
        throw new Error(`Unknown report type: ${reportType}`);
    }
  }
}

export function exportToCSV(data: any[], filename: string) {
  if (!data || data.length === 0) {
    console.error('No data to export');
    return;
  }

  // Get headers from first object
  const headers = Object.keys(data[0]);
  
  // Create CSV content
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        const value = row[header];
        // Escape commas and quotes
        const escaped = String(value).replace(/"/g, '""');
        return `"${escaped}"`;
      }).join(',')
    )
  ].join('\n');

  // Create download link
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

