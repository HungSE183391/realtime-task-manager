import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { useVoiceRoom } from '../hooks/useVoiceRoom';

type VoiceRoomState = ReturnType<typeof useVoiceRoom>;

interface VoiceAudioMounterProps {
  voice: VoiceRoomState;
}

/**
 * Renders <audio> elements for every remote peer at the page root, so audio
 * keeps playing even when the voice panel is closed. Audio playback is purely
 * a side effect of having the element bound to the MediaStream — its visual
 * placement does not matter.
 */
export default function VoiceAudioMounter({ voice }: VoiceAudioMounterProps) {
  const peers = Object.values(voice.peers);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div aria-hidden style={{ position: 'fixed', width: 0, height: 0, overflow: 'hidden' }}>
      {peers.map((p) => (
        <PeerAudio key={p.socketId} stream={p.stream} />
      ))}
    </div>,
    document.body,
  );
}

function PeerAudio({ stream }: { stream: MediaStream | null }) {
  const ref = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (stream && el.srcObject !== stream) {
      el.srcObject = stream;
      el.play().catch(() => undefined);
    }
    if (!stream && el.srcObject) {
      el.srcObject = null;
    }
  }, [stream]);

  return <audio ref={ref} autoPlay playsInline />;
}
