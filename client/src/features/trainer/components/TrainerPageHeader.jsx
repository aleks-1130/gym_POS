import React from 'react';

export default function TrainerPageHeader({
    title,
    subtitle,
    icon = 'dashboard',
    leading = null,
    rightSlot = null,
    children = null,
    className = ''
}) {
    return (
        <header className={`sticky top-0 z-40 -mx-4 px-4 py-3 bg-background/90 backdrop-blur border-b border-white/10 ${className}`.trim()}>
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                    {leading}
                    <div className="w-9 h-9 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center shrink-0">
                        <span className="material-icons-round text-base text-white/80">{icon}</span>
                    </div>
                    <div className="min-w-0">
                        <h1 className="text-base font-bold text-white truncate">{title}</h1>
                        {subtitle ? <p className="text-[11px] text-text-muted">{subtitle}</p> : null}
                    </div>
                </div>
                {rightSlot ? <div className="shrink-0">{rightSlot}</div> : null}
            </div>
            {children ? <div className="mt-3">{children}</div> : null}
        </header>
    );
}
