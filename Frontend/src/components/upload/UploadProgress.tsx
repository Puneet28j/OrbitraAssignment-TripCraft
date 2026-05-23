interface UploadProgressProps {
  progress: number;
  status?: 'uploading' | 'processing' | 'ready' | 'failed';
  error?: string;
}

export const UploadProgress = ({ progress, status = 'uploading', error }: UploadProgressProps) => {
  const isFailed = status === 'failed';
  const isSuccess = status === 'ready';
  const isProcessing = status === 'processing';

  let barColorClass = 'bg-primary';
  if (isFailed) barColorClass = 'bg-destructive';
  if (isSuccess) barColorClass = 'bg-success';
  if (isProcessing) barColorClass = 'bg-primary animate-pulse';

  return (
    <div className="w-full space-y-1.5">
      <div className="flex items-center justify-between text-xs font-medium">
        <span className="text-secondary">
          {isFailed && 'Upload failed'}
          {isSuccess && 'Completed'}
          {isProcessing && 'Extracting text...'}
          {status === 'uploading' && `Uploading (${progress}%)`}
        </span>
        <span className={isFailed ? 'text-destructive' : 'text-primary'}>
          {isFailed ? 'Error' : `${progress}%`}
        </span>
      </div>
      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ease-out ${barColorClass}`}
          style={{ width: `${progress}%` }}
        />
      </div>
      {isFailed && error && (
        <p className="text-[10px] text-destructive leading-normal mt-0.5">{error}</p>
      )}
    </div>
  );
};

export default UploadProgress;
