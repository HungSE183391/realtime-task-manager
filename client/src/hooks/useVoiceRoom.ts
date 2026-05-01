import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';
import { getSocket } from '../lib/socket';

export interface VoicePeer {
  socketId: string;
  userId: string;
  name: string;
  muted: boolean;
  speaking: boolean;
  stream: MediaStream | null;
  connectionState: RTCPeerConnectionState;
}

interface RoomParticipant {
  socketId: string;
  userId: string;
  name: string;
  muted: boolean;
}

interface JoinResultOk {
  ok: true;
  participants: RoomParticipant[];
}
interface JoinResultErr {
  ok: false;
  error: string;
}
type JoinResult = JoinResultOk | JoinResultErr;
type ListResult = JoinResult;

interface SignalPayload {
  boardId: string;
  from: string;
  signal:
    | { type: 'offer'; data: RTCSessionDescriptionInit }
    | { type: 'answer'; data: RTCSessionDescriptionInit }
    | { type: 'ice'; data: RTCIceCandidateInit };
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

const SPEAKING_THRESHOLD = 18;

export function useVoiceRoom(boardId: string | undefined) {
  const token = useAuthStore((s) => s.token);
  const me = useAuthStore((s) => s.user);

  const [joined, setJoined] = useState(false);
  const [joining, setJoining] = useState(false);
  const [muted, setMutedState] = useState(false);
  const [peers, setPeers] = useState<Record<string, VoicePeer>>({});
  const [localSpeaking, setLocalSpeaking] = useState(false);
  // Live snapshot of everyone in the voice room (visible even before joining).
  const [roomParticipants, setRoomParticipants] = useState<RoomParticipant[]>([]);

  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const peerMetaRef = useRef<Map<string, { userId: string; name: string }>>(new Map());
  const audioContextRef = useRef<AudioContext | null>(null);
  const analysersRef = useRef<Map<string, { analyser: AnalyserNode; raf: number }>>(new Map());
  const localAnalyserRef = useRef<{ analyser: AnalyserNode; raf: number } | null>(null);

  const updatePeer = useCallback((socketId: string, patch: Partial<VoicePeer>) => {
    setPeers((prev) => {
      const cur = prev[socketId];
      if (!cur) return prev;
      return { ...prev, [socketId]: { ...cur, ...patch } };
    });
  }, []);

  const ensureAudioContext = useCallback((): AudioContext | null => {
    if (typeof window === 'undefined') return null;
    if (!audioContextRef.current) {
      const Ctx =
        (window.AudioContext as typeof AudioContext | undefined) ||
        ((window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
      if (!Ctx) return null;
      audioContextRef.current = new Ctx();
    }
    return audioContextRef.current;
  }, []);

  const startSpeakingDetection = useCallback(
    (socketId: string, stream: MediaStream, isLocal: boolean) => {
      const ctx = ensureAudioContext();
      if (!ctx) return;
      try {
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);

        let lastSpeaking = false;
        let raf = 0;
        const tick = () => {
          analyser.getByteFrequencyData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) sum += data[i];
          const avg = sum / data.length;
          const speaking = avg > SPEAKING_THRESHOLD;
          if (speaking !== lastSpeaking) {
            lastSpeaking = speaking;
            if (isLocal) setLocalSpeaking(speaking);
            else updatePeer(socketId, { speaking });
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);

        if (isLocal) {
          localAnalyserRef.current = { analyser, raf };
        } else {
          analysersRef.current.set(socketId, { analyser, raf });
        }
      } catch (err) {
        console.warn('[voice] speaking detection failed', err);
      }
    },
    [ensureAudioContext, updatePeer],
  );

  const stopSpeakingDetection = useCallback((socketId: string | null) => {
    if (socketId === null) {
      if (localAnalyserRef.current) {
        cancelAnimationFrame(localAnalyserRef.current.raf);
        localAnalyserRef.current = null;
      }
      return;
    }
    const entry = analysersRef.current.get(socketId);
    if (entry) {
      cancelAnimationFrame(entry.raf);
      analysersRef.current.delete(socketId);
    }
  }, []);

  const createPeer = useCallback(
    (
      remoteSocketId: string,
      remoteMeta: { userId: string; name: string },
      isInitiator: boolean,
    ) => {
      if (!token) return null;
      const socket = getSocket(token);
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      peersRef.current.set(remoteSocketId, pc);
      peerMetaRef.current.set(remoteSocketId, remoteMeta);

      const localStream = localStreamRef.current;
      if (localStream) {
        for (const track of localStream.getTracks()) {
          pc.addTrack(track, localStream);
        }
      }

      pc.onicecandidate = (e) => {
        if (e.candidate && boardId) {
          socket.emit('voice:signal', {
            boardId,
            to: remoteSocketId,
            signal: { type: 'ice', data: e.candidate.toJSON() },
          });
        }
      };

      pc.ontrack = (e) => {
        const [stream] = e.streams;
        updatePeer(remoteSocketId, { stream });
        startSpeakingDetection(remoteSocketId, stream, false);
      };

      pc.onconnectionstatechange = () => {
        updatePeer(remoteSocketId, { connectionState: pc.connectionState });
        if (
          pc.connectionState === 'failed' ||
          pc.connectionState === 'closed' ||
          pc.connectionState === 'disconnected'
        ) {
          // keep peer entry for UI; closing happens on peer-left
        }
      };

      setPeers((prev) => ({
        ...prev,
        [remoteSocketId]: {
          socketId: remoteSocketId,
          userId: remoteMeta.userId,
          name: remoteMeta.name,
          muted: false,
          speaking: false,
          stream: null,
          connectionState: pc.connectionState,
        },
      }));

      if (isInitiator && boardId) {
        (async () => {
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.emit('voice:signal', {
              boardId,
              to: remoteSocketId,
              signal: { type: 'offer', data: offer },
            });
          } catch (err) {
            console.error('[voice] createOffer failed', err);
          }
        })();
      }

      return pc;
    },
    [boardId, startSpeakingDetection, token, updatePeer],
  );

  const closePeer = useCallback(
    (remoteSocketId: string) => {
      const pc = peersRef.current.get(remoteSocketId);
      if (pc) {
        pc.onicecandidate = null;
        pc.ontrack = null;
        pc.onconnectionstatechange = null;
        pc.close();
        peersRef.current.delete(remoteSocketId);
      }
      peerMetaRef.current.delete(remoteSocketId);
      stopSpeakingDetection(remoteSocketId);
      setPeers((prev) => {
        if (!prev[remoteSocketId]) return prev;
        const next = { ...prev };
        delete next[remoteSocketId];
        return next;
      });
    },
    [stopSpeakingDetection],
  );

  const closeAllPeers = useCallback(() => {
    for (const id of Array.from(peersRef.current.keys())) closePeer(id);
  }, [closePeer]);

  const stopLocalStream = useCallback(() => {
    if (localStreamRef.current) {
      for (const track of localStreamRef.current.getTracks()) track.stop();
      localStreamRef.current = null;
    }
    stopSpeakingDetection(null);
    setLocalSpeaking(false);
  }, [stopSpeakingDetection]);

  const join = useCallback(async () => {
    if (!boardId || !token || joined || joining) return;
    setJoining(true);
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          video: false,
        });
      } catch (err) {
        toast.error('Cannot access microphone. Check browser permissions.');
        throw err;
      }
      localStreamRef.current = stream;
      startSpeakingDetection('__local__', stream, true);

      const socket = getSocket(token);
      const result: JoinResult = await new Promise((resolve) => {
        socket.emit(
          'voice:join',
          { boardId },
          (r: JoinResult) => resolve(r),
        );
      });

      if (!result.ok) {
        stopLocalStream();
        toast.error(result.error || 'Failed to join voice room');
        return;
      }

      setMutedState(false);
      setJoined(true);
      for (const p of result.participants) {
        createPeer(p.socketId, { userId: p.userId, name: p.name }, true);
        updatePeer(p.socketId, { muted: p.muted });
      }
    } catch {
      // already toasted
    } finally {
      setJoining(false);
    }
  }, [boardId, createPeer, joined, joining, startSpeakingDetection, stopLocalStream, token, updatePeer]);

  const leave = useCallback(() => {
    if (!boardId || !token) return;
    const socket = getSocket(token);
    socket.emit('voice:leave', { boardId });
    closeAllPeers();
    stopLocalStream();
    setJoined(false);
    setPeers({});
  }, [boardId, closeAllPeers, stopLocalStream, token]);

  const setMuted = useCallback(
    (next: boolean) => {
      if (!boardId || !token) return;
      const stream = localStreamRef.current;
      if (stream) {
        for (const t of stream.getAudioTracks()) t.enabled = !next;
      }
      setMutedState(next);
      const socket = getSocket(token);
      socket.emit('voice:state', { boardId, muted: next });
    },
    [boardId, token],
  );

  const toggleMute = useCallback(() => setMuted(!muted), [muted, setMuted]);

  // Always-on subscription: keep a fresh snapshot of who is in the voice room,
  // even before the local user joins. Server broadcasts to `board:${boardId}`
  // room which we already joined via useBoardSocket.
  useEffect(() => {
    if (!boardId || !token) return;
    const socket = getSocket(token);

    const fetchList = () => {
      socket.emit('voice:list', { boardId }, (r: ListResult) => {
        if (r?.ok) setRoomParticipants(r.participants);
      });
    };

    const onRoomState = (payload: { boardId: string; participants: RoomParticipant[] }) => {
      if (payload.boardId !== boardId) return;
      setRoomParticipants(payload.participants);
    };

    // Re-fetch every time the socket connects (handles reconnects + initial connect)
    const onConnect = () => fetchList();

    socket.on('connect', onConnect);
    socket.on('voice:room-state', onRoomState);

    if (socket.connected) fetchList();

    // Periodic safety re-sync in case we missed a broadcast (e.g. server restart).
    const interval = window.setInterval(fetchList, 15000);

    return () => {
      socket.off('connect', onConnect);
      socket.off('voice:room-state', onRoomState);
      window.clearInterval(interval);
    };
  }, [boardId, token]);

  // Wire socket events for the active boardId / joined state
  useEffect(() => {
    if (!boardId || !token || !joined) return;
    const socket = getSocket(token);

    const onPeerJoined = (payload: {
      participant: { socketId: string; userId: string; name: string; muted: boolean };
    }) => {
      const { participant } = payload;
      // The newcomer creates the offer. Existing peer just registers and waits.
      createPeer(
        participant.socketId,
        { userId: participant.userId, name: participant.name },
        false,
      );
      updatePeer(participant.socketId, { muted: participant.muted });
    };

    const onPeerLeft = (payload: { socketId: string }) => {
      closePeer(payload.socketId);
    };

    const onPeerState = (payload: { socketId: string; muted: boolean }) => {
      updatePeer(payload.socketId, { muted: payload.muted });
    };

    const onSignal = async (payload: SignalPayload) => {
      if (payload.boardId !== boardId) return;
      let pc = peersRef.current.get(payload.from);
      const meta = peerMetaRef.current.get(payload.from);
      if (!pc) {
        // Race: signal before peer-joined event was processed. We need meta.
        if (!meta) {
          console.warn('[voice] signal from unknown peer (no meta)', payload.from);
          return;
        }
        pc = createPeer(payload.from, meta, false) || undefined;
        if (!pc) return;
      }

      try {
        if (payload.signal.type === 'offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.signal.data));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('voice:signal', {
            boardId,
            to: payload.from,
            signal: { type: 'answer', data: answer },
          });
        } else if (payload.signal.type === 'answer') {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.signal.data));
        } else if (payload.signal.type === 'ice') {
          await pc.addIceCandidate(new RTCIceCandidate(payload.signal.data));
        }
      } catch (err) {
        console.error('[voice] handleSignal error', err);
      }
    };

    socket.on('voice:peer-joined', onPeerJoined);
    socket.on('voice:peer-left', onPeerLeft);
    socket.on('voice:peer-state', onPeerState);
    socket.on('voice:signal', onSignal);

    return () => {
      socket.off('voice:peer-joined', onPeerJoined);
      socket.off('voice:peer-left', onPeerLeft);
      socket.off('voice:peer-state', onPeerState);
      socket.off('voice:signal', onSignal);
    };
  }, [boardId, closePeer, createPeer, joined, token, updatePeer]);

  // Cleanup on unmount or boardId change
  useEffect(() => {
    return () => {
      if (joined) {
        try {
          if (boardId && token) {
            const socket = getSocket(token);
            socket.emit('voice:leave', { boardId });
          }
        } catch {
          /* ignore */
        }
      }
      closeAllPeers();
      stopLocalStream();
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => undefined);
        audioContextRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId]);

  return {
    joined,
    joining,
    muted,
    peers,
    localSpeaking,
    me,
    join,
    leave,
    toggleMute,
    setMuted,
    roomParticipants,
  };
}
