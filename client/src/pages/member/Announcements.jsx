import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Megaphone, Calendar, Clock, Pin, AlertCircle } from 'lucide-react';

export default function Announcements() {
    const [announcements, setAnnouncements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all'); // all, pinned, recent

    // Dummy data for demonstration
    const dummyAnnouncements = [
        {
            id: 1,
            title: "🎉 Grand Opening Celebration!",
            content: "Join us this Saturday for our grand opening celebration! Enjoy free guest passes, fitness demos, and refreshments. First 50 members get a free gym bag!",
            category: "event",
            isPinned: true,
            author: "Management",
            createdAt: new Date().toISOString(),
        },
        {
            id: 2,
            title: "⚠️ Pool Maintenance Schedule",
            content: "The pool will be closed for maintenance from January 28-30. We apologize for any inconvenience. All pool classes will be moved to the main gym area.",
            category: "maintenance",
            isPinned: true,
            author: "Facilities Team",
            createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
        },
        {
            id: 3,
            title: "New Year Membership Promotion",
            content: "Limited time offer! Sign up for an annual membership and get 2 months free plus a personal training session. Valid until February 15th. Don't miss out!",
            category: "promotion",
            isPinned: false,
            author: "Sales Team",
            createdAt: new Date().toISOString(),
        },
        {
            id: 4,
            title: "Updated Gym Hours",
            content: "Starting February 1st, we'll be open extended hours! New schedule: Monday-Friday 5:00 AM - 11:00 PM, Saturday-Sunday 6:00 AM - 10:00 PM.",
            category: "general",
            isPinned: false,
            author: "Management",
            createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
        },
        {
            id: 5,
            title: "New Yoga Classes Available",
            content: "We're excited to announce new yoga classes starting next week! Morning sessions at 7 AM and evening sessions at 6 PM. Perfect for all skill levels.",
            category: "event",
            isPinned: false,
            author: "Fitness Coordinator",
            createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
        },
        {
            id: 6,
            title: "Parking Lot Resurfacing",
            content: "The west parking lot will be resurfaced next week. Please use the east or north parking areas. Work expected to be completed by Friday.",
            category: "maintenance",
            isPinned: false,
            author: "Facilities Team",
            createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(), // 4 days ago
        },
        {
            id: 7,
            title: "Personal Training Special",
            content: "Book 5 personal training sessions and get 1 free! Our certified trainers are here to help you reach your fitness goals. Offer valid through February.",
            category: "promotion",
            isPinned: false,
            author: "Training Department",
            createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
        },
        {
            id: 8,
            title: "COVID-19 Safety Guidelines",
            content: "Please continue to follow our safety protocols: wipe down equipment after use, maintain social distancing when possible, and stay home if you're feeling unwell.",
            category: "urgent",
            isPinned: false,
            author: "Health & Safety",
            createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 1 week ago
        },
        {
            id: 9,
            title: "Member Appreciation Day",
            content: "Thank you for being part of our gym family! Join us February 14th for Member Appreciation Day featuring free smoothies, prize drawings, and special guest instructors.",
            category: "event",
            isPinned: false,
            author: "Management",
            createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days ago
        },
        {
            id: 10,
            title: "New Equipment Arrival",
            content: "Excited to announce new state-of-the-art cardio equipment has arrived! Come check out our new treadmills, ellipticals, and rowing machines.",
            category: "general",
            isPinned: false,
            author: "Equipment Manager",
            createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(), // 2 weeks ago
        },
    ];

    useEffect(() => {
        fetchAnnouncements();
    }, []);

    const fetchAnnouncements = async () => {
        try {
            // Simulate API call with dummy data
            setTimeout(() => {
                setAnnouncements(dummyAnnouncements);
                setLoading(false);
            }, 800);
            
            // Uncomment below to use real API
            // const res = await axios.get('http://localhost:5000/api/announcements');
            // setAnnouncements(res.data);
        } catch (error) {
            console.error("Failed to fetch announcements");
            setLoading(false);
        }
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (date.toDateString() === today.toDateString()) {
            return 'Today';
        } else if (date.toDateString() === yesterday.toDateString()) {
            return 'Yesterday';
        } else {
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        }
    };

    const formatTime = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    };

    const getCategoryColor = (category) => {
        const colors = {
            general: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
            event: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
            maintenance: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
            urgent: 'bg-red-500/10 text-red-400 border-red-500/30',
            promotion: 'bg-green-500/10 text-green-400 border-green-500/30',
        };
        return colors[category?.toLowerCase()] || colors.general;
    };

    const filteredAnnouncements = announcements.filter(announcement => {
        if (filter === 'pinned') return announcement.isPinned;
        if (filter === 'recent') {
            const announcementDate = new Date(announcement.createdAt);
            const threeDaysAgo = new Date();
            threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
            return announcementDate >= threeDaysAgo;
        }
        return true;
    });

    const pinnedAnnouncements = filteredAnnouncements.filter(a => a.isPinned);
    const regularAnnouncements = filteredAnnouncements.filter(a => !a.isPinned);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                    <p className="text-text-muted text-sm">Loading Announcements...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="pb-20 px-4 max-w-4xl mx-auto">
            {/* Header */}
            <div className="sticky top-0 bg-background/95 backdrop-blur-sm z-10 -mx-4 px-4 py-4 mb-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                        <Megaphone className="text-primary" size={24} />
                    </div>
                    <div className="flex-1">
                        <h1 className="text-xl font-bold text-white">Announcements</h1>
                        <p className="text-text-muted text-xs mt-0.5">Stay updated with gym news</p>
                    </div>
                </div>

                {/* Filter Tabs */}
                <div className="flex gap-2 overflow-x-auto no-scrollbar">
                    <button
                        onClick={() => setFilter('all')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                            filter === 'all'
                                ? 'bg-primary text-white'
                                : 'bg-white/5 text-text-muted hover:bg-white/10'
                        }`}
                    >
                        All
                    </button>
                    <button
                        onClick={() => setFilter('pinned')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                            filter === 'pinned'
                                ? 'bg-primary text-white'
                                : 'bg-white/5 text-text-muted hover:bg-white/10'
                        }`}
                    >
                        Pinned
                    </button>
                    <button
                        onClick={() => setFilter('recent')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                            filter === 'recent'
                                ? 'bg-primary text-white'
                                : 'bg-white/5 text-text-muted hover:bg-white/10'
                        }`}
                    >
                        Recent
                    </button>
                </div>
            </div>

            {/* Announcements List */}
            <div className="space-y-4">
                {/* Pinned Announcements */}
                {pinnedAnnouncements.length > 0 && filter !== 'recent' && (
                    <div className="space-y-3">
                        {pinnedAnnouncements.map(announcement => (
                            <div
                                key={announcement.id}
                                className="bg-gradient-to-br from-primary/10 to-orange-500/10 border border-primary/30 rounded-xl p-4 relative overflow-hidden group hover:border-primary/50 transition-all"
                            >
                                {/* Pinned Badge */}
                                <div className="absolute top-3 right-3">
                                    <Pin className="text-primary" size={20} fill="currentColor" />
                                </div>

                                {/* Category Tag */}
                                {announcement.category && (
                                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border mb-3 ${getCategoryColor(announcement.category)}`}>
                                        <span>{announcement.category}</span>
                                    </div>
                                )}

                                {/* Title */}
                                <h3 className="text-white font-bold text-lg mb-2 pr-8">
                                    {announcement.title}
                                </h3>

                                {/* Content */}
                                <p className="text-text-muted text-sm leading-relaxed mb-3">
                                    {announcement.content}
                                </p>

                                {/* Footer */}
                                <div className="flex items-center gap-4 text-xs text-text-muted">
                                    <div className="flex items-center gap-1.5">
                                        <Calendar size={14} />
                                        <span>{formatDate(announcement.createdAt)}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <Clock size={14} />
                                        <span>{formatTime(announcement.createdAt)}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Regular Announcements */}
                {regularAnnouncements.length > 0 ? (
                    <div className="space-y-3">
                        {regularAnnouncements.map(announcement => (
                            <div
                                key={announcement.id}
                                className="bg-surface border border-white/5 rounded-xl p-4 hover:border-white/10 transition-all group"
                            >
                                {/* Category Tag */}
                                {announcement.category && (
                                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border mb-3 ${getCategoryColor(announcement.category)}`}>
                                        <span>{announcement.category}</span>
                                    </div>
                                )}

                                {/* Title */}
                                <h3 className="text-white font-bold text-base mb-2 group-hover:text-primary transition-colors">
                                    {announcement.title}
                                </h3>

                                {/* Content */}
                                <p className="text-text-muted text-sm leading-relaxed mb-3">
                                    {announcement.content}
                                </p>

                                {/* Footer */}
                                <div className="flex items-center gap-4 text-xs text-text-muted">
                                    <div className="flex items-center gap-1.5">
                                        <Calendar size={14} />
                                        <span>{formatDate(announcement.createdAt)}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <Clock size={14} />
                                        <span>{formatTime(announcement.createdAt)}</span>
                                    </div>
                                    {announcement.author && (
                                        <div className="flex items-center gap-1.5 ml-auto">
                                            <span className="text-primary font-medium">By {announcement.author}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-16">
                        <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <AlertCircle className="text-text-muted" size={32} />
                        </div>
                        <p className="text-text-muted text-sm mb-2">No announcements found</p>
                        <p className="text-text-muted text-xs">Check back later for updates</p>
                    </div>
                )}
            </div>
        </div>
    );
}