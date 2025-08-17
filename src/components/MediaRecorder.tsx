import React, { useEffect, useRef, useState } from 'react';

export type MediaFile = {
  type: 'video' | 'audio' | 'photo';
  file: File;
  duration?: number;
};

type Props = {
  onFilesChange?: (files: MediaFile[]) => void;
  maxAudioFiles?: number;
  maxVideoFiles?: number;
  maxPhotoFiles?: number;
};

const pickSupportedMime = (candidates: string[], kind: 'video' | 'audio') => {
  // @ts-ignore
  const MR = window.MediaRecorder;
  if (!MR || !MR.isTypeSupported) return undefined;
  for (const t of candidates) {
    try {
      if (MR.isTypeSupported(t)) return t;
    } catch {}
  }
  return undefined;
};

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const generateUniqueFileName = (type: string, extension: string) => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${type}-${timestamp}-${random}.${extension}`;
};

const isIOS = () =>
  typeof navigator !== 'undefined' &&
  /iPad|iPhone|iPod/.test(navigator.userAgent) &&
  // iPadOS 13+ reports as Mac; also check for touch support
  ('ontouchend' in document);

const isLive = (s: MediaStream | null) =>
  !!s && s.getTracks().some(t => t.readyState === 'live');

/**
 * Build a recorder stream from CLONED tracks so the preview keeps its originals.
 * This prevents iOS Safari from blanking the <video> while recording.
 */
const makeRecorderStream = (src: MediaStream, withAudio: boolean) => {
  const videoTrack = src.getVideoTracks()[0];
  if (!videoTrack) throw new Error('No video track available');
  const clonedVideo = videoTrack.clone();

  let tracks: MediaStreamTrack[] = [clonedVideo];
  if (withAudio) {
    const audioTrack = src.getAudioTracks()[0];
    if (audioTrack) tracks.push(audioTrack.clone());
  }
  return new MediaStream(tracks);
};

const MediaRecorderWidget: React.FC<Props> = ({
  onFilesChange,
  maxAudioFiles = 5,
  maxVideoFiles = 5,
  maxPhotoFiles = 10,
}) => {
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null); // live preview
  const playbackRef = useRef<HTMLVideoElement | null>(null);     // playback element
  const streamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const recordingStartTimeRef = useRef<number>(0);

  const videoRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRecorderRef = useRef<MediaRecorder | null>(null);
  const videoChunksRef = useRef<Blob[]>([]);
  const audioChunksRef = useRef<Blob[]>([]);

  const [files, setFiles] = useState<MediaFile[]>([]);
  const [cameraReady, setCameraReady] = useState(false);
  const [recordingVideo, setRecordingVideo] = useState(false);
  const [recordingAudio, setRecordingAudio] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [debugOpen, setDebugOpen] = useState(false);
  const [chosenVideoMime, setChosenVideoMime] = useState<string | undefined>();
  const [chosenAudioMime, setChosenAudioMime] = useState<string | undefined>();

  // Push up to parent
  useEffect(() => {
    onFilesChange?.(files);
  }, [files, onFilesChange]);

  // Recording timer (browser-safe typing)
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (recordingVideo || recordingAudio) {
      interval = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
    } else {
      setRecordingTime(0);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [recordingVideo, recordingAudio]);

  // Handle page visibility change - pause preview but don't stop tracks
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && videoPreviewRef.current) {
        videoPreviewRef.current.pause();
      } else if (!document.hidden && videoPreviewRef.current && streamRef.current) {
        videoPreviewRef.current.play().catch(() => {});
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCameraTracks();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopCameraTracks = () => {
    if (streamRef.current) {
      for (const t of streamRef.current.getTracks()) t.stop();
      streamRef.current = null;
    }
    setCameraReady(false);
    if (videoPreviewRef.current) {
      videoPreviewRef.current.srcObject = null;
    }
  };

  const ensureFirstFrame = (videoEl: HTMLVideoElement) => {
    // Set essential props + attributes (iOS needs both)
    videoEl.muted = true;
    videoEl.setAttribute('muted', 'true'); // extra nudge for iOS
    videoEl.playsInline = true;
    videoEl.setAttribute('playsinline', 'true');
    videoEl.setAttribute('webkit-playsinline', 'true');
    videoEl.autoplay = true;

    const tryPlay = () => videoEl.play().catch(() => { /* ignore */ });

    // When metadata is ready, try to play
    videoEl.onloadedmetadata = () => {
      tryPlay();
    };

    // Confirm the first painted frame (best effort) 
    if ('requestVideoFrameCallback' in videoEl) {
      (videoEl as any).requestVideoFrameCallback(() => {
        setCameraReady(true);
      });
    } else {
      // Fallback: mark ready after a delay
      setTimeout(() => setCameraReady(true), 500);
    }

    // Safety retry: if we still haven't painted, poke again
    let attempts = 0;
    const pump = () => {
      if (videoEl.readyState >= 2 && videoEl.videoWidth > 0) return;
      attempts += 1;
      tryPlay();
      if (attempts < 10) requestAnimationFrame(pump);
    };
    requestAnimationFrame(pump);
  };

  const openCameraWithFallback = async () => {
    const base = { width: { ideal: 1280 }, height: { ideal: 720 } };

    const tryConstraints = async (videoFacingMode: 'environment' | 'user') => {
      // PREVIEW stream must be VIDEO ONLY
      return navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: videoFacingMode }, ...base },
        audio: false,
      });
    };

    let stream = await tryConstraints('environment').catch(() => null);
    if (!stream) stream = await tryConstraints('user'); // fallback if environment fails
    if (!stream) throw new Error('No camera available');

    streamRef.current = stream;
    const v = videoPreviewRef.current!;
    v.srcObject = null;
    v.load();
    v.srcObject = stream;
    ensureFirstFrame(v);

    // If no first frame after 1200ms, swap to user camera once
    setTimeout(async () => {
      if (!v.videoWidth || v.readyState < 2) {
        // keep audio from the first stream, just swap video track
        try {
          const alt = await tryConstraints('user');
          if (alt) {
            const vt = alt.getVideoTracks()[0];
            // 🚫 Do NOT add audio to the preview stream (iOS will black out)
            const mixed = new MediaStream([vt]); // preview stays VIDEO-ONLY
            streamRef.current = mixed;
            v.srcObject = null;
            v.load();
            v.srcObject = mixed;
            ensureFirstFrame(v);
          }
        } catch {/* ignore */}
      }
    }, 1200);

    return streamRef.current;
  };

  const ensureCamera = async () => {
    if (streamRef.current) return streamRef.current;
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('getUserMedia not supported in this browser.');
    }

    return openCameraWithFallback();
  };

  const startVideoRecording = async () => {
    if (recordingVideo) return;

    try {
      const stream = await ensureCamera();
      recordingStartTimeRef.current = Date.now();

      // Choose video MIME in order: mp4 h264 → webm vp8 → webm
      const videoCandidates = [
        'video/mp4;codecs=h264',
        'video/webm;codecs=vp8',
        'video/webm',
      ];
      const picked = pickSupportedMime(videoCandidates, 'video');
      setChosenVideoMime(picked);
      const options: MediaRecorderOptions = picked ? { mimeType: picked } : {};

      // IMPORTANT: For iOS, keep PREVIEW stream video-only.
      // Build the RECORDER stream from:
      //   - cloned video track from the preview stream
      //   - a FRESH mic stream (audio: true)
      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack) throw new Error('No video track available');
      const clonedVideo = videoTrack.clone();

      // request mic ONLY for the recorder
      micStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      const micTrack = micStreamRef.current.getAudioTracks()[0];

      const recorderStream = new MediaStream([clonedVideo, ...(micTrack ? [micTrack] : [])]);

      const rec = new MediaRecorder(recorderStream, options);
      videoRecorderRef.current = rec;
      videoChunksRef.current = [];

      rec.ondataavailable = (e) => {
        if (e.data && e.data.size) videoChunksRef.current.push(e.data);
      };

      rec.onstart = () => {
        // Safari can pause the preview when recording starts; poke it to keep playing
        const v = videoPreviewRef.current;
        if (v) {
          v.play().catch(() => {});
        }
      };

      rec.onstop = () => {
        const blob = new Blob(videoChunksRef.current, { type: picked || 'video/webm' });
        const duration = Math.round((Date.now() - recordingStartTimeRef.current) / 1000);

        // Check file size (50MB limit)
        if (blob.size > 50 * 1024 * 1024) {
          alert('Archivo muy grande (>50MB). Intenta grabar menos tiempo.');
          return;
        }

        const extension = (picked || 'video/webm').includes('mp4') ? 'mp4' : 'webm';
        const filename = generateUniqueFileName('video', extension);
        const file = new File([blob], filename, { type: blob.type });

        setFiles((prev) => {
          if (prev.filter((f) => f.type === 'video').length >= maxVideoFiles) return prev;
          return [...prev, { type: 'video', file, duration }];
        });

        // Play back recorded result in a dedicated element
        if (playbackRef.current) {
          // (Optional) revoke old URL if you store it; for now just set a fresh one
          playbackRef.current.src = URL.createObjectURL(blob);
          playbackRef.current.load();
        }

        // Clean up only the RECORDER tracks (cloned video + temp mic)
        try { recorderStream.getTracks().forEach(t => t.stop()); } catch {}
        try {
          if (micStreamRef.current) {
            micStreamRef.current.getTracks().forEach(t => t.stop());
            micStreamRef.current = null;
          }
        } catch {}
      };

      rec.start(250); // gather chunks every 250ms
      setRecordingVideo(true);
    } catch (error) {
      console.error('Video recording failed:', error);
      alert('No se pudo iniciar la grabación de video. Verifica los permisos de la cámara.');
    }
  };

  const stopVideoRecording = () => {
    if (!recordingVideo) return;
    const rec = videoRecorderRef.current;
    if (rec && rec.state !== 'inactive') rec.stop();
    setRecordingVideo(false);
    // NOTE: do NOT stop camera tracks here (we keep preview alive)
  };

  const closeCamera = () => {
    // Allow user to close camera explicitly; this will blank the live preview
    stopCameraTracks();
  };

  const startAudioRecording = async () => {
    if (recordingAudio) return;
    
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('getUserMedia not supported in this browser.');
      }

      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingStartTimeRef.current = Date.now();
      
      // Choose audio MIME in order: mp4 → webm → ogg
      const audioCandidates = ['audio/mp4', 'audio/webm', 'audio/ogg'];
      const picked = pickSupportedMime(audioCandidates, 'audio');
      setChosenAudioMime(picked);
      const options: MediaRecorderOptions = picked ? { mimeType: picked } : {};

      const rec = new MediaRecorder(audioStream, options);
      audioRecorderRef.current = rec;
      audioChunksRef.current = [];

      rec.ondataavailable = (e) => {
        if (e.data && e.data.size) audioChunksRef.current.push(e.data);
      };

      rec.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: picked || 'audio/webm' });
        const duration = Math.round((Date.now() - recordingStartTimeRef.current) / 1000);
        
        // Check file size (50MB limit)
        if (blob.size > 50 * 1024 * 1024) {
          alert('Archivo muy grande (>50MB). Intenta grabar menos tiempo.');
          return;
        }
        
        const extension = (picked || 'audio/webm').includes('mp4') ? 'm4a' : 
                         (picked?.includes('ogg') ? 'ogg' : 'webm');
        const filename = generateUniqueFileName('audio', extension);
        const file = new File([blob], filename, { type: blob.type });

        setFiles((prev) => {
          if (prev.filter((f) => f.type === 'audio').length >= maxAudioFiles) return prev;
          return [...prev, { type: 'audio', file, duration }];
        });

        // Stop audio tracks after we finish (no preview to keep)
        for (const t of audioStream.getTracks()) t.stop();
      };

      rec.start(250);
      setRecordingAudio(true);
    } catch (error) {
      console.error('Audio recording failed:', error);
      alert('No se pudo iniciar la grabación de audio. Verifica los permisos del micrófono.');
    }
  };

  const stopAudioRecording = () => {
    if (!recordingAudio) return;
    const rec = audioRecorderRef.current;
    if (rec && rec.state !== 'inactive') rec.stop();
    setRecordingAudio(false);
  };

  const handlePhotoPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Check file size (50MB limit)
    if (file.size > 50 * 1024 * 1024) {
      alert('Archivo muy grande (>50MB). Por favor selecciona una imagen más pequeña.');
      e.currentTarget.value = '';
      return;
    }
    
    // Generate unique filename for photo
    const extension = file.name.split('.').pop() || 'jpg';
    const uniqueName = generateUniqueFileName('photo', extension);
    const renamedFile = new File([file], uniqueName, { type: file.type });
    
    setFiles((prev) => {
      if (prev.filter((f) => f.type === 'photo').length >= maxPhotoFiles) return prev;
      return [...prev, { type: 'photo', file: renamedFile }];
    });
    // Reset input so same photo can be re-selected later if needed
    e.currentTarget.value = '';
  };

  return (
    <div className="space-y-3">
      {/* Always-mounted preview video with hard CSS guardrails */}
      <div className="relative min-h-[240px]" style={{ background: '#000' }}>
        <video
          ref={videoPreviewRef}
          autoPlay
          muted
          playsInline
          preload="metadata"
          className="block"
          style={{
            width: '100%',
            minHeight: 240,
            background: '#000',
            objectFit: 'cover',
            borderRadius: 8,
            transform: 'translateZ(0)',
            contain: 'paint',
          }}
        />
        {cameraReady && (
          <span className="absolute top-2 left-2 text-xs px-2 py-1 rounded bg-green-600/80 text-white">
            Camera Ready
          </span>
        )}
        {(recordingVideo || recordingAudio) && (
          <div className="absolute top-2 right-2 flex items-center gap-2 text-xs px-2 py-1 rounded bg-red-600/80 text-white">
            <div className="w-2 h-2 bg-red-300 rounded-full animate-pulse"></div>
            REC {formatTime(recordingTime)}
          </div>
        )}
      </div>

      {/* Inline diagnostics */}
      <div className="text-[11px] opacity-70 mt-1">
        Tracks: {streamRef.current ? streamRef.current.getTracks().filter(t => t.readyState === 'live').length : 0} •
        readyState: {videoPreviewRef.current?.readyState} •
        size: {videoPreviewRef.current?.videoWidth ?? 0}×{videoPreviewRef.current?.videoHeight ?? 0}
      </div>

      {/* Controls */}
      <div className="grid grid-cols-2 gap-2">
        <button
          className="h-11 rounded-lg border px-3 text-sm font-medium hover:bg-accent active:scale-[0.98] transition-all"
          onClick={ensureCamera}
          type="button"
        >
          Abrir Cámara
        </button>

        {!recordingVideo ? (
          <button
            className="h-11 rounded-lg bg-red-600 text-white px-3 text-sm font-semibold hover:bg-red-700 active:scale-[0.98] transition-all"
            onClick={startVideoRecording}
            type="button"
          >
            Grabar Video
          </button>
        ) : (
          <button
            className="h-11 rounded-lg bg-red-600 text-white px-3 text-sm font-semibold hover:bg-red-700 active:scale-[0.98] transition-all"
            onClick={stopVideoRecording}
            type="button"
          >
            Detener Video
          </button>
        )}

        <button
          className="h-11 rounded-lg border px-3 text-sm font-medium hover:bg-accent active:scale-[0.98] transition-all"
          onClick={closeCamera}
          type="button"
        >
          Cerrar Cámara
        </button>

        {!recordingAudio ? (
          <button
            className="h-11 rounded-lg border px-3 text-sm font-medium hover:bg-accent active:scale-[0.98] transition-all"
            onClick={startAudioRecording}
            type="button"
          >
            Grabar Audio
          </button>
        ) : (
          <button
            className="h-11 rounded-lg border px-3 text-sm font-medium hover:bg-accent active:scale-[0.98] transition-all"
            onClick={stopAudioRecording}
            type="button"
          >
            Detener Audio
          </button>
        )}
      </div>

      {/* Photo picker */}
      <div>
        <label className="block text-sm font-medium mb-1">Tomar/Subir Foto</label>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handlePhotoPick}
          className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-muted hover:file:bg-muted/80"
        />
      </div>

      {/* Playback for the last recorded video */}
      <div className="rounded-lg overflow-hidden bg-muted/30 p-2">
        <label className="block text-sm font-medium mb-1">Vista Previa del Video Grabado</label>
        <video
          ref={playbackRef}
          controls
          playsInline
          preload="metadata"
          className="w-full rounded"
          style={{ minHeight: 160, background: '#000' }}
        />
      </div>

      {/* Enhanced debug panel */}
      <details className="text-xs text-muted-foreground" open={debugOpen} onToggle={(e) => setDebugOpen((e.target as HTMLDetailsElement).open)}>
        <summary className="cursor-pointer select-none hover:text-foreground transition-colors">
          Mostrar diagnóstico
        </summary>
        <div className="mt-2 space-y-1 p-3 rounded-lg bg-muted/50">
          <div><strong>UserAgent:</strong> {navigator.userAgent.slice(0, 100)}...</div>
          <div><strong>Protocol:</strong> {location.protocol}</div>
          <div><strong>MediaRecorder:</strong> {typeof window !== 'undefined' && 'MediaRecorder' in window ? '✅ YES' : '❌ NO'}</div>
          <div><strong>getUserMedia:</strong> {navigator.mediaDevices?.getUserMedia ? '✅ YES' : '❌ NO'}</div>
          <div><strong>Chosen Video MIME:</strong> {chosenVideoMime || '(default)'}</div>
          <div><strong>Chosen Audio MIME:</strong> {chosenAudioMime || '(default)'}</div>
          <div><strong>Tracks Alive:</strong> {streamRef.current ? streamRef.current.getTracks().filter(t => t.readyState === 'live').length : 0}</div>
          <div><strong>requestVideoFrameCallback:</strong> {videoPreviewRef.current && 'requestVideoFrameCallback' in videoPreviewRef.current ? '✅ YES' : '❌ NO'}</div>
        </div>
      </details>
      
      {/* File list summary */}
      {files.length > 0 && (
        <div className="text-xs text-muted-foreground">
          Archivos: {files.filter(f => f.type === 'video').length} videos, {files.filter(f => f.type === 'audio').length} audios, {files.filter(f => f.type === 'photo').length} fotos
        </div>
      )}
    </div>
  );
};

export default MediaRecorderWidget;
