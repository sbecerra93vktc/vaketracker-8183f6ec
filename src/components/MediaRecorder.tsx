import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
  Info
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export interface MediaFile {
  id: string;
  type: 'audio' | 'video' | 'photo';
  file: File;
  url: string;
  duration?: number;
  name: string;
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
  const [mediaSupport, setMediaSupport] = useState({
    hasMediaRecorder: false,
    hasGetUserMedia: false,
    isHttps: false,
    isSupported: false,
    errorMessage: ''
  });
  
  const audioRecorderRef = useRef<MediaRecorder | null>(null);
  const videoRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  
  const { toast } = useToast();

  // Check media capabilities on component mount
  useEffect(() => {
    const checkMediaSupport = () => {
      const isHttps = window.location.protocol === 'https:' || window.location.hostname === 'localhost';
      const hasGetUserMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
      const hasMediaRecorder = !!(window as any).MediaRecorder;
      const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isAndroid = /Android/.test(navigator.userAgent);
      
      // Enhanced mobile debugging
      console.log('🔍 ENHANCED MOBILE MEDIA DEBUG:', {
        isHttps,
        hasGetUserMedia,
        hasMediaRecorder,
        isMobile,
        isIOS,
        isAndroid,
        userAgent: navigator.userAgent,
        protocol: window.location.protocol,
        hostname: window.location.hostname,
        touchPoints: navigator.maxTouchPoints,
        screen: {
          width: screen.width,
          height: screen.height,
          orientation: screen.orientation?.type
        },
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        },
        mediaDevices: !!navigator.mediaDevices,
        constraints: {
          audio: hasGetUserMedia,
          video: hasGetUserMedia
        },
        permissions: {
          query: !!(navigator.permissions && navigator.permissions.query)
        }
      });

      // ALWAYS show fields on mobile - force true for all conditions
      setMediaSupport({
        hasMediaRecorder: true, // Force true on mobile
        hasGetUserMedia: true,  // Force true on mobile
        isHttps,
        isSupported: true,      // ALWAYS true
        errorMessage: ''
      });
    };

    checkMediaSupport();
    
    // Re-check on orientation change (mobile specific)
    const handleOrientationChange = () => {
      setTimeout(checkMediaSupport, 100);
    };
    
    window.addEventListener('orientationchange', handleOrientationChange);
    window.addEventListener('resize', handleOrientationChange);
    
    return () => {
      window.removeEventListener('orientationchange', handleOrientationChange);
      window.removeEventListener('resize', handleOrientationChange);
    };
  }, []);

  const updateAllFiles = useCallback((audio: MediaFile[], video: MediaFile[], photos: MediaFile[]) => {
    const allFiles = [...audio, ...video, ...photos];
    onFilesChange(allFiles);
  }, [onFilesChange]);

  const startAudioRecording = async () => {
    // Always attempt recording - let the browser handle any issues
    console.log('Starting audio recording...');

    try {
      console.log('Requesting audio permission for mobile...');
      
       // Mobile-optimized audio constraints
      const isMobile = 'ontouchstart' in window;
      const constraints = isMobile ? {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 22050 // Lower for mobile compatibility
        }
      } : {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        }
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      audioStreamRef.current = stream;
      
      console.log('Audio stream obtained, creating MediaRecorder...');
      
      // Try different MIME types for better mobile compatibility
      let mimeType = '';
      const MediaRecorderClass = (window as any).MediaRecorder;
      if (MediaRecorderClass && MediaRecorderClass.isTypeSupported) {
        // Prefer MP4 for better mobile compatibility and playback
        if (MediaRecorderClass.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        } else if (MediaRecorderClass.isTypeSupported('audio/webm;codecs=opus')) {
          mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorderClass.isTypeSupported('audio/webm')) {
          mimeType = 'audio/webm';
        } else if (MediaRecorderClass.isTypeSupported('audio/wav')) {
          mimeType = 'audio/wav';
        }
        // If none are supported, let browser choose
      }
      
      console.log('Selected audio MIME type:', mimeType);
      
      const options = mimeType ? { mimeType } : {};
      const mediaRecorder = new (window as any).MediaRecorder(stream, options);
      audioRecorderRef.current = mediaRecorder;
      
      const chunks: Blob[] = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType || 'audio/webm' });
        const fileExtension = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('wav') ? 'wav' : 'webm';
        const file = new File([blob], `voice-note-${Date.now()}.${fileExtension}`, { type: mimeType || 'audio/webm' });
        
        console.log('Audio recording completed:', {
          size: blob.size,
          type: blob.type,
          fileName: file.name
        });
        
        const newAudioFile: MediaFile = {
          id: Date.now().toString(),
          type: 'audio',
          file,
          url: URL.createObjectURL(blob),
          name: file.name
        };
        
        const updatedAudioFiles = [...audioFiles, newAudioFile];
        setAudioFiles(updatedAudioFiles);
        updateAllFiles(updatedAudioFiles, videoFiles, photoFiles);
        
        // Clean up stream
        stream.getTracks().forEach(track => track.stop());
        audioStreamRef.current = null;
      };
      
      mediaRecorder.start();
      setIsRecordingAudio(true);
      
      toast({
        title: "Grabando nota de voz",
        description: "Toca el botón de parar cuando termines",
      });
    } catch (error: any) {
      console.error('Audio recording error:', error);
      let errorMessage = "No se pudo acceder al micrófono";
      
      if (error.name === 'NotAllowedError') {
        errorMessage = "Permisos de micrófono denegados. Por favor, permite el acceso en la configuración del navegador.";
      } else if (error.name === 'NotFoundError') {
        errorMessage = "No se encontró micrófono disponible";
      } else if (error.name === 'NotSupportedError') {
        errorMessage = "Grabación de audio no soportada en este dispositivo";
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
    }
  };

  const startVideoRecording = async () => {
    // Always attempt recording - let the browser handle any issues
    console.log('Starting video recording...');

    try {
      console.log('Requesting video permission for mobile...');
      
       // Mobile-optimized video constraints
      const isMobile = 'ontouchstart' in window;
      const constraints = isMobile ? {
        video: { 
          facingMode: 'user',
          width: { ideal: 640, max: 1280 },
          height: { ideal: 480, max: 720 },
          frameRate: { ideal: 15, max: 30 } // Lower framerate for mobile
        }, 
        audio: {
          echoCancellation: true,
          noiseSuppression: true
        }
      } : {
        video: { 
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 }
        }, 
        audio: true
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      videoStreamRef.current = stream;
      
        if (videoPreviewRef.current) {
         console.log('🎥 Setting up video preview for mobile...');
         const video = videoPreviewRef.current;
         
         // Enhanced mobile video setup
         video.srcObject = stream;
         video.muted = true;
         video.playsInline = true;
         video.autoplay = false; // Disable autoplay on mobile initially
         video.controls = false;
         video.style.background = '#000';
         video.style.objectFit = 'cover';
         
         // Mobile-specific video attributes
         video.setAttribute('webkit-playsinline', 'true');
         video.setAttribute('playsinline', 'true');
         
         // Enhanced load handling
         const handleVideoLoad = () => {
           console.log('📹 Video metadata loaded:', {
             dimensions: `${video.videoWidth}x${video.videoHeight}`,
             readyState: video.readyState,
             duration: video.duration
           });
         };
         
         video.addEventListener('loadedmetadata', handleVideoLoad);
         video.addEventListener('canplay', () => {
           console.log('📹 Video can play');
         });
         
         // Mobile-friendly play strategy
         const isMobile = 'ontouchstart' in window;
         if (isMobile) {
           // On mobile, wait for user interaction
           video.addEventListener('loadeddata', () => {
             // Show visual feedback that video is ready
             video.style.border = '2px solid #10b981';
             console.log('📱 Mobile video ready - user can start recording');
           });
         } else {
           // Desktop autoplay
           const playPromise = video.play();
           if (playPromise !== undefined) {
             playPromise.then(() => {
               console.log('✅ Desktop video preview playing');
             }).catch(error => {
               console.warn('⚠️ Desktop autoplay failed:', error);
             });
           }
         }
       }
      
      // Try different video MIME types for better compatibility
      let videoMimeType = '';
      const MediaRecorderClass = (window as any).MediaRecorder;
      if (MediaRecorderClass && MediaRecorderClass.isTypeSupported) {
        // Prefer MP4 for better mobile compatibility and playback
        if (MediaRecorderClass.isTypeSupported('video/mp4')) {
          videoMimeType = 'video/mp4';
        } else if (MediaRecorderClass.isTypeSupported('video/webm;codecs=vp8')) {
          videoMimeType = 'video/webm;codecs=vp8';
        } else if (MediaRecorderClass.isTypeSupported('video/webm')) {
          videoMimeType = 'video/webm';
        }
        // If none are supported, let browser choose
      }
      
      const videoOptions = videoMimeType ? { mimeType: videoMimeType } : {};
      const mediaRecorder = new (window as any).MediaRecorder(stream, videoOptions);
      videoRecorderRef.current = mediaRecorder;
      
      const chunks: Blob[] = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: videoMimeType || 'video/webm' });
        const fileExtension = videoMimeType.includes('mp4') ? 'mp4' : 'webm';
        const file = new File([blob], `video-${Date.now()}.${fileExtension}`, { type: videoMimeType || 'video/webm' });
        
        console.log('Video recording completed:', {
          size: blob.size,
          type: blob.type,
          fileName: file.name
        });
        
        const newVideoFile: MediaFile = {
          id: Date.now().toString(),
          type: 'video',
          file,
          url: URL.createObjectURL(blob),
          name: file.name
        };
        
        const updatedVideoFiles = [...videoFiles, newVideoFile];
        setVideoFiles(updatedVideoFiles);
        updateAllFiles(audioFiles, updatedVideoFiles, photoFiles);
        
        // Clean up stream
        stream.getTracks().forEach(track => track.stop());
        videoStreamRef.current = null;
        
        if (videoPreviewRef.current) {
          videoPreviewRef.current.srcObject = null;
        }
      };
      
      mediaRecorder.start();
      setIsRecordingVideo(true);
      
      toast({
        title: "Grabando video",
        description: "Toca el botón de parar cuando termines",
      });
    } catch (error: any) {
      console.error('Video recording error:', error);
      let errorMessage = "No se pudo acceder a la cámara";
      
      if (error.name === 'NotAllowedError') {
        errorMessage = "Permisos de cámara denegados. Por favor, permite el acceso en la configuración del navegador.";
      } else if (error.name === 'NotFoundError') {
        errorMessage = "No se encontró cámara disponible";
      } else if (error.name === 'NotSupportedError') {
        errorMessage = "Grabación de video no soportada en este dispositivo";
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
    }
  };

  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      if (photoFiles.length >= maxPhotoFiles) {
        toast({
          variant: "destructive",
          title: "Límite alcanzado",
          description: `Máximo ${maxPhotoFiles} fotos permitidas`,
        });
        return;
      }

      const newPhotoFile: MediaFile = {
        id: Date.now().toString() + Math.random(),
        type: 'photo',
        file,
        url: URL.createObjectURL(file),
        name: file.name
      };

      const updatedPhotoFiles = [...photoFiles, newPhotoFile];
      setPhotoFiles(updatedPhotoFiles);
      updateAllFiles(audioFiles, videoFiles, updatedPhotoFiles);
    });
  };

  const playAudio = (audioFile: MediaFile) => {
    if (playingAudio === audioFile.id) {
      audioPlayerRef.current?.pause();
      setPlayingAudio(null);
    } else {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.src = audioFile.url;
        audioPlayerRef.current.play();
        setPlayingAudio(audioFile.id);
        
        audioPlayerRef.current.onended = () => setPlayingAudio(null);
      }
    }
  };

  const removeFile = (fileId: string, type: 'audio' | 'video' | 'photo') => {
    if (type === 'audio') {
      const updated = audioFiles.filter(f => f.id !== fileId);
      setAudioFiles(updated);
      updateAllFiles(updated, videoFiles, photoFiles);
    } else if (type === 'video') {
      const updated = videoFiles.filter(f => f.id !== fileId);
      setVideoFiles(updated);
      updateAllFiles(audioFiles, updated, photoFiles);
    } else {
      const updated = photoFiles.filter(f => f.id !== fileId);
      setPhotoFiles(updated);
      updateAllFiles(audioFiles, videoFiles, updated);
    }
  };

  return (
    <div className="space-y-6">
      <audio ref={audioPlayerRef} />
      
      {/* Only show warning for HTTPS issues */}
      {!mediaSupport.isHttps && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            Las funciones de grabación requieren una conexión segura (HTTPS).
          </AlertDescription>
        </Alert>
      )}
      
      {/* Debug info for mobile testing */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription className="text-xs">
          📱 Estado: Audio {mediaSupport.hasMediaRecorder ? '✅' : '❌'} | Video {mediaSupport.hasGetUserMedia ? '✅' : '❌'} | HTTPS {mediaSupport.isHttps ? '✅' : '❌'}
          <br />
          <span className="text-[10px] opacity-70">
            📲 Dispositivo: {'ontouchstart' in window ? 'Táctil' : 'No táctil'} | 
            🖐️ Touch: {navigator.maxTouchPoints || 0} | 
            📐 {window.innerWidth}x{window.innerHeight}
          </span>
          <br />
          <span className="text-[8px] opacity-50">
            🌐 {navigator.userAgent.slice(0, 80)}...
          </span>
        </AlertDescription>
      </Alert>
      
      {/* Voice Notes Section - Always show */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <Label className="text-sm font-medium">Notas de Voz</Label>
            <Badge variant="outline">
              {audioFiles.length}/{maxAudioFiles}
            </Badge>
          </div>
          
          <div className="space-y-3">
            <Button
              type="button"
              onClick={isRecordingAudio ? stopAudioRecording : startAudioRecording}
              disabled={!isRecordingAudio && audioFiles.length >= maxAudioFiles}
              variant={isRecordingAudio ? "destructive" : "outline"}
              className="w-full text-base py-3 min-h-[48px]" // Better mobile touch target
              size="lg"
            >
              {isRecordingAudio ? (
                <><Square className="h-5 w-5 mr-2" />Parar Grabación</>
              ) : (
                <><Mic className="h-5 w-5 mr-2" />Grabar Nota de Voz</>
              )}
            </Button>
            
            {audioFiles.length > 0 && (
              <div className="space-y-2">
                {audioFiles.map((audioFile) => (
                  <div key={audioFile.id} className="flex items-center gap-2 p-2 border rounded">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => playAudio(audioFile)}
                    >
                      {playingAudio === audioFile.id ? 
                        <Pause className="h-4 w-4" /> : 
                        <Play className="h-4 w-4" />
                      }
                    </Button>
                    <span className="text-sm flex-1 truncate">{audioFile.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(audioFile.id, 'audio')}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Video Recording Section - Always show */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <Label className="text-sm font-medium">Videos</Label>
            <Badge variant="outline">
              {videoFiles.length}/{maxVideoFiles}
            </Badge>
          </div>
          
          <div className="space-y-3">
             {isRecordingVideo && (
               <video 
                 ref={videoPreviewRef}
                 className="w-full h-48 bg-black rounded-lg"
                 autoPlay
                 muted
                 playsInline
               />
             )}
            
            <Button
              type="button"
              onClick={isRecordingVideo ? stopVideoRecording : startVideoRecording}
              disabled={!isRecordingVideo && videoFiles.length >= maxVideoFiles}
              variant={isRecordingVideo ? "destructive" : "outline"}
              className="w-full text-base py-3 min-h-[48px]" // Better mobile touch target
              size="lg"
            >
              {isRecordingVideo ? (
                <><Square className="h-5 w-5 mr-2" />Parar Video</>
              ) : (
                <><Video className="h-5 w-5 mr-2" />Grabar Video</>
              )}
            </Button>
            
            {videoFiles.length > 0 && (
              <div className="space-y-2">
                {videoFiles.map((videoFile) => (
                  <div key={videoFile.id} className="flex items-center gap-2 p-2 border rounded">
                    <Video className="h-4 w-4" />
                    <span className="text-sm flex-1 truncate">{videoFile.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(videoFile.id, 'video')}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Photos Section - Always works */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <Label className="text-sm font-medium">Fotos del Negocio</Label>
            <Badge variant="outline">
              {photoFiles.length}/{maxPhotoFiles}
            </Badge>
          </div>
          
          <div className="space-y-3">
            <div className="flex gap-2">
              <label className="flex-1">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoUpload}
                  className="hidden"
                  disabled={photoFiles.length >= maxPhotoFiles}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="w-full text-base py-3 min-h-[48px]" // Better mobile touch target
                  disabled={photoFiles.length >= maxPhotoFiles}
                  asChild
                  size="lg"
                >
                  <span>
                    <Upload className="h-5 w-5 mr-2" />
                    Subir Fotos
                  </span>
                </Button>
              </label>
              
              <label>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoUpload}
                  className="hidden"
                  disabled={photoFiles.length >= maxPhotoFiles}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-[48px] px-4" // Better mobile touch target
                  disabled={photoFiles.length >= maxPhotoFiles}
                  asChild
                  size="lg"
                >
                  <span>
                    <Camera className="h-5 w-5" />
                  </span>
                </Button>
              </label>
            </div>
            
            {photoFiles.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {photoFiles.map((photoFile) => (
                  <div key={photoFile.id} className="relative group">
                    <img
                      src={photoFile.url}
                      alt={photoFile.name}
                      className="w-full h-20 md:h-24 lg:h-28 object-cover rounded border"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removeFile(photoFile.id, 'photo')}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MediaRecorder;