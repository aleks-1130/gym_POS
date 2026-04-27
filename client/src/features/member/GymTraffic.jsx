import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import MemberPageHeader from './components/MemberPageHeader';

const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const mondayFirstDayIndexes = [1, 2, 3, 4, 5, 6, 0];

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const addDays = (date, days) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
const getStartOfWeekMonday = (date) => {
    const day = date.getDay(); // 0..6 (Sun..Sat)
    const mondayOffset = day === 0 ? -6 : 1 - day;
    return startOfDay(addDays(date, mondayOffset));
};
const getEndOfWeekSunday = (date) => {
    const monday = getStartOfWeekMonday(date);
    const sunday = addDays(monday, 6);
    return new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate(), 23, 59, 59, 999);
};

const formatDateShort = (date) =>
    date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

const formatHour12 = (hour) => {
    const suffix = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 === 0 ? 12 : hour % 12;
    return `${hour12} ${suffix}`;
};

export default function GymTraffic() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [rangeStart, setRangeStart] = useState(getStartOfWeekMonday(new Date()));
    const [rangeEnd, setRangeEnd] = useState(getEndOfWeekSunday(new Date()));
    const [selectedDay, setSelectedDay] = useState(startOfDay(new Date()));

    useEffect(() => {
        const fetchTraffic = async () => {
            try {
                
                const now = new Date();
                const start = getStartOfWeekMonday(now);
                const end = getEndOfWeekSunday(now);
                const res = await axios.get('/api/access/traffic', {
                    params: {
                        start: start.toISOString(),
                        end: end.toISOString()
                    } });
                const payloadLogs = res.data?.logs || [];

                setLogs(payloadLogs);
                setRangeStart(start);
                setRangeEnd(end);
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
        <div className="space-y-6 max-w-5xl mx-auto">
            <MemberPageHeader
                title="Gym Traffic"
                subtitle={`Check-in activity for ${formatDateShort(rangeStart)} - ${formatDateShort(rangeEnd)}`}
                icon="timeline"
            />

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="member-card p-3 sm:p-4">
                    <p className="text-text-muted text-xs sm:text-sm mb-1">Check-ins This Week</p>
                    <p className="text-xl sm:text-2xl font-bold text-primary">
                        {countsByDay.reduce((sum, entry) => sum + entry.count, 0)}
                    </p>
                </div>
                <div className="member-card p-3 sm:p-4">
                    <p className="text-text-muted text-xs sm:text-sm mb-1">Busiest Day</p>
                    <p className="text-sm sm:text-base font-bold text-emerald-400">
                        {dayLabels[busiestDay.day.getDay()]} • {busiestDay.count} visits
                    </p>
                </div>
                <div className="member-card p-3 sm:p-4 col-span-2 sm:col-span-1">
                    <p className="text-text-muted text-xs sm:text-sm mb-1">Busiest Hour</p>
                    <p className="text-sm sm:text-base font-bold text-yellow-400">
                        {formatHour12(busiestHour.hour)} • {busiestHour.count} visits
                    </p>
                </div>
            </div>

            <div className="member-card p-4 sm:p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-white font-semibold text-base sm:text-lg">Week Overview</h2>
                    <span className="text-text-muted text-xs">Total check-ins per day</span>
                </div>
                <div className="grid grid-cols-7 gap-2 items-end">
                    {mondayFirstDayIndexes.map((dayIndex) => {
                        const entry = countsByDay.find(({ day }) => day.getDay() === dayIndex);
                        const day = entry?.day;
                        const count = entry?.count ?? 0;
                        if (!day) return null;

                        return (
                            <div key={day.toISOString()} className="flex flex-col items-center gap-2">
                                <div className="w-full h-24 sm:h-28 bg-white/5 rounded-lg flex items-end overflow-hidden">
                                    <div
                                        className="w-full bg-gradient-to-t from-primary to-orange-500"
                                        style={{ height: `${(count / maxDayCount) * 100}%` }}
                                    />
                                </div>
                                <span className="text-[10px] text-text-muted font-medium">
                                    {dayLabels[day.getDay()]}
                                </span>
                                <span className="text-[10px] text-white font-semibold">{count}</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="member-card p-4 sm:p-6 space-y-4">
                <div className="space-y-3">
                    <div>
                        <h2 className="text-white font-semibold text-base sm:text-lg">Day & Hour Detail</h2>
                        <p className="text-text-muted text-xs">Select a day to see hourly check-ins</p>
                    </div>
                    <div className="w-full grid grid-cols-7 gap-1 sm:gap-2">
                        {mondayFirstDayIndexes.map((dayIndex) => {
                            const day = weekDays.find((d) => d.getDay() === dayIndex);
                            if (!day) return null;

                            const isActive = startOfDay(day).getTime() === selectedDay.getTime();
                            const dayName = dayLabels[day.getDay()];
                            const dayDate = day.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
                            return (
                                <button
                                    key={day.toISOString()}
                                    onClick={() => setSelectedDay(startOfDay(day))}
                                    className={`w-full min-w-0 px-1.5 py-1.5 rounded-lg text-[10px] sm:text-xs font-semibold border transition-all leading-tight ${isActive
                                        ? 'bg-primary/15 border-primary/40 text-primary'
                                        : 'bg-white/5 border-white/10 text-text-muted hover:text-white'
                                        }`}
                                >
                                    <span className="block truncate">{dayName}</span>
                                    <span className="block truncate">{dayDate}</span>
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
                                {formatHour12(hour)}
                            </span>
                            <span className="text-[10px] text-white font-semibold">{count}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

