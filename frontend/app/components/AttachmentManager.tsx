import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '@/lib/api';
import { useFileUpload } from '@/hooks/useFileUpload';
import { useAuth } from '@/context/AuthContext';

import { 
  FileText, 
  UploadCloud, 
  X, 
  Download,
  ExternalLink, 
  Trash2, 
  Image as ImageIcon,
  Loader2,
  CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";

type Attachment = {
  id: string;
  file_name: string;
  file_url: string;
  uploaded_by: string;
  created_at: string;
};

type AttachmentManagerProps = {
  incidentId: string;
  onAttachmentChange?: () => void;
};

export default function AttachmentManager({ incidentId, onAttachmentChange }: AttachmentManagerProps) {
  const { user } = useAuth();
  const { uploadFile, status, progress, error, reset } = useFileUpload();

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // 1. Fetch existing attachments
  const fetchAttachments = useCallback(async () => {
    try {
      const res = await authFetch(`/incidents/${incidentId}/attachments`);
      if (!res.ok) throw new Error("Failed to fetch attachments");
      const data = await res.json();
      setAttachments(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingList(false);
    }
  }, [incidentId]);

  useEffect(() => {
    fetchAttachments();
  }, [fetchAttachments]);

  if (!user) return null;
  const name = user.user_metadata?.full_name?.split(" ").filter((n: string) => n) || [];
  const role = user.app_metadata.role? user.app_metadata.role : "User";

  // 2. Handle Drag and Drop Events
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      await handleUpload(file);
    }
  };

  // Handle File Selection
  const onFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      await handleUpload(file);
    }
  };

  // Handle Upload Function
  const handleUpload = async (file: File) => {
    // 10MB Limit Check
    if (file.size > 10 * 1024 * 1024) {
      alert("File is too large (Max 10MB)");
      return;
    }

    await uploadFile(file, incidentId);

    // Refresh list on success
    // Note: delay slightly to ensure MinIO consistency
    setTimeout(() => {
      fetchAttachments();
      // Refresh audit log to show ATTACHMENT_UPLOAD event
      if (onAttachmentChange) onAttachmentChange();
      // Reset upload state after a short delay
      setTimeout(reset, 3000);
    }, 1000);
  };

  const handleDownload = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (e) {
      console.error("Download failed", e);
      window.open(url, "_blank");
    }
  };

  const handleDelete = async (attId: string) => {
    if(!confirm("Delete this attachment?")) return;
    setDeletingId(attId);
    
    try {
      const res = await authFetch(`/incidents/${incidentId}/attachments/${attId}`, {
        method: "DELETE"
      });
      
      if (!res.ok) throw new Error("Failed to delete attachment");
      
      setAttachments(prev => prev.filter(a => a.id !== attId));
      // Refresh audit log to show ATTACHMENT_DELETE event
      if (onAttachmentChange) onAttachmentChange();
    } catch (e) {
      console.error(e);
      alert("Failed to delete attachment");
    } finally {
      setDeletingId(null);
    }
  };

  // Helper to choose icon based on extension
  const getFileIcon = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (['png', 'jpg', 'jpeg', 'gif', 'svg'].includes(ext || '')) return <ImageIcon className="h-8 w-8 text-purple-500" />;
    if (['pdf'].includes(ext || '')) return <FileText className="h-8 w-8 text-red-500" />;
    return <FileText className="h-8 w-8 text-blue-500" />;
  };

  return (
    <div className="space-y-6">
      
      {/* --- UPLOAD AREA --- */}
      <div 
        className={`
          border-2 border-dashed rounded-lg p-8 text-center transition-colors
          ${isDragging ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:bg-slate-50"}
          ${status === "UPLOADING" || status === "SIGNING" ? "pointer-events-none opacity-50" : ""}
        `}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <div className="flex flex-col items-center gap-3">
          {status === "IDLE" || status === "SUCCESS" || status === "ERROR" ? (
            <>
              <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center">
                <UploadCloud className="h-6 w-6 text-slate-500" />
              </div>
              <div>
                <p className="font-medium text-slate-900">Click to upload or drag and drop</p>
                <p className="text-sm text-slate-500">SVG, PNG, JPG or PDF (max 10MB)</p>
              </div>
              <input 
                type="file" 
                className="hidden" 
                id="file-upload" 
                onChange={onFileSelect}
              />
              <label htmlFor="file-upload">
                <Button variant="outline" size="sm" className="mt-2 pointer-events-auto" asChild>
                  <span>Browse Files</span>
                </Button>
              </label>
            </>
          ) : (
            /* PROGRESS STATE */
            <div className="w-full max-w-xs space-y-2">
              <div className="flex justify-between text-sm font-medium">
                <span>{status === "SIGNING" ? "Preparing..." : "Uploading..."}</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {/* SUCCESS / ERROR MESSAGES */}
          {status === "SUCCESS" && (
             <div className="text-emerald-600 flex items-center gap-2 text-sm font-medium mt-2">
                <CheckCircle2 className="h-4 w-4" /> Upload Complete
             </div>
          )}
          {error && (
             <div className="text-red-600 flex items-center gap-2 text-sm font-medium mt-2">
                <X className="h-4 w-4" /> {error}
             </div>
          )}
        </div>
      </div>

      {/* --- GALLERY AREA --- */}
      <div>
        <h3 className="text-sm font-semibold text-slate-900 mb-4">
          Attachments ({attachments?.length || 0})
        </h3>
        
        {loadingList ? (
          <div className="flex items-center gap-2 text-slate-500">
             <Loader2 className="h-4 w-4 animate-spin" /> Loading files...
          </div>
        ) : attachments.length === 0 ? (
          <p className="text-sm text-slate-500 italic">No files attached yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {attachments.map((att) => (
              <Card key={att.id} className="p-3 flex items-center gap-3 group hover:border-blue-300 transition-colors">
                <div className="shrink-0">
                  {getFileIcon(att.file_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate" title={att.file_name}>
                    {att.file_name}
                  </p>
                  <p className="text-xs text-slate-500 truncate">
                    by {att.uploaded_by} • {new Date(att.created_at).toLocaleDateString()}
                  </p>
                </div>
                
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" asChild>
                    <a href={att.file_url} target="_blank" rel="noopener noreferrer" title="View">
                      <ExternalLink className="h-4 w-4 text-slate-500" />
                    </a>
                  </Button>

                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => handleDownload(att.file_url, att.file_name)}
                    className="text-green-500 hover:text-green-600 hover:bg-green-50 cursor-pointer"
                    title="Download"
                  >
                    <Download className="h-4 w-4 text-green-500" />
                  </Button>
                  
                  {(role === 'ADMIN' || name.includes(att.uploaded_by)) && (
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleDelete(att.id)}
                        disabled={deletingId === att.id}
                        className="text-red-500 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                        title="Delete"
                    >
                      {deletingId === att.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}