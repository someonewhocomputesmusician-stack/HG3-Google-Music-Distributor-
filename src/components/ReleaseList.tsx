import React, { useState, useEffect } from 'react';
import { db, collection, query, where, onSnapshot, User, handleFirestoreError, OperationType, deleteDoc, doc } from '../firebase';
import { Disc, Plus, Search, Filter, MoreVertical, Play, Trash2, Edit, ExternalLink, Music2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { View } from '../App';

interface ReleaseListProps {
  onNavigate: (view: View) => void;
  onEdit: (release: any) => void;
  user: User;
}

export default function ReleaseList({ onNavigate, onEdit, user }: ReleaseListProps) {
  const [releases, setReleases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'releases'), where('artistId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setReleases(data);
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'releases');
    });
    return () => unsubscribe();
  }, [user.uid]);

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteDoc(doc(db, 'releases', deleteId));
      setDeleteId(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `releases/${deleteId}`);
    }
  };

  const filteredReleases = releases.filter(r => 
    r.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">My Releases</h2>
          <p className="text-neutral-400 mt-1">Manage your discography and distribution status.</p>
        </div>
        <button
          onClick={() => onNavigate('new-release')}
          className="bg-emerald-500 hover:bg-emerald-600 text-black font-semibold px-6 py-3 rounded-2xl flex items-center gap-2 transition-all self-start md:self-auto"
        >
          <Plus className="w-5 h-5" />
          Create Release
        </button>
      </header>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500" />
          <input 
            type="text" 
            placeholder="Search releases..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-neutral-900 border border-white/5 rounded-2xl pl-12 pr-4 py-3 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
          />
        </div>
        <button className="flex items-center gap-2 px-6 py-3 bg-neutral-900 border border-white/5 rounded-2xl text-neutral-400 hover:text-white transition-all">
          <Filter className="w-5 h-5" />
          Filter
        </button>
      </div>

      {/* Release Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="aspect-square bg-neutral-900/50 rounded-3xl animate-pulse" />
          ))
        ) : filteredReleases.length > 0 ? (
          filteredReleases.map((release) => (
            <motion.div
              layout
              key={release.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="group bg-neutral-900/50 border border-white/5 rounded-3xl overflow-hidden hover:border-white/10 transition-all"
            >
              <div className="relative aspect-square bg-neutral-800">
                {release.coverImageUrl ? (
                  <img 
                    src={release.coverImageUrl} 
                    alt={release.title} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Music2 className="w-12 h-12 text-neutral-700" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                  <button className="p-3 bg-white text-black rounded-full hover:scale-110 transition-transform">
                    <Play className="w-5 h-5 fill-current" />
                  </button>
                  <button 
                    onClick={() => onEdit(release)}
                    className="p-3 bg-neutral-900 text-white rounded-full hover:scale-110 transition-transform"
                  >
                    <Edit className="w-5 h-5" />
                  </button>
                </div>
                <div className="absolute top-4 right-4">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    release.status === 'distributed' ? 'bg-emerald-500 text-black' :
                    release.status === 'pending' ? 'bg-amber-500 text-black' :
                    'bg-neutral-800 text-neutral-400'
                  }`}>
                    {release.status}
                  </span>
                </div>
              </div>
              <div className="p-5 space-y-1">
                <div className="flex justify-between items-start">
                  <h3 className="font-semibold truncate pr-2">{release.title}</h3>
                  <button className="text-neutral-500 hover:text-white transition-colors">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-neutral-500 uppercase tracking-wide font-medium">
                  {release.type} • {release.genre || 'No Genre'}
                </p>
                <div className="pt-4 flex items-center justify-between">
                  <span className="text-[10px] text-neutral-600 font-mono">
                    {release.releaseDate ? new Date(release.releaseDate).toLocaleDateString() : 'No date'}
                  </span>
                  <button 
                    onClick={() => setDeleteId(release.id)}
                    className="text-neutral-600 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))
        ) : (
          <div className="col-span-full py-20 text-center space-y-4">
            <div className="w-20 h-20 bg-neutral-900 rounded-full flex items-center justify-center mx-auto">
              <Disc className="w-10 h-10 text-neutral-700" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-medium">No releases found</h3>
              <p className="text-neutral-500 text-sm">Start by creating your first single or album.</p>
            </div>
            <button
              onClick={() => onNavigate('new-release')}
              className="text-emerald-500 font-medium hover:underline"
            >
              Create a release now
            </button>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-neutral-900 border border-white/10 rounded-3xl p-8 max-w-md w-full shadow-2xl"
            >
              <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mb-6">
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-2xl font-bold mb-2">Delete Release?</h3>
              <p className="text-neutral-400 mb-8">
                This action cannot be undone. All tracks and metadata associated with this release will be permanently removed.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => setDeleteId(null)}
                  className="flex-1 bg-neutral-800 hover:bg-neutral-700 text-white font-bold py-3 rounded-2xl transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-black font-bold py-3 rounded-2xl transition-all"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
