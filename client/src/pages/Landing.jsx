import { Link } from 'react-router-dom';
import { useState } from 'react';
import {
    Layers,
    Zap,
    Users,
    Shield,
    RefreshCw,
    Mail,
    FileText,
    Clock,
    Monitor,
    Printer,
    Camera,
    BarChart3,
    Lock,
    Check,
    X,
    Menu,
    XIcon,
    ChevronRight
} from 'lucide-react';

const FitOSLanding = () => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const scrollToSection = (sectionId) => {
        const element = document.getElementById(sectionId);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
            setIsMenuOpen(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-gray-100">
            {/* Navigation */}
            <nav className="sticky top-0 z-50 bg-[#0a0a0a]/90 backdrop-blur-xl border-b border-gray-800">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
                                <Layers className="h-6 w-6 text-white" />
                            </div>
                            <span className="text-2xl font-bold text-white">
                                FitOS
                                <span className="text-xs ml-2 text-gray-500 font-normal">Gym Management</span>
                            </span>
                        </div>

                        <div className="hidden md:flex items-center gap-6">
                            <button
                                onClick={() => scrollToSection('features')}
                                className="text-gray-400 hover:text-white transition-colors"
                            >
                                Features
                            </button>
                            <button
                                onClick={() => scrollToSection('hardware')}
                                className="text-gray-400 hover:text-white transition-colors"
                            >
                                Hardware
                            </button>
                            <button
                                onClick={() => scrollToSection('pricing')}
                                className="text-gray-400 hover:text-white transition-colors"
                            >
                                Pricing
                            </button>
                            <button
                                onClick={() => scrollToSection('faq')}
                                className="text-gray-400 hover:text-white transition-colors"
                            >
                                FAQ
                            </button>
                            <Link
                                to="/signup"
                                className="bg-gradient-to-r from-orange-500 to-orange-600 text-white px-6 py-2 rounded-lg font-semibold hover:from-orange-600 hover:to-orange-700 transition-all text-center"
                            >
                                Get Started
                            </Link>
                        </div>

                        <button
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                            className="md:hidden p-2 text-gray-400"
                        >
                            {isMenuOpen ? <XIcon className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                        </button>
                    </div>

                    {isMenuOpen && (
                        <div className="md:hidden py-4 border-t border-gray-800">
                            <div className="flex flex-col space-y-3">
                                <button
                                    onClick={() => scrollToSection('features')}
                                    className="text-left px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-800/50 rounded"
                                >
                                    Features
                                </button>
                                <button
                                    onClick={() => scrollToSection('hardware')}
                                    className="text-left px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-800/50 rounded"
                                >
                                    Hardware
                                </button>
                                <button
                                    onClick={() => scrollToSection('pricing')}
                                    className="text-left px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-800/50 rounded"
                                >
                                    Pricing
                                </button>
                                <button
                                    onClick={() => scrollToSection('faq')}
                                    className="text-left px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-800/50 rounded"
                                >
                                    FAQ
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </nav>

            {/* Hero Section */}
            <section className="relative py-20 sm:py-32 overflow-hidden">
                {/* Grid Background */}
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzIxMjEyMSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-40"></div>

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                    <div className="text-center mb-12">
                        <div className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 text-orange-400 px-4 py-2 rounded-full text-sm font-medium mb-6">
                            <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                            Enterprise v3.0 Now Available
                        </div>

                        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-6 text-white">
                            The Operating System for<br />Modern Fitness Facilities
                        </h1>

                        <p className="text-xl text-gray-400 max-w-3xl mx-auto mb-10">
                            Replace your spreadsheets and disconnected tools with one unified platform.
                            Manage members, automated billing, and access control securely.
                        </p>

                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <button
                                onClick={() => scrollToSection('pricing')}
                                className="bg-gradient-to-r from-orange-500 to-orange-600 text-white px-8 py-4 rounded-lg font-semibold text-lg hover:from-orange-600 hover:to-orange-700 transition-all shadow-lg shadow-orange-500/25"
                            >
                                View Packages
                            </button>
                            <button
                                onClick={() => scrollToSection('features')}
                                className="bg-gray-800 border border-gray-700 text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-gray-700 transition-all"
                            >
                                Book Live Demo
                            </button>
                        </div>
                    </div>

                    {/* Hero Image Placeholder */}
                    <div className="mt-16 rounded-2xl overflow-hidden border border-gray-800 shadow-2xl">
                        <div className="bg-gradient-to-br from-gray-900 to-gray-800 aspect-video flex items-center justify-center">
                            <div className="text-center">
                                <Monitor className="h-16 w-16 text-gray-600 mx-auto mb-4" />
                                <p className="text-gray-500 font-medium">Dashboard Preview</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Social Proof */}
            <section className="py-12 border-y border-gray-800">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <p className="text-center text-sm text-gray-500 font-medium mb-6">
                        TRUSTED BY 500+ GYMS & WELLNESS CENTERS
                    </p>
                    <div className="flex flex-wrap justify-center items-center gap-8 opacity-40">
                        <span className="text-gray-600 font-bold text-lg">GOLD'S GYM</span>
                        <span className="text-gray-600 font-bold text-lg">ANYTIME FITNESS</span>
                        <span className="text-gray-600 font-bold text-lg">CROSSFIT</span>
                        <span className="text-gray-600 font-bold text-lg">EQUINOX</span>
                        <span className="text-gray-600 font-bold text-lg">YMCA</span>
                    </div>
                </div>
            </section>

            {/* Feature Section 1 - Access Control */}
            <section id="features" className="py-20">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid md:grid-cols-2 gap-12 items-center">
                        <div>
                            <span className="inline-block bg-orange-500/10 border border-orange-500/20 text-orange-400 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide mb-4">
                                Access Control
                            </span>
                            <h2 className="text-4xl font-bold mb-4 text-white">Lightning Fast Check-ins</h2>
                            <p className="text-gray-400 text-lg mb-6">
                                Don't let lines form at the front desk. Our system processes member scans in under 0.5 seconds,
                                giving you instant visual verification of payment status and membership validity.
                            </p>
                            <ul className="space-y-3">
                                <li className="flex items-center gap-3">
                                    <Check className="h-5 w-5 text-orange-500 flex-shrink-0" />
                                    <span className="text-gray-300">Works with Barcode & QR Codes</span>
                                </li>
                                <li className="flex items-center gap-3">
                                    <Check className="h-5 w-5 text-orange-500 flex-shrink-0" />
                                    <span className="text-gray-300">Pop-up alerts for expiring plans</span>
                                </li>
                                <li className="flex items-center gap-3">
                                    <Check className="h-5 w-5 text-orange-500 flex-shrink-0" />
                                    <span className="text-gray-300">Tracks peak hours automatically</span>
                                </li>
                                <li className="flex items-center gap-3">
                                    <Check className="h-5 w-5 text-orange-500 flex-shrink-0" />
                                    <span className="text-gray-300">Photo verification to prevent sharing</span>
                                </li>
                            </ul>
                        </div>
                        <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-800 rounded-2xl p-8 shadow-xl">
                            <div className="bg-gray-800/50 aspect-video rounded-lg flex items-center justify-center">
                                <Zap className="h-16 w-16 text-orange-500" />
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Feature Section 2 - Analytics */}
            <section className="py-20 bg-gradient-to-b from-gray-900/50 to-transparent">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid md:grid-cols-2 gap-12 items-center">
                        <div className="order-2 md:order-1 bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-800 rounded-2xl p-8 shadow-xl">
                            <div className="bg-gray-800/50 aspect-video rounded-lg flex items-center justify-center">
                                <BarChart3 className="h-16 w-16 text-orange-500" />
                            </div>
                        </div>
                        <div className="order-1 md:order-2">
                            <span className="inline-block bg-orange-500/10 border border-orange-500/20 text-orange-400 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide mb-4">
                                Business Intelligence
                            </span>
                            <h2 className="text-4xl font-bold mb-4 text-white">Data-Driven Decisions</h2>
                            <p className="text-gray-400 text-lg mb-6">
                                Stop guessing about your gym's health. FitOS aggregates all your data into a real-time dashboard,
                                allowing you to see exactly where your revenue is coming from.
                            </p>
                            <ul className="space-y-3">
                                <li className="flex items-center gap-3">
                                    <Check className="h-5 w-5 text-orange-500 flex-shrink-0" />
                                    <span className="text-gray-300">Monthly Recurring Revenue (MRR) tracking</span>
                                </li>
                                <li className="flex items-center gap-3">
                                    <Check className="h-5 w-5 text-orange-500 flex-shrink-0" />
                                    <span className="text-gray-300">Member retention & churn rates</span>
                                </li>
                                <li className="flex items-center gap-3">
                                    <Check className="h-5 w-5 text-orange-500 flex-shrink-0" />
                                    <span className="text-gray-300">Staff commission calculation</span>
                                </li>
                                <li className="flex items-center gap-3">
                                    <Check className="h-5 w-5 text-orange-500 flex-shrink-0" />
                                    <span className="text-gray-300">Automated daily email reports</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </section>

            {/* Feature Section 3 - POS */}
            <section className="py-20">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid md:grid-cols-2 gap-12 items-center">
                        <div>
                            <span className="inline-block bg-orange-500/10 border border-orange-500/20 text-orange-400 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide mb-4">
                                Point of Sale
                            </span>
                            <h2 className="text-4xl font-bold mb-4 text-white">Integrated POS & Billing</h2>
                            <p className="text-gray-400 text-lg mb-6">
                                Sell supplements, water, and gear directly from the same interface you use for check-ins.
                                Manage inventory levels and link purchases to member profiles for "charge to account" capabilities.
                            </p>
                            <ul className="space-y-3">
                                <li className="flex items-center gap-3">
                                    <Check className="h-5 w-5 text-orange-500 flex-shrink-0" />
                                    <span className="text-gray-300">Touch-screen friendly interface</span>
                                </li>
                                <li className="flex items-center gap-3">
                                    <Check className="h-5 w-5 text-orange-500 flex-shrink-0" />
                                    <span className="text-gray-300">Receipt printing (Thermal 80mm)</span>
                                </li>
                                <li className="flex items-center gap-3">
                                    <Check className="h-5 w-5 text-orange-500 flex-shrink-0" />
                                    <span className="text-gray-300">Inventory low-stock alerts</span>
                                </li>
                                <li className="flex items-center gap-3">
                                    <Check className="h-5 w-5 text-orange-500 flex-shrink-0" />
                                    <span className="text-gray-300">Export sales data to Excel/CSV</span>
                                </li>
                            </ul>
                        </div>
                        <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-800 rounded-2xl p-8 shadow-xl">
                            <div className="bg-gray-800/50 aspect-video rounded-lg flex items-center justify-center">
                                <p className="text-gray-600 font-medium">POS Interface Preview</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Bento Grid Features */}
            <section className="py-20 bg-gradient-to-b from-gray-900 to-gray-800/50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl font-bold mb-4 text-white">Enterprise-Grade Infrastructure</h2>
                        <p className="text-gray-400 text-lg">Built for stability, security, and scale.</p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <BentoCard
                            icon={<Lock className="h-6 w-6" />}
                            title="Local Data Encryption"
                            description="Your member data is encrypted at rest using AES-256 standards. We prioritize local-first storage for maximum speed and offline capability."
                        />
                        <BentoCard
                            icon={<Users className="h-6 w-6" />}
                            title="Multi-User Permissions"
                            description="Granular access control. Give your front-desk staff access to check-ins, while restricting financial data to managers and owners."
                        />
                        <BentoCard
                            icon={<RefreshCw className="h-6 w-6" />}
                            title="Automated Backups"
                            description="Never lose data. The system automatically creates daily backups to a secure local partition or your optional cloud drive."
                        />
                        <BentoCard
                            icon={<Mail className="h-6 w-6" />}
                            title="Marketing Automation"
                            description="Send bulk SMS or Emails to members who haven't visited in 30 days, or wish them a happy birthday automatically."
                        />
                        <BentoCard
                            icon={<FileText className="h-6 w-6" />}
                            title="Digital Waivers"
                            description="Go paperless. New members can sign liability waivers digitally, which are instantly stored and linked to their profile."
                        />
                        <BentoCard
                            icon={<Clock className="h-6 w-6" />}
                            title="Session Tracking"
                            description="Perfect for Personal Trainers. Track prepaid sessions (e.g., '10 Class Pack') and auto-deduct upon check-in."
                        />
                    </div>
                </div>
            </section>

            {/* Hardware Section */}
            <section id="hardware" className="py-20">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl font-bold mb-4 text-white">Hardware Compatibility</h2>
                        <p className="text-gray-400 text-lg">
                            Our software runs on standard Windows hardware, or you can purchase our turnkey kits.
                        </p>
                    </div>

                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        <HardwareCard
                            icon="🖥️"
                            title="Windows PC"
                            specs={["Windows 10/11", "4GB RAM Min", "i3 Processor or better"]}
                        />
                        <HardwareCard
                            icon="🔫"
                            title="Barcode Scanner"
                            specs={["Any USB Plug-and-Play", "Supports Code 128/39", "QR Code Compatible"]}
                        />
                        <HardwareCard
                            icon="🖨️"
                            title="Receipt Printer"
                            specs={["Standard 58mm or 80mm", "Thermal Printer", "EPSON / POS-58 Driver"]}
                        />
                        <HardwareCard
                            icon="📸"
                            title="Webcam"
                            specs={["Logitech or Generic", "For Member Photos", "720p Recommended"]}
                        />
                    </div>
                </div>
            </section>

            {/* Pricing Section */}
            <section id="pricing" className="py-20 bg-gradient-to-b from-gray-900/50 to-transparent">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl font-bold mb-4 text-white">Transparent Investment</h2>
                        <p className="text-gray-400 text-lg">
                            One-time licensing. No recurring monthly software fees. Own your data.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        {/* Starter */}
                        <PricingCard
                            name="Starter"
                            subtitle="For boutique studios & small gyms"
                            price="18k"
                            hardware="🖥️ Client provides PC/Laptop"
                            features={[
                                "Core Membership Software",
                                "Basic Barcode Scanner",
                                "Remote Installation",
                                "90 Days Email Support"
                            ]}
                            buttonText="Get Starter"
                            buttonStyle="outline"
                        />

                        {/* Standard - Featured */}
                        <PricingCard
                            name="Standard"
                            subtitle="For growing fitness centers"
                            price="35k"
                            hardware="🖥️ Client provides PC/Laptop"
                            features={[
                                "Advanced Analytics Module",
                                "Pro Barcode Scanner",
                                "80mm Thermal Printer",
                                "On-site Deployment & Training",
                                "6 Months Priority Support"
                            ]}
                            buttonText="Choose Standard"
                            buttonStyle="primary"
                            featured={true}
                        />

                        {/* Enterprise */}
                        <PricingCard
                            name="Enterprise"
                            subtitle="For large-scale facilities"
                            price="65k"
                            hardware="✅ Includes Dedicated PC Unit"
                            hardwareIncluded={true}
                            features={[
                                "Turnkey Hardware Solution",
                                "Enterprise Scanner & Printer",
                                "Custom Receipt Branding",
                                "Full Day On-site Implementation",
                                "12 Months Dedicated Support"
                            ]}
                            buttonText="Contact Sales"
                            buttonStyle="outline"
                        />
                    </div>
                </div>
            </section>

            {/* FAQ Section */}
            <section id="faq" className="py-20">
                <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="text-4xl font-bold text-center mb-12 text-white">Frequently Asked Questions</h2>

                    <div className="space-y-6">
                        <FAQItem
                            question="Does this require an internet connection?"
                            answer="FitOS is a 'Local First' software. It functions perfectly offline for check-ins and POS. Internet is only required for cloud backups and sending emails."
                        />
                        <FAQItem
                            question="Is there a monthly fee?"
                            answer="No. We operate on a Lifetime License model. You pay once for the version you buy. Optional support packages are available for renewal annually."
                        />
                        <FAQItem
                            question="Can I migrate my data from Excel?"
                            answer="Yes, we provide a CSV import template. Our team can also handle the migration for you with the Premium package."
                        />
                        <FAQItem
                            question="Does it support door access control (Maglocks)?"
                            answer="Yes, FitOS can integrate with specific relay controllers to trigger magnetic door locks upon successful member scan. Contact sales for compatible hardware list."
                        />
                    </div>
                </div>
            </section>

            {/* Final CTA */}
            <section className="py-20 bg-gradient-to-r from-orange-600 to-orange-500">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <h2 className="text-4xl font-bold text-white mb-4">Stop Overpaying for Gym Software</h2>
                    <p className="text-orange-100 text-lg mb-8">
                        Join hundreds of gym owners who have switched to the reliability of FitOS.
                    </p>
                    <button className="bg-white text-orange-600 px-10 py-4 rounded-lg font-bold text-lg hover:bg-gray-100 transition-all shadow-xl">
                        See Investment Packages
                    </button>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-gray-950 border-t border-gray-800 py-12">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid md:grid-cols-4 gap-8 mb-8">
                        <div>
                            <div className="flex items-center gap-2 mb-4">
                                <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
                                    <Layers className="h-5 w-5 text-white" />
                                </div>
                                <span className="text-xl font-bold">FitOS</span>
                            </div>
                            <p className="text-gray-500 text-sm">
                                Building the digital infrastructure for the fitness industry.
                            </p>
                        </div>

                        <div>
                            <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Product</h4>
                            <div className="space-y-2">
                                <a href="#" className="block text-gray-500 hover:text-orange-500 transition-colors text-sm">Features</a>
                                <a href="#" className="block text-gray-500 hover:text-orange-500 transition-colors text-sm">Changelog</a>
                                <a href="#" className="block text-gray-500 hover:text-orange-500 transition-colors text-sm">Download Trial</a>
                            </div>
                        </div>

                        <div>
                            <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Company</h4>
                            <div className="space-y-2">
                                <a href="#" className="block text-gray-500 hover:text-orange-500 transition-colors text-sm">About Us</a>
                                <a href="#" className="block text-gray-500 hover:text-orange-500 transition-colors text-sm">Careers</a>
                                <a href="#" className="block text-gray-500 hover:text-orange-500 transition-colors text-sm">Contact</a>
                            </div>
                        </div>

                        <div>
                            <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Legal</h4>
                            <div className="space-y-2">
                                <a href="#" className="block text-gray-500 hover:text-orange-500 transition-colors text-sm">Privacy Policy</a>
                                <a href="#" className="block text-gray-500 hover:text-orange-500 transition-colors text-sm">Terms of Service</a>
                                <a href="#" className="block text-gray-500 hover:text-orange-500 transition-colors text-sm">EULA</a>
                            </div>
                        </div>
                    </div>

                    <div className="border-t border-gray-800 pt-8">
                        <p className="text-center text-gray-500 text-sm">
                            © 2026 Gym Membership Management Solutions. All rights reserved.
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    );
};

// Component: Bento Card
const BentoCard = ({ icon, title, description }) => {
    return (
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 hover:bg-gray-900 hover:border-gray-700 transition-all">
            <div className="text-orange-500 mb-4">{icon}</div>
            <h3 className="text-lg font-semibold mb-2 text-white">{title}</h3>
            <p className="text-gray-400 text-sm leading-relaxed">{description}</p>
        </div>
    );
};

// Component: Hardware Card
const HardwareCard = ({ icon, title, specs }) => {
    return (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center hover:border-orange-500/50 transition-all">
            <div className="text-5xl mb-4">{icon}</div>
            <h4 className="text-lg font-semibold mb-3 text-white">{title}</h4>
            <div className="space-y-1">
                {specs.map((spec, index) => (
                    <p key={index} className="text-gray-500 text-sm">{spec}</p>
                ))}
            </div>
        </div>
    );
};

// Component: Pricing Card
const PricingCard = ({
    name,
    subtitle,
    price,
    hardware,
    hardwareIncluded,
    features,
    buttonText,
    buttonStyle,
    featured
}) => {
    return (
        <div className={`relative bg-gray-900 border ${featured ? 'border-orange-500 shadow-xl shadow-orange-500/10' : 'border-gray-800'} rounded-xl p-8 hover:border-orange-500/50 transition-all`}>
            {featured && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="bg-gradient-to-r from-orange-500 to-orange-600 text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wide">
                        Recommended
                    </span>
                </div>
            )}

            <div className="mb-6">
                <h3 className="text-xl font-semibold mb-1 text-white">{name}</h3>
                <p className="text-gray-500 text-sm mb-4">{subtitle}</p>
                <div className="flex items-baseline gap-1">
                    <span className="text-gray-400 text-2xl">₱</span>
                    <span className="text-5xl font-bold text-white">{price}</span>
                    <span className="text-gray-500">/ license</span>
                </div>
            </div>

            <div className={`${hardwareIncluded ? 'bg-green-900/20 border-green-500/30 text-green-400' : 'bg-gray-800/50 border-gray-700 text-gray-400'} border rounded-lg px-4 py-2 text-sm mb-6`}>
                {hardware}
            </div>

            <ul className="space-y-3 mb-8">
                {features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-3">
                        <Check className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-300 text-sm">{feature}</span>
                    </li>
                ))}
            </ul>

            <button className={`w-full py-3 rounded-lg font-semibold transition-all ${buttonStyle === 'primary'
                ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700'
                : 'bg-gray-800 border border-gray-700 text-white hover:bg-gray-700'
                }`}>
                {buttonText}
            </button>
        </div>
    );
};

// Component: FAQ Item
const FAQItem = ({ question, answer }) => {
    return (
        <div className="border-b border-gray-800 pb-6">
            <h3 className="text-lg font-semibold mb-2 text-white">{question}</h3>
            <p className="text-gray-400 leading-relaxed">{answer}</p>
        </div>
    );
};

export default FitOSLanding;