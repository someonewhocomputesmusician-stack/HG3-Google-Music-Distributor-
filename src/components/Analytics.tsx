import React, { useState, useEffect } from 'react';
import { db, collection, query, where, onSnapshot, User, handleFirestoreError, OperationType } from '../firebase';
import { BarChart3, TrendingUp, Play, Users, Calendar, Download, Filter } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { format, subDays, startOfToday } from 'date-fns';

interface AnalyticsProps {
  user: User;
}

export default function Analytics({ user }: AnalyticsProps) {
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('7d');

  // Mock data for demonstration
  const streamData = [
    { date: '2024-03-15', streams: 1200, revenue: 4.2 },
    { date: '2024-03-16', streams: 1900, revenue: 6.5 },
    { date: '2024-03-17', streams: 1500, revenue: 5.1 },
    { date: '2024-03-18', streams: 2400, revenue: 8.2 },
    { date: '2024-03-19', streams: 3100, revenue: 10.5 },
    { date: '2024-03-20', streams: 2800, revenue: 9.6 },
    { date: '2024-03-21', streams: 3500, revenue: 12.1 },
  ];

  const platformData = [
    { name: 'Spotify', value: 45, color: '#1DB954' },
    { name: 'Apple Music', value: 30, color: '#FA243C' },
    { name: 'YouTube', value: 15, color: '#FF0000' },
    { name: 'Amazon', value: 10, color: '#00A8E1' },
  ];

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Analytics</h2>
          <p className="text-neutral-400 mt-1">Deep dive into your music's performance across platforms.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-neutral-900 border border-white/5 rounded-2xl p-1 flex">
            <RangeButton active={timeRange === '7d'} onClick={() => setTimeRange('7d')} label="7D" />
            <RangeButton active={timeRange === '30d'} onClick={() => setTimeRange('30d')} label="30D" />
            <RangeButton active={timeRange === '90d'} onClick={() => setTimeRange('90d')} label="90D" />
          </div>
          <button className="p-3 bg-neutral-900 border border-white/5 rounded-2xl text-neutral-400 hover:text-white transition-all">
            <Download className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <MiniStat label="Total Streams" value="24,592" trend="+14.2%" positive />
        <MiniStat label="Unique Listeners" value="8,102" trend="+5.1%" positive />
        <MiniStat label="Avg. Listen Time" value="2:45" trend="-2.4%" positive={false} />
        <MiniStat label="Total Revenue" value="$84.20" trend="+12.8%" positive />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Growth Chart */}
        <div className="lg:col-span-2 bg-neutral-900/50 border border-white/5 rounded-3xl p-8">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-xl font-semibold">Streaming Growth</h3>
            <div className="flex items-center gap-4 text-xs font-medium">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                <span className="text-neutral-400">Streams</span>
              </div>
            </div>
          </div>
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={streamData}>
                <defs>
                  <linearGradient id="colorStreams" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff05" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#737373', fontSize: 11 }} 
                  tickFormatter={(val) => format(new Date(val), 'MMM dd')}
                  dy={10} 
                />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#737373', fontSize: 11 }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#171717', border: '1px solid #ffffff10', borderRadius: '16px', padding: '12px' }}
                  itemStyle={{ color: '#10b981' }}
                  labelStyle={{ color: '#737373', marginBottom: '4px', fontSize: '12px' }}
                />
                <Area type="monotone" dataKey="streams" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorStreams)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Platform Breakdown */}
        <div className="bg-neutral-900/50 border border-white/5 rounded-3xl p-8">
          <h3 className="text-xl font-semibold mb-8">Platform Share</h3>
          <div className="h-[300px] w-full mb-8">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={platformData} layout="vertical">
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#fff', fontSize: 12 }} width={100} />
                <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ backgroundColor: '#171717', border: '1px solid #ffffff10', borderRadius: '12px' }} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                  {platformData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-4">
            {platformData.map((platform) => (
              <div key={platform.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: platform.color }} />
                  <span className="text-neutral-400">{platform.name}</span>
                </div>
                <span className="font-semibold">{platform.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function RangeButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
        active ? 'bg-white text-black' : 'text-neutral-500 hover:text-white'
      }`}
    >
      {label}
    </button>
  );
}

function MiniStat({ label, value, trend, positive }: { label: string; value: string; trend: string; positive: boolean }) {
  return (
    <div className="bg-neutral-900/50 border border-white/5 rounded-3xl p-6">
      <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">{label}</p>
      <div className="flex items-end justify-between">
        <h4 className="text-2xl font-bold">{value}</h4>
        <span className={`text-xs font-bold ${positive ? 'text-emerald-500' : 'text-red-500'}`}>
          {trend}
        </span>
      </div>
    </div>
  );
}
