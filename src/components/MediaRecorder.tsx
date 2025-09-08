import React, { useEffect, useRef, useState } from 'react';

export type MediaFile = {
  type: 'video' | 'audio' | 'photo';
  file: File;
  duration?: number;
};

type Props = {
  onFilesChange?: (files: MediaFile[]) => void;
  onUploadActivity?: (files: MediaFile[]) => Promise<void>;
  maxAudioFiles?: number;
  maxVideoFiles?: number;
  maxPhotoFiles?: number;
  showUploadActivityButton?: boolean;
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

// Device detection utilities for diagnostics
const getIOSVersion = () => {
  const match = navigator.userAgent.match(/OS (\d+)_(\d+)_?(\d+)?/);
  return match ? `${match[1]}.${match[2]}${match[3] ? `.${match[3]}` : ''}` : 'N/A';
};

const getSafariVersion = () => {
  const match = navigator.userAgent.match(/Version\/(\d+\.\d+)/);
  return match ? match[1] : 'N/A';
};

const getDeviceInfo = () => {
  const ua = navigator.userAgent;
  const isIOSDevice = /iPad|iPhone|iPod/.test(ua);
  const isSafari = /Safari/.test(ua) && !/Chrome/.test(ua);
  
  return {
    isIOS: isIOSDevice,
    isSafari,
    iosVersion: isIOSDevice ? getIOSVersion() : 'N/A',
    safariVersion: isSafari ? getSafariVersion() : 'N/A',
    userAgent: ua.slice(0, 80) + (ua.length > 80 ? '...' : ''),
  };
};

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
  onUploadActivity,
  maxAudioFiles = 5,
  maxVideoFiles = 5,
  maxPhotoFiles = 10,
  showUploadActivityButton = false,
}) => {
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null); // live preview
  const playbackRef = useRef<HTMLVideoElement | null>(null);     // playback element
  const audioPlaybackRef = useRef<HTMLAudioElement | null>(null); // audio playback element
  const streamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const recordingStartTimeRef = useRef<number>(0);
  const previewKeepAliveRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
  const [diagnosticsTick, setDiagnosticsTick] = useState(0);
  const [language, setLanguage] = useState<'es' | 'en'>('es');
  const [uploading, setUploading] = useState(false);

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

  // Live diagnostics updater (only during recording)
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (recordingVideo || recordingAudio) {
      interval = setInterval(() => setDiagnosticsTick(prev => prev + 1), 500);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [recordingVideo, recordingAudio]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Stop any active recordings
      if (recordingVideo) {
        const rec = videoRecorderRef.current;
        if (rec && rec.state === 'recording') {
          try {
            rec.stop();
          } catch (error) {
            console.warn('Error stopping video recorder on unmount:', error);
          }
        }
      }
      
      if (recordingAudio) {
        const rec = audioRecorderRef.current;
        if (rec && rec.state === 'recording') {
          try {
            rec.stop();
          } catch (error) {
            console.warn('Error stopping audio recorder on unmount:', error);
          }
        }
      }
      
      // Stop camera tracks
      stopCameraTracks();
      
      // Clear intervals
      if (previewKeepAliveRef.current) {
        clearInterval(previewKeepAliveRef.current);
        previewKeepAliveRef.current = null;
      }
      
      // Clean up any remaining streams
      try {
        if (micStreamRef.current) {
          micStreamRef.current.getTracks().forEach(t => t.stop());
          micStreamRef.current = null;
        }
      } catch (error) {
        console.warn('Error cleaning up mic stream on unmount:', error);
      }
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
    if (recordingVideo) {
      console.warn('Video recording already in progress');
      return;
    }
    
    if (recordingAudio) {
      console.warn('Audio recording in progress, cannot start video recording');
      return;
    }

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
        // Nudge preview to keep playing
        const v = videoPreviewRef.current;
        if (v) v.play().catch(() => {});

        // Clear any previous interval
        if (previewKeepAliveRef.current) {
          clearInterval(previewKeepAliveRef.current);
          previewKeepAliveRef.current = null;
        }

        // Every second, check for "black" preview and re-attach srcObject if needed
        previewKeepAliveRef.current = setInterval(() => {
          const vEl = videoPreviewRef.current;
          const liveStream = streamRef.current;
          if (!vEl || !liveStream) return;

          const black =
            vEl.readyState < 2 ||
            vEl.videoWidth === 0 ||
            vEl.videoHeight === 0;

          const trackLive = liveStream.getVideoTracks().some(t => t.readyState === 'live');

          if (black || !trackLive || (vEl.srcObject !== liveStream)) {
            vEl.srcObject = liveStream;
            vEl.play().catch(() => {});
          }
        }, 1000);
      };

      rec.onstop = () => {
        try {
          // clear keep-alive
          if (previewKeepAliveRef.current) {
            clearInterval(previewKeepAliveRef.current);
            previewKeepAliveRef.current = null;
          }
          
          // re-prime the preview stream
          const v = videoPreviewRef.current;
          if (v && streamRef.current) {
            if (v.srcObject !== streamRef.current) v.srcObject = streamRef.current;
            v.play().catch(() => {});
          }

          // Check if we have any video chunks
          if (videoChunksRef.current.length === 0) {
            console.warn('No video chunks available for recording');
            return;
          }

          const blob = new Blob(videoChunksRef.current, { type: picked || 'video/webm' });
          const duration = Math.round((Date.now() - recordingStartTimeRef.current) / 1000);

          // Check file size (50MB limit)
          if (blob.size > 50 * 1024 * 1024) {
            alert(t[language].fileTooBig);
            return;
          }

          // Check if blob has actual content
          if (blob.size === 0) {
            console.warn('Generated video blob is empty');
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

          console.log('Video recording completed successfully:', {
            size: blob.size,
            duration,
            filename,
            chunks: videoChunksRef.current.length
          });

        } catch (error) {
          console.error('Error in video recording onstop handler:', error);
        } finally {
          // Clean up only the RECORDER tracks (cloned video + temp mic)
          try { 
            if (recorderStream) {
              recorderStream.getTracks().forEach(t => t.stop()); 
            }
          } catch (cleanupError) {
            console.warn('Error cleaning up recorder stream:', cleanupError);
          }
          
          try {
            if (micStreamRef.current) {
              micStreamRef.current.getTracks().forEach(t => t.stop());
              micStreamRef.current = null;
            }
          } catch (cleanupError) {
            console.warn('Error cleaning up mic stream:', cleanupError);
          }
        }
      };

      rec.start(250); // gather chunks every 250ms
      setRecordingVideo(true);
    } catch (error) {
      console.error('Video recording failed:', error);
      alert(t[language].cameraError);
    }
  };

  const stopVideoRecording = () => {
    if (!recordingVideo) return;
    
    try {
      const rec = videoRecorderRef.current;
      if (rec && rec.state !== 'inactive') {
        // Check if recorder is actually recording before stopping
        if (rec.state === 'recording') {
          rec.stop();
        } else {
          console.warn('MediaRecorder not in recording state:', rec.state);
        }
      } else {
        console.warn('No active video recorder found');
      }
    } catch (error) {
      console.error('Error stopping video recording:', error);
    }
    
    // Clear the recording state immediately
    setRecordingVideo(false);
    
    // Clear keep-alive interval
    if (previewKeepAliveRef.current) {
      clearInterval(previewKeepAliveRef.current);
      previewKeepAliveRef.current = null;
    }
    
    // Reset recording time
    setRecordingTime(0);
  };

  const closeCamera = () => {
    // Allow user to close camera explicitly; this will blank the live preview
    stopCameraTracks();
  };

  const startAudioRecording = async () => {
    if (recordingAudio) {
      console.warn('Audio recording already in progress');
      return;
    }
    
    if (recordingVideo) {
      console.warn('Video recording in progress, cannot start audio recording');
      return;
    }
    
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
          alert(t[language].fileTooBig);
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

        // Play back recorded audio in a dedicated element
        if (audioPlaybackRef.current) {
          audioPlaybackRef.current.src = URL.createObjectURL(blob);
          audioPlaybackRef.current.load();
        }

        console.log('Audio recording completed successfully:', {
          size: blob.size,
          duration,
          filename,
          chunks: audioChunksRef.current.length
        });

        // Stop audio tracks after we finish (no preview to keep)
        for (const t of audioStream.getTracks()) t.stop();
      };

      rec.start(250);
      setRecordingAudio(true);
    } catch (error) {
      console.error('Audio recording failed:', error);
      alert(t[language].audioError);
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
      alert(t[language].photoTooBig);
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

  const handleUpload = async () => {
    if (files.length === 0) {
      alert(t[language].noFiles);
      return;
    }

    setUploading(true);
    try {
      // Create FormData for file upload
      const formData = new FormData();
      files.forEach((mediaFile, index) => {
        formData.append(`file_${index}`, mediaFile.file);
        formData.append(`type_${index}`, mediaFile.type);
        if (mediaFile.duration) {
          formData.append(`duration_${index}`, mediaFile.duration.toString());
        }
      });

      // Here you would typically upload to your server
      // For now, we'll simulate an upload
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Simulate successful upload
      console.log('Uploading files:', files);
      alert(t[language].uploadSuccess);
      
      // Clear files after successful upload
      setFiles([]);
      
    } catch (error) {
      console.error('Upload failed:', error);
      alert(t[language].uploadError);
    } finally {
      setUploading(false);
    }
  };

  const handleUploadActivity = async () => {
    if (files.length === 0) {
      alert(t[language].noFiles);
      return;
    }

    if (!onUploadActivity) {
      alert(t[language].uploadError);
      return;
    }

    setUploading(true);
    try {
      await onUploadActivity(files);
      // Clear files after successful upload
      setFiles([]);
    } catch (error) {
      console.error('Activity upload failed:', error);
      alert(t[language].uploadError);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const ENABLE_VIDEO = import.meta.env.VITE_ENABLE_VIDEO === 'true';
  const IS_PRODUCTION = import.meta.env.VITE_PRODUCTION_MODE === 'true';

  // Translations
  const t = {
    es: {
      openCamera: 'Abrir Cámara',
      recordVideo: 'Grabar Video',
      stopVideo: 'Detener Video',
      closeCamera: 'Cerrar Cámara',
      recordAudio: '📱 Grabar Audio',
      stopAudio: '⏹️ Detener Audio',
      takePhoto: 'Tomar/Subir Foto',
      videoPreview: 'Vista Previa del Video Grabado',
      audioPreview: 'Vista Previa del Audio Grabado',
      lastAudio: 'Último audio',
      recordedFiles: 'Archivos Grabados',
      video: 'Video',
      audio: 'Audio',
      photo: 'Foto',
      cameraReady: 'Camera Ready',
      recording: 'REC',
      videoCapture: '📹 Captura de video',
      comingSoon: '(en mejora, próximamente)',
      showDiagnostics: 'Mostrar diagnóstico',
      fileTooBig: 'Archivo muy grande (>50MB). Intenta grabar menos tiempo.',
      photoTooBig: 'Archivo muy grande (>50MB). Por favor selecciona una imagen más pequeña.',
      cameraError: 'No se pudo iniciar la grabación de video. Verifica los permisos de la cámara.',
      audioError: 'No se pudo iniciar la grabación de audio. Verifica los permisos del micrófono.',
      language: 'Idioma',
      uploadFiles: 'Subir Archivos',
      uploadActivity: 'Subir Actividad',
      noFiles: 'No hay archivos para subir',
      uploadSuccess: 'Archivos subidos exitosamente',
      uploadError: 'Error al subir archivos',
      userAgent: 'UserAgent',
      protocol: 'Protocolo',
      mediaRecorder: 'MediaRecorder',
      getUserMedia: 'getUserMedia',
      chosenVideoMime: 'MIME de Video Elegido',
      chosenAudioMime: 'MIME de Audio Elegido',
      tracksAlive: 'Pistas Activas',
      requestVideoFrameCallback: 'requestVideoFrameCallback',
      default: '(por defecto)',
      yes: 'SÍ',
      no: 'NO',
      deleteFile: 'Eliminar archivo'
    },
    en: {
      openCamera: 'Open Camera',
      recordVideo: 'Record Video',
      stopVideo: 'Stop Video',
      closeCamera: 'Close Camera',
      recordAudio: '📱 Record Audio',
      stopAudio: '⏹️ Stop Audio',
      takePhoto: 'Take/Upload Photo',
      videoPreview: 'Recorded Video Preview',
      audioPreview: 'Recorded Audio Preview',
      lastAudio: 'Last audio',
      recordedFiles: 'Recorded Files',
      video: 'Video',
      audio: 'Audio',
      photo: 'Photo',
      cameraReady: 'Camera Ready',
      recording: 'REC',
      videoCapture: '📹 Video capture',
      comingSoon: '(improving, coming soon)',
      showDiagnostics: 'Show diagnostics',
      fileTooBig: 'File too large (>50MB). Try recording for less time.',
      photoTooBig: 'File too large (>50MB). Please select a smaller image.',
      cameraError: 'Could not start video recording. Check camera permissions.',
      audioError: 'Could not start audio recording. Check microphone permissions.',
      language: 'Language',
      uploadFiles: 'Upload Files',
      uploadActivity: 'Upload Activity',
      noFiles: 'No files to upload',
      uploadSuccess: 'Files uploaded successfully',
      uploadError: 'Error uploading files',
      userAgent: 'UserAgent',
      protocol: 'Protocol',
      mediaRecorder: 'MediaRecorder',
      getUserMedia: 'getUserMedia',
      chosenVideoMime: 'Chosen Video MIME',
      chosenAudioMime: 'Chosen Audio MIME',
      tracksAlive: 'Tracks Alive',
      requestVideoFrameCallback: 'requestVideoFrameCallback',
      default: '(default)',
      yes: 'YES',
      no: 'NO',
      deleteFile: 'Delete file'
    }
  };

  return (
    <div className="space-y-8">
          {/* Header with Language Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg">
                <span className="text-white text-lg">🎥</span>
              </div>
              <h2 className="text-2xl font-bold text-foreground bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                Media Capture
              </h2>
            </div>
            <button
              onClick={() => setLanguage(language === 'es' ? 'en' : 'es')}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded-xl border border-border hover:bg-accent hover:border-accent-foreground/20 transition-all duration-200 hover:scale-105 active:scale-95 shadow-sm hover:shadow-md"
              title={t[language].language}
            >
              <span className="text-lg">{language === 'es' ? '🇪🇸' : '🇺🇸'}</span>
              <span className="font-semibold">{language === 'es' ? 'ES' : 'EN'}</span>
            </button>
          </div>

      {/* Video Preview Section - Only show when camera is ready or recording */}
      {ENABLE_VIDEO && (cameraReady || recordingVideo || recordingAudio) ? (
        <div className="relative group">
          <div className="relative overflow-hidden rounded-3xl bg-black shadow-2xl ring-1 ring-black/20">
            <video
              ref={videoPreviewRef}
              autoPlay
              muted
              playsInline
              preload="metadata"
              className="w-full h-64 sm:h-80 object-cover"
            />
            
            {/* Status Overlays */}
            <div className="absolute inset-0 pointer-events-none">
              {cameraReady && (
                <div className="absolute top-4 left-4 flex items-center gap-2 px-4 py-2 bg-green-500/95 backdrop-blur-md rounded-full text-white text-sm font-semibold shadow-lg">
                  <div className="w-2 h-2 bg-green-200 rounded-full animate-pulse"></div>
                  {t[language].cameraReady}
                </div>
              )}
              
              {(recordingVideo || recordingAudio) && (
                <div className="absolute top-4 right-4 flex items-center gap-2 px-4 py-2 bg-red-500/95 backdrop-blur-md rounded-full text-white text-sm font-semibold shadow-lg">
                  <div className="w-2 h-2 bg-red-200 rounded-full animate-pulse"></div>
                  {t[language].recording} {formatTime(recordingTime)}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : !ENABLE_VIDEO ? (
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-muted/40 via-muted/20 to-muted/40 border-2 border-dashed border-muted-foreground/40 shadow-lg">
          <div className="flex flex-col items-center justify-center p-16 text-center">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center mb-6 shadow-lg">
              <span className="text-3xl">📹</span>
            </div>
            <h3 className="text-xl font-bold text-foreground mb-3">{t[language].videoCapture}</h3>
            <p className="text-sm text-muted-foreground font-medium">{t[language].comingSoon}</p>
          </div>
        </div>
      ) : null}

      {/* Main Controls Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Video Controls */}
        {ENABLE_VIDEO && (
          <>
            <button
              onClick={ensureCamera}
              className="group flex items-center justify-center gap-4 p-6 rounded-2xl border border-border hover:bg-accent hover:border-accent-foreground/20 transition-all duration-300 hover:scale-[1.03] active:scale-[0.97] shadow-sm hover:shadow-lg"
            >
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center group-hover:from-primary/20 group-hover:to-primary/10 transition-all duration-300">
                <span className="text-xl">📷</span>
              </div>
              <span className="font-semibold text-sm">{t[language].openCamera}</span>
            </button>

            {!recordingVideo ? (
              <button
                onClick={startVideoRecording}
                className="group flex items-center justify-center gap-4 p-6 rounded-2xl bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white transition-all duration-300 hover:scale-[1.03] active:scale-[0.97] shadow-lg hover:shadow-red-500/30"
              >
                <div className="w-12 h-12 rounded-2xl bg-red-400/30 flex items-center justify-center group-hover:bg-red-400/40 transition-all duration-300">
                  <span className="text-xl">🔴</span>
                </div>
                <span className="font-bold text-sm">{t[language].recordVideo}</span>
              </button>
            ) : (
              <button
                onClick={stopVideoRecording}
                className="group flex items-center justify-center gap-4 p-6 rounded-2xl bg-gradient-to-br from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white transition-all duration-300 hover:scale-[1.03] active:scale-[0.97] shadow-lg hover:shadow-red-600/30"
              >
                <div className="w-12 h-12 rounded-2xl bg-red-400/30 flex items-center justify-center group-hover:bg-red-400/40 transition-all duration-300">
                  <span className="text-xl">⏹️</span>
                </div>
                <span className="font-bold text-sm">{t[language].stopVideo}</span>
              </button>
            )}

            <button
              onClick={closeCamera}
              className="group flex items-center justify-center gap-4 p-6 rounded-2xl border border-border hover:bg-accent hover:border-accent-foreground/20 transition-all duration-300 hover:scale-[1.03] active:scale-[0.97] shadow-sm hover:shadow-lg"
            >
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-muted to-muted/80 flex items-center justify-center group-hover:from-muted/80 group-hover:to-muted/60 transition-all duration-300">
                <span className="text-xl">❌</span>
              </div>
              <span className="font-semibold text-sm">{t[language].closeCamera}</span>
            </button>
          </>
        )}

        {/* Audio Controls */}
        {!recordingAudio ? (
          <button
            onClick={startAudioRecording}
            className={`group flex items-center justify-center gap-4 p-6 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white transition-all duration-300 hover:scale-[1.03] active:scale-[0.97] shadow-lg hover:shadow-blue-500/30 ${!ENABLE_VIDEO ? 'col-span-full' : ''}`}
          >
            <div className="w-12 h-12 rounded-2xl bg-blue-400/30 flex items-center justify-center group-hover:bg-blue-400/40 transition-all duration-300">
              <span className="text-xl">🎤</span>
            </div>
            <span className="font-bold text-sm">{t[language].recordAudio}</span>
          </button>
        ) : (
          <button
            onClick={stopAudioRecording}
            className={`group flex items-center justify-center gap-4 p-6 rounded-2xl bg-gradient-to-br from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white transition-all duration-300 hover:scale-[1.03] active:scale-[0.97] shadow-lg hover:shadow-red-600/30 ${!ENABLE_VIDEO ? 'col-span-full' : ''}`}
          >
            <div className="w-12 h-12 rounded-2xl bg-red-400/30 flex items-center justify-center group-hover:bg-red-400/40 transition-all duration-300">
              <span className="text-xl">⏹️</span>
            </div>
            <span className="font-bold text-sm">{t[language].stopAudio}</span>
          </button>
        )}
      </div>

      {/* Photo Upload Section */}
      <div className="space-y-4">
        <label className="block text-lg font-bold text-foreground">{t[language].takePhoto}</label>
        <div className="relative">
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePhotoPick}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            id="photo-upload"
          />
          <label
            htmlFor="photo-upload"
            className="flex items-center justify-center gap-4 p-8 rounded-2xl border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 transition-all duration-300 cursor-pointer group hover:scale-[1.02] active:scale-[0.98]"
          >
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center group-hover:from-primary/20 group-hover:to-primary/10 transition-all duration-300">
              <span className="text-2xl">📷</span>
            </div>
            <span className="font-semibold text-base text-muted-foreground group-hover:text-foreground transition-colors">
              {t[language].takePhoto}
            </span>
          </label>
        </div>
      </div>

      {/* Playback Sections - Only show when there's media */}
      {ENABLE_VIDEO && files.filter(f => f.type === 'video').length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-foreground">{t[language].videoPreview}</h3>
          <div className="relative overflow-hidden rounded-2xl bg-black shadow-xl ring-1 ring-black/20">
            <video
              ref={playbackRef}
              controls
              playsInline
              preload="metadata"
              className="w-full h-48 sm:h-64 object-cover"
            />
          </div>
        </div>
      )}

      {files.filter(f => f.type === 'audio').length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-foreground">{t[language].audioPreview}</h3>
          <div className="p-6 rounded-2xl bg-gradient-to-br from-muted/50 to-muted/30 border border-border shadow-lg">
            <audio
              ref={audioPlaybackRef}
              controls
              preload="metadata"
              className="w-full"
            />
            <div className="text-sm text-muted-foreground mt-3 font-medium">
              {t[language].lastAudio}: {files.filter(f => f.type === 'audio').slice(-1)[0]?.duration}s
            </div>
          </div>
        </div>
      )}

      {/* Debug Panel - Development Only */}
      {!IS_PRODUCTION && (
        <details className="group">
          <summary className="flex items-center gap-2 cursor-pointer select-none p-3 rounded-lg hover:bg-muted/50 transition-colors">
            <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground">
              {t[language].showDiagnostics}
            </span>
            <span className="text-xs text-muted-foreground">🔍</span>
          </summary>
          <div className="mt-3 p-4 rounded-lg bg-muted/30 border border-border space-y-2 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div><strong>{t[language].userAgent}:</strong> {navigator.userAgent.slice(0, 60)}...</div>
              <div><strong>{t[language].protocol}:</strong> {location.protocol}</div>
              <div><strong>{t[language].mediaRecorder}:</strong> {typeof window !== 'undefined' && 'MediaRecorder' in window ? `✅ ${t[language].yes}` : `❌ ${t[language].no}`}</div>
              <div><strong>{t[language].getUserMedia}:</strong> {navigator.mediaDevices?.getUserMedia ? `✅ ${t[language].yes}` : `❌ ${t[language].no}`}</div>
              <div><strong>{t[language].chosenVideoMime}:</strong> {chosenVideoMime || t[language].default}</div>
              <div><strong>{t[language].chosenAudioMime}:</strong> {chosenAudioMime || t[language].default}</div>
              <div><strong>{t[language].tracksAlive}:</strong> {streamRef.current ? streamRef.current.getTracks().filter(t => t.readyState === 'live').length : 0}</div>
              <div><strong>{t[language].requestVideoFrameCallback}:</strong> {videoPreviewRef.current && 'requestVideoFrameCallback' in videoPreviewRef.current ? `✅ ${t[language].yes}` : `❌ ${t[language].no}`}</div>
            </div>
          </div>
        </details>
      )}
      
      {/* Files List */}
      {files.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-foreground flex items-center gap-3">
              {t[language].recordedFiles}
              <span className="px-3 py-1 text-sm font-bold bg-gradient-to-r from-primary/10 to-primary/5 text-primary rounded-full border border-primary/20">
                {files.length}
              </span>
            </h3>
            <div className="flex gap-3">
              {showUploadActivityButton && onUploadActivity && (
                <button
                  onClick={handleUploadActivity}
                  disabled={uploading}
                  className="flex items-center gap-2 px-5 py-3 text-sm font-semibold rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed transition-all duration-300 hover:scale-105 active:scale-95 shadow-lg hover:shadow-blue-500/30"
                >
                  {uploading ? '⏳' : '📋'} {t[language].uploadActivity}
                </button>
              )}
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="flex items-center gap-2 px-5 py-3 text-sm font-semibold rounded-xl bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed transition-all duration-300 hover:scale-105 active:scale-95 shadow-lg hover:shadow-green-500/30"
              >
                {uploading ? '⏳' : '📤'} {t[language].uploadFiles}
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {files.map((file, index) => (
              <div key={index} className="group relative overflow-hidden rounded-2xl bg-card border border-border hover:border-primary/50 transition-all duration-300 hover:shadow-xl hover:scale-[1.02]">
                {/* Delete Button */}
                <button
                  onClick={() => handleDeleteFile(index)}
                  className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-red-500/90 hover:bg-red-600 text-white flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 shadow-lg hover:shadow-red-500/30 opacity-0 group-hover:opacity-100"
                  title={t[language].deleteFile}
                >
                  <span className="text-sm">🗑️</span>
                </button>
                
                <div className="p-5">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      {file.type === 'video' && (
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-500/10 to-red-500/5 flex items-center justify-center shadow-sm">
                          <span className="text-2xl">🎥</span>
                        </div>
                      )}
                      {file.type === 'audio' && (
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/10 to-blue-500/5 flex items-center justify-center shadow-sm">
                          <span className="text-2xl">🎵</span>
                        </div>
                      )}
                      {file.type === 'photo' && (
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-500/10 to-green-500/5 flex items-center justify-center shadow-sm">
                          <span className="text-2xl">📷</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-foreground truncate mb-2">
                        {file.file.name}
                      </div>
                      <div className="text-xs text-muted-foreground space-y-1">
                        <div className="font-medium">
                          {file.type === 'video' && `${t[language].video} • ${file.duration}s`}
                          {file.type === 'audio' && `${t[language].audio} • ${file.duration}s`}
                          {file.type === 'photo' && t[language].photo}
                        </div>
                        <div className="font-semibold">{(file.file.size / 1024 / 1024).toFixed(1)}MB</div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Media Preview */}
                  <div className="mt-4">
                    {file.type === 'audio' && (
                      <audio
                        controls
                        preload="metadata"
                        className="w-full h-10"
                        src={URL.createObjectURL(file.file)}
                      />
                    )}
                    {file.type === 'video' && (
                      <video
                        controls
                        playsInline
                        preload="metadata"
                        className="w-full h-24 rounded-xl object-cover shadow-sm"
                        src={URL.createObjectURL(file.file)}
                      />
                    )}
                    {file.type === 'photo' && (
                      <img
                        src={URL.createObjectURL(file.file)}
                        alt="Preview"
                        className="w-full h-24 rounded-xl object-cover shadow-sm"
                      />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MediaRecorderWidget;
