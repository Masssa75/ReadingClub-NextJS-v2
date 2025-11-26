'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';

interface LevelProgressData {
  id: string;
  profile_id: string;
  profile_name: string;
  level: number;
  cycles_completed: number;
  total_time_seconds: number;
  letters_skipped: number;
  last_cycle_at: string | null;
  created_at: string;
}

type SortField = 'profile_name' | 'level' | 'cycles_completed' | 'total_time_seconds' | 'avg_time' | 'skip_rate' | 'last_cycle_at';
type SortDirection = 'asc' | 'desc';

export default function AdminProgressPage() {
  const [progressData, setProgressData] = useState<LevelProgressData[]>([]);
  const [loading, setLoading] = useState(true);
  const [levelFilter, setLevelFilter] = useState<number | 'all'>('all');
  const [sortField, setSortField] = useState<SortField>('cycles_completed');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadProgressData();
  }, []);

  const loadProgressData = async () => {
    setLoading(true);
    try {
      // Fetch level_progress joined with profiles
      const { data, error } = await supabase
        .from('level_progress')
        .select(`
          id,
          profile_id,
          level,
          cycles_completed,
          total_time_seconds,
          letters_skipped,
          last_cycle_at,
          created_at,
          profiles!inner(name)
        `);

      if (error) throw error;

      // Transform data to include profile name
      const transformed: LevelProgressData[] = (data || []).map((item: any) => ({
        id: item.id,
        profile_id: item.profile_id,
        profile_name: item.profiles?.name || 'Unknown',
        level: item.level,
        cycles_completed: item.cycles_completed,
        total_time_seconds: item.total_time_seconds || 0,
        letters_skipped: item.letters_skipped || 0,
        last_cycle_at: item.last_cycle_at,
        created_at: item.created_at,
      }));

      setProgressData(transformed);
    } catch (error) {
      console.error('Error loading progress data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate derived values
  const getAvgTimePerCycle = (item: LevelProgressData): number => {
    if (item.cycles_completed === 0) return 0;
    return item.total_time_seconds / item.cycles_completed;
  };

  const getSkipRate = (item: LevelProgressData): number => {
    if (item.cycles_completed === 0) return 0;
    const totalLetters = item.cycles_completed * 26;
    return (item.letters_skipped / totalLetters) * 100;
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatRelativeTime = (dateString: string | null): string => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  };

  // Filter and sort data
  const filteredData = progressData
    .filter(item => levelFilter === 'all' || item.level === levelFilter)
    .filter(item =>
      searchQuery === '' ||
      item.profile_name.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      let aVal: number | string;
      let bVal: number | string;

      switch (sortField) {
        case 'profile_name':
          aVal = a.profile_name.toLowerCase();
          bVal = b.profile_name.toLowerCase();
          break;
        case 'level':
          aVal = a.level;
          bVal = b.level;
          break;
        case 'cycles_completed':
          aVal = a.cycles_completed;
          bVal = b.cycles_completed;
          break;
        case 'total_time_seconds':
          aVal = a.total_time_seconds;
          bVal = b.total_time_seconds;
          break;
        case 'avg_time':
          aVal = getAvgTimePerCycle(a);
          bVal = getAvgTimePerCycle(b);
          break;
        case 'skip_rate':
          aVal = getSkipRate(a);
          bVal = getSkipRate(b);
          break;
        case 'last_cycle_at':
          aVal = a.last_cycle_at || '';
          bVal = b.last_cycle_at || '';
          break;
        default:
          aVal = a.cycles_completed;
          bVal = b.cycles_completed;
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

  // Calculate summary stats
  const totalCycles = progressData.reduce((sum, item) => sum + item.cycles_completed, 0);
  const totalKids = new Set(progressData.map(item => item.profile_id)).size;
  const avgCyclesPerKid = totalKids > 0 ? totalCycles / totalKids : 0;
  const totalTimeSeconds = progressData.reduce((sum, item) => sum + item.total_time_seconds, 0);
  const avgCycleDuration = totalCycles > 0 ? totalTimeSeconds / totalCycles : 0;
  const totalSkipped = progressData.reduce((sum, item) => sum + item.letters_skipped, 0);
  const totalLettersAttempted = totalCycles * 26;
  const avgSkipRate = totalLettersAttempted > 0 ? (totalSkipped / totalLettersAttempted) * 100 : 0;

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => (
    <span className="ml-1 opacity-50">
      {sortField === field ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
    </span>
  );

  return (
    <div className="mt-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold text-white text-center mb-6" style={{ textShadow: '0 4px 12px rgba(124,179,66,0.8)' }}>
        Level Progress Tracker
      </h1>

      {/* Level Filter Tabs */}
      <div className="flex gap-2 mb-6 justify-center">
        <button
          onClick={() => setLevelFilter('all')}
          className={`px-5 py-2 rounded-lg transition-colors ${
            levelFilter === 'all'
              ? 'bg-white/30 font-bold'
              : 'bg-white/10 hover:bg-white/20'
          }`}
        >
          All Levels
        </button>
        <button
          onClick={() => setLevelFilter(1)}
          className={`px-5 py-2 rounded-lg transition-colors ${
            levelFilter === 1
              ? 'bg-[#2196F3] font-bold'
              : 'bg-[#2196F3]/20 text-[#2196F3] hover:bg-[#2196F3]/30'
          }`}
        >
          Level 1 (Flashcards)
        </button>
        <button
          onClick={() => setLevelFilter(2)}
          className={`px-5 py-2 rounded-lg transition-colors ${
            levelFilter === 2
              ? 'bg-[#9C27B0] font-bold'
              : 'bg-[#9C27B0]/20 text-[#9C27B0] hover:bg-[#9C27B0]/30'
          }`}
        >
          Level 2 (Voice)
        </button>
      </div>

      {/* Summary Stats */}
      <div className="bg-black/70 rounded-[30px] p-8 mb-6">
        <div className="grid grid-cols-4 gap-5">
          <div className="bg-white/10 rounded-2xl p-5 text-center">
            <div className="text-4xl font-bold text-[#7CB342]">{totalCycles}</div>
            <div className="text-[#d1d5db] text-sm mt-1">Total Cycles Completed</div>
          </div>
          <div className="bg-white/10 rounded-2xl p-5 text-center">
            <div className="text-4xl font-bold text-[#7CB342]">{avgCyclesPerKid.toFixed(1)}</div>
            <div className="text-[#d1d5db] text-sm mt-1">Avg Cycles per Kid</div>
          </div>
          <div className="bg-white/10 rounded-2xl p-5 text-center">
            <div className="text-4xl font-bold text-[#FDD835]">{formatTime(avgCycleDuration)}</div>
            <div className="text-[#d1d5db] text-sm mt-1">Avg Cycle Duration</div>
          </div>
          <div className="bg-white/10 rounded-2xl p-5 text-center">
            <div className="text-4xl font-bold text-[#2196F3]">{avgSkipRate.toFixed(0)}%</div>
            <div className="text-[#d1d5db] text-sm mt-1">Avg Skip Rate</div>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-black/70 rounded-[30px] p-8">
        {/* Filter Bar */}
        <div className="flex gap-4 mb-6 items-center">
          <input
            type="text"
            placeholder="Search by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-4 py-2 rounded-lg bg-white/10 text-white placeholder-white/50 border-none outline-none w-52"
          />
          <button
            onClick={loadProgressData}
            className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
          >
            Refresh
          </button>
          <div className="flex-1" />
          <div className="text-[#d1d5db] text-sm">
            {filteredData.length} record{filteredData.length !== 1 ? 's' : ''}
          </div>
        </div>

        {loading ? (
          <div className="text-center text-[#d1d5db] py-12">Loading progress data...</div>
        ) : filteredData.length === 0 ? (
          <div className="text-center text-[#d1d5db] py-12">
            {progressData.length === 0
              ? 'No progress data yet. Kids will appear here after completing alphabet cycles in flashcard mode.'
              : 'No matching records found.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th
                    onClick={() => handleSort('profile_name')}
                    className="px-4 py-3 text-left text-[#d1d5db] text-sm font-medium uppercase tracking-wide cursor-pointer hover:text-white"
                  >
                    Profile <SortIcon field="profile_name" />
                  </th>
                  <th
                    onClick={() => handleSort('level')}
                    className="px-4 py-3 text-left text-[#d1d5db] text-sm font-medium uppercase tracking-wide cursor-pointer hover:text-white"
                  >
                    Level <SortIcon field="level" />
                  </th>
                  <th
                    onClick={() => handleSort('cycles_completed')}
                    className="px-4 py-3 text-left text-[#d1d5db] text-sm font-medium uppercase tracking-wide cursor-pointer hover:text-white"
                  >
                    Cycles <SortIcon field="cycles_completed" />
                  </th>
                  <th
                    onClick={() => handleSort('total_time_seconds')}
                    className="px-4 py-3 text-left text-[#d1d5db] text-sm font-medium uppercase tracking-wide cursor-pointer hover:text-white"
                  >
                    Total Time <SortIcon field="total_time_seconds" />
                  </th>
                  <th
                    onClick={() => handleSort('avg_time')}
                    className="px-4 py-3 text-left text-[#d1d5db] text-sm font-medium uppercase tracking-wide cursor-pointer hover:text-white"
                  >
                    Avg/Cycle <SortIcon field="avg_time" />
                  </th>
                  <th
                    onClick={() => handleSort('skip_rate')}
                    className="px-4 py-3 text-left text-[#d1d5db] text-sm font-medium uppercase tracking-wide cursor-pointer hover:text-white"
                  >
                    Skip Rate <SortIcon field="skip_rate" />
                  </th>
                  <th
                    onClick={() => handleSort('last_cycle_at')}
                    className="px-4 py-3 text-left text-[#d1d5db] text-sm font-medium uppercase tracking-wide cursor-pointer hover:text-white"
                  >
                    Last Active <SortIcon field="last_cycle_at" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((item) => {
                  const avgTime = getAvgTimePerCycle(item);
                  const skipRate = getSkipRate(item);

                  return (
                    <tr
                      key={item.id}
                      className="border-b border-white/5 hover:bg-white/5 transition-colors"
                    >
                      <td className="px-4 py-4">
                        <span className="font-bold text-lg">{item.profile_name}</span>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`px-3 py-1 rounded-xl text-sm font-medium ${
                          item.level === 1
                            ? 'bg-[#2196F3] text-white'
                            : 'bg-[#9C27B0] text-white'
                        }`}>
                          Level {item.level}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className="inline-block bg-gradient-to-r from-[#7CB342] to-[#8BC34A] text-white px-4 py-1 rounded-full font-bold text-xl">
                          {item.cycles_completed}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-[#FDD835] font-medium">
                        {formatTime(item.total_time_seconds)}
                      </td>
                      <td className="px-4 py-4 text-[#FDD835] font-medium">
                        {formatTime(avgTime)}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <span className={skipRate > 20 ? 'text-red-400' : skipRate > 10 ? 'text-yellow-400' : 'text-green-400'}>
                            {skipRate.toFixed(0)}%
                          </span>
                          <div className="w-20 h-2 bg-white/10 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.min(skipRate, 100)}%`,
                                background: skipRate > 20
                                  ? 'linear-gradient(90deg, #f44336, #ff5722)'
                                  : skipRate > 10
                                    ? 'linear-gradient(90deg, #FFC107, #FF9800)'
                                    : 'linear-gradient(90deg, #4CAF50, #8BC34A)'
                              }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-[#999]">
                        {formatRelativeTime(item.last_cycle_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
