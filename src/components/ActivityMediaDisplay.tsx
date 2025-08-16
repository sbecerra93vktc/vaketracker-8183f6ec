import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  FileImage, 
  Video, 
  Mic,
  ExternalLink,
  Eye
} from 'lucide-react';

interface ActivityFile {
  id: string;
  activity_id: string;
  file_type: 'photo' | 'video' | 'audio';
  file_path: string;
  file_name: string;
  file_size: number;
  duration?: number;
  created_at: string;
  user_id: string;
}

interface ActivityMediaDisplayProps {
  activityId: string;
  activityAddress?: string;
}

const ActivityMediaDisplay: React.FC<ActivityMediaDisplayProps> = ({ 
  activityId, 
  activityAddress 
}) => {
  const [files, setFiles] = useState<ActivityFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { userRole } = useAuth();

  useEffect(() => {
    fetchActivityFiles();
  }, [activityId]);

  const fetchActivityFiles = async () => {
    try {
      const { data, error } = await supabase
        .from('activity_files')
        .select('*')
        .eq('activity_id', activityId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFiles((data || []).map(file => ({
        ...file,
        file_type: file.file_type as 'photo' | 'video' | 'audio'
      })));
    } catch (error) {
      console.error('Error fetching activity files:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFileUrl = async (filePath: string, fileType: 'photo' | 'video' | 'audio') => {
    let bucket;
    switch (fileType) {
      case 'photo':
        bucket = 'activity-photos';
        break;
      case 'video':
        bucket = 'activity-videos';
        break;
      case 'audio':
        bucket = 'activity-audio';
        break;
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
    return data.publicUrl;
  };

  const playAudio = async (file: ActivityFile) => {
    if (playingAudio === file.id) {
      audioRef.current?.pause();
      setPlayingAudio(null);
    } else {
      try {
        const url = await getFileUrl(file.file_path, 'audio');
        if (audioRef.current) {
          audioRef.current.src = url;
          audioRef.current.play();
          setPlayingAudio(file.id);
          
          audioRef.current.onended = () => setPlayingAudio(null);
        }
      } catch (error) {
        console.error('Error playing audio:', error);
      }
    }
  };

  const audioFiles = files.filter(f => f.file_type === 'audio');
  const videoFiles = files.filter(f => f.file_type === 'video');
  const photoFiles = files.filter(f => f.file_type === 'photo');

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="text-center text-muted-foreground">
            Cargando archivos...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (files.length === 0) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="text-center text-muted-foreground">
            No hay archivos multimedia para esta actividad
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <audio ref={audioRef} />
      
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Archivos Multimedia
            {activityAddress && (
              <div className="text-xs text-muted-foreground font-normal mt-1">
                {activityAddress}
              </div>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Audio Files */}
          {audioFiles.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Mic className="h-4 w-4 text-warning" />
                <span className="text-sm font-medium">Notas de Voz</span>
                <Badge variant="outline">{audioFiles.length}</Badge>
              </div>
              <div className="space-y-2 pl-6">
                {audioFiles.map((file) => (
                  <div key={file.id} className="flex items-center gap-2 p-2 border rounded">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => playAudio(file)}
                    >
                      {playingAudio === file.id ? 
                        <Pause className="h-4 w-4" /> : 
                        <Play className="h-4 w-4" />
                      }
                    </Button>
                    <div className="flex-1">
                      <div className="text-sm font-medium">{file.file_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(file.created_at).toLocaleString()}
                        {file.duration && ` • ${Math.round(file.duration)}s`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Video Files */}
          {videoFiles.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Video className="h-4 w-4 text-warning" />
                <span className="text-sm font-medium">Videos</span>
                <Badge variant="outline">{videoFiles.length}</Badge>
              </div>
              <div className="space-y-2 pl-6">
                {videoFiles.map((file) => (
                  <div key={file.id} className="space-y-2">
                    <div className="text-sm font-medium">{file.file_name}</div>
                    <video 
                      controls 
                      className="w-full max-h-48 rounded border"
                      src={`${supabase.storage.from('activity-videos').getPublicUrl(file.file_path).data.publicUrl}`}
                    />
                    <div className="text-xs text-muted-foreground">
                      {new Date(file.created_at).toLocaleString()}
                      {file.duration && ` • ${Math.round(file.duration)}s`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Photo Files */}
          {photoFiles.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <FileImage className="h-4 w-4 text-warning" />
                <span className="text-sm font-medium">Fotos</span>
                <Badge variant="outline">{photoFiles.length}</Badge>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 pl-6">
                {photoFiles.map((file) => (
                  <div key={file.id} className="relative group">
                    <img
                      src={`${supabase.storage.from('activity-photos').getPublicUrl(file.file_path).data.publicUrl}`}
                      alt={file.file_name}
                      className="w-full h-20 md:h-24 lg:h-28 object-cover rounded border cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => setSelectedPhoto(`${supabase.storage.from('activity-photos').getPublicUrl(file.file_path).data.publicUrl}`)}
                      loading="lazy"
                    />
                    <div className="absolute bottom-1 left-1 right-1">
                      <div className="text-xs bg-black/50 text-white px-1 py-0.5 rounded truncate">
                        {file.file_name}
                      </div>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => setSelectedPhoto(`${supabase.storage.from('activity-photos').getPublicUrl(file.file_path).data.publicUrl}`)}
                    >
                      <Eye className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Photo Modal */}
      {selectedPhoto && (
        <div 
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-2 md:p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <div className="relative w-full h-full max-w-4xl max-h-[95vh] flex items-center justify-center">
            <img
              src={selectedPhoto}
              alt="Photo preview"
              className="max-w-full max-h-full object-contain rounded"
            />
            <Button
              variant="secondary"
              className="absolute top-2 right-2 z-10"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedPhoto(null);
              }}
            >
              ✕
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActivityMediaDisplay;