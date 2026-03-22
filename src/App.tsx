import React, { useState, useEffect } from 'react';
import { auth, googleProvider, signInWithPopup, signOut, onAuthStateChanged, User, db, collection, query, where, onSnapshot, handleFirestoreError, OperationType, doc, setDoc, Timestamp } from './firebase';
import { Music, LayoutDashboard, Disc, BarChart3, Plus, LogOut, LogIn, Loader2, ChevronRight, Music2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Dashboard from './components/Dashboard';
import ReleaseList from './components/ReleaseList';
import ReleaseForm from './components/ReleaseForm';
import Analytics from './components/Analytics';

export type View = 'dashboard' | 'releases' | 'new-release' | 'edit-release' | 'analytics';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [editingRelease, setEditingRelease] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Ensure artist profile exists
        try {
          const artistRef = doc(db, 'artists', user.uid);
          await setDoc(artistRef, {
            uid: user.uid,
            name: user.displayName || 'Anonymous Artist',
            profileImageUrl: user.photoURL || '',
            createdAt: Timestamp.now(),
          }, { merge: true });
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `artists/${user.uid}`);
        }
      }
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setError('Failed to sign in. Please try again.');
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setCurrentView('dashboard');
    } catch (err) {
      setError('Failed to sign out.');
    }
  };

  const handleEditRelease = (release: any) => {
    setEditingRelease(release);
    setCurrentView('edit-release');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full text-center space-y-8"
        >
          <div className="flex justify-center">
            <div className="w-20 h-20 bg-emerald-500/10 rounded-3xl flex items-center justify-center">
              <Music className="w-10 h-10 text-emerald-500" />
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-4xl font-bold text-white tracking-tight">Google Music</h1>
            <p className="text-neutral-400">Distribute your music to the world. Professional tools for independent artists.</p>
          </div>
          <button
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-3 bg-white text-black font-semibold py-4 rounded-2xl hover:bg-neutral-200 transition-colors"
          >
            <LogIn className="w-5 h-5" />
            Sign in with Google
          </button>
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-500 text-sm">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-white/5 flex flex-col p-6 space-y-8">
        <div className="flex items-center gap-3 px-2">
          <Music className="w-8 h-8 text-emerald-500" />
          <span className="font-bold text-xl tracking-tight">Distributor</span>
        </div>

        <nav className="flex-1 space-y-2">
          <NavItem 
            active={currentView === 'dashboard'} 
            onClick={() => setCurrentView('dashboard')}
            icon={<LayoutDashboard className="w-5 h-5" />}
            label="Dashboard"
          />
          <NavItem 
            active={currentView === 'releases'} 
            onClick={() => setCurrentView('releases')}
            icon={<Disc className="w-5 h-5" />}
            label="My Releases"
          />
          <NavItem 
            active={currentView === 'analytics'} 
            onClick={() => setCurrentView('analytics')}
            icon={<BarChart3 className="w-5 h-5" />}
            label="Analytics"
          />
        </nav>

        <div className="pt-6 border-t border-white/5 space-y-4">
          <div className="flex items-center gap-3 px-2">
            <img 
              src={user.photoURL || `https://picsum.photos/seed/${user.uid}/100/100`} 
              alt={user.displayName || 'Artist'} 
              className="w-10 h-10 rounded-full border border-white/10"
              referrerPolicy="no-referrer"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.displayName}</p>
              <p className="text-xs text-neutral-500 truncate">Artist</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 text-neutral-400 hover:text-white hover:bg-white/5 rounded-xl transition-all"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-sm font-medium">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentView}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
          >
            {currentView === 'dashboard' && <Dashboard onNavigate={setCurrentView} user={user} />}
            {currentView === 'releases' && <ReleaseList onNavigate={setCurrentView} onEdit={handleEditRelease} user={user} />}
            {currentView === 'new-release' && <ReleaseForm onCancel={() => setCurrentView('releases')} user={user} />}
            {currentView === 'edit-release' && <ReleaseForm onCancel={() => { setEditingRelease(null); setCurrentView('releases'); }} user={user} initialData={editingRelease} />}
            {currentView === 'analytics' && <Analytics user={user} />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

function NavItem({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
        active 
          ? 'bg-emerald-500/10 text-emerald-500' 
          : 'text-neutral-400 hover:text-white hover:bg-white/5'
      }`}
    >
      {icon}
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}
