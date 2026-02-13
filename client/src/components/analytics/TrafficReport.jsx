import React from 'react';
import { Bar } from 'react-chartjs-2';

const TrafficReport = ({ data }) => {
    const { peakHours, checkInsByDay, operations } = data; // Assuming operations data structure

    // Chart Options
    const chartOptions = {
        responsive: true,
        plugins: {
            legend: { display: false },
        },
        scales: {
            y: { beginAtZero: true },
        }
    };

    // Prepare Data for Charts (Static for print)
    const peakHoursData = {
        labels: ['6-9 AM', '9-12 PM', '12-3 PM', '3-6 PM', '6-9 PM', '9-12 AM'], // Standard gym blocks
        datasets: [{
            label: 'Average Volume',
            data: peakHours || Array(6).fill(0),
            backgroundColor: 'rgba(54, 162, 235, 0.5)',
            borderColor: 'rgba(54, 162, 235, 1)',
            borderWidth: 1
        }]
    };

    const weeklyData = {
        labels: checkInsByDay?.labels || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        datasets: [{
            label: 'Check-ins',
            data: checkInsByDay?.data || Array(7).fill(0),
            backgroundColor: 'rgba(34, 197, 94, 0.5)',
            borderColor: 'rgba(34, 197, 94, 1)',
            borderWidth: 1
        }]
    };

    return (
        <div className="w-full space-y-8">
            {/* 1. Traffic Summary */}
            <div>
                <h3 className="text-gray-500 uppercase tracking-wider text-sm font-bold border-b border-gray-200 pb-2 mb-4">Traffic Summary</h3>
                <div className="grid grid-cols-3 gap-6">
                    <div className="p-4 bg-gray-50 rounded border border-gray-200 text-center">
                        <p className="text-xs text-gray-500 uppercase">Total Visits</p>
                        <p className="text-2xl font-bold text-gray-800">{operations?.totalVisits || 0}</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded border border-gray-200 text-center">
                        <p className="text-xs text-gray-500 uppercase">Busiest Day</p>
                        <p className="text-2xl font-bold text-blue-600">{operations?.busiestDay || 'N/A'}</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded border border-gray-200 text-center">
                        <p className="text-xs text-gray-500 uppercase">Peak Hour</p>
                        <p className="text-2xl font-bold text-orange-600">{operations?.peakHour || 'N/A'}</p>
                    </div>
                </div>
            </div>

            {/* 2. Charts */}
            <div className="grid grid-cols-2 gap-8">
                <div>
                    <h3 className="text-gray-500 uppercase tracking-wider text-sm font-bold border-b border-gray-200 pb-2 mb-4">Hourly Distribution</h3>
                    <div className="h-64 border border-gray-100 rounded p-2">
                        <Bar data={peakHoursData} options={chartOptions} />
                    </div>
                </div>
                <div>
                    <h3 className="text-gray-500 uppercase tracking-wider text-sm font-bold border-b border-gray-200 pb-2 mb-4">Weekly Trends</h3>
                    <div className="h-64 border border-gray-100 rounded p-2">
                        <Bar data={weeklyData} options={chartOptions} />
                    </div>
                </div>
            </div>

            {/* 3. Member Activity by Type (Optional Placeholder) */}
            <div>
                <h3 className="text-gray-500 uppercase tracking-wider text-sm font-bold border-b border-gray-200 pb-2 mb-4">Activity Breakdown</h3>
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-500">
                        <tr>
                            <th className="py-2 px-3">Member Type</th>
                            <th className="py-2 px-3 text-right">Visits</th>
                            <th className="py-2 px-3 text-right">% of Total</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {operations?.visitsByType && operations.visitsByType.map((type, i) => (
                            <tr key={i}>
                                <td className="py-2 px-3 text-gray-700">{type.name}</td>
                                <td className="py-2 px-3 text-right font-medium">{type.count}</td>
                                <td className="py-2 px-3 text-right text-gray-500">{type.percentage}%</td>
                            </tr>
                        ))}
                        {!operations?.visitsByType && (
                            <tr>
                                <td colSpan="3" className="py-4 text-center text-gray-400 italic">No detailed breakdown available for this period.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default TrafficReport;
