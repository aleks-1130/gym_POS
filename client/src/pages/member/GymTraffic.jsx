import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';

const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const addDays = (date, days) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

const formatDateShort = (date) =>
    date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export default function GymTraffic() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [rangeStart, setRangeStart] = useState(startOfDay(addDays(new Date(), -6)));
    const [rangeEnd, setRangeEnd] = useState(new Date());
    const [selectedDay, setSelectedDay] = useState(startOfDay(new Date()));

    useEffect(() => {
        const fetchTraffic = async () => {
            try {
                const now = new Date();
                const start = startOfDay(addDays(now, -6));
                const res = await axios.get('http://localhost:5000/api/access/traffic', {
                    params: {
                        start: start.toISOString(),
                        end: now.toISOString()
                    }
                });
                const payloadLogs = res.data?.logs || [];
                const payloadStart = res.data?.range?.start ? new Date(res.data.range.start) : start;
                const payloadEnd = res.data?.range?.end ? new Date(res.data.range.end) : now;

                setLogs(payloadLogs);
                setRangeStart(startOfDay(payloadStart));
                setRangeEnd(payloadEnd);
                setSelectedDay(startOfDay(now));
            } catch (e) {
                console.error('Failed to fetch traffic data', e);
            } finally {
                setLoading(false);
            }
        };

        fetchTraffic();
    }, []);

    const allowedLogs = useMemo(
        () => logs.filter((log) => log.status !== 'DENIED'),
        [logs]
    );

    const weekDays = useMemo(() => {
        return Array.from({ length: 7 }, (_, index) => addDays(rangeStart, index));
    }, [rangeStart]);

    const countsByDay = useMemo(() => {
        return weekDays.map((day) => {
            const dayStart = startOfDay(day);
            const dayEnd = addDays(dayStart, 1);
            const count = allowedLogs.filter((log) => {
                const checkIn = new Date(log.checkIn);
                return checkIn >= dayStart && checkIn < dayEnd;
            }).length;
            return { day, count };
        });
    }, [allowedLogs, weekDays]);

    const busiestDay = useMemo(() => {
        return countsByDay.reduce(
            (max, entry) => (entry.count > max.count ? entry : max),
            { day: rangeStart, count: 0 }
        );
    }, [countsByDay, rangeStart]);

    const hourlyCounts = useMemo(() => {
        const hours = Array.from({ length: 24 }, () => 0);
        allowedLogs.forEach((log) => {
            const checkIn = new Date(log.checkIn);
            const sameDay = startOfDay(checkIn).getTime() === selectedDay.getTime();
            if (sameDay) {
                hours[checkIn.getHours()] += 1;
            }
        });
        return hours;
    }, [allowedLogs, selectedDay]);

    const busiestHour = useMemo(() => {
        let maxHour = 0;
        let maxCount = 0;
        hourlyCounts.forEach((count, hour) => {
            if (count > maxCount) {
                maxCount = count;
                maxHour = hour;
            }
        });
        return { hour: maxHour, count: maxCount };
    }, [hourlyCounts]);

    const maxDayCount = Math.max(1, ...countsByDay.map((entry) => entry.count));
    const maxHourCount = Math.max(1, ...hourlyCounts);

    if (loading) {
        return <div className="text-white p-6 text-center">Loading traffic data...</div>;
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white">Gym Traffic</h1>
                <p className="text-text-muted text-xs sm:text-sm mt-1">
                    Check-in activity for {formatDateShort(rangeStart)} — {formatDateShort(rangeEnd)}
                </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-surface rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-white/5">
                    <p className="text-text-muted text-xs sm:text-sm mb-1">Check-ins This Week</p>
                    <p className="text-xl sm:text-2xl font-bold text-primary">
                        {countsByDay.reduce((sum, entry) => sum + entry.count, 0)}
                    </p>
                </div>
                <div className="bg-surface rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-white/5">
                    <p className="text-text-muted text-xs sm:text-sm mb-1">Busiest Day</p>
                    <p className="text-sm sm:text-base font-bold text-emerald-400">
                        {dayLabels[busiestDay.day.getDay()]} • {busiestDay.count} visits
                    </p>
                </div>
                <div className="bg-surface rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-white/5 col-span-2 sm:col-span-1">
                    <p className="text-text-muted text-xs sm:text-sm mb-1">Busiest Hour</p>
                    <p className="text-sm sm:text-base font-bold text-yellow-400">
                        {busiestHour.hour.toString().padStart(2, '0')}:00 • {busiestHour.count} visits
                    </p>
                </div>
            </div>

            <div className="bg-surface rounded-2xl border border-white/5 p-4 sm:p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-white font-semibold text-base sm:text-lg">Week Overview</h2>
                    <span className="text-text-muted text-xs">Total check-ins per day</span>
                </div>
                <div className="space-y-3">
                    {countsByDay.map(({ day, count }) => (
                        <div key={day.toISOString()} className="flex items-center gap-3">
                            <div className="w-14 text-xs text-text-muted font-medium">
                                {dayLabels[day.getDay()]}
                            </div>
                            <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-primary to-orange-500"
                                    style={{ width: `${(count / maxDayCount) * 100}%` }}
                                />
                            </div>
                            <div className="w-10 text-right text-xs text-white font-semibold">{count}</div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-surface rounded-2xl border border-white/5 p-4 sm:p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="text-white font-semibold text-base sm:text-lg">Day & Hour Detail</h2>
                        <p className="text-text-muted text-xs">Select a day to see hourly check-ins</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {weekDays.map((day) => {
                            const isActive = startOfDay(day).getTime() === selectedDay.getTime();
                            return (
                                <button
                                    key={day.toISOString()}
                                    onClick={() => setSelectedDay(startOfDay(day))}
                                    className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                                        isActive
                                            ? 'bg-primary/15 border-primary/40 text-primary'
                                            : 'bg-white/5 border-white/10 text-text-muted hover:text-white'
                                    }`}
                                >
                                    {dayLabels[day.getDay()]} {formatDateShort(day)}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="grid grid-cols-6 sm:grid-cols-8 lg:grid-cols-12 gap-2">
                    {hourlyCounts.map((count, hour) => (
                        <div key={hour} className="flex flex-col items-center gap-2">
                            <div className="w-full h-20 sm:h-24 bg-white/5 rounded-lg flex items-end overflow-hidden">
                                <div
                                    className="w-full bg-emerald-400/70"
                                    style={{ height: `${(count / maxHourCount) * 100}%` }}
                                />
                            </div>
                            <span className="text-[10px] text-text-muted font-medium">
                                {hour.toString().padStart(2, '0')}
                            </span>
                            <span className="text-[10px] text-white font-semibold">{count}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
