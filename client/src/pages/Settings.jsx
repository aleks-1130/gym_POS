import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function Settings() {
    const [activeTab, setActiveTab] = useState('plans');
    const [gymProfile, setGymProfile] = useState({
        name: 'FitOS Gym',
        address: '123 Fitness Blvd, Gym City',
        phone: '(555) 123-4567',
        email: 'contact@fitos.com',
        website: 'www.fitos.com'
    });

    const [plans, setPlans] = useState([]);
    const [formData, setFormData] = useState({ name: '', price: '', duration: '' });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchPlans();
    }, []);

    const fetchPlans = async () => {
        try {
            const res = await axios.get('http://localhost:5000/api/plans');
            setPlans(res.data);
        } catch (error) {
            console.error("Failed to fetch plans");
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure?")) return;
        try {
            await axios.delete(`http://localhost:5000/api/plans/${id}`);
            fetchPlans();
        } catch (e) {
            alert(e.response?.data?.error || "Failed to delete plan");
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await axios.post('http://localhost:5000/api/plans', formData);
            setFormData({ name: '', price: '', duration: '' });
            fetchPlans();
        } catch (e) {
            alert("Failed to create plan");
        } finally {
            setLoading(false);
        }
    };

    const handleProfileSave = (e) => {
        e.preventDefault();
        alert("Gym Profile Updated Successfully!");
        // In real app, persist to backend
    };

    return (
        <div className="space-y-8 max-w-5xl mx-auto">
            <header>
                <h1 className="text-3xl font-bold text-white">System Settings</h1>
                <p className="text-text-muted mt-1">Manage configuration and plans</p>
            </header>

            {/* Tabs */}
            <div className="flex gap-4 border-b border-white/10">
                <button
                    onClick={() => setActiveTab('plans')}
                    className={`pb-4 px-2 font-bold text-sm transition-colors relative ${activeTab === 'plans' ? 'text-primary' : 'text-text-muted hover:text-white'}`}
                >
                    Membership Plans
                    {activeTab === 'plans' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary rounded-t-full"></div>}
                </button>
                <button
                    onClick={() => setActiveTab('branding')}
                    className={`pb-4 px-2 font-bold text-sm transition-colors relative ${activeTab === 'branding' ? 'text-primary' : 'text-text-muted hover:text-white'}`}
                >
                    Gym Branding
                    {activeTab === 'branding' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary rounded-t-full"></div>}
                </button>
            </div>

            {activeTab === 'plans' ? (
                <div className="grid lg:grid-cols-2 gap-8">
                    {/* Plan List */}
                    <div className="bg-surface rounded-3xl border border-white/5 overflow-hidden shadow-sm p-6">
                        <h3 className="text-xl font-bold text-white mb-4">Active Plans</h3>
                        <div className="space-y-3">
                            {plans.map(plan => (
                                <div key={plan.id} className="flex items-center justify-between p-4 bg-surfaceHighlight rounded-2xl border border-white/5 hover:shadow-sm transition-shadow">
                                    <div>
                                        <h4 className="text-white font-bold">{plan.name}</h4>
                                        <p className="text-sm text-text-muted font-medium">{plan.duration} days • <span className="text-primary font-bold">${plan.price}</span></p>
                                    </div>
                                    <button onClick={() => handleDelete(plan.id)} className="text-text-muted hover:text-red-400 p-2 transition-colors">
                                        <span className="material-icons-round">delete</span>
                                    </button>
                                </div>
                            ))}
                            {plans.length === 0 && <p className="text-text-muted text-sm">No plans found.</p>}
                        </div>
                    </div>

                    {/* Add Plan Form */}
                    <div className="bg-surface rounded-3xl border border-white/5 p-6 shadow-sm h-fit">
                        <h3 className="text-xl font-bold text-white mb-4">Create New Plan</h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs text-text-secondary font-bold mb-1">Plan Name</label>
                                <input required className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder-text-muted text-sm"
                                    placeholder="e.g. Platinum Yearly"
                                    value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs text-text-secondary font-bold mb-1">Price ($)</label>
                                    <input required type="number" step="0.01" className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder-text-muted text-sm"
                                        placeholder="99.99"
                                        value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-xs text-text-secondary font-bold mb-1">Duration (Days)</label>
                                    <input required type="number" className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder-text-muted text-sm"
                                        placeholder="30"
                                        value={formData.duration} onChange={e => setFormData({ ...formData, duration: e.target.value })} />
                                </div>
                            </div>
                            <button disabled={loading} type="submit" className="w-full bg-primary hover:bg-orange-600 text-white font-bold py-3 rounded-xl transition-colors shadow-lg shadow-primary/20 disabled:opacity-50 mt-2">
                                {loading ? 'Creating...' : 'Create Plan'}
                            </button>
                        </form>
                    </div>
                </div>
            ) : (
                <div className="bg-surface rounded-3xl border border-white/5 p-8 shadow-sm max-w-2xl">
                    <h3 className="text-xl font-bold text-white mb-6">Business Profile</h3>
                    <form onSubmit={handleProfileSave} className="space-y-6">
                        <div>
                            <label className="block text-xs text-text-secondary font-bold mb-1">Gym Name</label>
                            <input className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm"
                                value={gymProfile.name} onChange={e => setGymProfile({ ...gymProfile, name: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-xs text-text-secondary font-bold mb-1">Address</label>
                            <input className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm"
                                value={gymProfile.address} onChange={e => setGymProfile({ ...gymProfile, address: e.target.value })} />
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <label className="block text-xs text-text-secondary font-bold mb-1">Phone</label>
                                <input className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm"
                                    value={gymProfile.phone} onChange={e => setGymProfile({ ...gymProfile, phone: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-xs text-text-secondary font-bold mb-1">Website</label>
                                <input className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm"
                                    value={gymProfile.website} onChange={e => setGymProfile({ ...gymProfile, website: e.target.value })} />
                            </div>
                        </div>

                        <div className="pt-4 flex justify-end">
                            <button type="submit" className="bg-white text-black font-bold px-8 py-3 rounded-xl hover:bg-gray-200 transition-colors shadow-lg">
                                Save Changes
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
