import React, { useState, useEffect, useRef } from 'react';
import { db, collection, addDoc, updateDoc, doc, getDocs, User, handleFirestoreError, OperationType, Timestamp, writeBatch, getStorageInstance, ref, uploadBytes, uploadBytesResumable, getDownloadURL } from '../firebase';
import { X, Upload, Music2, Image as ImageIcon, Check, Loader2, AlertCircle, Plus, Trash2, GripVertical, Play, FileAudio, Video, Download, ExternalLink, Info, TrendingUp, DollarSign, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Track {
  id?: string;
  title: string;
  audioUrl: string;
  isrc: string;
  duration: string;
  order: number;
  streams?: number;
  revenue?: number;
}

interface ReleaseFormProps {
  onCancel: () => void;
  user: User;
  initialData?: any;
}

const DISTRIBUTION_PORTALS = [
  { name: 'Spotify for Artists', url: 'https://artists.spotify.com/', icon: 'https://www.google.com/s2/favicons?domain=spotify.com&sz=32' },
  { name: 'Apple Music for Artists', url: 'https://artists.apple.com/', icon: 'https://www.google.com/s2/favicons?domain=apple.com&sz=32' },
  { name: 'Amazon Music for Artists', url: 'https://artists.amazonmusic.com/', icon: 'https://www.google.com/s2/favicons?domain=amazon.com&sz=32' },
  { name: 'Deezer for Creators', url: 'https://creators.deezer.com/', icon: 'https://www.google.com/s2/favicons?domain=deezer.com&sz=32' },
];

const SUBMISSION_STEPS = [
  'Prepare high-quality cover art (3000x3000px, 300dpi)',
  'Generate ISRC codes for each track (if not already assigned)',
  'Export audio tracks as 24-bit WAV files (44.1kHz or 48kHz)',
  'Click the portal links to the right to start manual submission',
  'Copy and paste metadata (Titles, Genre, Release Date) from this form to the portal',
  'Upload the audio files and cover art to the chosen platform',
  'Set your release date at least 4 weeks in advance for playlist pitching',
  'Submit and verify the release status on the platform dashboard',
];

export default function ReleaseForm({ onCancel, user, initialData }: ReleaseFormProps) {
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadTask, setUploadTask] = useState<any>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [generatingVideo, setGeneratingVideo] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [formData, setFormData] = useState({
    title: initialData?.title || '',
    type: initialData?.type || 'single',
    genre: initialData?.genre || '',
    releaseDate: initialData?.releaseDate || '',
    coverImageUrl: initialData?.coverImageUrl || '',
  });

  const [tracks, setTracks] = useState<Track[]>([]);
  const [newTrack, setNewTrack] = useState<Track>({ title: '', audioUrl: '', isrc: '', duration: '', order: 1 });
  const [checklist, setChecklist] = useState<boolean[]>(new Array(SUBMISSION_STEPS.length).fill(false));

  useEffect(() => {
    if (initialData?.id) {
      const fetchTracks = async () => {
        try {
          const tracksRef = collection(db, 'releases', initialData.id, 'tracks');
          const snapshot = await getDocs(tracksRef);
          const tracksData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Track));
          setTracks(tracksData.sort((a, b) => a.order - b.order));
        } catch (err) {
          handleFirestoreError(err, OperationType.LIST, `releases/${initialData.id}/tracks`);
        }
      };
      fetchTracks();
    }
  }, [initialData?.id]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Basic validation
    if (!file.type.startsWith('audio/')) {
      setError('Please upload a valid audio file (MP3, WAV, etc.)');
      return;
    }

    const storage = getStorageInstance();
    if (!storage) {
      setError('Firebase Storage is not configured. Please check your Firebase settings.');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadSuccess(false);
    setError(null);

    try {
      const timestamp = Date.now();
      const storageRef = ref(storage, `tracks/${user.uid}/${timestamp}_${file.name}`);
      const task = uploadBytesResumable(storageRef, file);
      setUploadTask(task);

      task.on('state_changed', 
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(progress);
        }, 
        (err) => {
          console.error('Upload error:', err);
          if (err.code === 'storage/canceled') {
            setError('Upload canceled.');
          } else {
            setError('Failed to upload audio file. Please try again.');
          }
          setUploading(false);
          setUploadTask(null);
        }, 
        async () => {
          const downloadUrl = await getDownloadURL(task.snapshot.ref);
          setNewTrack(prev => ({ ...prev, audioUrl: downloadUrl }));
          if (!newTrack.title) {
            const fileNameWithoutExt = file.name.split('.').slice(0, -1).join('.');
            setNewTrack(prev => ({ ...prev, title: fileNameWithoutExt, audioUrl: downloadUrl }));
          }

          const audio = new Audio(downloadUrl);
          audio.crossOrigin = "anonymous";
          audio.addEventListener('loadedmetadata', () => {
            const minutes = Math.floor(audio.duration / 60);
            const seconds = Math.floor(audio.duration % 60);
            const durationStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            setNewTrack(prev => ({ ...prev, duration: durationStr }));
          });

          setUploading(false);
          setUploadSuccess(true);
          setUploadTask(null);
        }
      );

    } catch (err) {
      console.error('Upload error:', err);
      setError('Failed to upload audio file. Please try again.');
      setUploading(false);
    }
  };

  const cancelUpload = () => {
    if (uploadTask) {
      uploadTask.cancel();
      setUploading(false);
      setUploadTask(null);
      setUploadProgress(0);
    }
  };

  const generatePromoVideo = async () => {
    if (!formData.coverImageUrl || tracks.length === 0) {
      setError('Please upload cover art and at least one track to generate a promo video.');
      return;
    }

    setGeneratingVideo(true);
    setVideoProgress(0);
    setError(null);

    try {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Load Image
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = formData.coverImageUrl;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      // Set canvas size (1080x1080 for square video)
      canvas.width = 1080;
      canvas.height = 1080;

      // Draw Image
      ctx.drawImage(img, 0, 0, 1080, 1080);

      // Add text overlay
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, 900, 1080, 180);
      ctx.fillStyle = 'white';
      ctx.font = 'bold 48px Inter';
      ctx.fillText(formData.title, 60, 980);
      ctx.font = '32px Inter';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.fillText(user.displayName || 'Artist', 60, 1030);

      // Setup Audio
      const audio = new Audio(tracks[0].audioUrl);
      audio.crossOrigin = "anonymous";
      
      // We only record first 15 seconds for promo
      const duration = 15; 
      
      const stream = canvas.captureStream(30);
      const audioContext = new AudioContext();
      const source = audioContext.createMediaElementSource(audio);
      const destination = audioContext.createMediaStreamDestination();
      source.connect(destination);
      source.connect(audioContext.destination);

      const combinedStream = new MediaStream([
        ...stream.getVideoTracks(),
        ...destination.stream.getAudioTracks()
      ]);

      const mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType: 'video/webm;codecs=vp9,opus'
      });

      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${formData.title}_promo.webm`;
        a.click();
        setGeneratingVideo(false);
      };

      mediaRecorder.start();
      audio.play();

      const startTime = Date.now();
      const interval = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        setVideoProgress(Math.min((elapsed / duration) * 100, 100));
        
        if (elapsed >= duration) {
          clearInterval(interval);
          mediaRecorder.stop();
          audio.pause();
        }
      }, 100);

    } catch (err) {
      console.error('Video generation error:', err);
      setError('Failed to generate promo video. Check if images/audio allow cross-origin access.');
      setGeneratingVideo(false);
    }
  };

  const handleAddTrack = () => {
    if (!newTrack.title || !newTrack.audioUrl) return;
    setTracks([...tracks, { ...newTrack, order: tracks.length + 1 }]);
    setNewTrack({ title: '', audioUrl: '', isrc: '', duration: '', order: tracks.length + 2 });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeTrack = (index: number) => {
    const updatedTracks = tracks.filter((_, i) => i !== index).map((t, i) => ({ ...t, order: i + 1 }));
    setTracks(updatedTracks);
  };

  const toggleChecklist = (index: number) => {
    const newChecklist = [...checklist];
    newChecklist[index] = !newChecklist[index];
    setChecklist(newChecklist);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (tracks.length === 0) {
      setError('Please add at least one track to your release.');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      let releaseId = initialData?.id;
      
      if (releaseId) {
        await updateDoc(doc(db, 'releases', releaseId), {
          ...formData,
          updatedAt: Timestamp.now(),
        });
      } else {
        const releaseRef = await addDoc(collection(db, 'releases'), {
          ...formData,
          artistId: user.uid,
          status: 'draft',
          createdAt: Timestamp.now(),
        });
        releaseId = releaseRef.id;
      }

      // Save tracks using batch
      const batch = writeBatch(db);
      
      if (initialData?.id) {
        const oldTracksSnapshot = await getDocs(collection(db, 'releases', releaseId, 'tracks'));
        oldTracksSnapshot.docs.forEach(trackDoc => batch.delete(trackDoc.ref));
      }

      tracks.forEach((track) => {
        const trackRef = doc(collection(db, 'releases', releaseId, 'tracks'));
        const { id, ...trackData } = track;
        batch.set(trackRef, { ...trackData, releaseId });
      });

      await batch.commit();
      onCancel();
    } catch (err) {
      handleFirestoreError(err, initialData?.id ? OperationType.UPDATE : OperationType.CREATE, initialData?.id ? `releases/${initialData.id}` : 'releases');
      setError(`Failed to ${initialData?.id ? 'update' : 'create'} release. Please check your inputs.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto pb-20">
      <header className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{initialData ? 'Edit Release' : 'New Release'}</h2>
          <p className="text-neutral-400 mt-1">
            {initialData ? 'Update the details for your release.' : 'Fill in the details for your new music release.'}
          </p>
        </div>
        <button
          onClick={onCancel}
          className="p-2 hover:bg-white/5 rounded-full transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
      </header>

      <form onSubmit={handleSubmit} className="space-y-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cover Art Upload */}
          <div className="space-y-4">
            <label className="block text-sm font-medium text-neutral-400 uppercase tracking-wider">Cover Artwork</label>
            <div className="aspect-square bg-neutral-900 border-2 border-dashed border-white/10 rounded-3xl flex flex-col items-center justify-center p-8 text-center group hover:border-emerald-500/50 transition-all cursor-pointer overflow-hidden relative">
              {formData.coverImageUrl ? (
                <img src={formData.coverImageUrl} alt="Cover" className="absolute inset-0 w-full h-full object-cover" />
              ) : (
                <>
                  <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <ImageIcon className="w-8 h-8 text-neutral-500" />
                  </div>
                  <p className="text-sm font-medium">Click to upload artwork</p>
                  <p className="text-xs text-neutral-500 mt-2">3000 x 3000px recommended. JPG or PNG.</p>
                </>
              )}
              <input 
                type="url" 
                placeholder="Or paste image URL"
                className="absolute bottom-4 left-4 right-4 bg-black/80 border border-white/10 rounded-xl px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                value={formData.coverImageUrl}
                onChange={(e) => setFormData({ ...formData, coverImageUrl: e.target.value })}
                onClick={(e) => e.stopPropagation()}
              />
            </div>

            {/* Video Generation Section */}
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Promo Generator</p>
              <button
                type="button"
                onClick={generatePromoVideo}
                disabled={generatingVideo || !formData.coverImageUrl || tracks.length === 0}
                className="w-full flex items-center justify-center gap-2 bg-neutral-900 border border-white/5 hover:border-emerald-500/50 text-white py-3 rounded-2xl transition-all disabled:opacity-50"
              >
                {generatingVideo ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Generating Promo... {Math.round(videoProgress)}%</span>
                  </>
                ) : (
                  <>
                    <Video className="w-4 h-4 text-emerald-500" />
                    <span>Generate Promo Video</span>
                  </>
                )}
              </button>
              <p className="text-[10px] text-neutral-500 leading-tight">
                Creates a 15s square video with your cover art and first track for social media.
              </p>
            </div>
            <canvas ref={canvasRef} className="hidden" />
          </div>

          {/* Release Details */}
          <div className="lg:col-span-2 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-400 uppercase tracking-wider">Release Title</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Midnight Melodies"
                  className="w-full bg-neutral-900 border border-white/5 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-400 uppercase tracking-wider">Release Type</label>
                <select
                  className="w-full bg-neutral-900 border border-white/5 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none transition-all appearance-none"
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                >
                  <option value="single">Single</option>
                  <option value="ep">EP</option>
                  <option value="album">Album</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-400 uppercase tracking-wider">Primary Genre</label>
                <input
                  type="text"
                  placeholder="e.g. Electronic, Jazz"
                  className="w-full bg-neutral-900 border border-white/5 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  value={formData.genre}
                  onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-400 uppercase tracking-wider">Release Date</label>
                <input
                  type="date"
                  className="w-full bg-neutral-900 border border-white/5 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  value={formData.releaseDate}
                  onChange={(e) => setFormData({ ...formData, releaseDate: e.target.value })}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Track Management Section */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <Music2 className="w-6 h-6 text-emerald-500" />
              Tracks
            </h3>
            <span className="text-xs font-bold text-neutral-500 uppercase tracking-widest">{tracks.length} Tracks Added</span>
          </div>

          <div className="bg-neutral-900/50 border border-white/5 rounded-3xl overflow-hidden">
            <div className="p-6 space-y-4">
              {/* Track List */}
              <div className="space-y-3">
                {tracks.map((track, index) => (
                  <motion.div 
                    layout
                    key={index}
                    className="flex items-center gap-4 bg-neutral-900 border border-white/5 p-4 rounded-2xl group"
                  >
                    <div className="w-8 h-8 flex items-center justify-center text-neutral-600 font-mono text-sm">
                      {index + 1}
                    </div>
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-xs font-bold text-neutral-500 uppercase tracking-tighter mb-1">Title</p>
                        <p className="font-medium truncate">{track.title}</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-neutral-500 uppercase tracking-tighter mb-1">Duration</p>
                        <p className="font-mono text-xs text-neutral-400">{track.duration || '--:--'}</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-neutral-500 uppercase tracking-tighter mb-1">ISRC</p>
                        <p className="font-mono text-xs text-neutral-400">{track.isrc || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-neutral-500 uppercase tracking-tighter mb-1">Audio File</p>
                        <div className="flex items-center gap-2">
                          <Play className="w-3 h-3 text-emerald-500" />
                          <p className="text-xs text-neutral-500 truncate max-w-[150px]">{track.audioUrl.split('/').pop()?.split('?')[0] || 'Uploaded'}</p>
                        </div>
                      </div>
                    </div>

                    {/* Track Analytics */}
                    <div className="hidden lg:flex items-center gap-6 px-6 border-l border-white/5">
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-tighter mb-0.5">Streams</p>
                        <div className="flex items-center gap-1.5 justify-end">
                          <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                          <span className="text-sm font-mono font-medium">{(track.streams || 0).toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-tighter mb-0.5">Est. Revenue</p>
                        <div className="flex items-center gap-1 justify-end">
                          <DollarSign className="w-3 h-3 text-emerald-500" />
                          <span className="text-sm font-mono font-medium">{(track.revenue || 0).toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                    <button 
                      type="button"
                      onClick={() => removeTrack(index)}
                      className="p-2 text-neutral-600 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </motion.div>
                ))}
              </div>

              {/* Add Track Form */}
              <div className="pt-6 border-t border-white/5">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                  <div className="md:col-span-1 space-y-2">
                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Track Title</label>
                    <input 
                      type="text" 
                      placeholder="Song name"
                      className="w-full bg-neutral-800 border border-white/5 rounded-xl px-4 py-2 text-sm outline-none focus:ring-1 focus:ring-emerald-500"
                      value={newTrack.title}
                      onChange={(e) => setNewTrack({ ...newTrack, title: e.target.value })}
                    />
                  </div>
                  <div className="md:col-span-1 space-y-2">
                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Duration</label>
                    <input 
                      type="text" 
                      placeholder="3:45"
                      className="w-full bg-neutral-800 border border-white/5 rounded-xl px-4 py-2 text-sm outline-none focus:ring-1 focus:ring-emerald-500"
                      value={newTrack.duration}
                      onChange={(e) => setNewTrack({ ...newTrack, duration: e.target.value })}
                    />
                  </div>
                  <div className="md:col-span-1 space-y-2">
                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Audio URL / File</label>
                    <div className="relative flex flex-col gap-2">
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          placeholder="https://..."
                          className="flex-1 bg-neutral-800 border border-white/5 rounded-xl px-4 py-2 text-sm outline-none focus:ring-1 focus:ring-emerald-500"
                          value={newTrack.audioUrl}
                          onChange={(e) => setNewTrack({ ...newTrack, audioUrl: e.target.value })}
                        />
                        <input 
                          type="file" 
                          accept="audio/*"
                          ref={fileInputRef}
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                        <button 
                          type="button" 
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploading}
                          className={`p-2 bg-neutral-800 border border-white/5 rounded-xl hover:bg-white/5 transition-all ${uploading ? 'opacity-50' : ''}`}
                          title={uploadSuccess ? "Re-upload Audio" : "Upload Audio File"}
                        >
                          {uploading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : uploadSuccess ? (
                            <RotateCcw className="w-4 h-4 text-emerald-500" />
                          ) : (
                            <Upload className="w-4 h-4 text-neutral-500" />
                          )}
                        </button>
                      </div>
                      
                      {/* Upload Progress & Feedback */}
                      {uploading && (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-neutral-400">Uploading... {Math.round(uploadProgress)}%</span>
                            <button 
                              type="button" 
                              onClick={cancelUpload}
                              className="text-red-500 hover:underline"
                            >
                              Cancel
                            </button>
                          </div>
                          <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                            <motion.div 
                              className="h-full bg-emerald-500"
                              initial={{ width: 0 }}
                              animate={{ width: `${uploadProgress}%` }}
                            />
                          </div>
                        </div>
                      )}
                      
                      {uploadSuccess && !uploading && (
                        <div className="flex items-center gap-1.5 text-[10px] text-emerald-500">
                          <Check className="w-3 h-3" />
                          <span>Upload successful</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="md:col-span-1 space-y-2">
                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">ISRC (Optional)</label>
                    <input 
                      type="text" 
                      placeholder="US-ABC-12-34567"
                      className="w-full bg-neutral-800 border border-white/5 rounded-xl px-4 py-2 text-sm outline-none focus:ring-1 focus:ring-emerald-500"
                      value={newTrack.isrc}
                      onChange={(e) => setNewTrack({ ...newTrack, isrc: e.target.value })}
                    />
                  </div>
                  <button 
                    type="button"
                    onClick={handleAddTrack}
                    disabled={!newTrack.title || !newTrack.audioUrl || uploading}
                    className="bg-white text-black font-bold text-sm py-2 px-4 rounded-xl hover:bg-neutral-200 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Track
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Distribution Checklist & Portals */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Submission Checklist */}
          <div className="bg-neutral-900/50 border border-white/5 rounded-3xl p-8 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                <Check className="w-5 h-5 text-emerald-500" />
              </div>
              <h3 className="text-xl font-bold">Submission Checklist</h3>
            </div>
            <div className="space-y-4">
              {SUBMISSION_STEPS.map((step, index) => (
                <label key={index} className="flex items-start gap-4 group cursor-pointer">
                  <div className="relative flex items-center justify-center mt-1">
                    <input 
                      type="checkbox" 
                      checked={checklist[index]}
                      onChange={() => toggleChecklist(index)}
                      className="peer appearance-none w-5 h-5 border border-white/10 rounded-md checked:bg-emerald-500 checked:border-transparent transition-all"
                    />
                    <Check className="absolute w-3 h-3 text-black opacity-0 peer-checked:opacity-100 transition-opacity" />
                  </div>
                  <span className={`text-sm transition-colors ${checklist[index] ? 'text-neutral-500 line-through' : 'text-neutral-300 group-hover:text-white'}`}>
                    {step}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Distribution Portals */}
          <div className="bg-neutral-900/50 border border-white/5 rounded-3xl p-8 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center">
                <ExternalLink className="w-5 h-5 text-blue-500" />
              </div>
              <h3 className="text-xl font-bold">Manual Upload Portals</h3>
            </div>
            <p className="text-sm text-neutral-400">
              Click the links below to manually manage your artist profiles and submission status on each platform.
            </p>
            <div className="grid grid-cols-1 gap-3">
              {DISTRIBUTION_PORTALS.map((portal, index) => (
                <a 
                  key={index}
                  href={portal.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-4 bg-neutral-900 border border-white/5 rounded-2xl hover:border-white/20 hover:bg-neutral-800 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <img src={portal.icon} alt={portal.name} className="w-6 h-6 rounded-md" />
                    <span className="font-medium">{portal.name}</span>
                  </div>
                  <ExternalLink className="w-4 h-4 text-neutral-600 group-hover:text-white transition-colors" />
                </a>
              ))}
            </div>
            <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-2xl flex gap-3">
              <Info className="w-5 h-5 text-blue-500 shrink-0" />
              <p className="text-xs text-neutral-400 leading-relaxed">
                Manual submission is recommended for independent artists to ensure maximum control over metadata and playlist pitching.
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-500 text-sm">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        <div className="pt-8 flex gap-4 border-t border-white/5">
          <button
            type="submit"
            disabled={loading || uploading || generatingVideo}
            className="flex-1 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-black font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
            {initialData ? 'Update Release' : 'Create Release'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-12 bg-neutral-900 hover:bg-neutral-800 text-white font-semibold py-4 rounded-2xl transition-all"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
