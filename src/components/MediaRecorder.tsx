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

const MediaRecorderWidget: React.FC<Props> = ({
  onFilesChange,
  maxAudioFiles = 5,
  maxVideoFiles = 5,
  maxPhotoFiles = 10,
}) => {
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null); // live preview
  const playbackRef = useRef<HTMLVideoElement | null>(null);     // playback element
  const streamRef = useRef<MediaStream | null>(null);
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

  // Recording timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (recordingVideo || recordingAudio) {
      interval = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      setRecordingTime(0);
    }
    return () => clearInterval(interval);
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

  const ensureCamera = async () => {
    if (streamRef.current) return streamRef.current;
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('getUserMedia not supported in this browser.');
    }

    const constraints: MediaStreamConstraints = {
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: true,
    };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    streamRef.current = stream;

    // Attach to live preview with iOS Safari specific handling
    const v = videoPreviewRef.current;
    if (v) {
      // Set essential props for iOS Safari
      v.muted = true;
      v.playsInline = true;
      v.setAttribute('playsinline', 'true');
      v.setAttribute('webkit-playsinline', 'true');
      
      v.srcObject = stream;
      
      // Wait for loadedmetadata, then play (iOS requirement)
      v.onloadedmetadata = () => {
        v.play().catch(() => {});
      };
      
      // Use requestVideoFrameCallback for first frame detection (fallback to loadeddata)
      if ('requestVideoFrameCallback' in v) {
        (v as any).requestVideoFrameCallback(() => setCameraReady(true));
      } else {
        // Use a timeout to ensure camera is ready after stream is attached
        setTimeout(() => setCameraReady(true), 500);
      }
    }

    return stream;
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

      // Some browsers require *only video tracks* for video recorder to avoid echo
      const videoOnlyStream = new MediaStream(stream.getVideoTracks());
      const rec = new MediaRecorder(videoOnlyStream, options);
      videoRecorderRef.current = rec;
      videoChunksRef.current = [];

      rec.ondataavailable = (e) => {
        if (e.data && e.data.size) videoChunksRef.current.push(e.data);
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
          playbackRef.current.src = URL.createObjectURL(blob);
          playbackRef.current.load();
        }
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
      {/* Live camera preview with proper iOS Safari styling */}
      <div className="relative rounded-lg overflow-hidden" style={{ background: '#000' }}>
        <video
          ref={videoPreviewRef}
          autoPlay
          muted
          playsInline
          webkit-playsinline="true"
          preload="metadata"
          className="w-full"
          style={{ 
            minHeight: 220, 
            objectFit: 'cover',
            background: '#000'
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
