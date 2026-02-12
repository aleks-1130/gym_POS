import React from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    BarElement,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { useCurrency } from '../../context/CurrencyContext';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend
);

const ProfitLossChart = ({ data }) => {
    const { formatPrice } = useCurrency();

    // Sort by date to ensure correct order
    const sortedData = [...(data || [])].sort((a, b) => new Date(a.date) - new Date(b.date));

    const chartLabels = sortedData.map(item => {
        const date = new Date(item.date);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });

    const chartData = {
        labels: chartLabels,
        datasets: [
            {
                label: 'Revenue',
                data: sortedData.map(item => item.revenue),
                backgroundColor: '#10B981', // Emerald
                borderRadius: 4,
                order: 2,
            },
            {
                label: 'Expenses',
                data: sortedData.map(item => item.expense),
                backgroundColor: '#EF4444', // Red
                borderRadius: 4,
                order: 3,
            }
        ],
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
            mode: 'index',
            intersect: false,
        },
        plugins: {
            legend: {
                position: 'top',
                labels: { color: '#9CA3AF', usePointStyle: true, boxWidth: 8 }
            },
            tooltip: {
                callbacks: {
                    label: (context) => {
                        let label = context.dataset.label || '';
                        if (label) {
                            label += ': ';
                        }
                        if (context.parsed.y !== null) {
                            label += formatPrice(context.parsed.y);
                        }
                        return label;
                    }
                }
            }
        },
        scales: {
            x: {
                grid: { display: false },
                ticks: { color: '#9CA3AF', maxTicksLimit: 10 }
            },
            y: {
                grid: { color: 'rgba(255, 255, 255, 0.05)' },
                ticks: { color: '#9CA3AF' }
            },
        },
    };

    return (
        <div className="bg-surface border border-white/5 rounded-2xl p-6 h-[380px]">
            <h3 className="text-lg font-bold text-white mb-4">Monthly Profit & Loss</h3>
            <div className="h-[300px] w-full">
                <Bar data={chartData} options={options} />
            </div>
        </div>
    );
};

export default ProfitLossChart;
