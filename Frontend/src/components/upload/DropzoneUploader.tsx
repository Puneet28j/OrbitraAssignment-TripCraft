import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, AlertCircle } from 'lucide-react';
import { formatFileSize } from '../../lib/formatters';

interface DropzoneUploaderProps {
  onFilesAccepted: (files: File[]) => void;
  maxFiles?: number;
  maxSize?: number;
  accept?: Record<string, string[]>;
  disabled?: boolean;
}

export const DropzoneUploader = ({
  onFilesAccepted,
  maxFiles = 10,
  maxSize = 10 * 1024 * 1024,
  accept = {
    'application/pdf': ['.pdf'],
    'image/jpeg': ['.jpeg', '.jpg'],
    'image/png': ['.png'],
    'image/webp': ['.webp'],
  },
  disabled = false,
}: DropzoneUploaderProps) => {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        onFilesAccepted(acceptedFiles);
      }
    },
    [onFilesAccepted]
  );

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop,
    maxFiles,
    maxSize,
    accept,
    disabled,
  });

  return (
    <div className="w-full space-y-4">
      <div
        {...getRootProps()}
        className={`interactive border-2 border-dashed rounded-xl p-6 sm:p-10 flex flex-col items-center justify-center text-center cursor-pointer outline-none ${
          isDragActive
            ? 'border-accent-border bg-accent-subtle/30 scale-[0.99]'
            : 'border-border hover:border-accent-border/50 bg-card/40'
        } ${disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}
      >
        <input {...getInputProps()} />
        <div className="relative mb-3 flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-muted border border-border">
          <UploadCloud className={`h-6 w-6 sm:h-7 sm:w-7 transition duration-normal ${isDragActive ? 'text-primary' : 'text-muted-foreground'}`} />
        </div>
        <div className="space-y-1.5 max-w-sm">
          <p className="text-sm font-medium text-foreground">
            {isDragActive ? 'Drop the files here...' : 'Drag & drop travel documents here'}
          </p>
          <p className="text-xs text-muted leading-normal">
            or <span className="text-accent font-medium hover:underline">browse files</span> from your device
          </p>
        </div>
        <div className="divider max-w-xs opacity-50" />
        <p className="text-[10px] text-muted tracking-wide uppercase font-mono">
          PDF, JPEG, PNG, WebP · Max {maxFiles} files · Up to {formatFileSize(maxSize)} each
        </p>
      </div>

      {fileRejections.length > 0 && (
        <div className="p-3 text-xs rounded-md bg-destructive/10 border border-destructive/20 text-destructive space-y-1">
          <div className="flex items-center gap-1.5 font-medium mb-1">
            <AlertCircle className="h-4 w-4" />
            <span>Some files were rejected:</span>
          </div>
          <ul className="list-disc pl-5 space-y-0.5">
            {fileRejections.map(({ file, errors: rejErrors }) => (
              <li key={file.name}>
                <span className="font-medium">{file.name}</span>:{' '}
                {rejErrors.map((e) => e.message).join(', ')}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default DropzoneUploader;
