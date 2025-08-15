import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { 
  Mic, 
  Square, 
  Play, 
  Pause, 
  Video, 
  Camera, 
  Trash2, 
  Upload,
  FileImage
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
  
  const audioRecorderRef = useRef<MediaRecorder | null>(null);
  const videoRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  
  const { toast } = useToast();

  const updateAllFiles = useCallback((audio: MediaFile[], video: MediaFile[], photos: MediaFile[]) => {
    const allFiles = [...audio, ...video, ...photos];
    onFilesChange(allFiles);
  }, [onFilesChange]);

  const startAudioRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      
      const mediaRecorder = new (window as any).MediaRecorder(stream);
      audioRecorderRef.current = mediaRecorder;
      
      const chunks: Blob[] = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const file = new File([blob], `voice-note-${Date.now()}.webm`, { type: 'audio/webm' });
        
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
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo acceder al micrófono",
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
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' }, 
        audio: true 
      });
      videoStreamRef.current = stream;
      
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        videoPreviewRef.current.play();
      }
      
      const mediaRecorder = new (window as any).MediaRecorder(stream);
      videoRecorderRef.current = mediaRecorder;
      
      const chunks: Blob[] = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const file = new File([blob], `video-${Date.now()}.webm`, { type: 'video/webm' });
        
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
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo acceder a la cámara",
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
      
      {/* Voice Notes Section */}
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
              className="w-full"
            >
              {isRecordingAudio ? (
                <><Square className="h-4 w-4 mr-2" />Parar Grabación</>
              ) : (
                <><Mic className="h-4 w-4 mr-2" />Grabar Nota de Voz</>
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

      {/* Video Recording Section */}
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
                muted
              />
            )}
            
            <Button
              type="button"
              onClick={isRecordingVideo ? stopVideoRecording : startVideoRecording}
              disabled={!isRecordingVideo && videoFiles.length >= maxVideoFiles}
              variant={isRecordingVideo ? "destructive" : "outline"}
              className="w-full"
            >
              {isRecordingVideo ? (
                <><Square className="h-4 w-4 mr-2" />Parar Video</>
              ) : (
                <><Video className="h-4 w-4 mr-2" />Grabar Video</>
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

      {/* Photos Section */}
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
                  className="w-full"
                  disabled={photoFiles.length >= maxPhotoFiles}
                  asChild
                >
                  <span>
                    <Upload className="h-4 w-4 mr-2" />
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
                  disabled={photoFiles.length >= maxPhotoFiles}
                  asChild
                >
                  <span>
                    <Camera className="h-4 w-4" />
                  </span>
                </Button>
              </label>
            </div>
            
            {photoFiles.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {photoFiles.map((photoFile) => (
                  <div key={photoFile.id} className="relative group">
                    <img
                      src={photoFile.url}
                      alt={photoFile.name}
                      className="w-full h-24 object-cover rounded border"
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