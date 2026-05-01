import { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import type { useVoiceRoom } from '../hooks/useVoiceRoom';

type VoiceRoomState = ReturnType<typeof useVoiceRoom>;

interface VoiceRoomPanelProps {
  open: boolean;
  onClose: () => void;
  voice: VoiceRoomState;
}

export default function VoiceRoomPanel({ open, onClose, voice }: VoiceRoomPanelProps) {
  const {
    joined,
    joining,
    muted,
    peers,
    localSpeaking,
    me,
    join,
    leave,
    toggleMute,
    roomParticipants,
  } = voice;

  const peerList = useMemo(() => Object.values(peers), [peers]);
  // Participants currently in the voice room (server snapshot, available even before joining).
  const previewParticipants = useMemo(
    () => roomParticipants.filter((p) => p.userId !== me?.id),
    [roomParticipants, me?.id],
  );
  const totalInRoom = roomParticipants.length;

  if (!open) return null;

  const node = (
    <AnimatePresence>
      <motion.div
        key="voice-backdrop"
        className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.aside
        key="voice-panel"
        className="fixed inset-y-0 right-0 z-[81] flex w-full max-w-md flex-col border-l border-white/10 bg-slate-950/95 shadow-2xl shadow-black/60"
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 320, damping: 32 }}
      >
        <header className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400/30 to-emerald-600/20 ring-1 ring-emerald-300/30">
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 text-emerald-300">
                <path d="M12 14a3 3 0 003-3V6a3 3 0 10-6 0v5a3 3 0 003 3z" />
                <path d="M19 11a1 1 0 10-2 0 5 5 0 01-10 0 1 1 0 10-2 0 7 7 0 006 6.92V20H8a1 1 0 100 2h8a1 1 0 100-2h-3v-2.08A7 7 0 0019 11z" />
              </svg>
            </span>
            <div>
              <h2 className="text-base font-bold text-white">Voice Room</h2>
              <p className="text-xs text-slate-400">
                {joined
                  ? `${peerList.length + 1} connected`
                  : totalInRoom > 0
                    ? `${totalInRoom} in room`
                    : 'Empty'}
              </p>
            </div>
          </div>
          <motion.button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-white/5 hover:text-white"
            whileHover={{ rotate: 90 }}
            transition={{ duration: 0.2 }}
            aria-label="Close voice room"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </motion.button>
        </header>

        <div className="flex-1 overflow-y-auto p-5">
          {!joined ? (
            <div className="flex h-full flex-col">
              <div className="mb-6 flex flex-col items-center text-center">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 220, damping: 18 }}
                  className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400/20 to-emerald-600/10 ring-1 ring-emerald-300/30"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-8 w-8 text-emerald-300">
                    <path d="M12 14a3 3 0 003-3V6a3 3 0 10-6 0v5a3 3 0 003 3z" />
                    <path d="M19 11a1 1 0 10-2 0 5 5 0 01-10 0 1 1 0 10-2 0 7 7 0 006 6.92V20H8a1 1 0 100 2h8a1 1 0 100-2h-3v-2.08A7 7 0 0019 11z" />
                  </svg>
                </motion.div>
                <h3 className="mb-1.5 text-lg font-bold text-white">
                  {previewParticipants.length > 0 ? 'Voice room is active' : 'Join voice chat'}
                </h3>
                <p className="mb-5 max-w-xs text-sm text-slate-400">
                  {previewParticipants.length > 0
                    ? 'Members below are talking right now. Join to be heard.'
                    : 'Talk to other board members in real-time. Your microphone will be requested.'}
                </p>
                <motion.button
                  onClick={join}
                  disabled={joining}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-900/40 transition hover:from-emerald-400 hover:to-emerald-500 disabled:opacity-60"
                >
                  {joining ? (
                    <>
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeOpacity="0.25"
                        />
                        <path
                          d="M22 12a10 10 0 00-10-10"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                        />
                      </svg>
                      Connecting...
                    </>
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                        <path d="M20.487 17.14l-4.065-3.696a1 1 0 00-1.391.05l-1.193 1.192a18.062 18.062 0 01-7.524-7.524l1.193-1.193a1 1 0 00.05-1.39L3.86 0.513a1 1 0 00-1.391.087L.713 2.92a3 3 0 00-.343 3.4 21.99 21.99 0 0017.31 17.31 3 3 0 003.4-.343l2.32-1.756a1 1 0 00.087-1.391z" />
                      </svg>
                      {previewParticipants.length > 0 ? 'Join now' : 'Join voice'}
                    </>
                  )}
                </motion.button>
              </div>

              {previewParticipants.length > 0 && (
                <div className="border-t border-white/10 pt-4">
                  <h4 className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    In the room ({previewParticipants.length})
                  </h4>
                  <ul className="space-y-2">
                    <AnimatePresence initial={false}>
                      {previewParticipants.map((p) => (
                        <PreviewRow key={p.socketId} name={p.name} muted={p.muted} />
                      ))}
                    </AnimatePresence>
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <ul className="space-y-2">
              <ParticipantRow
                name={`${me?.name ?? 'You'} (you)`}
                speaking={localSpeaking}
                muted={muted}
                connectionState="connected"
                isLocal
              />
              <AnimatePresence initial={false}>
                {peerList.map((p) => (
                  <ParticipantRow
                    key={p.socketId}
                    name={p.name}
                    speaking={p.speaking}
                    muted={p.muted}
                    connectionState={p.connectionState}
                  />
                ))}
              </AnimatePresence>
              {peerList.length === 0 && (
                <li className="mt-6 text-center text-sm text-slate-500">
                  Waiting for others to join...
                </li>
              )}
            </ul>
          )}
        </div>

        {joined && (
          <footer className="flex items-center justify-center gap-3 border-t border-white/10 bg-slate-950/60 px-5 py-4">
            <motion.button
              onClick={toggleMute}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={
                'inline-flex h-12 w-12 items-center justify-center rounded-full ring-1 transition ' +
                (muted
                  ? 'bg-red-500/20 text-red-300 ring-red-400/40 hover:bg-red-500/30'
                  : 'bg-white/10 text-white ring-white/20 hover:bg-white/20')
              }
              aria-label={muted ? 'Unmute' : 'Mute'}
              title={muted ? 'Unmute' : 'Mute'}
            >
              {muted ? (
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                  <path d="M3.293 2.293a1 1 0 011.414 0l16 16a1 1 0 01-1.414 1.414l-3.144-3.144A6.97 6.97 0 0112 18a7 7 0 01-7-7 1 1 0 112 0 5 5 0 008.535 3.535l-1.46-1.46A3 3 0 019 11V8.414L2.293 1.707a1 1 0 010-1.414zM12 4a3 3 0 013 3v3a3 3 0 01-.094.74L12 7.828V7a1 1 0 00-2 0v.172L9.094 6.266A3 3 0 0112 4z" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                  <path d="M12 14a3 3 0 003-3V6a3 3 0 10-6 0v5a3 3 0 003 3z" />
                  <path d="M19 11a1 1 0 10-2 0 5 5 0 01-10 0 1 1 0 10-2 0 7 7 0 006 6.92V20H8a1 1 0 100 2h8a1 1 0 100-2h-3v-2.08A7 7 0 0019 11z" />
                </svg>
              )}
            </motion.button>
            <motion.button
              onClick={leave}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="inline-flex h-12 items-center gap-2 rounded-full bg-gradient-to-r from-red-500 to-red-600 px-5 text-sm font-bold text-white shadow-lg shadow-red-900/40 hover:from-red-400 hover:to-red-500"
              aria-label="Leave voice room"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                <path d="M21.485 13.929a1.5 1.5 0 00-.155-2.071l-2.49-2.075a17.949 17.949 0 00-13.68 0L2.67 11.858a1.5 1.5 0 00-.155 2.071l1.69 2.029a1.5 1.5 0 001.96.34l2.31-1.32a1 1 0 00.5-.866v-1.71a13.5 13.5 0 0110.05 0v1.71a1 1 0 00.5.866l2.31 1.32a1.5 1.5 0 001.96-.34l1.69-2.029z" />
              </svg>
              Leave
            </motion.button>
          </footer>
        )}
      </motion.aside>
    </AnimatePresence>
  );

  return createPortal(node, document.body);
}

interface ParticipantRowProps {
  name: string;
  speaking: boolean;
  muted: boolean;
  connectionState: RTCPeerConnectionState;
  isLocal?: boolean;
}

function ParticipantRow({
  name,
  speaking,
  muted,
  connectionState,
  isLocal,
}: ParticipantRowProps) {
  const stateLabel =
    connectionState === 'connected'
      ? null
      : connectionState === 'connecting' || connectionState === 'new'
        ? 'connecting...'
        : connectionState === 'failed'
          ? 'connection failed'
          : connectionState === 'disconnected'
            ? 'disconnected'
            : null;

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.18 }}
      className={
        'flex items-center gap-3 rounded-xl border px-3 py-2.5 transition ' +
        (speaking && !muted
          ? 'border-emerald-400/60 bg-emerald-400/10 shadow-[0_0_0_3px_rgba(16,185,129,0.15)]'
          : 'border-white/10 bg-white/5')
      }
    >
      <div className="relative">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-brand text-sm font-bold text-white">
          {name.charAt(0).toUpperCase()}
        </div>
        {speaking && !muted && (
          <motion.span
            className="absolute inset-0 rounded-full ring-2 ring-emerald-400"
            initial={{ scale: 1, opacity: 0.7 }}
            animate={{ scale: 1.35, opacity: 0 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'easeOut' }}
          />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-white">{name}</div>
        {stateLabel && (
          <div className="text-[10px] uppercase tracking-wider text-slate-500">
            {stateLabel}
          </div>
        )}
      </div>
      {muted ? (
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-red-500/20 text-red-300 ring-1 ring-red-400/40">
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
            <path d="M3.293 2.293a1 1 0 011.414 0l16 16a1 1 0 01-1.414 1.414l-3.144-3.144A6.97 6.97 0 0112 18a7 7 0 01-7-7 1 1 0 112 0 5 5 0 008.535 3.535l-1.46-1.46A3 3 0 019 11V8.414L2.293 1.707a1 1 0 010-1.414zM12 4a3 3 0 013 3v3a3 3 0 01-.094.74L12 7.828V7a1 1 0 00-2 0v.172L9.094 6.266A3 3 0 0112 4z" />
          </svg>
        </span>
      ) : (
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/30">
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
            <path d="M12 14a3 3 0 003-3V6a3 3 0 10-6 0v5a3 3 0 003 3z" />
            <path d="M19 11a1 1 0 10-2 0 5 5 0 01-10 0 1 1 0 10-2 0 7 7 0 006 6.92V20H8a1 1 0 100 2h8a1 1 0 100-2h-3v-2.08A7 7 0 0019 11z" />
          </svg>
        </span>
      )}
    </motion.li>
  );
}

interface PreviewRowProps {
  name: string;
  muted: boolean;
}

function PreviewRow({ name, muted }: PreviewRowProps) {
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.18 }}
      className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5"
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-brand text-sm font-bold text-white">
        {name.charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1 truncate text-sm font-semibold text-white">{name}</div>
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300 ring-1 ring-emerald-400/30">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
        in voice
      </span>
      {muted && (
        <span
          className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-red-500/20 text-red-300 ring-1 ring-red-400/40"
          title="Muted"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3">
            <path d="M3.293 2.293a1 1 0 011.414 0l16 16a1 1 0 01-1.414 1.414l-3.144-3.144A6.97 6.97 0 0112 18a7 7 0 01-7-7 1 1 0 112 0 5 5 0 008.535 3.535l-1.46-1.46A3 3 0 019 11V8.414L2.293 1.707a1 1 0 010-1.414zM12 4a3 3 0 013 3v3a3 3 0 01-.094.74L12 7.828V7a1 1 0 00-2 0v.172L9.094 6.266A3 3 0 0112 4z" />
          </svg>
        </span>
      )}
    </motion.li>
  );
}
