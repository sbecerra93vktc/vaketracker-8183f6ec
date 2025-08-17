import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Mic, 
  Square, 
  Play, 
  Pause, 
  Video, 
  Camera, 
  Trash2, 
  Upload,
  FileImage,
  AlertCircle,
  Info,
  ChevronDown,
  CheckCircle2
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export interface MediaFile {
  type: 'audio' | 'video' | 'photo';
  file: File;
  duration?: number;
}

interface MediaRecorderProps {
  onFilesChange: (files: MediaFile[]) => void;
  maxAudioFiles?: number;
  maxVideoFiles?: number;
  maxPhotoFiles?: number;
}

const MediaRecorder: React.FC<MediaRecorderProps> = ({
  onFilesChange,
  maxAudioFiles = 5,
  maxVideoFiles = 5,
  maxPhotoFiles = 10
}) => {
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [isRecordingVideo, setIsRecordingVideo] = useState(false);
  const [audioFiles, setAudioFiles] = useState<MediaFile[]>([]);
  const [videoFiles, setVideoFiles] = useState<MediaFile[]>([]);
  const [photoFiles, setPhotoFiles] = useState<MediaFile[]>([]);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showDebug, setShowDebug] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  
  const [compatibility, setCompatibility] = useState({
    hasMediaRecorder: false,
    hasGetUserMedia: false,
    isHttps: false,
    userAgent: '',
    protocol: '',
    chosenAudioMimeType: '',
    chosenVideoMimeType: ''
  });
  
  const audioRecorderRef = useRef<MediaRecorder | null>(null);
  const videoRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const { toast } = useToast();

  // Check compatibility on mount
  useEffect(() => {
    const checkCompatibility = () => {
      const hasMediaRecorder = typeof MediaRecorder !== 'undefined';
      const hasGetUserMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
      const isHttps = window.location.protocol === 'https:' || window.location.hostname === 'localhost';
      
      setCompatibility({
        hasMediaRecorder,
        hasGetUserMedia,
        isHttps,
        userAgent: navigator.userAgent,
        protocol: window.location.protocol,
        chosenAudioMimeType: '',
        chosenVideoMimeType: ''
      });
    };

    checkCompatibility();
  }, []);

  const updateAllFiles = useCallback((audio: MediaFile[], video: MediaFile[], photos: MediaFile[]) => {
    const allFiles = [...audio, ...video, ...photos];
    onFilesChange(allFiles);
  }, [onFilesChange]);

  const startRecordingTimer = () => {
    setRecordingTime(0);
    recordingTimerRef.current = setInterval(() => {
      setRecordingTime(prev => prev + 1);
    }, 1000);
  };

  const stopRecordingTimer = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const startAudioRecording = async () => {
    if (!compatibility.hasGetUserMedia || !compatibility.hasMediaRecorder) {
      toast({
        variant: "destructive",
        title: "Función no disponible",
        description: "Tu dispositivo no soporta grabación en el navegador. Usa el cargador de archivos.",
      });
      return;
    }

    try {
      const constraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 'ontouchstart' in window ? 22050 : 44100
        }
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      audioStreamRef.current = stream;
      
      // Choose best MIME type
      let mimeType = '';
      if ((window as any).MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      } else if ((window as any).MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      } else if ((window as any).MediaRecorder.isTypeSupported('audio/webm')) {
        mimeType = 'audio/webm';
      }
      
      setCompatibility(prev => ({ ...prev, chosenAudioMimeType: mimeType }));
      
      const options = mimeType ? { mimeType } : {};
      const mediaRecorder = new (window as any).MediaRecorder(stream, options);
      audioRecorderRef.current = mediaRecorder;
      
      const chunks: Blob[] = [];
      const startTime = Date.now();
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType || 'audio/webm' });
        const duration = Math.round((Date.now() - startTime) / 1000);
        
        // Check file size (50MB limit)
        if (blob.size > 50 * 1024 * 1024) {
          toast({
            variant: "destructive",
            title: "Archivo muy grande",
            description: "El archivo no puede exceder 50MB. Intenta grabar menos tiempo.",
          });
          return;
        }
        
        const fileExtension = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('wav') ? 'wav' : 'webm';
        const file = new File([blob], `audio-${Date.now()}.${fileExtension}`, { type: mimeType || 'audio/webm' });
        
        const newAudioFile: MediaFile = {
          type: 'audio',
          file,
          duration
        };
        
        const updatedAudioFiles = [...audioFiles, newAudioFile];
        setAudioFiles(updatedAudioFiles);
        updateAllFiles(updatedAudioFiles, videoFiles, photoFiles);
        
        stream.getTracks().forEach(track => track.stop());
        audioStreamRef.current = null;
      };
      
      mediaRecorder.start();
      setIsRecordingAudio(true);
      startRecordingTimer();
      
      toast({
        title: "Grabando nota de voz",
        description: "Toca el botón de parar cuando termines",
      });
    } catch (error: any) {
      let errorMessage = "No se pudo acceder al micrófono";
      
      if (error.name === 'NotAllowedError') {
        errorMessage = "Permisos de micrófono denegados. Por favor, permite el acceso en la configuración del navegador.";
      } else if (error.name === 'NotFoundError') {
        errorMessage = "No se encontró micrófono disponible";
      }
      
      toast({
        variant: "destructive",
        title: "Error de grabación",
        description: errorMessage,
      });
    }
  };

  const stopAudioRecording = () => {
    if (audioRecorderRef.current && isRecordingAudio) {
      audioRecorderRef.current.stop();
      setIsRecordingAudio(false);
      stopRecordingTimer();
    }
  };

  const startVideoRecording = async () => {
    if (!compatibility.hasGetUserMedia || !compatibility.hasMediaRecorder) {
      toast({
        variant: "destructive",
        title: "Función no disponible",
        description: "Tu dispositivo no soporta grabación en el navegador. Usa el cargador de archivos.",
      });
      return;
    }

    try {
      const isMobile = 'ontouchstart' in window;
      const constraints = {
        video: { 
          facingMode: 'environment',
          width: isMobile ? { ideal: 640, max: 1280 } : { ideal: 640 },
          height: isMobile ? { ideal: 480, max: 720 } : { ideal: 480 },
          frameRate: isMobile ? { ideal: 15, max: 30 } : { ideal: 30 }
        }, 
        audio: {
          echoCancellation: true,
          noiseSuppression: true
        }
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      videoStreamRef.current = stream;
      
      if (videoPreviewRef.current) {
        const video = videoPreviewRef.current;
        video.srcObject = stream;
        video.muted = true;
        video.playsInline = true;
        video.setAttribute('webkit-playsinline', 'true');
        
        video.onloadedmetadata = () => {
          setVideoReady(true);
          
          // Only autoplay on desktop
          if (!isMobile) {
            video.play().catch(console.warn);
          }
        };
        
        // Mobile: user-initiated play
        if (isMobile) {
          video.addEventListener('loadeddata', () => {
            setVideoReady(true);
          });
        }
      }
      
      // Choose best video MIME type
      let mimeType = '';
      if ((window as any).MediaRecorder.isTypeSupported('video/mp4')) {
        mimeType = 'video/mp4';
      } else if ((window as any).MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
        mimeType = 'video/webm;codecs=vp8';
      } else if ((window as any).MediaRecorder.isTypeSupported('video/webm')) {
        mimeType = 'video/webm';
      }
      
      setCompatibility(prev => ({ ...prev, chosenVideoMimeType: mimeType }));
      
      const options = mimeType ? { mimeType } : {};
      const mediaRecorder = new (window as any).MediaRecorder(stream, options);
      videoRecorderRef.current = mediaRecorder;
      
      const chunks: Blob[] = [];
      const startTime = Date.now();
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType || 'video/webm' });
        const duration = Math.round((Date.now() - startTime) / 1000);
        
        // Check file size (50MB limit)
        if (blob.size > 50 * 1024 * 1024) {
          toast({
            variant: "destructive",
            title: "Archivo muy grande",
            description: "El archivo no puede exceder 50MB. Intenta grabar menos tiempo.",
          });
          return;
        }
        
        const fileExtension = mimeType.includes('mp4') ? 'mp4' : 'webm';
        const file = new File([blob], `video-${Date.now()}.${fileExtension}`, { type: mimeType || 'video/webm' });
        
        const newVideoFile: MediaFile = {
          type: 'video',
          file,
          duration
        };
        
        const updatedVideoFiles = [...videoFiles, newVideoFile];
        setVideoFiles(updatedVideoFiles);
        updateAllFiles(audioFiles, updatedVideoFiles, photoFiles);
        
        stream.getTracks().forEach(track => track.stop());
        videoStreamRef.current = null;
        setVideoReady(false);
        
        if (videoPreviewRef.current) {
          videoPreviewRef.current.srcObject = null;
        }
      };
      
      // On mobile, require user gesture to start preview
      if (isMobile && videoPreviewRef.current) {
        videoPreviewRef.current.addEventListener('click', () => {
          if (videoPreviewRef.current) {
            videoPreviewRef.current.play().catch(console.warn);
          }
        }, { once: true });
      }
      
      mediaRecorder.start();
      setIsRecordingVideo(true);
      startRecordingTimer();
      
      toast({
        title: "Grabando video",
        description: "Toca el botón de parar cuando termines",
      });
    } catch (error: any) {
      let errorMessage = "No se pudo acceder a la cámara";
      
      if (error.name === 'NotAllowedError') {
        errorMessage = "Permisos de cámara denegados. Por favor, permite el acceso en la configuración del navegador.";
      } else if (error.name === 'NotFoundError') {
        errorMessage = "No se encontró cámara disponible";
      }
      
      toast({
        variant: "destructive",
        title: "Error de grabación",
        description: errorMessage,
      });
    }
  };

  const stopVideoRecording = () => {
    if (videoRecorderRef.current && isRecordingVideo) {
      videoRecorderRef.current.stop();
      setIsRecordingVideo(false);
      stopRecordingTimer();
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>, type: 'audio' | 'video' | 'photo') => {
    const files = event.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      // Check file size (50MB limit)
      if (file.size > 50 * 1024 * 1024) {
        toast({
          variant: "destructive",
          title: "Archivo muy grande",
          description: `El archivo "${file.name}" excede 50MB. Por favor selecciona un archivo más pequeño.`,
        });
        return;
      }

      const newFile: MediaFile = {
        type,
        file
      };

      if (type === 'photo') {
        if (photoFiles.length >= maxPhotoFiles) {
          toast({
            variant: "destructive",
            title: "Límite alcanzado",
            description: `Máximo ${maxPhotoFiles} fotos permitidas`,
          });
          return;
        }
        const updatedPhotoFiles = [...photoFiles, newFile];
        setPhotoFiles(updatedPhotoFiles);
        updateAllFiles(audioFiles, videoFiles, updatedPhotoFiles);
      } else if (type === 'audio') {
        if (audioFiles.length >= maxAudioFiles) {
          toast({
            variant: "destructive",
            title: "Límite alcanzado", 
            description: `Máximo ${maxAudioFiles} audios permitidos`,
          });
          return;
        }
        const updatedAudioFiles = [...audioFiles, newFile];
        setAudioFiles(updatedAudioFiles);
        updateAllFiles(updatedAudioFiles, videoFiles, photoFiles);
      } else if (type === 'video') {
        if (videoFiles.length >= maxVideoFiles) {
          toast({
            variant: "destructive",
            title: "Límite alcanzado",
            description: `Máximo ${maxVideoFiles} videos permitidos`,
          });
          return;
        }
        const updatedVideoFiles = [...videoFiles, newFile];
        setVideoFiles(updatedVideoFiles);
        updateAllFiles(audioFiles, updatedVideoFiles, photoFiles);
      }
    });

    // Reset input
    event.target.value = '';
  };

  const playAudio = (audioFile: MediaFile) => {
    const audioId = audioFile.file.name + audioFile.file.size;
    
    if (playingAudio === audioId) {
      audioPlayerRef.current?.pause();
      setPlayingAudio(null);
    } else {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.src = URL.createObjectURL(audioFile.file);
        audioPlayerRef.current.play();
        setPlayingAudio(audioId);
        
        audioPlayerRef.current.onended = () => setPlayingAudio(null);
      }
    }
  };

  const removeFile = (fileIndex: number, type: 'audio' | 'video' | 'photo') => {
    if (type === 'audio') {
      const updated = audioFiles.filter((_, index) => index !== fileIndex);
      setAudioFiles(updated);
      updateAllFiles(updated, videoFiles, photoFiles);
    } else if (type === 'video') {
      const updated = videoFiles.filter((_, index) => index !== fileIndex);
      setVideoFiles(updated);
      updateAllFiles(audioFiles, updated, photoFiles);
    } else {
      const updated = photoFiles.filter((_, index) => index !== fileIndex);
      setPhotoFiles(updated);
      updateAllFiles(audioFiles, videoFiles, updated);
    }
  };

  const useNativeRecording = compatibility.hasGetUserMedia && compatibility.hasMediaRecorder;

  return (
    <div className="space-y-6">
      <audio ref={audioPlayerRef} />
      
      {/* Compatibility Debug Panel */}
      <Collapsible>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="text-xs" onClick={() => setShowDebug(!showDebug)}>
            <Info className="h-3 w-3 mr-1" />
            Mostrar diagnóstico
            <ChevronDown className="h-3 w-3 ml-1" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <Card className="mt-2">
            <CardContent className="pt-4 text-xs space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>MediaRecorder: {compatibility.hasMediaRecorder ? '✅' : '❌'}</div>
                <div>getUserMedia: {compatibility.hasGetUserMedia ? '✅' : '❌'}</div>
                <div>Protocol: {compatibility.protocol}</div>
                <div>HTTPS: {compatibility.isHttps ? '✅' : '❌'}</div>
              </div>
              {compatibility.chosenAudioMimeType && (
                <div>Audio MIME: {compatibility.chosenAudioMimeType}</div>
              )}
              {compatibility.chosenVideoMimeType && (
                <div>Video MIME: {compatibility.chosenVideoMimeType}</div>
              )}
              <div className="text-xs text-muted-foreground mt-2">
                User Agent: {compatibility.userAgent}
              </div>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      {/* Fallback Warning */}
      {!useNativeRecording && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Tu dispositivo no soporta grabación en el navegador. Usa el cargador de archivos.
          </AlertDescription>
        </Alert>
      )}

      {/* Audio Recording Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Mic className="h-5 w-5" />
            Notas de Voz
            {audioFiles.length > 0 && (
              <Badge variant="secondary">{audioFiles.length}/{maxAudioFiles}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {useNativeRecording ? (
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={isRecordingAudio ? stopAudioRecording : startAudioRecording}
                variant={isRecordingAudio ? "destructive" : "default"}
                size="lg"
                disabled={!isRecordingAudio && audioFiles.length >= maxAudioFiles}
                className="min-h-[48px]"
              >
                {isRecordingAudio ? (
                  <>
                    <Square className="h-5 w-5 mr-2" />
                    Detener ({formatTime(recordingTime)})
                  </>
                ) : (
                  <>
                    <Mic className="h-5 w-5 mr-2" />
                    Grabar audio
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="audio-upload" className="cursor-pointer">
                <div className="flex items-center justify-center min-h-[48px] px-4 py-2 border-2 border-dashed border-muted-foreground/25 rounded-lg hover:border-muted-foreground/50 transition-colors">
                  <Upload className="h-5 w-5 mr-2" />
                  Cargar archivo de audio
                </div>
              </Label>
              <input
                id="audio-upload"
                type="file"
                accept="audio/*"
                capture="user"
                multiple
                onChange={(e) => handleFileUpload(e, 'audio')}
                className="hidden"
              />
            </div>
          )}

          {audioFiles.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Archivos de audio:</Label>
              {audioFiles.map((audioFile, index) => (
                <div key={index} className="flex items-center gap-2 p-2 border rounded">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => playAudio(audioFile)}
                  >
                    {playingAudio === audioFile.file.name + audioFile.file.size ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </Button>
                  <span className="text-sm flex-1 truncate">{audioFile.file.name}</span>
                  {audioFile.duration && (
                    <Badge variant="outline">{formatTime(audioFile.duration)}</Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(index, 'audio')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Video Recording Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Video className="h-5 w-5" />
            Videos
            {videoFiles.length > 0 && (
              <Badge variant="secondary">{videoFiles.length}/{maxVideoFiles}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {useNativeRecording ? (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={isRecordingVideo ? stopVideoRecording : startVideoRecording}
                  variant={isRecordingVideo ? "destructive" : "default"}
                  size="lg"
                  disabled={!isRecordingVideo && videoFiles.length >= maxVideoFiles}
                  className="min-h-[48px]"
                >
                  {isRecordingVideo ? (
                    <>
                      <Square className="h-5 w-5 mr-2" />
                      Detener ({formatTime(recordingTime)})
                    </>
                  ) : (
                    <>
                      <Video className="h-5 w-5 mr-2" />
                      Grabar video
                    </>
                  )}
                </Button>
              </div>

              {(isRecordingVideo || videoReady) && (
                <div className="relative">
                  <video
                    ref={videoPreviewRef}
                    className="w-full h-48 bg-black rounded-lg object-cover"
                    playsInline
                    muted
                  />
                  {videoReady && !isRecordingVideo && 'ontouchstart' in window && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => videoPreviewRef.current?.play()}
                      >
                        <Play className="h-4 w-4 mr-2" />
                        Toca para ver vista previa
                      </Button>
                    </div>
                  )}
                  {videoReady && (
                    <div className="absolute top-2 right-2">
                      <Badge variant="default" className="bg-green-500">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Cámara lista
                      </Badge>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="video-upload" className="cursor-pointer">
                <div className="flex items-center justify-center min-h-[48px] px-4 py-2 border-2 border-dashed border-muted-foreground/25 rounded-lg hover:border-muted-foreground/50 transition-colors">
                  <Upload className="h-5 w-5 mr-2" />
                  Cargar archivo de video
                </div>
              </Label>
              <input
                id="video-upload"
                type="file"
                accept="video/*"
                capture="environment"
                multiple
                onChange={(e) => handleFileUpload(e, 'video')}
                className="hidden"
              />
            </div>
          )}

          {videoFiles.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Archivos de video:</Label>
              {videoFiles.map((videoFile, index) => (
                <div key={index} className="flex items-center gap-2 p-2 border rounded">
                  <Video className="h-4 w-4" />
                  <span className="text-sm flex-1 truncate">{videoFile.file.name}</span>
                  {videoFile.duration && (
                    <Badge variant="outline">{formatTime(videoFile.duration)}</Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(index, 'video')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Photo Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Camera className="h-5 w-5" />
            Fotos
            {photoFiles.length > 0 && (
              <Badge variant="secondary">{photoFiles.length}/{maxPhotoFiles}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="photo-upload" className="cursor-pointer">
              <div className="flex items-center justify-center min-h-[48px] px-4 py-2 border-2 border-dashed border-muted-foreground/25 rounded-lg hover:border-muted-foreground/50 transition-colors">
                <Camera className="h-5 w-5 mr-2" />
                Tomar o cargar foto
              </div>
            </Label>
            <input
              id="photo-upload"
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              onChange={(e) => handleFileUpload(e, 'photo')}
              className="hidden"
            />
          </div>

          {photoFiles.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Fotos:</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {photoFiles.map((photoFile, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={URL.createObjectURL(photoFile.file)}
                      alt={`Foto ${index + 1}`}
                      className="w-full h-24 object-cover rounded border"
                    />
                    <Button
                      variant="destructive"
                      size="sm"
                      className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0"
                      onClick={() => removeFile(index, 'photo')}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MediaRecorder;