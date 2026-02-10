import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useCurrency } from '../../context/CurrencyContext';

export default function MemberDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { formatPrice } = useCurrency();

  const [member, setMember] = useState(null);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [activityFilter, setActivityFilter] = useState('all');

  const [showRenewModal, setShowRenewModal] = useState(false);
  const [showFreezeModal, setShowFreezeModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const [renewData, setRenewData] = useState({ planId: '', duration: 30, amount: 0, method: 'CASH' });
  const [renewAmountTendered, setRenewAmountTendered] = useState('');
  const [renewGcashReference, setRenewGcashReference] = useState('');
  const [renewGcashDate, setRenewGcashDate] = useState('');
  const [renewGcashTime, setRenewGcashTime] = useState('');

  const [freezeData, setFreezeData] = useState({
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(new Date().setDate(new Date().getDate() + 30)).toISOString().split('T')[0]
  });

  const [passwordData, setPasswordData] = useState('');
  const [noteData, setNoteData] = useState('');
  const [notes, setNotes] = useState([]);
  const [editFormData, setEditFormData] = useState({});

  useEffect(() => {
    fetchMember();
    fetchPlans();
    fetchNotes();
  }, [id]);

  const fetchMember = async () => {
    try {
      const res = await axios.get(`http://localhost:5000/api/members/${id}`);
      setMember(res.data);
      if (res.data?.plan) {
        setRenewData((prev) => ({
          ...prev,
          planId: res.data.plan.id,
          duration: res.data.plan.duration,
          amount: res.data.plan.price
        }));
      }
    } catch (e) {
      alert('Member not found');
      navigate('/members');
    } finally {
      setLoading(false);
    }
  };

  const fetchPlans = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/plans');
      setPlans(res.data || []);
    } catch (e) {
      console.error('Failed to fetch plans', e);
    }
  };

  const fetchNotes = async () => {
    try {
      const res = await axios.get(`http://localhost:5000/api/members/${id}/notes`);
      setNotes(res.data || []);
    } catch (e) {
      console.error('Failed to fetch notes', e);
    }
  };

  const handlePlanChange = (planId) => {
    const selected = plans.find((p) => p.id === Number(planId));
    if (!selected) return;
    setRenewData({
      ...renewData,
      planId: selected.id,
      duration: selected.duration,
      amount: selected.price
    });
  };

  const submitRenew = async () => {
    try {
      const payload = {
        duration: renewData.duration,
        amount: renewData.amount,
        method: renewData.method,
        planId: renewData.planId || null,
        cashTendered: renewData.method === 'CASH' ? Number(renewAmountTendered) : null,
        changeDue: null,
        gcashReference: renewData.method === 'GCASH' ? renewGcashReference : null,
        gcashDate: renewGcashDate || null,
        gcashTime: renewGcashTime || null
      };
      await axios.post(`http://localhost:5000/api/members/${id}/renew`, payload);
      setShowRenewModal(false);
      await fetchMember();
      alert('Membership renewed');
    } catch (e) {
      alert(e.response?.data?.error || 'Renew failed');
    }
  };

  const handleFreeze = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`http://localhost:5000/api/members/${id}/status`, {
        status: 'FREEZED',
        freezeStartDate: freezeData.startDate,
        freezeEndDate: freezeData.endDate
      });
      setShowFreezeModal(false);
      await fetchMember();
    } catch (e) {
      alert('Freeze failed');
    }
  };

  const handleActivate = async () => {
    try {
      await axios.post(`http://localhost:5000/api/members/${id}/status`, { status: 'ACTIVE' });
      await fetchMember();
    } catch (e) {
      alert('Activation failed');
    }
  };

  const handleRenew = (e) => {
    e.preventDefault();
    if (renewData.method === 'CASH') {
      const tendered = parseFloat(renewAmountTendered) || 0;
      if (tendered < renewData.amount) return;
      submitRenew();
      return;
    }

    if (renewData.method === 'GCASH') {
      if (!renewGcashReference || !renewGcashDate || !renewGcashTime) return;
      submitRenew();
      return;
    }

    submitRenew();
  };

  const handleSetPassword = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:5000/api/auth/member-setup', {
        email: member.email,
        password: passwordData
      });
      setShowPasswordModal(false);
      setPasswordData('');
      alert('Password set successfully');
    } catch (e) {
      alert('Failed to set password');
    }
  };

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!noteData.trim()) return;
    try {
      await axios.post(`http://localhost:5000/api/members/${id}/notes`, { content: noteData.trim() });
      setNoteData('');
      setShowNotesModal(false);
      fetchNotes();
    } catch (e) {
      alert('Failed to add note');
    }
  };

  const handleEditClick = () => {
    setEditFormData({
      firstName: member.firstName,
      lastName: member.lastName,
      email: member.email,
      phone: member.phone || '',
      expiryDate: member.expiryDate ? new Date(member.expiryDate).toISOString().split('T')[0] : '',
      sex: member.sex || ''
    });
    setShowEditModal(true);
  };

  const handleEditSave = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`http://localhost:5000/api/members/${id}`, editFormData);
      setShowEditModal(false);
      fetchMember();
      alert("Member details updated!");
    } catch (e) {
      alert("Failed to update member");
    }
  };

  const daysRemaining = useMemo(() => {
    if (!member?.expiryDate) return 0;
    const today = new Date();
    const expiry = new Date(member.expiryDate);
    return Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
  }, [member?.expiryDate]);

  const progress = useMemo(() => {
    if (!member?.startDate || !member?.expiryDate) return 0;
    const total = new Date(member.expiryDate) - new Date(member.startDate);
    const elapsed = new Date() - new Date(member.startDate);
    return Math.min(100, Math.max(0, (elapsed / total) * 100));
  }, [member?.startDate, member?.expiryDate]);

  const filteredLogs = useMemo(() => {
    if (!member?.accessLogs) return [];
    const now = new Date();

    if (activityFilter === '7days') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return member.accessLogs.filter((log) => new Date(log.checkIn) >= weekAgo);
    }
    if (activityFilter === '30days') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return member.accessLogs.filter((log) => new Date(log.checkIn) >= monthAgo);
    }
    return member.accessLogs;
  }, [member?.accessLogs, activityFilter]);

  const groupedLogs = useMemo(() => {
    const grouped = {};
    filteredLogs.forEach((log) => {
      const date = new Date(log.checkIn).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(log);
    });
    return grouped;
  }, [filteredLogs]);

  const attendanceScore = useMemo(() => {
    const logs = member?.accessLogs || [];
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentLogs = logs.filter((log) => new Date(log.checkIn) >= thirtyDaysAgo);

    const visitsPerWeek = (recentLogs.length / 30) * 7;
    if (visitsPerWeek >= 4) return { label: 'High', color: 'emerald', icon: 'trending_up' };
    if (visitsPerWeek >= 2) return { label: 'Medium', color: 'amber', icon: 'trending_flat' };
    return { label: 'Low', color: 'red', icon: 'trending_down' };
  }, [member?.accessLogs]);

  const lastActive = useMemo(() => {
    const logs = member?.accessLogs || [];
    if (logs.length === 0) return 'Never';

    const lastLog = logs[0];
    const lastDate = new Date(lastLog.checkIn);
    const now = new Date();
    const diffMs = now - lastDate;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} months ago`;
  }, [member?.accessLogs]);

  const initials = member ? `${member.firstName?.[0] || ''}${member.lastName?.[0] || ''}`.toUpperCase() : '';
  const combinedPlanLabel = member?.plan?.name || 'No Plan';

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }
  if (!member) return null;

  const isExpired = daysRemaining < 0;
  const isExpiringSoon = daysRemaining > 0 && daysRemaining <= 7;

  return (
    <div className="space-y-6 pb-12">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <button onClick={() => navigate('/members')} className="text-text-muted hover:text-primary transition-colors">Members</button>
        <span className="text-text-muted">/</span>
        <span className="text-white font-medium">{member.firstName} {member.lastName}</span>
      </div>

      {/* Header */}
      <div className="bg-surface rounded-3xl border border-white/5 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-primary to-orange-600 rounded-2xl flex items-center justify-center text-xl font-bold text-white overflow-hidden border-2 border-white/10">
              {member.imageUrl ? (
                <img src={member.imageUrl} className="w-full h-full object-cover" alt="" />
              ) : (
                initials
              )}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-white">{member.firstName} {member.lastName}</h1>
                <button
                  onClick={handleEditClick}
                  className="bg-white/10 hover:bg-white/20 text-white p-2 rounded-full transition-colors"
                  title="Edit Profile"
                >
                  <span className="material-icons-round text-sm">edit</span>
                </button>
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${member.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                  member.status === 'FREEZED' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                    'bg-red-500/10 text-red-400 border-red-500/20'
                  }`}>
                  {member.status}
                </span>
                <span className="text-text-muted text-xs">ID: {member.id}</span>
                <span className="text-text-muted text-xs">Last active: {lastActive}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setShowRenewModal(true)} className="px-4 py-2 rounded-xl bg-primary text-background text-sm font-bold">Renew</button>
            {member.status === 'FREEZED' ? (
              <button onClick={handleActivate} className="px-4 py-2 rounded-xl bg-emerald-500/20 text-emerald-300 text-sm font-bold border border-emerald-500/30">Activate</button>
            ) : (
              <button onClick={() => setShowFreezeModal(true)} className="px-4 py-2 rounded-xl bg-blue-500/20 text-blue-300 text-sm font-bold border border-blue-500/30">Freeze</button>
            )}
            <button onClick={() => setShowPasswordModal(true)} className="px-4 py-2 rounded-xl bg-white/5 text-white text-sm font-bold border border-white/10">Set Password</button>
            <button onClick={() => setShowNotesModal(true)} className="px-4 py-2 rounded-xl bg-white/5 text-white text-sm font-bold border border-white/10">Add Note</button>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-surface rounded-2xl border border-white/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="material-icons-round text-amber-500 text-xl">stars</span>
            <p className="text-text-muted text-xs font-bold uppercase tracking-wider">Points</p>
          </div>
          <p className="text-3xl font-extrabold text-white">{member.points}</p>
        </div>
        <div className="bg-surface rounded-2xl border border-white/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="material-icons-round text-emerald-400 text-xl">how_to_reg</span>
            <p className="text-text-muted text-xs font-bold uppercase tracking-wider">Visits</p>
          </div>
          <p className="text-3xl font-extrabold text-white">{member.accessLogs?.length || 0}</p>
        </div>
        <div className="bg-surface rounded-2xl border border-white/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="material-icons-round text-blue-400 text-xl">payments</span>
            <p className="text-text-muted text-xs font-bold uppercase tracking-wider">Spent</p>
          </div>
          <p className="text-2xl font-extrabold text-white">
            {formatPrice(member.payments?.reduce((acc, p) => acc + p.amount, 0) || 0)}
          </p>
        </div>
      </div>

      {/* Freeze Info Banner */}
      {member.status === 'FREEZED' && member.freezeStartDate && (
        <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-400">
            <span className="material-icons-round">ac_unit</span>
          </div>
          <div className="flex-1">
            <p className="text-blue-400 font-bold text-sm mb-1">Account Frozen</p>
            <p className="text-white text-sm">
              {new Date(member.freezeStartDate).toLocaleDateString()} — {new Date(member.freezeEndDate).toLocaleDateString()}
            </p>
          </div>
          <button
            onClick={handleActivate}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all"
          >
            Unfreeze Now
          </button>
        </div>
      )}

      {/* Expiring/Expired Warning */}
      {(isExpiringSoon || isExpired) && (
        <div className={`flex items-center gap-4 p-5 rounded-2xl border ${isExpired ? 'bg-red-500/5 border-red-500/20' : 'bg-amber-500/5 border-amber-500/20'}`}>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isExpired ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'}`}>
            <span className="material-icons-round">warning</span>
          </div>
          <div className="flex-1">
            <p className={`font-bold text-sm mb-1 ${isExpired ? 'text-red-400' : 'text-amber-400'}`}>
              {isExpired ? 'Membership Expired!' : 'Membership Expiring Soon'}
            </p>
            <p className="text-white text-sm">
              {isExpired ? `Expired ${Math.abs(daysRemaining)} days ago` : `Only ${daysRemaining} days remaining`}
            </p>
          </div>
          <button
            onClick={() => setShowRenewModal(true)}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${isExpired ? 'bg-red-500 hover:bg-red-600' : 'bg-amber-500 hover:bg-amber-600'} text-white`}
          >
            Renew Now
          </button>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-2 flex-wrap">
        {['overview', 'activity', 'payments', 'notes'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-xl text-sm font-bold border ${activeTab === tab ? 'bg-primary/15 text-primary border-primary/30' : 'bg-surface text-text-muted border-white/10'}`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Membership Status Card */}
            <div className="bg-gradient-to-br from-primary/10 to-orange-500/10 border border-primary/20 rounded-3xl p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-text-muted text-xs uppercase font-bold tracking-wider mb-2">Current Membership</p>
                  <p className="text-3xl font-bold text-white mb-2">{combinedPlanLabel}</p>
                  <p className="text-primary font-semibold text-lg">
                    {formatPrice(member.plan?.price || 0)} / {member.plan?.duration || 0} Days
                  </p>
                </div>

                {/* Circular Progress */}
                <div className="relative w-28 h-28">
                  <svg className="transform -rotate-90 w-28 h-28">
                    <circle cx="56" cy="56" r="48" stroke="currentColor" strokeWidth="8" fill="none" className="text-white/10" />
                    <circle
                      cx="56" cy="56" r="48"
                      stroke="currentColor" strokeWidth="8" fill="none"
                      strokeDasharray={`${2 * Math.PI * 48}`}
                      strokeDashoffset={`${2 * Math.PI * 48 * (1 - progress / 100)}`}
                      className={`transition-all duration-1000 ${progress > 90 ? 'text-red-500' : 'text-primary'}`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-bold text-white">{Math.max(0, daysRemaining)}</span>
                    <span className="text-[10px] text-text-muted font-semibold">days left</span>
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-text-muted font-semibold">Membership Progress</span>
                  <span className="text-white font-bold">{Math.round(progress)}%</span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ${progress > 90 ? 'bg-red-500' : 'bg-primary'}`}
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
                <div className="bg-white/5 rounded-xl p-3">
                  <p className="text-text-muted font-semibold text-xs mb-1">Start Date</p>
                  <p className="text-white font-bold">
                    {member.startDate ? new Date(member.startDate).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
                <div className="bg-white/5 rounded-xl p-3">
                  <p className="text-text-muted font-semibold text-xs mb-1">Expiry Date</p>
                  <p className={`font-bold ${isExpired ? 'text-red-400' : isExpiringSoon ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {member.expiryDate ? new Date(member.expiryDate).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
              </div>
            </div>

            {/* Personal Information */}
            <div className="bg-surface rounded-3xl border border-white/5 overflow-hidden">
              <div className="p-6 border-b border-white/5 bg-white/5">
                <h3 className="font-bold text-white flex items-center gap-2">
                  <span className="material-icons-round text-primary">person</span>
                  Personal Information
                </h3>
              </div>
              <div className="p-6">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                    <p className="text-text-muted text-xs uppercase font-bold tracking-widest mb-2">Email Address</p>
                    <p className="text-white font-bold text-sm truncate">{member.email}</p>
                  </div>
                  <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                    <p className="text-text-muted text-xs uppercase font-bold tracking-widest mb-2">Phone Number</p>
                    <p className="text-white font-bold text-sm">{member.phone || 'Not provided'}</p>
                  </div>
                  <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                    <p className="text-text-muted text-xs uppercase font-bold tracking-widest mb-2">Date of Birth</p>
                    <p className="text-white font-bold text-sm">
                      {member.birthDate ? new Date(member.birthDate).toLocaleDateString() : 'Not provided'}
                    </p>
                  </div>
                  <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                    <p className="text-text-muted text-xs uppercase font-bold tracking-widest mb-2">Gender</p>
                    <p className="text-white font-bold text-sm">{member.sex || 'Not specified'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Member Insights */}
            <div className="bg-surface rounded-3xl border border-white/5 overflow-hidden">
              <div className="p-6 border-b border-white/5 bg-white/5">
                <h3 className="font-bold text-white flex items-center gap-2">
                  <span className="material-icons-round text-primary">insights</span>
                  Member Insights
                </h3>
              </div>
              <div className="p-5 space-y-4">
                <div className={`bg-${attendanceScore.color}-500/10 rounded-2xl p-4 border border-${attendanceScore.color}-500/20`}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-text-muted text-xs uppercase font-semibold tracking-wider">Engagement</p>
                    <span className={`material-icons-round text-${attendanceScore.color}-400`}>{attendanceScore.icon}</span>
                  </div>
                  <p className={`text-2xl font-bold text-${attendanceScore.color}-400 mb-1`}>{attendanceScore.label}</p>
                  <p className="text-text-muted text-xs">Based on 30-day activity</p>
                </div>

                <div className="bg-purple-500/10 rounded-2xl p-4 border border-purple-500/20">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-text-muted text-xs uppercase font-semibold tracking-wider">Retention Risk</p>
                    <span className="material-icons-round text-purple-400">shield</span>
                  </div>
                  <p className="text-2xl font-bold text-purple-400 mb-1">
                    {isExpired ? 'High' : isExpiringSoon ? 'Medium' : 'Low'}
                  </p>
                  <p className="text-text-muted text-xs">
                    {isExpired ? 'Membership expired' : isExpiringSoon ? 'Expiring soon' : 'Active membership'}
                  </p>
                </div>
              </div>
            </div>

            {/* Recent Activity Preview */}
            <div className="bg-surface rounded-3xl border border-white/5 overflow-hidden">
              <div className="p-6 border-b border-white/5 flex justify-between items-center">
                <h3 className="font-bold text-white flex items-center gap-2">
                  <span className="material-icons-round text-primary">history</span>
                  Recent Activity
                </h3>
                <button onClick={() => setActiveTab('activity')} className="text-primary text-sm font-bold hover:underline">
                  View All
                </button>
              </div>
              <div className="p-6 space-y-3">
                {filteredLogs.slice(0, 5).map((log) => (
                  <div key={log.id} className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${log.status === 'ALLOWED' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                      <span className="material-icons-round text-lg">
                        {log.status === 'ALLOWED' ? 'check_circle' : 'cancel'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-bold text-sm">
                        {log.status === 'ALLOWED' ? 'Successful Check-in' : 'Access Denied'}
                      </p>
                      <p className="text-text-muted text-xs mt-0.5">
                        {new Date(log.checkIn).toLocaleString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </p>
                    </div>
                    <span className={`px-2 py-1 rounded-lg text-[10px] font-bold border ${log.status === 'ALLOWED'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-red-500/10 text-red-400 border-red-500/20'
                      }`}>
                      {log.status}
                    </span>
                  </div>
                ))}
                {filteredLogs.length === 0 && (
                  <div className="py-8 text-center">
                    <span className="material-icons-round text-2xl text-text-muted block mb-2">event_busy</span>
                    <p className="text-text-muted font-medium text-sm">No recent activity</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'activity' && (
        <div className="bg-surface rounded-2xl border border-white/5 p-6 space-y-4">
          <div className="flex gap-2">
            {['all', '7days', '30days'].map((f) => (
              <button
                key={f}
                onClick={() => setActivityFilter(f)}
                className={`px-3 py-1 rounded-full text-xs font-semibold border ${activityFilter === f ? 'bg-primary/15 text-primary border-primary/30' : 'bg-white/5 text-text-muted border-white/10'}`}
              >
                {f === 'all' ? 'All' : f === '7days' ? 'Last 7 Days' : 'Last 30 Days'}
              </button>
            ))}
          </div>
          <div className="space-y-6 max-h-[700px] overflow-y-auto">
            {Object.entries(groupedLogs).map(([date, logs]) => (
              <div key={date}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-primary/10 px-3 py-1.5 rounded-lg border border-primary/20">
                    <p className="text-primary font-bold text-sm">{date}</p>
                  </div>
                  <div className="h-px flex-1 bg-white/5"></div>
                  <span className="text-text-muted text-xs font-bold">{logs.length} visits</span>
                </div>
                <div className="space-y-3">
                  {logs.map((log) => (
                    <div key={log.id} className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${log.status === 'ALLOWED' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                        <span className="material-icons-round text-lg">
                          {log.status === 'ALLOWED' ? 'check_circle' : 'cancel'}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-bold text-sm">
                          {log.status === 'ALLOWED' ? 'Successful Check-in' : 'Access Denied'}
                        </p>
                        <p className="text-text-muted text-xs mt-0.5">
                          {new Date(log.checkIn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <span className={`px-2 py-1 rounded-lg text-[10px] font-bold border ${log.status === 'ALLOWED'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-red-500/10 text-red-400 border-red-500/20'
                        }`}>
                        {log.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {filteredLogs.length === 0 && (
              <p className="text-text-muted text-center py-8">No activity found.</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'payments' && (
        <div className="bg-surface rounded-2xl border border-white/5 p-6 space-y-4">
          {(member.payments || []).map((pay) => (
            <div key={pay.id} className="p-5 bg-white/5 rounded-2xl border border-white/10">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-2xl font-bold text-white mb-1">{formatPrice(pay.amount)}</p>
                  <p className="text-xs text-text-secondary font-medium uppercase tracking-wider">
                    {(pay.type || 'Payment').replace('_', ' ')}
                  </p>
                </div>
                <div className="text-right">
                  <span className="inline-block text-[10px] font-bold bg-background/50 text-text-muted px-3 py-1.5 rounded-lg border border-white/5 mb-2">
                    {pay.method}
                  </span>
                  <p className="text-xs text-text-muted">
                    {new Date(pay.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
              </div>
            </div>
          ))}
          {(member.payments || []).length === 0 && (
            <div className="py-16 text-center">
              <span className="material-icons-round text-3xl text-text-muted block mb-3">receipt</span>
              <p className="text-text-muted font-medium">No payments yet</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'notes' && (
        <div className="bg-surface rounded-3xl border border-white/5 overflow-hidden">
          <div className="p-6 border-b border-white/5 flex justify-between items-center">
            <h3 className="font-bold text-white flex items-center gap-2">
              <span className="material-icons-round text-primary">description</span>
              Staff Notes
            </h3>
            <button
              onClick={() => setShowNotesModal(true)}
              className="bg-primary hover:bg-orange-600 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2"
            >
              <span className="material-icons-round text-sm">add</span>
              Add Note
            </button>
          </div>
          <div className="p-6 space-y-4">
            {notes.length === 0 ? (
              <div className="py-16 text-center">
                <span className="material-icons-round text-3xl text-text-muted block mb-3">note</span>
                <p className="text-text-muted font-medium">No notes yet</p>
                <button
                  onClick={() => setShowNotesModal(true)}
                  className="mt-4 bg-primary/10 hover:bg-primary/20 text-primary px-6 py-2 rounded-xl text-sm font-bold border border-primary/20 transition-all"
                >
                  Create First Note
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {notes.map((note) => (
                  <div key={note.id} className="bg-white/5 border border-white/10 rounded-2xl p-4">
                    <div className="text-xs text-text-muted mb-2">
                      {note.author?.name || note.author?.email || 'Staff'} • {new Date(note.createdAt).toLocaleString()}
                    </div>
                    <p className="text-sm text-white whitespace-pre-wrap">{note.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Renew Modal */}
      {showRenewModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleRenew} className="bg-surface rounded-2xl border border-white/10 w-full max-w-md p-5 space-y-4">
            <h3 className="text-xl font-bold text-white">Renew Membership</h3>
            <select
              value={renewData.planId}
              onChange={(e) => handlePlanChange(e.target.value)}
              className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-3 py-2 text-white"
            >
              <option value="">Select plan</option>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name} - {formatPrice(plan.price)} / {plan.duration} days
                </option>
              ))}
            </select>
            <input
              type="number"
              value={renewData.duration}
              onChange={(e) => setRenewData((prev) => ({ ...prev, duration: Number(e.target.value) }))}
              className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-3 py-2 text-white"
              placeholder="Duration (days)"
              readOnly
            />
            <input
              type="number"
              value={renewData.amount}
              onChange={(e) => setRenewData((prev) => ({ ...prev, amount: Number(e.target.value) }))}
              className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-3 py-2 text-white"
              placeholder="Amount"
            />
            <select
              value={renewData.method}
              onChange={(e) => setRenewData((prev) => ({ ...prev, method: e.target.value }))}
              className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-3 py-2 text-white"
            >
              <option value="CASH">Cash</option>
              <option value="GCASH">GCash</option>
              <option value="CARD">Card</option>
            </select>
            {renewData.method === 'CASH' && (
              <input
                type="number"
                value={renewAmountTendered}
                onChange={(e) => setRenewAmountTendered(e.target.value)}
                className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-3 py-2 text-white"
                placeholder="Cash tendered"
              />
            )}
            {renewData.method === 'GCASH' && (
              <div className="space-y-2">
                <input
                  value={renewGcashReference}
                  onChange={(e) => setRenewGcashReference(e.target.value)}
                  className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-3 py-2 text-white"
                  placeholder="GCash reference"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={renewGcashDate}
                    onChange={(e) => setRenewGcashDate(e.target.value)}
                    className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-3 py-2 text-white"
                  />
                  <input
                    type="time"
                    value={renewGcashTime}
                    onChange={(e) => setRenewGcashTime(e.target.value)}
                    className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowRenewModal(false)} className="flex-1 py-2 rounded-xl bg-white/5 text-white">Cancel</button>
              <button type="submit" className="flex-1 py-2 rounded-xl bg-primary text-background font-bold">Renew</button>
            </div>
          </form>
        </div>
      )}

      {/* Freeze Modal */}
      {showFreezeModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleFreeze} className="bg-surface rounded-2xl border border-white/10 w-full max-w-md p-5 space-y-4">
            <h3 className="text-xl font-bold text-white">Freeze Membership</h3>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={freezeData.startDate}
                onChange={(e) => setFreezeData((prev) => ({ ...prev, startDate: e.target.value }))}
                className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-3 py-2 text-white"
              />
              <input
                type="date"
                value={freezeData.endDate}
                onChange={(e) => setFreezeData((prev) => ({ ...prev, endDate: e.target.value }))}
                className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-3 py-2 text-white"
              />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowFreezeModal(false)} className="flex-1 py-2 rounded-xl bg-white/5 text-white">Cancel</button>
              <button type="submit" className="flex-1 py-2 rounded-xl bg-blue-500 text-white font-bold">Freeze</button>
            </div>
          </form>
        </div>
      )}

      {/* Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSetPassword} className="bg-surface rounded-2xl border border-white/10 w-full max-w-md p-5 space-y-4">
            <h3 className="text-xl font-bold text-white">Set Password</h3>
            <input
              type="password"
              value={passwordData}
              onChange={(e) => setPasswordData(e.target.value)}
              className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-3 py-2 text-white"
              placeholder="New password"
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowPasswordModal(false)} className="flex-1 py-2 rounded-xl bg-white/5 text-white">Cancel</button>
              <button type="submit" className="flex-1 py-2 rounded-xl bg-primary text-background font-bold">Save</button>
            </div>
          </form>
        </div>
      )}

      {/* Notes Modal */}
      {showNotesModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleAddNote} className="bg-surface rounded-2xl border border-white/10 w-full max-w-md p-5 space-y-4">
            <h3 className="text-xl font-bold text-white">Add Note</h3>
            <textarea
              value={noteData}
              onChange={(e) => setNoteData(e.target.value)}
              className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-3 py-2 text-white"
              rows={4}
              placeholder="Enter your note here..."
              required
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowNotesModal(false)} className="flex-1 py-2 rounded-xl bg-white/5 text-white">Cancel</button>
              <button type="submit" className="flex-1 py-2 rounded-xl bg-primary text-background font-bold">Save Note</button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Member Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-white/10 rounded-2xl shadow-2xl max-w-lg w-full p-6">
            <h2 className="text-2xl font-bold text-white mb-6">Edit Member Details</h2>
            <form onSubmit={handleEditSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-text-muted text-sm font-medium mb-1">First Name</label>
                  <input
                    type="text"
                    required
                    className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary outline-none"
                    value={editFormData.firstName || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, firstName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-text-muted text-sm font-medium mb-1">Last Name</label>
                  <input
                    type="text"
                    required
                    className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary outline-none"
                    value={editFormData.lastName || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, lastName: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-text-muted text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  required
                  className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary outline-none"
                  value={editFormData.email || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-text-muted text-sm font-medium mb-1">Phone</label>
                <input
                  type="tel"
                  className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary outline-none"
                  value={editFormData.phone || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-text-muted text-sm font-medium mb-1 text-orange-400">Expiry Date (Override)</label>
                <input
                  type="date"
                  className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary outline-none"
                  value={editFormData.expiryDate || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, expiryDate: e.target.value })}
                />
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 py-3 text-white font-bold bg-white/10 hover:bg-white/20 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-primary hover:bg-orange-600 text-white font-bold rounded-xl"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
