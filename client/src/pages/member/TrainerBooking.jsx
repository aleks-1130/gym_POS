import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { useCurrency } from '../../context/CurrencyContext';

export default function TrainerBooking() {
    const { user } = useAuth();
    const { formatPrice } = useCurrency();
    const [trainers, setTrainers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedTrainer, setSelectedTrainer] = useState(null);
    const [showBookingModal, setShowBookingModal] = useState(false);
    const [bookingLoading, setBookingLoading] = useState(false);
    const [filterView, setFilterView] = useState('all');
    const [paymentMethods, setPaymentMethods] = useState([]);
    const [selectedMethodId, setSelectedMethodId] = useState('');

    const [bookingData, setBookingData] = useState({
        date: '',
        time: '',
        duration: 60,
        notes: '',
        paymentMethod: 'CASH'
    });

    useEffect(() => {
        const fetchTrainers = async () => {
            try {
                const token = sessionStorage.getItem('token') || localStorage.getItem('token');
                const res = await axios.get('http://localhost:5000/api/trainers', {
                    headers: token ? { Authorization: `Bearer ${token}` } : undefined
                });
                setTrainers(res.data || []);
            } catch (error) {
                console.error('Failed to fetch trainers', error);
            } finally {
                setLoading(false);
            }
        };

        fetchTrainers();
    }, []);

    useEffect(() => {
        const fetchMethods = async () => {
            if (!user?.id) return;
            try {
                const token = sessionStorage.getItem('token') || localStorage.getItem('token');
                const res = await axios.get(`http://localhost:5000/api/members/${user.id}/payment-methods`, {
                    headers: token ? { Authorization: `Bearer ${token}` } : undefined
                });
                const methods = res.data || [];
                setPaymentMethods(methods);
                const defaultMethod = methods.find((method) => method.isDefault);
                if (defaultMethod) {
                    setSelectedMethodId(defaultMethod.id);
                    setBookingData((prev) => ({
                        ...prev,
                        paymentMethod: defaultMethod.type === 'GCASH' ? 'GCASH' : 'CARD'
                    }));
                }
            } catch (error) {
                console.error('Failed to fetch payment methods', error);
            }
        };

        fetchMethods();
    }, [user?.id]);

    useEffect(() => {
        if (showBookingModal) {
            document.body.style.overflow = 'hidden';
            document.body.style.position = 'fixed';
            document.body.style.width = '100%';
        } else {
            document.body.style.overflow = '';
            document.body.style.position = '';
            document.body.style.width = '';
        }
        return () => {
            document.body.style.overflow = '';
            document.body.style.position = '';
            document.body.style.width = '';
        };
    }, [showBookingModal]);

    const filteredTrainers = useMemo(() => {
        return trainers.filter((trainer) => {
            if (filterView === 'available') return trainer.availableSlots === null || trainer.availableSlots > 0;
            if (filterView === 'top-rated') return (trainer.rating || 0) >= 4.5;
            return true;
        });
    }, [trainers, filterView]);

    const getTrainerSpecialties = (trainer) => {
        if (!trainer?.specialties) return [];
        if (Array.isArray(trainer.specialties)) return trainer.specialties;
        if (typeof trainer.specialties === 'string') {
            return trainer.specialties
                .split(',')
                .map((item) => item.trim())
                .filter(Boolean);
        }
        return [];
    };

    const getTrainerDurations = (trainer) => {
        const raw = trainer?.sessionDurations || '60';
        return raw
            .split(',')
            .map((item) => Number(item.trim()))
            .filter((value) => Number.isFinite(value) && value > 0);
    };

    const getEndTime = (start, duration) => {
        if (!start || !duration) return '';
        const [hours, minutes] = start.split(':').map(Number);
        if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return '';
        const totalMinutes = hours * 60 + minutes + duration;
        const endHours = Math.floor(totalMinutes / 60) % 24;
        const endMinutes = totalMinutes % 60;
        return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
    };

    const openModal = (trainer) => {
        setSelectedTrainer(trainer);
        setBookingData({
            date: '',
            time: '',
            duration: getTrainerDurations(trainer)[0] || 60,
            notes: '',
            paymentMethod: bookingData.paymentMethod || 'CASH'
        });
        setShowBookingModal(true);
    };

    const closeModal = () => {
        setShowBookingModal(false);
        setSelectedTrainer(null);
        setBookingData({ date: '', time: '', duration: 60, notes: '', paymentMethod: 'CASH' });
        setSelectedMethodId('');
    };

    const handleBookSession = async (event) => {
        event.preventDefault();
        if (!selectedTrainer || !bookingData.date || !bookingData.time) {
            alert('Please fill in all required fields');
            return;
        }
        if (!user?.id) {
            alert('Member session not found. Please log in again.');
            return;
        }
        if (!selectedMethodId && bookingData.paymentMethod !== 'CASH') {
            alert('Please select a payment method.');
            return;
        }

        setBookingLoading(true);
        try {
            const token = sessionStorage.getItem('token') || localStorage.getItem('token');
            const payload = {
                trainerId: selectedTrainer.id,
                date: bookingData.date,
                time: bookingData.time,
                duration: bookingData.duration,
                notes: bookingData.notes,
                method: bookingData.paymentMethod
            };

            const res = await axios.post('http://localhost:5000/api/members/book-training', payload, {
                headers: token ? { Authorization: `Bearer ${token}` } : undefined
            });
            alert(res.data?.message || 'Training session booked successfully!');
            closeModal();
        } catch (error) {
            alert(error.response?.data?.message || 'Failed to book training session');
        } finally {
            setBookingLoading(false);
        }
    };

    const activeDuration = Number(bookingData.duration) || 60;
    const sessionRate = selectedTrainer?.sessionPrice ?? 300;
    const totalAmount = (sessionRate * activeDuration) / 60;

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh] px-4">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                    <p className="text-text-muted text-sm">Loading trainers...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="pb-24 px-4 sm:px-6 max-w-6xl mx-auto space-y-4 sm:space-y-6">
            <header className="pt-4">
                <h1 className="text-xl font-bold text-white">Book a Trainer</h1>
                <p className="text-text-muted text-xs mt-0.5">Choose a coach and lock your training slot.</p>
            </header>

            <div className="flex flex-wrap gap-2">
                {[
                    { id: 'all', label: 'All trainers' },
                    { id: 'available', label: 'Available now' },
                    { id: 'top-rated', label: 'Top rated' }
                ].map((tab) => (
                    <button
                        key={tab.id}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                            filterView === tab.id
                                ? 'bg-primary text-white border-primary'
                                : 'bg-surface border-white/10 text-text-muted hover:text-white'
                        }`}
                        onClick={() => setFilterView(tab.id)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {filteredTrainers.length === 0 ? (
                <div className="bg-surface rounded-2xl border border-white/5 p-6 text-center text-text-muted text-sm">
                    No trainers found for this filter.
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredTrainers.map((trainer) => {
                        const specialties = getTrainerSpecialties(trainer);
                        const durations = getTrainerDurations(trainer);
                        const availableSlots = trainer.availableSlots === null ? 'Unlimited' : trainer.availableSlots;

                        return (
                            <div
                                key={trainer.id}
                                className="bg-surface rounded-2xl border border-white/5 overflow-hidden flex flex-col"
                            >
                                <div className="relative h-36 sm:h-40 bg-surfaceHighlight">
                                    {trainer.imageUrl ? (
                                        <img
                                            src={trainer.imageUrl}
                                            alt={trainer.name}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-text-muted">
                                            {trainer.name?.slice(0, 2)?.toUpperCase() || 'TR'}
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent"></div>
                                    <div className="absolute left-4 bottom-3 right-4">
                                        <p className="text-white text-lg font-semibold truncate">{trainer.name}</p>
                                        <p className="text-xs text-white/70">{trainer.experience || 'Certified trainer'}</p>
                                    </div>
                                    <span className="absolute top-3 right-3 text-[10px] uppercase tracking-wider text-primary font-bold bg-black/40 px-2 py-1 rounded-full">
                                        Trainer
                                    </span>
                                </div>

                                <div className="p-5 flex flex-col gap-4">

                                {specialties.length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                        {specialties.map((item) => (
                                            <span
                                                key={item}
                                                className="px-2 py-1 rounded-full text-[10px] bg-primary/10 text-primary font-semibold"
                                            >
                                                {item}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-3 text-xs text-text-muted">
                                    <div>
                                        <p className="text-white font-semibold">{formatPrice(trainer.sessionPrice ?? 300, true)}</p>
                                        <p>per hour</p>
                                    </div>
                                    <div>
                                        <p className="text-white font-semibold">{availableSlots}</p>
                                        <p>slots left</p>
                                    </div>
                                    <div>
                                        <p className="text-white font-semibold">{trainer.rating || 0}</p>
                                        <p>rating</p>
                                    </div>
                                    <div>
                                        <p className="text-white font-semibold">{durations.join(', ')} min</p>
                                        <p>durations</p>
                                    </div>
                                </div>

                                <button
                                    className="mt-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-orange-600"
                                    onClick={() => openModal(trainer)}
                                >
                                    Book Session
                                </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {showBookingModal && selectedTrainer && (
                <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
                    <div className="absolute inset-0 bg-black/70" onClick={closeModal}></div>
                    <div className="relative bg-surface rounded-2xl border border-white/10 w-full max-w-lg p-6">
                        <div className="flex items-start justify-between gap-3 mb-4">
                            <div>
                                <h2 className="text-lg font-bold text-white">Book {selectedTrainer.name}</h2>
                                <p className="text-xs text-text-muted">Select your preferred time and payment method.</p>
                            </div>
                            <button
                                className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/70 hover:text-white transition-all"
                                onClick={closeModal}
                                type="button"
                                aria-label="Close"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <form className="space-y-4" onSubmit={handleBookSession}>
                            <div className="grid grid-cols-2 gap-3">
                                <label className="space-y-1 text-xs text-text-muted">
                                    Date
                                    <input
                                        type="date"
                                        className="w-full rounded-xl border border-white/10 bg-surfaceHighlight px-3 py-2 text-sm text-white"
                                        value={bookingData.date}
                                        onChange={(event) =>
                                            setBookingData((prev) => ({ ...prev, date: event.target.value }))
                                        }
                                        required
                                    />
                                </label>
                                <label className="space-y-1 text-xs text-text-muted">
                                    Time
                                    <input
                                        type="time"
                                        className="w-full rounded-xl border border-white/10 bg-surfaceHighlight px-3 py-2 text-sm text-white"
                                        value={bookingData.time}
                                        onChange={(event) =>
                                            setBookingData((prev) => ({ ...prev, time: event.target.value }))
                                        }
                                        required
                                    />
                                </label>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <label className="space-y-1 text-xs text-text-muted">
                                    Duration
                                    <select
                                        className="w-full rounded-xl border border-white/10 bg-surfaceHighlight px-3 py-2 text-sm text-white"
                                        value={bookingData.duration}
                                        onChange={(event) =>
                                            setBookingData((prev) => ({ ...prev, duration: Number(event.target.value) }))
                                        }
                                    >
                                        {getTrainerDurations(selectedTrainer).map((duration) => (
                                            <option key={duration} value={duration}>
                                                {duration} minutes
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <label className="space-y-1 text-xs text-text-muted">
                                    Payment Method
                                    <select
                                        className="w-full rounded-xl border border-white/10 bg-surfaceHighlight px-3 py-2 text-sm text-white"
                                        value={bookingData.paymentMethod}
                                        onChange={(event) => {
                                            const method = event.target.value;
                                            setBookingData((prev) => ({ ...prev, paymentMethod: method }));
                                            if (method === 'CASH') {
                                                setSelectedMethodId('');
                                            }
                                        }}
                                    >
                                        <option value="CASH">Cash</option>
                                        <option value="GCASH">GCash</option>
                                        <option value="CARD">Card</option>
                                    </select>
                                </label>
                            </div>

                            {bookingData.paymentMethod !== 'CASH' && (
                                <div className="space-y-2">
                                    <p className="text-xs text-text-muted">Saved payment</p>
                                    <div className="grid grid-cols-1 gap-2">
                                        {paymentMethods
                                            .filter((method) =>
                                                bookingData.paymentMethod === 'GCASH'
                                                    ? method.type === 'GCASH'
                                                    : method.type === 'CARD'
                                            )
                                            .map((method) => (
                                                <button
                                                    type="button"
                                                    key={method.id}
                                                    onClick={() => setSelectedMethodId(method.id)}
                                                    className={`text-left w-full rounded-xl border px-3 py-2 transition-all ${
                                                        selectedMethodId === method.id
                                                            ? 'border-primary/60 bg-primary/10'
                                                            : 'border-white/10 bg-surfaceHighlight hover:border-white/20'
                                                    }`}
                                                >
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div className="min-w-0">
                                                            <p className="text-white text-sm font-semibold truncate">
                                                                {method.label}
                                                                {method.isDefault && (
                                                                    <span className="ml-2 text-[10px] uppercase tracking-wider text-emerald-400 font-bold">
                                                                        Default
                                                                    </span>
                                                                )}
                                                            </p>
                                                            <p className="text-xs text-text-muted">
                                                                {method.type === 'GCASH'
                                                                    ? `${method.name} - ${method.phone}`
                                                                    : `${method.brand || 'Card'} - **** ${method.last4} - ${method.expMonth}/${method.expYear}`}
                                                            </p>
                                                        </div>
                                                        <span className={`w-3 h-3 rounded-full border ${
                                                            selectedMethodId === method.id
                                                                ? 'bg-primary border-primary'
                                                                : 'border-white/30'
                                                        }`}></span>
                                                    </div>
                                                </button>
                                            ))}
                                        {paymentMethods.filter((method) =>
                                            bookingData.paymentMethod === 'GCASH'
                                                ? method.type === 'GCASH'
                                                : method.type === 'CARD'
                                        ).length === 0 && (
                                            <div className="text-xs text-text-muted bg-white/5 border border-white/10 rounded-xl p-3">
                                                No saved {bookingData.paymentMethod === 'GCASH' ? 'GCash' : 'card'} methods.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            <label className="space-y-1 text-xs text-text-muted block">
                                Notes (optional)
                                <textarea
                                    className="w-full rounded-xl border border-white/10 bg-surfaceHighlight px-3 py-2 text-sm text-white min-h-[90px]"
                                    value={bookingData.notes}
                                    onChange={(event) =>
                                        setBookingData((prev) => ({ ...prev, notes: event.target.value }))
                                    }
                                />
                            </label>

                            <div className="bg-surfaceHighlight rounded-xl border border-white/10 p-3 text-xs text-text-muted space-y-1">
                                <p>
                                    End time: <span className="text-white">{getEndTime(bookingData.time, activeDuration) || '--'}</span>
                                </p>
                                <p>
                                    Total cost: <span className="text-white">{formatPrice(totalAmount, true)}</span>
                                </p>
                            </div>

                            <button
                                type="submit"
                                disabled={bookingLoading}
                                className="w-full px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-orange-600 disabled:opacity-70"
                            >
                                {bookingLoading ? 'Booking...' : 'Confirm Booking'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
