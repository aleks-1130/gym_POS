import React, { useState, useEffect, useCallback } from 'react';
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
    const [bookingData, setBookingData] = useState({
        date: '',
        time: '',
        duration: 60,
        notes: '',
        paymentMethod: 'CASH'
    });
    const [bookingLoading, setBookingLoading] = useState(false);
    const [filterView, setFilterView] = useState('all'); // all, available, top-rated

    useEffect(() => {
        fetchTrainers();
    }, []);

    // Prevent body scroll when modal is open (PWA best practice)
    useEffect(() => {
        if (showBookingModal) {
            document.body.style.overflow = 'hidden';
            // Add safe area insets for iOS
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

    const fetchTrainers = async () => {
        try {
            const res = await axios.get('http://localhost:5000/api/trainers');
            setTrainers(res.data);
        } catch (error) {
            console.error("Failed to fetch trainers");
        } finally {
            setLoading(false);
        }
    };

    const handleBookSession = async (e) => {
        e.preventDefault();
        if (!selectedTrainer || !bookingData.date || !bookingData.time) {
            alert("Please fill in all required fields");
            return;
        }

        setBookingLoading(true);
        try {
            await axios.post('http://localhost:5000/api/members/book-training', {
                trainerId: selectedTrainer.id,
                date: bookingData.date,
                time: bookingData.time,
                duration: bookingData.duration,
                notes: bookingData.notes,
                method: bookingData.paymentMethod
            });
            alert("Training session booked successfully!");
            setShowBookingModal(false);
            setSelectedTrainer(null);
            setBookingData({ date: '', time: '', duration: 60, notes: '', paymentMethod: 'CASH' });
            fetchTrainers();
        } catch (error) {
            alert(error.response?.data?.message || "Failed to book training session");
        } finally {
            setBookingLoading(false);
        }
    };

    const closeModal = useCallback(() => {
        setShowBookingModal(false);
        setSelectedTrainer(null);
        setBookingData({ date: '', time: '', duration: 60, notes: '', paymentMethod: 'CASH' });
    }, []);

    const filteredTrainers = trainers.filter(trainer => {
        if (filterView === 'available') return trainer.availableSlots > 0;
        if (filterView === 'top-rated') return trainer.rating >= 4.5;
        return true;
    });


    const getTrainerSpecialties = (trainer) => {
        if (!trainer?.specialties) return [];
        if (Array.isArray(trainer.specialties)) return trainer.specialties;
        if (typeof trainer.specialties === 'string') {
            return trainer.specialties.split(',').map((item) => item.trim()).filter(Boolean);
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
        <div className="space-y-4 sm:space-y-6 pb-20 sm:pb-6">
            {/* Header */}
            <div className="space-y-3 sm:space-y-4">
                <div className="px-4 sm:px-0">
                    <h1 className="text-2xl sm:text-3xl font-bold text-white">1-on-1 Training</h1>
                    <p className="text-text-muted text-sm sm:text-base mt-1">Book personalized training sessions</p>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-2 gap-3 sm:gap-4 px-4 sm:px-0">
                    <div className="bg-surface rounded-xl sm:rounded-2xl p-4 sm:p-5 border border-white/5">
                        <p className="text-text-muted text-xs sm:text-sm mb-1">Available Trainers</p>
                        <p className="text-2xl sm:text-3xl font-bold text-primary">{trainers.length}</p>
                    </div>
                    <div className="bg-surface rounded-xl sm:rounded-2xl p-4 sm:p-5 border border-white/5">
                        <p className="text-text-muted text-xs sm:text-sm mb-1">Avg. Rate</p>
                        <p className="text-2xl sm:text-3xl font-bold text-emerald-400">
                            {trainers.length > 0 
                                ? formatPrice(trainers.reduce((sum, t) => sum + (t.sessionPrice ?? 300), 0) / trainers.length, true)
                                : formatPrice(0, true)
                            }
                        </p>
                    </div>
                </div>

                {/* Filter Tabs - Mobile Optimized */}
                <div className="overflow-x-auto px-4 sm:px-0 -mx-4 sm:mx-0">
                    <div className="flex gap-2 min-w-max px-4 sm:px-0">
                        <button
                            onClick={() => setFilterView('all')}
                            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all whitespace-nowrap ${
                                filterView === 'all'
                                    ? 'bg-primary text-background'
                                    : 'bg-white/5 text-text-muted hover:bg-white/10'
                            }`}
                        >
                            All Trainers
                        </button>
                        <button
                            onClick={() => setFilterView('available')}
                            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all whitespace-nowrap ${
                                filterView === 'available'
                                    ? 'bg-primary text-background'
                                    : 'bg-white/5 text-text-muted hover:bg-white/10'
                            }`}
                        >
                            Available Now
                        </button>
                        <button
                            onClick={() => setFilterView('top-rated')}
                            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all whitespace-nowrap ${
                                filterView === 'top-rated'
                                    ? 'bg-primary text-background'
                                    : 'bg-white/5 text-text-muted hover:bg-white/10'
                            }`}
                        >
                            Top Rated
                        </button>
                    </div>
                </div>
            </div>

            {/* Trainers Grid */}
            {filteredTrainers.length === 0 ? (
                <div className="text-center py-12 px-4">
                    <span className="material-icons-round text-5xl text-text-muted opacity-50 block mb-3">person_off</span>
                    <p className="text-text-muted text-base">No trainers match your filter</p>
                    <button 
                        onClick={() => setFilterView('all')}
                        className="mt-4 px-4 py-2 bg-primary text-background rounded-lg font-medium text-sm"
                    >
                        Show All Trainers
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 px-4 sm:px-0">
                    {filteredTrainers.map(trainer => (
                        <div key={trainer.id} className="bg-surface rounded-2xl border border-white/5 overflow-hidden hover:border-primary/30 transition-all group flex flex-col">
                            {/* Trainer Image */}
                            <div className="aspect-[4/3] sm:aspect-square bg-white/5 overflow-hidden relative">
                                {trainer.imageUrl ? (
                                    <img 
                                        src={trainer.imageUrl} 
                                        alt={trainer.name} 
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                        loading="lazy"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                                        <span className="material-icons-round text-6xl text-primary/30">person</span>
                                    </div>
                                )}

                                {/* Rating Badge */}
                                {trainer.rating && (
                                    <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-md rounded-full px-3 py-1.5 flex items-center gap-1">
                                        <span className="material-icons-round text-base text-yellow-400">star</span>
                                        <span className="text-white font-bold text-sm">{trainer.rating}</span>
                                    </div>
                                )}

                                {/* Experience Tag */}
                                {trainer.experience && (
                                    <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-md rounded-lg px-3 py-1.5">
                                        <span className="text-white font-medium text-xs">{trainer.experience}y exp</span>
                                    </div>
                                )}
                            </div>

                            {/* Trainer Info */}
                            <div className="p-4 sm:p-5 flex flex-col flex-1">
                                <div className="mb-3">
                                    <h3 className="font-bold text-white text-lg sm:text-xl">{trainer.name}</h3>
                                    <p className="text-text-muted text-sm mt-0.5">{trainer.specialization || 'Personal Trainer'}</p>
                                </div>

                                {/* Bio */}
                                {trainer.bio && (
                                    <p className="text-text-muted text-sm mb-3 line-clamp-2 leading-relaxed">
                                        {trainer.bio}
                                    </p>
                                )}

                                {/* Specializations */}
                                {getTrainerSpecialties(trainer).length > 0 && (
                                    <div className="mb-4 flex flex-wrap gap-2">
                                        {getTrainerSpecialties(trainer).slice(0, 3).map((specialty, idx) => (
                                            <span key={idx} className="bg-white/10 text-text-secondary px-2.5 py-1 rounded-md text-xs font-medium">
                                                {specialty}
                                            </span>
                                        ))}
                                        {getTrainerSpecialties(trainer).length > 3 && (
                                            <span className="text-text-muted text-xs py-1 px-1">+{getTrainerSpecialties(trainer).length - 3} more</span>
                                        )}
                                    </div>
                                )}

                                <div className="mt-auto space-y-3">
                                    {/* Price */}
                                    <div className="flex justify-between items-center py-2 border-t border-white/5">
                                        <span className="text-text-muted text-sm">Per Session (60 min)</span>
                                        <span className="text-primary font-bold text-xl">{formatPrice(trainer.sessionPrice ?? 300, true)}</span>
                                    </div>

                                    {/* Availability */}
                                    {trainer.availableSlots !== undefined && (
                                        <div className="flex items-center gap-2 text-sm">
                                            <div className={`w-2 h-2 rounded-full ${trainer.availableSlots > 0 ? 'bg-green-400' : 'bg-red-400'}`}></div>
                                            <span className={trainer.availableSlots > 0 ? 'text-green-400' : 'text-red-400'}>
                                                {trainer.availableSlots > 0 
                                                    ? `${trainer.availableSlots} slots this week`
                                                    : 'Fully booked'
                                                }
                                            </span>
                                        </div>
                                    )}

                                    {/* Book Button - Touch Optimized */}
                                    <button
                                        onClick={() => {
                                            setSelectedTrainer(trainer);
                                            setShowBookingModal(true);
                                        }}
                                        disabled={trainer.availableSlots === 0}
                                        className={`w-full py-3.5 sm:py-3 rounded-xl font-bold text-sm sm:text-base transition-all active:scale-95 flex items-center justify-center gap-2 touch-manipulation ${
                                            trainer.availableSlots === 0
                                                ? 'bg-white/5 text-text-muted cursor-not-allowed opacity-50'
                                                : 'bg-primary text-background hover:brightness-110 shadow-lg shadow-primary/25'
                                        }`}
                                    >
                                        <span className="material-icons-round text-lg">event</span>
                                        Book Session
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Booking Modal - Mobile Optimized */}
            {showBookingModal && selectedTrainer && (
                <div 
                    className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center sm:justify-center"
                    onClick={closeModal}
                    style={{ 
                        paddingBottom: 'env(safe-area-inset-bottom)',
                        paddingTop: 'env(safe-area-inset-top)'
                    }}
                >
                    <div 
                        className="w-full sm:max-w-lg bg-surface rounded-t-3xl sm:rounded-2xl border-t sm:border border-white/10 flex flex-col max-h-[90vh] sm:max-h-[85vh] overflow-hidden animate-slide-up sm:animate-none" 
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Modal Header - Sticky */}
                        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-white/10 bg-surface sticky top-0 z-10">
                            <div className="flex-1 min-w-0 pr-4">
                                <h2 className="text-xl sm:text-2xl font-bold text-white truncate">Book Session</h2>
                                <p className="text-text-muted text-sm mt-0.5 truncate">with {selectedTrainer.name}</p>
                            </div>
                            <button 
                                onClick={closeModal}
                                className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors flex-shrink-0 touch-manipulation"
                                aria-label="Close modal"
                            >
                                <span className="material-icons-round text-white text-2xl">close</span>
                            </button>
                        </div>

                        {/* Booking Form - Scrollable */}
                        <div className="flex-1 overflow-y-auto overscroll-contain">
                            <form onSubmit={handleBookSession} className="p-5 sm:p-6 space-y-5">
                                {/* Trainer Info Card */}
                                <div className="bg-white/5 rounded-xl p-4 border border-white/5 flex gap-4">
                                    <div className="w-16 h-16 sm:w-14 sm:h-14 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                                        {selectedTrainer.imageUrl ? (
                                            <img src={selectedTrainer.imageUrl} alt={selectedTrainer.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="material-icons-round text-text-muted text-2xl">person</span>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-white text-base truncate">{selectedTrainer.name}</p>
                                        <p className="text-text-muted text-sm truncate">{selectedTrainer.specialization}</p>
                                        <p className="text-primary font-bold text-lg mt-1">{formatPrice(selectedTrainer.sessionPrice ?? 300, true)}/session</p>
                                    </div>
                                </div>

                                {/* Date Input - Touch Optimized */}
                                <div>
                                    <label className="block text-sm font-bold text-white mb-2">Session Date *</label>
                                    <input
                                        type="date"
                                        required
                                        value={bookingData.date}
                                        onChange={(e) => setBookingData({ ...bookingData, date: e.target.value })}
                                        min={new Date().toISOString().split('T')[0]}
                                        className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-text-muted focus:outline-none focus:border-primary text-base touch-manipulation"
                                    />
                                </div>

                                {/* Time Input - Touch Optimized */}
                                <div>
                                    <label className="block text-sm font-bold text-white mb-2">Session Time *</label>
                                    <input
                                        type="time"
                                        required
                                        value={bookingData.time}
                                        onChange={(e) => setBookingData({ ...bookingData, time: e.target.value })}
                                        className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-text-muted focus:outline-none focus:border-primary text-base touch-manipulation"
                                    />
                                </div>
                                {bookingData.time && (
                                    <p className="text-xs text-text-muted mt-2">Ends at {getEndTime(bookingData.time, bookingData.duration)}</p>
                                )}

                                {/* Duration - Touch Optimized */}
                                <div>
                                    <label className="block text-sm font-bold text-white mb-2">Duration</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {getTrainerDurations(selectedTrainer).map((duration) => (
                                            <button
                                                key={duration}
                                                type="button"
                                                onClick={() => setBookingData({ ...bookingData, duration })}
                                                className={`px-3 py-2 rounded-xl text-sm font-semibold border transition-all ${
                                                    bookingData.duration === duration
                                                        ? 'bg-primary/15 text-primary border-primary/40'
                                                        : 'bg-white/5 text-text-muted border-white/10 hover:text-white'
                                                }`}
                                            >
                                                {duration} min
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Notes - Touch Optimized */}
                                <div>
                                    <label className="block text-sm font-bold text-white mb-2">Payment Method *</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        {['CASH', 'CARD', 'GCASH'].map((method) => (
                                            <button
                                                key={method}
                                                type="button"
                                                onClick={() => setBookingData({ ...bookingData, paymentMethod: method })}
                                                className={`px-4 py-3 rounded-xl text-sm font-semibold border transition-all ${
                                                    bookingData.paymentMethod === method
                                                        ? 'bg-primary/15 text-primary border-primary/40'
                                                        : 'bg-white/5 text-text-muted border-white/10 hover:text-white'
                                                }`}
                                            >
                                                {method}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-white mb-2">Notes (optional)</label>
                                    <textarea
                                        value={bookingData.notes}
                                        onChange={(e) => setBookingData({ ...bookingData, notes: e.target.value })}
                                        placeholder="Any specific goals or preferences?"
                                        rows="4"
                                        className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-text-muted focus:outline-none focus:border-primary text-base resize-none touch-manipulation"
                                    />
                                </div>

                                {/* Total Price - Highlighted */}
                                <div className="bg-primary/10 border border-primary/30 rounded-xl p-4">
                                    <div className="flex justify-between items-center">
                                        <span className="text-text-muted text-sm">Total for {bookingData.duration} min</span>
                                        <span className="text-primary font-bold text-2xl">
                                            {formatPrice(((selectedTrainer.sessionPrice ?? 300) / 60) * bookingData.duration, true)}
                                        </span>
                                    </div>
                                </div>
                            </form>
                        </div>

                        {/* Modal Footer - Sticky */}
                        <div className="border-t border-white/10 p-5 sm:p-6 bg-surface sticky bottom-0 space-y-3">
                            <button
                                onClick={handleBookSession}
                                disabled={bookingLoading}
                                className="w-full py-4 bg-primary text-background rounded-xl font-bold text-base hover:brightness-110 active:scale-95 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
                            >
                                <span className="material-icons-round text-xl">check_circle</span>
                                {bookingLoading ? 'Booking...' : 'Confirm Booking'}
                            </button>
                            <button
                                onClick={closeModal}
                                className="w-full py-3 bg-white/5 text-white rounded-xl font-medium text-sm hover:bg-white/10 transition-colors touch-manipulation"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add animation styles */}
            <style jsx>{`
                @keyframes slide-up {
                    from {
                        transform: translateY(100%);
                    }
                    to {
                        transform: translateY(0);
                    }
                }
                .animate-slide-up {
                    animation: slide-up 0.3s ease-out;
                }
            `}</style>
        </div>
    );
}