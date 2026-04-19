/**
 * ProfilePage — User/Officer profile page
 * Shows personal details, and for officers: documents, approval status, jurisdiction
 */
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function Icon({ name, className = '' }) {
    return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

const CAT_LABEL = {
    pothole: 'Pothole / Road',
    garbage: 'Garbage / Sanitation',
    broken_streetlight: 'Streetlight / Electrical',
    waterlogging: 'Waterlogging / Drainage',
    other: 'Other',
};

const STATUS_BADGE = {
    approved: 'bg-emerald-100 text-emerald-700',
    pending: 'bg-amber-100 text-amber-700',
    rejected: 'bg-red-100 text-red-700',
};

export default function ProfilePage() {
    const { user, userLogout, userLoading, isUserAuthenticated } = useAuth();
    const navigate = useNavigate();

    if (userLoading) {
        return (
            <div className="min-h-screen bg-[#f6f6f8] flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (!isUserAuthenticated) {
        navigate('/auth?mode=login');
        return null;
    }

    const handleLogout = () => {
        userLogout();
        navigate('/');
    };

    const dashboardPath = user?.role === 'officer' ? '/officer' : '/dashboard';

    return (
        <div className="min-h-screen bg-[#f6f6f8] font-display text-slate-900 overflow-x-hidden pb-16">
            <div className="blob blob-a opacity-30" aria-hidden="true" />
            <div className="blob blob-b opacity-20" aria-hidden="true" />

            {/* Header */}
            <header className="relative z-40 w-full glass border-b border-white/40 sticky top-0">
                <div className="max-w-3xl mx-auto px-5 py-4 flex items-center justify-between">
                    <Link to={dashboardPath} className="flex items-center gap-2.5">
                        <div className="bg-primary text-white rounded-lg w-9 h-9 flex items-center justify-center shadow-md shadow-primary/30">
                            <Icon name="location_city" className="text-xl" />
                        </div>
                        <span className="text-lg font-black tracking-tight">CivicLens</span>
                    </Link>
                    <div className="flex items-center gap-3">
                        <Link to={dashboardPath} className="text-sm font-bold text-primary hover:underline flex items-center gap-1">
                            <Icon name="arrow_back" className="text-lg" />
                            Dashboard
                        </Link>
                    </div>
                </div>
            </header>

            <main className="relative z-10 max-w-3xl mx-auto px-5 pt-8 space-y-8">
                {/* Profile Header */}
                <section className="bg-white/70 backdrop-blur-md border border-white rounded-3xl p-8 shadow-sm flex flex-col sm:flex-row items-center gap-6">
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center text-white text-4xl font-black shadow-lg shadow-primary/20">
                        {user?.name?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <div className="flex-1 text-center sm:text-left">
                        <h1 className="text-2xl font-black tracking-tight">{user?.name}</h1>
                        <p className="text-sm text-slate-500 mt-1">{user?.email}</p>
                        <div className="flex items-center gap-3 mt-3 justify-center sm:justify-start">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${user?.role === 'officer' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-700'}`}>
                                {user?.role}
                            </span>
                            {user?.role === 'officer' && user?.status && (
                                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${STATUS_BADGE[user.status] || ''}`}>
                                    {user.status}
                                </span>
                            )}
                        </div>
                    </div>
                </section>

                {/* Details Cards */}
                <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <DetailCard icon="mail" label="Email" value={user?.email || '-'} />
                    <DetailCard icon="call" label="Phone" value={user?.phone || 'Not provided'} />
                    <DetailCard icon="badge" label="Role" value={user?.role?.charAt(0).toUpperCase() + user?.role?.slice(1) || '-'} />
                    <DetailCard icon="calendar_today" label="Member Since" value={user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-'} />
                    
                    {user?.role === 'officer' && (
                        <>
                            <DetailCard icon="apartment" label="Department" value={user?.department || 'Not specified'} />
                            <DetailCard icon="location_city" label="City" value={user?.jurisdiction?.city || 'Not specified'} />
                            <DetailCard icon="category" label="Issue Domain" value={CAT_LABEL[user?.issueCategory] || user?.issueCategory || 'Not specified'} />
                            <DetailCard icon="verified_user" label="Approval Status" value={user?.status?.charAt(0).toUpperCase() + user?.status?.slice(1) || '-'} />
                        </>
                    )}
                </section>

                {/* ID Proof Document (Officer only) */}
                {user?.role === 'officer' && user?.idProofUrl && (
                    <section className="bg-white/70 backdrop-blur-md border border-white rounded-3xl p-6 shadow-sm">
                        <div className="flex items-center gap-2 mb-4">
                            <Icon name="description" className="text-primary text-xl" />
                            <h2 className="font-bold text-sm text-slate-800">Submitted Documents</h2>
                        </div>
                        <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-inner bg-slate-50">
                            <img
                                src={user.idProofUrl}
                                alt="ID Proof Document"
                                className="w-full max-h-96 object-contain"
                            />
                        </div>
                        <p className="text-xs text-slate-400 mt-3 text-center">ID Proof uploaded during registration</p>
                    </section>
                )}

                {/* Logout */}
                <section className="text-center pt-4">
                    <button
                        onClick={handleLogout}
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-red-50 text-red-600 font-bold text-sm hover:bg-red-100 transition-colors"
                    >
                        <Icon name="logout" className="text-lg" />
                        Log Out
                    </button>
                </section>
            </main>
        </div>
    );
}

function DetailCard({ icon, label, value }) {
    return (
        <div className="bg-white/60 backdrop-blur-sm border border-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
                <Icon name={icon} className="text-primary text-lg" />
                <span className="text-[10px] uppercase font-black tracking-[0.15em] text-slate-400">{label}</span>
            </div>
            <p className="text-sm font-bold text-slate-800 ml-7">{value}</p>
        </div>
    );
}
