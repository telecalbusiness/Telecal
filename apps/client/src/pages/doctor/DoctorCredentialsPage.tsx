import React, { useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Upload, FileText, CheckCircle2, AlertCircle, X, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiGet } from '@/services/api';
import { Button } from '@/components/common/Button';
import { Card, Badge } from '@/components/common/index';
import { formatDateTime } from '@/utils';

interface Credential {
  id: string;
  fileName: string;
  fileType: string;
  fileSizeBytes: number;
  uploadedAt: string;
}

export const DoctorCredentialsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [dragOver, setDragOver] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  const { data: credentials, isLoading } = useQuery({
    queryKey: ['doctor-credentials'],
    queryFn: () => apiGet<Credential[]>('/doctors/me/credentials'),
    staleTime: 30_000,
  });

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    const allowed = ['application/pdf', 'image/jpeg', 'image/png'];
    const valid = Array.from(files).filter((f) => {
      if (!allowed.includes(f.type)) {
        toast.error(`${f.name}: only PDF, JPEG, PNG allowed`);
        return false;
      }
      if (f.size > 10 * 1024 * 1024) {
        toast.error(`${f.name}: file too large (max 10MB)`);
        return false;
      }
      return true;
    });
    setSelectedFiles((prev) => [...prev, ...valid].slice(0, 5));
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  const uploadFiles = async () => {
    if (!selectedFiles.length) return;
    setUploading(true);
    try {
      const formData = new FormData();
      selectedFiles.forEach((f) => formData.append('credentials', f));

      const response = await fetch('/api/v1/doctors/me/credentials', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const err = await response.json() as { error?: { message?: string } };
        throw new Error(err.error?.message ?? 'Upload failed');
      }

      toast.success(`${selectedFiles.length} file(s) uploaded`);
      setSelectedFiles([]);
      void queryClient.invalidateQueries({ queryKey: ['doctor-credentials'] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="page-container py-6 animate-fade-in">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-[var(--text-primary)] tracking-tight">
          Verification documents
        </h1>
        <p className="text-sm text-[var(--text-muted)] mt-0.5">
          Upload your medical license and supporting credentials for admin review
        </p>
      </div>

      {/* Status banner */}
      <Card className="mb-5 border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/10" padding="md">
        <div className="flex items-start gap-3">
          <Clock size={18} className="text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-yellow-800 dark:text-yellow-400">
              Pending verification
            </p>
            <p className="text-xs text-yellow-700/80 dark:text-yellow-500/80 mt-0.5 leading-relaxed">
              Upload your medical license, specialty certificate, and any supporting documents.
              Our admin team will review them within 24–48 hours and notify you by email.
            </p>
          </div>
        </div>
      </Card>

      {/* Drop zone */}
      <Card padding="none" className="mb-4 overflow-hidden">
        <label
          className={`block p-8 text-center cursor-pointer transition-all border-2 border-dashed rounded-xl ${
            dragOver
              ? 'border-brand-400 bg-brand-50 dark:bg-brand-900/20'
              : 'border-[var(--border)] hover:border-brand-300 hover:bg-[var(--surface-2)]'
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <input
            type="file"
            className="sr-only"
            multiple
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <div className="w-12 h-12 rounded-xl bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center mx-auto mb-3">
            <Upload size={22} className="text-brand-600 dark:text-brand-400" />
          </div>
          <p className="font-medium text-[var(--text-primary)] text-sm">
            Drop files here or click to browse
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            PDF, JPEG, PNG · Max 10MB per file · Up to 5 files
          </p>
        </label>
      </Card>

      {/* Selected files preview */}
      {selectedFiles.length > 0 && (
        <div className="space-y-2 mb-4">
          <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">
            Ready to upload ({selectedFiles.length})
          </p>
          {selectedFiles.map((file, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-[var(--surface-2)]">
              <FileText size={16} className="text-brand-600 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--text-primary)] truncate">{file.name}</p>
                <p className="text-xs text-[var(--text-muted)]">
                  {(file.size / 1024).toFixed(0)} KB · {file.type}
                </p>
              </div>
              <button
                onClick={() => setSelectedFiles((prev) => prev.filter((_, j) => j !== i))}
                className="text-[var(--text-muted)] hover:text-red-500 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          ))}
          <Button
            className="w-full"
            loading={uploading}
            leftIcon={<Upload size={14} />}
            onClick={() => void uploadFiles()}
          >
            Upload {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''}
          </Button>
        </div>
      )}

      {/* Already uploaded */}
      <div>
        <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide mb-3">
          Uploaded credentials ({isLoading ? '…' : (credentials?.length ?? 0)})
        </p>
        {!isLoading && !credentials?.length ? (
          <div className="text-center py-8 text-[var(--text-muted)]">
            <AlertCircle size={24} className="mx-auto mb-2" />
            <p className="text-sm">No credentials uploaded yet</p>
            <p className="text-xs mt-1">Upload at least your medical license to proceed</p>
          </div>
        ) : (
          <div className="space-y-2">
            {credentials?.map((cred) => (
              <div key={cred.id} className="flex items-center gap-3 p-3 rounded-xl bg-[var(--surface-0)] border border-[var(--border)]">
                <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/20 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 size={15} className="text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--text-primary)] truncate">{cred.fileName}</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {cred.fileType} · {(cred.fileSizeBytes / 1024).toFixed(0)} KB ·{' '}
                    Uploaded {formatDateTime(cred.uploadedAt)}
                  </p>
                </div>
                <Badge variant="success">Uploaded</Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
