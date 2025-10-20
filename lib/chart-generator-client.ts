/**
 * Client-side chart generator
 * Generates charts using Chart.js and converts them to base64 images
 */
import { Chart, ChartConfiguration, registerables } from 'chart.js';

// Register Chart.js components
if (typeof window !== 'undefined') {
  Chart.register(...registerables);
}

export interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor?: string | string[];
    borderColor?: string | string[];
    borderWidth?: number;
  }[];
}

export class ClientChartGenerator {
  /**
   * Generate a bar chart and return as base64 image
   */
  static async generateBarChart(data: ChartData, options?: any): Promise<string> {
    return this.generateChart('bar', data, options);
  }

  /**
   * Generate a line chart and return as base64 image
   */
  static async generateLineChart(data: ChartData, options?: any): Promise<string> {
    return this.generateChart('line', data, options);
  }

  /**
   * Generate a pie chart and return as base64 image
   */
  static async generatePieChart(data: ChartData, options?: any): Promise<string> {
    return this.generateChart('pie', data, options);
  }

  /**
   * Generate a chart of any type and return as base64 image
   */
  private static async generateChart(
    type: 'bar' | 'line' | 'pie',
    data: ChartData,
    options?: any
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        // Create a canvas element
        const canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 400;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error('Could not get canvas context');
        }

        // Create the chart configuration
        const config: ChartConfiguration = {
          type,
          data,
          options: {
            ...options,
            responsive: false,
            animation: {
              onComplete: () => {
                // Convert canvas to base64 image
                const base64Image = canvas.toDataURL('image/png');
                
                // Clean up
                chart.destroy();
                canvas.remove();
                
                resolve(base64Image);
              },
            },
          },
        };

        // Create the chart
        const chart = new Chart(ctx, config);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Generate multiple charts at once
   */
  static async generateCharts(charts: Array<{
    type: 'bar' | 'line' | 'pie';
    data: ChartData;
    options?: any;
    key: string;
  }>): Promise<Record<string, string>> {
    const results: Record<string, string> = {};
    
    for (const chart of charts) {
      try {
        const image = await this.generateChart(chart.type, chart.data, chart.options);
        results[chart.key] = image;
      } catch (error) {
        console.error(`Failed to generate chart: ${chart.key}`, error);
      }
    }
    
    return results;
  }
}

