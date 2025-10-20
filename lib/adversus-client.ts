import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

export interface AdversusConfig {
  apiUrl: string;
  username: string;
  password: string;
}

export class AdversusClient {
  private client: AxiosInstance;

  constructor(config: AdversusConfig) {
    // Create base64 encoded credentials for Basic Auth
    const credentials = Buffer.from(`${config.username}:${config.password}`).toString('base64');
    
    this.client = axios.create({
      baseURL: config.apiUrl,
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      auth: {
        username: config.username,
        password: config.password,
      },
    });

    // Add request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        console.log(`[Adversus API] ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('[Adversus API Error]', error.response?.data || error.message);
        return Promise.reject(error);
      }
    );
  }

  // Generic GET request
  async get<T = any>(endpoint: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.get<T>(endpoint, config);
    return response.data;
  }

  // Generic POST request
  async post<T = any>(endpoint: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.post<T>(endpoint, data, config);
    return response.data;
  }

  // Generic PUT request
  async put<T = any>(endpoint: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.put<T>(endpoint, data, config);
    return response.data;
  }

  // Generic DELETE request
  async delete<T = any>(endpoint: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.delete<T>(endpoint, config);
    return response.data;
  }

  // Adversus API endpoints
  
  // Get Call Detail Records (CDRs) - actual call data with pagination
  async getCallLogs(params?: {
    startDate?: string;
    endDate?: string;
    userId?: number;
    limit?: number;
    offset?: number;
    fetchAll?: boolean; // New parameter to fetch all pages
  }) {
    // Build filters object for CDR endpoint
    const filters: any = {};
    
    // Only use userId filter for now, date filtering will be done client-side
    if (params?.userId) {
      filters.userId = params.userId;
    }

    const pageSize = params?.limit || 1000; // Use 1000 for efficiency (32 pages vs 320 pages)
    const fetchAll = params?.fetchAll !== false; // Default to true

    if (!fetchAll) {
      // Single page fetch
      const queryParams: any = {
        pageSize,
        page: params?.offset ? Math.floor(params.offset / pageSize) + 1 : 1,
        sortProperty: 'startTime',
        sortDirection: 'desc'
      };

      if (Object.keys(filters).length > 0) {
        queryParams.filters = JSON.stringify(filters);
      }

      return this.get('/cdr', { params: queryParams });
    }

    // Fetch all pages until no more data
    const allCdrs: any[] = [];
    let currentPage = 1;
    let hasMorePages = true;

    console.log('Starting to fetch all CDR pages...');
    
    // Rate limiting helper
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    
    // No page limits - fetch all data as needed
    const MAX_REQUESTS_PER_HOUR = 800; // Leave margin for other API calls

    while (hasMorePages) {
      const queryParams: any = {
        pageSize,
        page: currentPage,
        sortProperty: 'startTime',
        sortDirection: 'desc',  // Get most recent calls first
        includeMeta: true  // Include pagination metadata
      };

      if (Object.keys(filters).length > 0) {
        queryParams.filters = JSON.stringify(filters);
      }

      try {
        console.log(`Fetching CDR page ${currentPage}...`);
        
        // Rate limiting: Add delay between requests to respect 60 requests/minute limit
        if (currentPage > 1) {
          await delay(1100); // ~55 requests per minute (safe margin)
        }
        
        const response = await this.get('/cdr', { params: queryParams });
        const cdrArray = Array.isArray(response) ? response : (response.cdr || response.data || []);
        const meta = response.meta;
        
        if (cdrArray.length > 0) {
          allCdrs.push(...cdrArray);
          
          // Check the date range of this page
          const oldestInPage = cdrArray[cdrArray.length - 1]?.startTime;
          console.log(`  → Page ${currentPage}: ${cdrArray.length} records (Total: ${allCdrs.length}, Oldest: ${oldestInPage})`);
          
          if (meta && meta.pagination) {
            console.log(`  → Meta: Page ${meta.pagination.page}/${meta.pagination.pageCount}, Total: ${meta.pagination.total}`);
            
            // Use meta data to determine if there are more pages
            if (currentPage >= meta.pagination.pageCount) {
              console.log(`  → Last page reached (page ${currentPage} >= ${meta.pagination.pageCount})`);
              hasMorePages = false;
            } else {
              currentPage++;
            }
          } else {
            // Fallback to old logic if no meta data
            if (cdrArray.length < pageSize) {
              console.log(`  → Last page reached (received ${cdrArray.length} < ${pageSize})`);
              hasMorePages = false;
            } else {
              currentPage++;
            }
          }
        } else {
          console.log(`  → No more data on page ${currentPage}`);
          hasMorePages = false;
        }
      } catch (error: any) {
        console.error(`Error fetching page ${currentPage}:`, error);
        
        // Handle rate limit errors (429 status code)
        if (error.response?.status === 429) {
          console.warn('Rate limit exceeded, waiting 60 seconds before retry...');
          await delay(60000); // Wait 1 minute
          // Don't increment currentPage, retry the same page
          continue;
        }
        
        hasMorePages = false;
      }
    }

    console.log(`✓ Completed: Fetched ${allCdrs.length} total CDR records across ${currentPage} pages`);
    return { cdr: allCdrs };
  }

      // Get leads data with optimized fetching options
      async getLeads(params?: {
        startDate?: string;
        endDate?: string;
        status?: string;
        campaignId?: number;
        leadIds?: string[]; // New parameter to filter by specific lead IDs
        limit?: number;
        offset?: number;
        fetchAll?: boolean;
        fastMode?: boolean; // New option for faster fetching
      }) {
        const pageSize = params?.limit || (params?.fastMode ? 2000 : 1000);
        const fetchAll = params?.fetchAll !== false; // Default to true
        const fastMode = params?.fastMode || false;

        // Build filters for leads endpoint
        const filters: any = {};
        
        if (params?.campaignId) {
          filters.campaignId = params.campaignId;
        }
        
        if (params?.status) {
          filters.status = params.status;
        }
        
        // Note: Date filtering is done in memory after fetching
        // The API doesn't support date range filtering in the way we need

        if (!fetchAll) {
          // Single page fetch
          const queryParams: any = {
            pageSize,
            page: params?.offset ? Math.floor(params.offset / pageSize) + 1 : 1,
            sortProperty: 'lastModifiedTime',
            sortDirection: 'desc'
          };

          if (Object.keys(filters).length > 0) {
            queryParams.filters = JSON.stringify(filters);
          }

          return this.get('/leads', { params: queryParams });
        }

        // Fetch all pages until no more data
        const allLeads: any[] = [];
        let currentPage = 1;
        let hasMorePages = true;

        console.log('Starting to fetch all leads pages...');
        
        // Rate limiting helper
        const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
        
        // No page limits - fetch all data as needed
        const MAX_REQUESTS_PER_HOUR = 800;

        while (hasMorePages) {
          const queryParams: any = {
            pageSize,
            page: currentPage,
            sortProperty: 'lastModifiedTime',
            sortDirection: 'desc',
            includeMeta: true
          };

          if (Object.keys(filters).length > 0) {
            queryParams.filters = JSON.stringify(filters);
          }

          try {
            console.log(`Fetching leads page ${currentPage}...`);
            
            // Optimized rate limiting - even faster in fast mode
            if (currentPage > 1) {
              await delay(fastMode ? 200 : 500); // 200ms in fast mode, 500ms normal
            }
            
            const response = await this.get('/leads', { params: queryParams });
            const leadsArray = Array.isArray(response) ? response : (response.leads || response.data || []);
            const meta = response.meta;
            
            if (leadsArray.length > 0) {
              allLeads.push(...leadsArray);
              
              console.log(`  → Page ${currentPage}: ${leadsArray.length} records (Total: ${allLeads.length})`);
              
              if (meta && meta.pagination) {
                console.log(`  → Meta: Page ${meta.pagination.page}/${meta.pagination.pageCount}, Total: ${meta.pagination.total}`);
                
                if (currentPage >= meta.pagination.pageCount) {
                  console.log(`  → Last page reached (page ${currentPage} >= ${meta.pagination.pageCount})`);
                  hasMorePages = false;
                } else {
                  currentPage++;
                }
              } else {
                if (leadsArray.length < pageSize) {
                  console.log(`  → Last page reached (received ${leadsArray.length} < ${pageSize})`);
                  hasMorePages = false;
                } else {
                  currentPage++;
                }
              }
            } else {
              console.log(`  → No more data on page ${currentPage}`);
              hasMorePages = false;
            }
          } catch (error: any) {
            console.error(`Error fetching leads page ${currentPage}:`, error);
            
            if (error.response?.status === 429) {
              console.warn('Rate limit exceeded, waiting 60 seconds before retry...');
              await delay(60000);
              continue;
            }
            
            hasMorePages = false;
          }
        }

        console.log(`✓ Completed: Fetched ${allLeads.length} total leads across ${currentPage} pages`);
        return { leads: allLeads };
      }

  // Get users (agents)
  async getAgents(params?: { limit?: number; offset?: number }) {
    return this.get('/users', { params });
  }

  // Get campaigns
  async getCampaigns(params?: { limit?: number; offset?: number }) {
    return this.get('/campaigns', { params });
  }

  // Get calls data - using call-logs endpoint for actual CDRs
  async getCalls(params?: {
    startDate?: string;
    endDate?: string;
    status?: string;
    limit?: number;
    offset?: number;
    fetchAll?: boolean;
  }) {
    return this.getCallLogs(params);
  }

  // Get statistics - aggregate from call logs
  async getStatistics(params?: {
    startDate?: string;
    endDate?: string;
    groupBy?: string;
  }) {
    return this.getCallLogs({ 
      startDate: params?.startDate, 
      endDate: params?.endDate,
      limit: 10000 
    });
  }
}

// Singleton instance
let adversusClient: AdversusClient | null = null;

export function getAdversusClient(): AdversusClient {
  if (!adversusClient) {
    const config: AdversusConfig = {
      apiUrl: process.env.ADVERSUS_API_URL || 'https://api.adversus.io/v1',
      username: process.env.ADVERSUS_API_USERNAME || '',
      password: process.env.ADVERSUS_API_PASSWORD || '',
    };

    if (!config.username || !config.password) {
      throw new Error('ADVERSUS_API_USERNAME and ADVERSUS_API_PASSWORD must be configured');
    }

    adversusClient = new AdversusClient(config);
  }

  return adversusClient;
}
