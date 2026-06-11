'use client';

import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from 'recharts';
import { format, subDays, isAfter, startOfDay, parseISO } from 'date-fns';

type AnalyticsChartsProps = {
  leads: any[];
  sentEmails: any[];
  dateRange: '7d' | '30d' | 'this_month' | 'all_time';
};

export default function AnalyticsCharts({ leads, sentEmails, dateRange }: AnalyticsChartsProps) {
  const chartData = useMemo(() => {
    let daysToShow = 30;
    const now = new Date();

    if (dateRange === '7d') daysToShow = 7;
    else if (dateRange === '30d') daysToShow = 30;
    else if (dateRange === 'this_month') {
      daysToShow = now.getDate();
    } else if (dateRange === 'all_time') {
      daysToShow = 90; // Limit to 90 days for chart readability
    }

    const dataMap: Record<string, { date: string; sent: number; opens: number; clicks: number; replies: number; newLeads: number }> = {};

    // Initialize dates
    for (let i = daysToShow - 1; i >= 0; i--) {
      const d = subDays(now, i);
      const key = format(d, 'MMM dd');
      dataMap[key] = { date: key, sent: 0, opens: 0, clicks: 0, replies: 0, newLeads: 0 };
    }

    const startDate = startOfDay(subDays(now, daysToShow - 1));

    // Populate emails
    sentEmails.forEach((email) => {
      const d = new Date(email.sent_at);
      if (isAfter(d, startDate)) {
        const key = format(d, 'MMM dd');
        if (dataMap[key]) {
          dataMap[key].sent += 1;
        }
      }
      // A click implies an open even when the tracking pixel was blocked.
      const openedAt = email.opened_at || email.clicked_at;
      if (openedAt) {
        const od = new Date(openedAt);
        if (isAfter(od, startDate)) {
          const key = format(od, 'MMM dd');
          if (dataMap[key]) {
            dataMap[key].opens += 1;
          }
        }
      }
      if (email.clicked_at) {
        const cd = new Date(email.clicked_at);
        if (isAfter(cd, startDate)) {
          const key = format(cd, 'MMM dd');
          if (dataMap[key]) {
            dataMap[key].clicks += 1;
          }
        }
      }
      if (email.replied_at) {
        const rd = new Date(email.replied_at);
        if (isAfter(rd, startDate)) {
          const key = format(rd, 'MMM dd');
          if (dataMap[key]) {
            dataMap[key].replies += 1;
          }
        }
      }
    });

    // Populate leads
    leads.forEach((lead) => {
      const d = new Date(lead.created_at || now); // Assuming created_at exists, else fallback to now
      if (isAfter(d, startDate)) {
        const key = format(d, 'MMM dd');
        if (dataMap[key]) {
          dataMap[key].newLeads += 1;
        }
      }
    });

    return Object.values(dataMap);
  }, [leads, sentEmails, dateRange]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-xl border border-[var(--border)] bg-white/90 p-3 shadow-lg backdrop-blur-sm">
          <p className="mb-2 font-semibold text-zinc-900">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-zinc-600">{entry.name}:</span>
              <span className="font-semibold text-zinc-900">{entry.value}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 mt-6">
      <div className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
        <h3 className="mb-6 font-semibold text-zinc-900">Outreach Performance</h3>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
              <XAxis 
                dataKey="date" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#71717a', fontSize: 12 }} 
                dy={10} 
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#71717a', fontSize: 12 }} 
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ paddingTop: '20px' }} />
              <Line
                type="monotone"
                dataKey="sent"
                name="Emails Sent"
                stroke="#8b5cf6"
                strokeWidth={3}
                dot={{ r: 4, strokeWidth: 2, fill: '#fff' }}
                activeDot={{ r: 6, strokeWidth: 0 }}
              />
              <Line
                type="monotone"
                dataKey="opens"
                name="Opens"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={{ r: 3, strokeWidth: 2, fill: '#fff' }}
                activeDot={{ r: 5, strokeWidth: 0 }}
              />
              <Line
                type="monotone"
                dataKey="clicks"
                name="Clicks"
                stroke="#0ea5e9"
                strokeWidth={2}
                dot={{ r: 3, strokeWidth: 2, fill: '#fff' }}
                activeDot={{ r: 5, strokeWidth: 0 }}
              />
              <Line
                type="monotone"
                dataKey="replies"
                name="Replies"
                stroke="#10b981"
                strokeWidth={3}
                dot={{ r: 4, strokeWidth: 2, fill: '#fff' }}
                activeDot={{ r: 6, strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
        <h3 className="mb-6 font-semibold text-zinc-900">Lead Generation</h3>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
              <XAxis 
                dataKey="date" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#71717a', fontSize: 12 }} 
                dy={10} 
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#71717a', fontSize: 12 }} 
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f4f4f5' }} />
              <Legend wrapperStyle={{ paddingTop: '20px' }} />
              <Bar 
                dataKey="newLeads" 
                name="New Leads Added" 
                fill="#0ea5e9" 
                radius={[4, 4, 0, 0]} 
                maxBarSize={40}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
