import React, { useState, useEffect } from 'react';
import { db, collection, query, where, onSnapshot, User, handleFirestoreError, OperationType } from '../firebase';
import { Disc, TrendingUp, Users, Play, Plus, ChevronRight, Music2 } from 'lucide-react';
import { motion } from 'motion/react';
import { View } from '../App';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

interface DashboardProps {
  onNavigate: (view: View) => void;
  user: User;
}

export default function Dashboard({ onNavigate, user }: DashboardProps) {
  const [releaseCount, setReleaseCount] = useState(0);
  const [recentReleases, setRecentReleases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'releases'), where('artistId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setReleaseCount(snapshot.size);
      const releases = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRecentReleases(releases.slice(0, 3));
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'releases');
    });
    return () => unsubscribe();
  }, [user.uid]);

  const mockData = [
    { name: 'Mon', streams: 4000 },
    { name: 'Tue', streams: 3000 },
    { name: 'Wed', streams: 2000 },
    { name: 'Thu', streams: 2780 },
    { name: 'Fri', streams: 1890 },
    { name: 'Sat', streams: 2390 },
    { name: 'Sun', streams: 3490 },
  ];

  return (
    <div className="space-y-8">
      <header>
        <h2 className="text-3xl font-bold tracking-tight">Welcome back, {user.displayName?.split(' ')[0]}</h2>
        <p className="text-neutral-400 mt-1">Here's what's happening with your music today.</p>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
          icon={<Disc className="w-6 h-6 text-blue-400" />}
          label="Total Releases"
          value={releaseCount.toString()}
          trend="+1 this month"
        />
        <StatCard 
          icon={<Play className="w-6 h-6 text-emerald-400" />}
          label="Total Streams"
          value="124.8K"
          trend="+12% vs last week"
        />
        <StatCard 
          icon={<TrendingUp className="w-6 h-6 text-purple-400" />}
          label="Est. Revenue"
          value="$432.50"
          trend="Next payout: Apr 15"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Chart Section */}
        <div className="lg:col-span-2 bg-neutral-900/50 border border-white/5 rounded-3xl p-8">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-xl font-semibold">Streaming Performance</h3>
            <select className="bg-neutral-800 border-none rounded-lg text-sm px-3 py-1 focus:ring-2 focus:ring-emerald-500">
              <option>Last 7 days</option>
              <option>Last 30 days</option>
            </select>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mockData}>
                <defs>
                  <linearGradient id="colorStreams" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff10" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#737373', fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#737373', fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#171717', border: '1px solid #ffffff10', borderRadius: '12px' }}
                  itemStyle={{ color: '#10b981' }}
                />
                <Area type="monotone" dataKey="streams" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorStreams)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Releases */}
        <div className="bg-neutral-900/50 border border-white/5 rounded-3xl p-8">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-semibold">Recent Releases</h3>
            <button onClick={() => onNavigate('releases')} className="text-emerald-500 text-sm font-medium hover:underline">View all</button>
          </div>
          <div className="space-y-4">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-neutral-600" />
              </div>
            ) : recentReleases.length > 0 ? (
              recentReleases.map((release) => (
                <div key={release.id} className="flex items-center gap-4 group cursor-pointer">
                  <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-neutral-800 flex-shrink-0">
                    {release.coverImageUrl ? (
                      <img src={release.coverImageUrl} alt={release.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <Music2 className="w-6 h-6 absolute inset-0 m-auto text-neutral-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium truncate group-hover:text-emerald-500 transition-colors">{release.title}</h4>
                    <p className="text-xs text-neutral-500 capitalize">{release.type} • {release.status}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-neutral-600 group-hover:text-white transition-colors" />
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-neutral-500 text-sm">
                No releases yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, trend }: { icon: React.ReactNode; label: string; value: string; trend: string }) {
  return (
    <div className="bg-neutral-900/50 border border-white/5 rounded-3xl p-6 hover:border-white/10 transition-all">
      <div className="flex items-center gap-4 mb-4">
        <div className="p-3 bg-white/5 rounded-2xl">
          {icon}
        </div>
        <span className="text-sm font-medium text-neutral-400">{label}</span>
      </div>
      <div className="space-y-1">
        <div className="text-3xl font-bold tracking-tight">{value}</div>
        <div className="text-xs text-neutral-500 font-medium">{trend}</div>
      </div>
    </div>
  );
}

function Loader2(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
