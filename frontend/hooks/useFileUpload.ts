import { useState } from 'react';
import { authFetch } from '@/lib/api';

// The status of the file upload process
export type UploadStatus = "IDLE" | "SIGNING" | "UPLOADING" | "SAVING" | "SUCCESS" | "ERROR";

type UseFileUploadReturn = {
  uploadFile: (file: File, incidentId: string) => Promise<void>;
  status: UploadStatus;
  progress: number;
  error: string | null;
  reset: () => void;
};

export function useFileUpload(): UseFileUploadReturn {
  const [status, setStatus] = useState<UploadStatus>("IDLE");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setStatus("IDLE");
    setProgress(0);
    setError(null);
  };

  const uploadFile = async (file: File, incidentId: string) => {
    reset();

    try {
      // --- STEP 1: SIGNING ---
      setStatus("SIGNING");

      const signRes = await authFetch(`/incidents/${incidentId}/attachments/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_name: file.name, file_type: file.type }),
      });

      if (!signRes.ok) throw new Error('Failed to get presigned URL');

      const { data: presignedData, file_key: fileKey } = await signRes.json();

      // --- STEP 2: UPLOADING ---
      setStatus("UPLOADING");

      // We must construct a FormData object exactly as S3/MinIO expects
      const formData = new FormData();

      // 1. Add all the hidden fields returned by the backend (key, policy, signature, etc.)
      Object.entries(presignedData.fields).forEach(([k, v]) => {
        formData.append(k, v as string);
      });

      // 2. Add the file at the end
      formData.append('file', file);

      // Perform the upload to S3/MinIO using XMLHttpRequest so we can track progress
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percentComplete = (event.loaded / event.total) * 100;
            setProgress(Math.round(percentComplete));
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error('File upload failed'));
          }
        };

        xhr.onerror = () => reject(new Error('Network error during file upload'));

        // Open and send the request
        xhr.open('POST', presignedData.url);
        xhr.send(formData);
      });

      // --- STEP 3: CONFIRMING ---
      setStatus("SAVING");

      const confirmRes = await authFetch(`/incidents/${incidentId}/attachments/complete`, {
        method: 'POST',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file_name: file.name,
          file_key: fileKey,
        }),
      });

      if (!confirmRes.ok) throw new Error('Failed to confirm file upload');

      // Upload successful
      setStatus("SUCCESS");
      setProgress(100);
  } catch (err: any) {
      setStatus("ERROR");
      setError(err.message || 'An unknown error occurred');
    }
  };
  
  return { uploadFile, status, progress, error, reset };
}