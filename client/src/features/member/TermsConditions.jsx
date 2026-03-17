import React from 'react';
import { useNavigate } from 'react-router-dom';
import MemberPageHeader from './components/MemberPageHeader';

const agreementSections = [
    {
        title: '1. Health and Safety',
        content: 'I confirm that I am in good physical health and have no medical conditions that would prevent me from using the gym facilities safely. I assume all risks associated with physical exercise.'
    },
    {
        title: '2. Rules and Regulations',
        content: 'Members must follow all gym rules, including appropriate attire and proper equipment usage. Management reserves the right to terminate membership for violation of rules.'
    },
    {
        title: '3. Liability Waiver',
        content: 'The gym is not responsible for any lost or stolen items. Members use the facilities at their own risk. The gym and its staff are not liable for any injuries sustained on the premises.'
    },
    {
        title: '4. Membership Cancellation',
        content: 'Membership fees are non-refundable. Notice requirement for cancellation depends on the specific plan purchased.'
    }
];

export default function TermsConditions() {
    const navigate = useNavigate();

    return (
        <div className="space-y-4 max-w-3xl mx-auto">
            <MemberPageHeader
                title="Terms & Conditions"
                subtitle="Membership Agreement"
                icon="gavel"
                leading={(
                    <button
                        type="button"
                        onClick={() => navigate('/profile')}
                        className="w-9 h-9 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 flex items-center justify-center"
                        aria-label="Back to profile"
                    >
                        <span className="material-icons-round text-base text-white/80">arrow_back</span>
                    </button>
                )}
            />

            <section className="rounded-2xl border border-white/10 bg-surface p-4 sm:p-5">
                <div className="pb-3 border-b border-white/10">
                    <h2 className="text-lg font-bold text-white">Gym POS Membership Form</h2>
                    <p className="text-xs text-text-muted mt-1">
                        Official registration and waiver agreement accepted during member registration.
                    </p>
                </div>

                <div className="mt-4 space-y-3">
                    {agreementSections.map((section) => (
                        <article key={section.title} className="rounded-xl border border-white/10 bg-white/5 p-3">
                            <h3 className="text-sm font-bold text-white">{section.title}</h3>
                            <p className="text-xs text-text-secondary mt-1.5 leading-relaxed">{section.content}</p>
                        </article>
                    ))}
                </div>

                <div className="mt-4 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2.5">
                    <p className="text-xs text-primary font-semibold">
                        By using your membership, you acknowledge and agree to this policy.
                    </p>
                </div>
            </section>
        </div>
    );
}
