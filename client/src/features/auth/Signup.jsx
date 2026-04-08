import React from 'react';
import { Link } from 'react-router-dom';

export default function Signup() {
    const steps = [
        { icon: 'storefront', title: 'Visit our nearest branch', desc: 'Find a FitOS Gym near you.' },
        { icon: 'badge', title: 'Present your ID and details', desc: 'Bring a valid ID to the front desk.' },
        { icon: 'support_agent', title: 'Staff will handle your registration', desc: 'We will input your details and assign your plan.' },
        { icon: 'draw', title: 'Sign the agreement', desc: 'Review and sign the membership terms.' },
        { icon: 'mark_email_read', title: 'Activate your account', desc: 'Click the link sent to your email.' },
        { icon: 'fitness_center', title: 'Start using the gym!', desc: 'Access the facility and enjoy your workout.' },
    ];

    return (
        <div className="min-h-screen bg-[#0A0A0A] text-white flex items-center justify-center p-6 relative overflow-hidden">
            {/* Background Glow Detail */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 blur-[120px] rounded-full"></div>

            <div className="relative w-full max-w-md bg-white/5 backdrop-blur-2xl border border-white/10 p-10 rounded-[2.5rem] shadow-2xl z-10">
                <div className="text-center mb-10">
                    <h1 className="text-4xl font-black italic tracking-tighter uppercase">
                        Fit<span className="text-primary">OS</span>
                    </h1>
                    <p className="text-gray-400 mt-2">How to join our gym</p>
                </div>

                <div className="space-y-6">
                    {steps.map((step, index) => (
                        <div key={index} className="flex flex-row gap-4 items-start">
                            <div className="flex flex-col items-center">
                                <div className="w-10 h-10 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold relative z-10">
                                    <span className="material-icons-round text-xl">{step.icon}</span>
                                </div>
                                {index !== steps.length - 1 && (
                                    <div className="w-px h-12 bg-white/10 absolute mt-10"></div>
                                )}
                            </div>
                            <div className="pt-1">
                                <h3 className="font-bold text-lg text-white">{index + 1}. {step.title}</h3>
                                <p className="text-sm text-gray-400">{step.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-10 pt-8 border-t border-white/10 space-y-4 text-center">
                    <p className="text-gray-400 text-sm">
                        Already a member?
                        <Link to="/login" className="text-primary font-bold hover:underline ml-1">
                            Sign In
                        </Link>
                    </p>
                    <Link to="/" className="inline-flex items-center gap-2 text-xs text-text-muted hover:text-white transition-colors uppercase tracking-widest font-black">
                        <span className="material-icons-round text-sm">arrow_back</span>
                        Back
                    </Link>
                </div>
            </div>
        </div>
    );
}
