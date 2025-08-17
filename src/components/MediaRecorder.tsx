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

const MediaRecorderWidget: React.FC<Props> = ({
  onFilesChange,
  maxAudioFiles = 5,
  maxVideoFiles = 5,
  maxPhotoFiles = 10,
}) => {
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null); // live preview
  const playbackRef = useRef<HTMLVideoElement | null>(null);     // playback element
  const streamRef = useRef<MediaStream | null>(null);

  const videoRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRecorderRef = useRef<MediaRecorder | null>(null);
  const videoChunksRef = useRef<Blob[]>([]);
  const audioChunksRef = useRef<Blob[]>([]);

  const [files, setFiles] = useState<MediaFile[]>([]);
  const [cameraReady, setCameraReady] = useState(false);
  const [recordingVideo, setRecordingVideo] = useState(false);
  const [recordingAudio, setRecordingAudio] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const [chosenVideoMime, setChosenVideoMime] = useState<string | undefined>();
  const [chosenAudioMime, setChosenAudioMime] = useState<string | undefined>();

  // Push up to parent
  useEffect(() => {
    onFilesChange?.(files);
  }, [files, onFilesChange]);

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

    // Attach to live preview
    const v = videoPreviewRef.current;
    if (v) {
      v.srcObject = stream;
      v.onloadedmetadata = () => {
        // Important for iOS: must be muted + playsInline + autoplay
        v.play().catch(() => {});
      };
      v.onloadeddata = () => setCameraReady(true);
    }

    return stream;
  };

  const startVideoRecording = async () => {
    if (recordingVideo) return;
    const stream = await ensureCamera();

    // Choose video MIME
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
      const filename = `video-${Date.now()}.${(picked || 'video/webm').includes('mp4') ? 'mp4' : 'webm'}`;
      const file = new File([blob], filename, { type: blob.type });
      setFiles((prev) => {
        if (prev.filter((f) => f.type === 'video').length >= maxVideoFiles) return prev;
        return [...prev, { type: 'video', file }];
      });

      // Play back recorded result in a dedicated element
      if (playbackRef.current) {
        playbackRef.current.src = URL.createObjectURL(blob);
        playbackRef.current.load();
      }
    };

    rec.start(250); // gather chunks
    setRecordingVideo(true);
  };

  const stopVideoRecording = async () => {
    if (!recordingVideo) return;
    const rec = videoRecorderRef.current;
    if (rec && rec.state !== 'inactive') rec.stop();
    setRecordingVideo(false);

    // NOTE: do NOT stop camera tracks here (we keep preview alive).
  };

  const closeCamera = () => {
    // Allow user to close camera explicitly; this will blank the live preview
    stopCameraTracks();
  };

  const startAudioRecording = async () => {
    if (recordingAudio) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('getUserMedia not supported in this browser.');
    }

    const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
      const filename = `audio-${Date.now()}.${(picked || 'audio/webm').includes('mp4') ? 'm4a' : (picked?.includes('ogg') ? 'ogg' : 'webm')}`;
      const file = new File([blob], filename, { type: blob.type });

      setFiles((prev) => {
        if (prev.filter((f) => f.type === 'audio').length >= maxAudioFiles) return prev;
        return [...prev, { type: 'audio', file }];
      });

      // Stop audio tracks after we finish (no preview to keep)
      for (const t of audioStream.getTracks()) t.stop();
    };

    rec.start(250);
    setRecordingAudio(true);
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
    setFiles((prev) => {
      if (prev.filter((f) => f.type === 'photo').length >= maxPhotoFiles) return prev;
      return [...prev, { type: 'photo', file }];
    });
    // Reset input so same photo can be re-selected later if needed
    e.currentTarget.value = '';
  };

  return (
    <div className="space-y-3">
      {/* Live camera preview */}
      <div className="relative rounded-lg overflow-hidden bg-black">
        <video
          ref={videoPreviewRef}
          autoPlay
          muted
          playsInline
          // @ts-ignore needed for older iOS
          webkit-playsinline="true"
          preload="metadata"
          className="w-full"
          style={{ minHeight: 240, objectFit: 'cover' }}
        />
        {cameraReady && (
          <span className="absolute top-2 left-2 text-xs px-2 py-1 rounded bg-green-600/80 text-white">
            Camera Ready
          </span>
        )}
      </div>

      {/* Controls */}
      <div className="grid grid-cols-2 gap-2">
        <button
          className="h-11 rounded-lg border px-3 text-sm font-medium hover:bg-accent active:scale-[0.98]"
          onClick={ensureCamera}
          type="button"
        >
          Open Camera
        </button>

        {!recordingVideo ? (
          <button
            className="h-11 rounded-lg bg-red-600 text-white px-3 text-sm font-semibold hover:bg-red-700 active:scale-[0.98]"
            onClick={startVideoRecording}
            type="button"
          >
            Start Video
          </button>
        ) : (
          <button
            className="h-11 rounded-lg bg-red-600 text-white px-3 text-sm font-semibold hover:bg-red-700 active:scale-[0.98]"
            onClick={stopVideoRecording}
            type="button"
          >
            Stop Video
          </button>
        )}

        <button
          className="h-11 rounded-lg border px-3 text-sm font-medium hover:bg-accent active:scale-[0.98]"
          onClick={closeCamera}
          type="button"
        >
          Close Camera
        </button>

        {!recordingAudio ? (
          <button
            className="h-11 rounded-lg border px-3 text-sm font-medium hover:bg-accent active:scale-[0.98]"
            onClick={startAudioRecording}
            type="button"
          >
            Start Voice Note
          </button>
        ) : (
          <button
            className="h-11 rounded-lg border px-3 text-sm font-medium hover:bg-accent active:scale-[0.98]"
            onClick={stopAudioRecording}
            type="button"
          >
            Stop Voice Note
          </button>
        )}
      </div>

      {/* Photo picker (best cross-device fallback) */}
      <div>
        <label className="block text-sm font-medium mb-1">Take/Upload Photo</label>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handlePhotoPick}
          className="block w-full text-sm"
        />
      </div>

      {/* Playback for the last recorded video */}
      <div className="rounded-lg overflow-hidden bg-muted/30 p-2">
        <label className="block text-sm font-medium mb-1">Recorded Video Preview</label>
        <video
          ref={playbackRef}
          controls
          playsInline
          preload="metadata"
          className="w-full rounded"
          style={{ minHeight: 160, background: '#000' }}
        />
      </div>

      {/* Small debug panel */}
      <details className="text-xs text-muted-foreground" open={debugOpen} onToggle={(e) => setDebugOpen((e.target as HTMLDetailsElement).open)}>
        <summary className="cursor-pointer select-none">Mostrar diagnóstico</summary>
        <div className="mt-2 space-y-1">
          <div>UserAgent: {navigator.userAgent}</div>
          <div>Protocol: {location.protocol}</div>
          <div>MediaRecorder: {typeof window !== 'undefined' && 'MediaRecorder' in window ? 'YES' : 'NO'}</div>
          <div>getUserMedia: {navigator.mediaDevices?.getUserMedia ? 'YES' : 'NO'}</div>
          <div>Chosen Video MIME: {chosenVideoMime || '(default)'}</div>
          <div>Chosen Audio MIME: {chosenAudioMime || '(default)'}</div>
          <div>Tracks Alive: {streamRef.current ? streamRef.current.getTracks().filter(t => t.readyState === 'live').length : 0}</div>
        </div>
      </details>
    </div>
  );
};

export default MediaRecorderWidget;
