import React from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { useCurrency } from '../../context/CurrencyContext';

ChartJS.register(ArcElement, Tooltip, Legend);

const ExpenseBreakdownChart = ({ data }) => {
    const { formatPrice } = useCurrency();

    const chartData = {
        labels: data?.map(item => item.category) || [],
        datasets: [
            {
                data: data?.map(item => item.amount) || [],
                backgroundColor: ['#F59E0B', '#3B82F6', '#EF4444', '#8B5CF6', '#10B981', '#6B7280'], // Amber, Blue, Red, Purple, Emerald, Gray
                borderColor: '#1F2937', // Match bg-surface roughly
                borderWidth: 2,
            }
        ]
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: {
            legend: {
                position: 'right',
                labels: { color: '#9CA3AF', usePointStyle: true, boxWidth: 8, font: { size: 11 } }
            },
            tooltip: {
                callbacks: {
                    label: (context) => {
                        let label = context.label || '';
                        if (label) {
                            label += ': ';
                        }
                        const value = context.parsed;
                        label += formatPrice(value);
                        return label;
                    }
                }
            }
        }
    };

    return (
        <div className="bg-surface border border-white/5 rounded-2xl p-6 h-[380px]">
            <h3 className="text-lg font-bold text-white mb-4">Expense Breakdown</h3>
            {(!data || data.length === 0) ? (
                <div className="h-[300px] flex flex-col items-center justify-center text-text-muted">
                    <span className="material-icons-round text-4xl mb-2 opacity-50">pie_chart</span>
                    <p>No expense data</p>
                </div>
            ) : (
                <div className="h-[300px] flex items-center justify-center">
                    <Doughnut data={chartData} options={options} />
                </div>
            )}
        </div>
    );
};

export default ExpenseBreakdownChart;
