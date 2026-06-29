import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Mic, MicOff, Video, VideoOff, PhoneOff,
  Maximize2, Minimize2, AlertTriangle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { io, Socket } from 'socket.io-client';
import { apiGet, apiPost } from '@/services/api';
import { useAuth } from '@/hooks/useAppDispatch';
import { WS_EVENTS, SESSION_LIMITS } from '@mediconnect/shared';
import { formatDuration, cn } from '@/utils';

type SimplePeerInstance = {
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  signal: (data: unknown) => void;
  destroy: () => void;
};

interface SessionData {
  appointmentId: string;
  sessionDurationMinutes: number;
  iceServers: RTCIceServer[];
  role: 'patient' | 'doctor';
}

export const VideoCallPage: React.FC = () => {
  const { id: appointmentId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  // peerRef now uses our local type instead of SimplePeer.Instance
  const peerRef = useRef<SimplePeerInstance | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // State
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [showWarning, setShowWarning] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'failed'>('connecting');

  const { data: session, isLoading } = useQuery({
    queryKey: ['session', appointmentId],
    queryFn: () => apiGet<SessionData>(`/sessions/${appointmentId!}/join`),
    enabled: !!appointmentId,
  });

  // ── Initialize timer ──────────────────────────────────────────

  useEffect(() => {
    if (!session) return;
    const totalSeconds = session.sessionDurationMinutes * 60;
    setSecondsRemaining(totalSeconds);

    timerRef.current = setInterval(() => {
      setSecondsRemaining((prev) => {
        const next = prev - 1;
        if (next <= SESSION_LIMITS.WARNING_BEFORE_END_SECONDS) {
          setShowWarning(true);
        }
        if (next <= 0) {
          void endCall(false);
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [session]);

  // ── Initialize WebRTC ─────────────────────────────────────────

  useEffect(() => {
    if (!session || !appointmentId || !user) return;

    const initCall = async () => {
      try {
        // Dynamically import simple-peer here — only when the video
        // call page is actually opened, not when the app first loads.
        // This prevents the Node.js module errors at startup.
        const SimplePeer = (await import('simple-peer')).default;

        // Get local media
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720, facingMode: 'user' },
          audio: { echoCancellation: true, noiseSuppression: true },
        });
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // Start recording
        startRecording(stream);

        // Connect WebSocket — must point to backend explicitly in production
        const socketUrl = import.meta.env.VITE_API_URL ?? '';
        const socket = io(socketUrl, { withCredentials: true });
        socketRef.current = socket;

        socket.emit('appointment:join', { appointmentId });

        const isInitiator = session.role === 'doctor';

        // SimplePeer is now available from the dynamic import above
        const peer = new SimplePeer({
          initiator: isInitiator,
          stream,
          trickle: true,
          config: { iceServers: session.iceServers },
        }) as SimplePeerInstance;

        peerRef.current = peer;

        peer.on('signal', (data) => {
          const signalData = data as { type?: string };
          if (signalData.type === 'offer') {
            socket.emit(WS_EVENTS.SESSION_OFFER, { appointmentId, signal: data });
          } else if (signalData.type === 'answer') {
            socket.emit(WS_EVENTS.SESSION_ANSWER, { appointmentId, signal: data });
          } else {
            socket.emit(WS_EVENTS.SESSION_ICE_CANDIDATE, { appointmentId, signal: data });
          }
        });

        peer.on('stream', (remoteStream) => {
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStream as MediaStream;
          }
          setIsConnected(true);
          setConnectionStatus('connected');
          void apiPost(`/sessions/${appointmentId}/start`);
        });

        peer.on('error', (err) => {
          console.error('Peer error:', err);
          setConnectionStatus('failed');
          toast.error('Connection error. Please try again.');
        });

        peer.on('close', () => {
          setIsConnected(false);
        });

        // Handle incoming signals
        socket.on(WS_EVENTS.SESSION_OFFER, ({ signal, fromUserId }: { signal: unknown; fromUserId: string }) => {
          if (fromUserId !== user.id) peer.signal(signal);
        });
        socket.on(WS_EVENTS.SESSION_ANSWER, ({ signal, fromUserId }: { signal: unknown; fromUserId: string }) => {
          if (fromUserId !== user.id) peer.signal(signal);
        });
        socket.on(WS_EVENTS.SESSION_ICE_CANDIDATE, ({ signal, fromUserId }: { signal: unknown; fromUserId: string }) => {
          if (fromUserId !== user.id) peer.signal(signal);
        });

        // Server-side session end
        socket.on(WS_EVENTS.SESSION_END, () => {
          toast('Session ended by the server', { icon: '⏱' });
          void cleanup(false);
          navigate(`/dashboard/appointments/${appointmentId}`);
        });

      } catch (err) {
        console.error('Media error:', err);
        toast.error('Could not access camera/microphone. Please check permissions.');
        setConnectionStatus('failed');
      }
    };

    void initCall();

    return () => { void cleanup(true); };
  }, [session, appointmentId, user]);

  // ── Recording ─────────────────────────────────────────────────

  const startRecording = (stream: MediaStream) => {
    try {
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9,opus' });
      recordedChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      recorder.start(5000);
      mediaRecorderRef.current = recorder;
    } catch (err) {
      console.warn('Recording not supported:', err);
    }
  };

  // ── Controls ──────────────────────────────────────────────────

  const toggleMute = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getAudioTracks().forEach((t) => { t.enabled = !t.enabled; });
    setIsMuted((m) => !m);
  };

  const toggleVideo = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getVideoTracks().forEach((t) => { t.enabled = !t.enabled; });
    setIsVideoOff((v) => !v);
  };

  const endCall = useCallback(async (_natural: boolean) => {
    if (isEnding) return;
    setIsEnding(true);
    try {
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      await apiPost(`/sessions/${appointmentId}/end`);
      await cleanup(false);
      navigate(`/dashboard/appointments/${appointmentId}`);
    } catch {
      await cleanup(false);
      navigate(`/dashboard/appointments/${appointmentId}`);
    }
  }, [appointmentId, isEnding, navigate]);

  const cleanup = async (silent: boolean) => {
    if (timerRef.current) clearInterval(timerRef.current);
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    peerRef.current?.destroy();
    socketRef.current?.disconnect();
    if (!silent) {
      peerRef.current = null;
      socketRef.current = null;
    }
  };

  // ── Render ────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#0a1f1e]">
        <div className="text-center space-y-3 text-white">
          <div className="w-12 h-12 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-white/70">Joining session...</p>
        </div>
      </div>
    );
  }

  const timerWarning = secondsRemaining <= SESSION_LIMITS.WARNING_BEFORE_END_SECONDS;
  const timerCritical = secondsRemaining <= 30;

  return (
    <div className={cn('h-screen flex flex-col bg-[#0a1f1e] relative', isFullscreen && 'fixed inset-0 z-50')}>

      {/* Remote video (main) */}
      <div className="flex-1 relative">
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />
        {!isConnected && (
          <div className="absolute inset-0 flex flex-col items-center justify-center space-y-3">
            <div className={cn(
              'w-16 h-16 rounded-full border-2 border-brand-500 border-t-transparent animate-spin',
              connectionStatus === 'failed' && 'border-red-500',
            )} />
            <p className="text-white/80 text-sm">
              {connectionStatus === 'failed'
                ? 'Connection failed — please retry'
                : 'Connecting to other participant...'}
            </p>
          </div>
        )}

        {/* Local video (PiP) */}
        <div className="absolute bottom-4 right-4 w-36 h-24 sm:w-48 sm:h-32 rounded-xl overflow-hidden border-2 border-white/20 shadow-xl">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          {isVideoOff && (
            <div className="absolute inset-0 bg-[#0a1f1e] flex items-center justify-center">
              <VideoOff size={20} className="text-white/40" />
            </div>
          )}
        </div>

        {/* Timer */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2">
          <div className={cn(
            'timer-pill',
            timerCritical && 'critical',
            timerWarning && !timerCritical && 'warning',
          )}>
            {timerWarning && <AlertTriangle size={12} />}
            {formatDuration(secondsRemaining)}
          </div>
        </div>

        {/* Warning banner */}
        {showWarning && !timerCritical && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-yellow-500/90 backdrop-blur-sm text-white text-xs px-4 py-2 rounded-full animate-fade-in">
            Session ending in {Math.ceil(secondsRemaining / 60)} minute{secondsRemaining > 60 ? 's' : ''}
          </div>
        )}

        {/* Fullscreen toggle */}
        <button
          onClick={() => setIsFullscreen((f) => !f)}
          className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-black/40 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/60 transition-colors"
        >
          {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
      </div>

      {/* Controls bar */}
      <div className="flex items-center justify-center gap-4 py-5 px-4 bg-black/60 backdrop-blur-sm">
        <ControlBtn
          active={!isMuted}
          onClick={toggleMute}
          icon={isMuted ? <MicOff size={18} /> : <Mic size={18} />}
          label={isMuted ? 'Unmute' : 'Mute'}
        />
        <ControlBtn
          active={!isVideoOff}
          onClick={toggleVideo}
          icon={isVideoOff ? <VideoOff size={18} /> : <Video size={18} />}
          label={isVideoOff ? 'Show video' : 'Hide video'}
        />
        <button
          onClick={() => void endCall(true)}
          disabled={isEnding}
          className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-lg transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
          aria-label="End call"
        >
          {isEnding ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <PhoneOff size={20} />
          )}
        </button>
      </div>
    </div>
  );
};

// ─── Control button ───────────────────────────────────────────

const ControlBtn: React.FC<{
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}> = ({ active, onClick, icon, label }) => (
  <button
    onClick={onClick}
    className={cn(
      'w-12 h-12 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95',
      active
        ? 'bg-white/15 text-white hover:bg-white/25'
        : 'bg-red-500/80 text-white hover:bg-red-600/80',
    )}
    aria-label={label}
    title={label}
  >
    {icon}
  </button>
);