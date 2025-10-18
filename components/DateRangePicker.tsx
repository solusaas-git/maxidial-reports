'use client';

import { useState, useEffect } from 'react';
import { Calendar } from 'lucide-react';

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
}

export default function DateRangePicker({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
}: DateRangePickerProps) {
  const [selectedQuickRange, setSelectedQuickRange] = useState<string>('');
  // Convert date to datetime-local format if needed
  const formatForInput = (date: string) => {
    if (!date) return '';
    // If it's already datetime format (YYYY-MM-DDTHH:mm), use it
    if (date.includes('T')) return date.substring(0, 16);
    // If it's just date (YYYY-MM-DD), add time 00:00
    return `${date}T00:00`;
  };

  const handleStartChange = (value: string) => {
    // Convert to ISO format for API
    if (value) {
      onStartDateChange(value + ':00Z');
      // Clear quick range selection when manually changing dates
      setSelectedQuickRange('');
    }
  };

  const handleEndChange = (value: string) => {
    // Convert to ISO format for API
    if (value) {
      onEndDateChange(value + ':59Z');
      // Clear quick range selection when manually changing dates
      setSelectedQuickRange('');
    }
  };

  // Quick date range helpers - always use UTC 00:00 and 23:59
  const setQuickRange = (range: string) => {
    const now = new Date();
    let startDate = '';
    let endDate = '';

    const formatDateUTC = (year: number, month: number, day: number, isEnd: boolean = false) => {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return isEnd ? `${dateStr}T23:59:59Z` : `${dateStr}T00:00:00Z`;
    };

    switch (range) {
      case 'today':
        startDate = formatDateUTC(now.getFullYear(), now.getMonth(), now.getDate());
        endDate = formatDateUTC(now.getFullYear(), now.getMonth(), now.getDate(), true);
        break;
      
      case 'yesterday':
        startDate = formatDateUTC(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        endDate = formatDateUTC(now.getFullYear(), now.getMonth(), now.getDate() - 1, true);
        break;
      
      case 'this-week':
        const dayOfWeek = now.getDay();
        const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Monday is start of week
        const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday);
        startDate = formatDateUTC(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate());
        endDate = formatDateUTC(now.getFullYear(), now.getMonth(), now.getDate(), true);
        break;
      
      case 'last-week':
        const lastWeekDay = now.getDay();
        const diffToLastMonday = lastWeekDay === 0 ? -13 : -6 - lastWeekDay;
        const lastWeekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToLastMonday);
        const lastWeekEnd = new Date(lastWeekStart.getFullYear(), lastWeekStart.getMonth(), lastWeekStart.getDate() + 6);
        startDate = formatDateUTC(lastWeekStart.getFullYear(), lastWeekStart.getMonth(), lastWeekStart.getDate());
        endDate = formatDateUTC(lastWeekEnd.getFullYear(), lastWeekEnd.getMonth(), lastWeekEnd.getDate(), true);
        break;
      
      case 'this-month':
        startDate = formatDateUTC(now.getFullYear(), now.getMonth(), 1);
        endDate = formatDateUTC(now.getFullYear(), now.getMonth(), now.getDate(), true);
        break;
      
      case 'last-month':
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0); // Last day of previous month
        startDate = formatDateUTC(lastMonthStart.getFullYear(), lastMonthStart.getMonth(), lastMonthStart.getDate());
        endDate = formatDateUTC(lastMonthEnd.getFullYear(), lastMonthEnd.getMonth(), lastMonthEnd.getDate(), true);
        break;
      
      case 'this-year':
        startDate = formatDateUTC(now.getFullYear(), 0, 1);
        endDate = formatDateUTC(now.getFullYear(), now.getMonth(), now.getDate(), true);
        break;
      
      case 'last-year':
        startDate = formatDateUTC(now.getFullYear() - 1, 0, 1);
        endDate = formatDateUTC(now.getFullYear() - 1, 11, 31, true);
        break;
    }

    onStartDateChange(startDate);
    onEndDateChange(endDate);
    setSelectedQuickRange(range);
  };

  const quickRanges = [
    { id: 'today', label: 'Today' },
    { id: 'yesterday', label: 'Yesterday' },
    { id: 'this-week', label: 'This Week' },
    { id: 'last-week', label: 'Last Week' },
    { id: 'this-month', label: 'This Month' },
    { id: 'last-month', label: 'Last Month' },
    { id: 'this-year', label: 'This Year' },
    { id: 'last-year', label: 'Last Year' },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Quick Range Selection */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-2">
        {/* Mobile: Select Dropdown */}
        <div className="sm:hidden">
          <label className="block text-sm font-medium text-gray-700 mb-2">Quick Select:</label>
          <select
            value={selectedQuickRange}
            onChange={(e) => {
              if (e.target.value) {
                setQuickRange(e.target.value);
              }
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="">Choose a quick range...</option>
            {quickRanges.map((range) => (
              <option key={range.id} value={range.id}>
                {range.label}
              </option>
            ))}
          </select>
        </div>

        {/* Desktop: Badge Buttons */}
        <div className="hidden sm:flex sm:flex-wrap sm:gap-2">
          <span className="text-sm font-medium text-gray-700 self-center mr-2">Quick Select:</span>
          {quickRanges.map((range) => (
            <button
              key={range.id}
              onClick={() => setQuickRange(range.id)}
              className={`px-3 py-1 text-sm font-medium border rounded-full transition-all duration-200 ${
                selectedQuickRange === range.id
                  ? 'bg-blue-500 border-blue-500 text-white hover:bg-blue-600'
                  : 'text-gray-700 bg-white border-gray-300 hover:bg-blue-50 hover:border-blue-500 hover:text-blue-600'
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      {/* Date & Time Inputs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
        <div className="flex flex-col gap-2 flex-1 w-full">
          <label className="text-sm font-medium text-gray-700">
            Start Date & Time
          </label>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-500 flex-shrink-0" />
            <input
              type="datetime-local"
              value={formatForInput(startDate)}
              onChange={(e) => handleStartChange(e.target.value)}
              className="form-input flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
            />
          </div>
        </div>
        
        <div className="flex flex-col gap-2 flex-1 w-full">
          <label className="text-sm font-medium text-gray-700">
            End Date & Time
          </label>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-500 flex-shrink-0" />
            <input
              type="datetime-local"
              value={formatForInput(endDate)}
              onChange={(e) => handleEndChange(e.target.value)}
              className="form-input flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
            />
          </div>
        </div>
      </div>
    </div>
  );
}