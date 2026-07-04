import { useState, useRef, useCallback, type DragEvent, type ChangeEvent } from 'react';
import { UploadCloud, X, FileText, Image as ImageIcon, Camera } from 'lucide-react';
import clsx from 'clsx';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface UploadedFile {
  id: string;
  file: File;
  preview?: string;
  progress: number;
}

interface FileUploadProps {
  accept?: string;
  multiple?: boolean;
  maxSizeMB?: number;
  onChange?: (files: UploadedFile[]) => void;
  className?: string;
  // When true, shows a "Use Camera" button alongside the drop zone.
  // On mobile the camera input opens the rear camera directly
  // (capture="environment") so franchisees can shoot the DR / crate
  // photo in-app; on desktop it falls back to the file picker.
  camera?: boolean;
}

let fileIdCounter = 0;

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function FileUpload({
  accept,
  multiple = false,
  maxSizeMB = 10,
  onChange,
  className,
  camera = false,
}: FileUploadProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const simulateProgress = useCallback((entry: UploadedFile, allFiles: UploadedFile[]) => {
    let prog = 0;
    const interval = setInterval(() => {
      prog += Math.random() * 30 + 10;
      if (prog >= 100) {
        prog = 100;
        clearInterval(interval);
      }
      setFiles((prev) => {
        const next = prev.map((f) => (f.id === entry.id ? { ...f, progress: Math.min(prog, 100) } : f));
        return next;
      });
    }, 200);
    // Notify parent after "upload" completes
    setTimeout(() => {
      onChange?.(allFiles.map((f) => ({ ...f, progress: 100 })));
    }, 1500);
  }, [onChange]);

  const addFiles = useCallback(
    (incoming: FileList | File[]) => {
      const arr = Array.from(incoming);
      const valid = arr.filter((f) => f.size <= maxSizeMB * 1024 * 1024);

      const newEntries: UploadedFile[] = valid.map((file) => {
        const id = `file-${++fileIdCounter}`;
        const isImage = file.type.startsWith('image/');
        return {
          id,
          file,
          preview: isImage ? URL.createObjectURL(file) : undefined,
          progress: 0,
        };
      });

      setFiles((prev) => {
        const combined = multiple ? [...prev, ...newEntries] : newEntries;
        newEntries.forEach((entry) => simulateProgress(entry, combined));
        return combined;
      });
    },
    [maxSizeMB, multiple, simulateProgress]
  );

  const removeFile = useCallback(
    (id: string) => {
      setFiles((prev) => {
        const target = prev.find((f) => f.id === id);
        if (target?.preview) URL.revokeObjectURL(target.preview);
        const next = prev.filter((f) => f.id !== id);
        onChange?.(next);
        return next;
      });
    },
    [onChange]
  );

  /* Drag handlers */
  const onDragOver = (e: DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };
  const onDragLeave = () => setDragging(false);
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  };

  const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) addFiles(e.target.files);
    e.target.value = '';
  };

  return (
    <div className={clsx('flex flex-col gap-3', className)}>
      {/* Drop zone */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={clsx(
          'flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 cursor-pointer transition-colors',
          dragging
            ? 'border-zapp-orange bg-orange-50'
            : 'border-gray-300 bg-gray-50 hover:border-zapp-orange/60 hover:bg-orange-50/40'
        )}
        role="button"
        tabIndex={0}
        aria-label="Upload files"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
        }}
      >
        <UploadCloud size={32} className="text-gray-400" />
        <p className="text-sm text-gray-600">
          <span className="font-semibold text-zapp-orange">Click to upload</span> or drag and drop
        </p>
        <p className="text-xs text-gray-400">
          {accept ? `Accepted: ${accept}` : 'Any file type'} &middot; Max {maxSizeMB}MB
        </p>
      </div>

      {/* Camera capture — opt-in. On phones this opens the rear camera
          directly; on desktop it behaves like a normal file picker. */}
      {camera && (
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:border-zapp-orange/60 hover:bg-orange-50/40 transition-colors cursor-pointer"
        >
          <Camera size={16} className="text-zapp-orange" /> Use Camera
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={onInputChange}
        className="sr-only"
        tabIndex={-1}
      />

      {camera && (
        <input
          ref={cameraInputRef}
          type="file"
          accept={accept ?? 'image/*'}
          capture="environment"
          onChange={onInputChange}
          className="sr-only"
          tabIndex={-1}
        />
      )}

      {/* File list */}
      {files.length > 0 && (
        <ul className="flex flex-col gap-2">
          {files.map((entry) => (
            <li
              key={entry.id}
              className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-3"
            >
              {/* Preview / icon */}
              {entry.preview ? (
                <img
                  src={entry.preview}
                  alt={entry.file.name}
                  className="w-10 h-10 rounded object-cover shrink-0"
                />
              ) : (
                <span className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center shrink-0">
                  {entry.file.type.startsWith('image/') ? (
                    <ImageIcon size={18} className="text-gray-400" />
                  ) : (
                    <FileText size={18} className="text-gray-400" />
                  )}
                </span>
              )}

              {/* Info + progress */}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800 truncate">{entry.file.name}</p>
                <p className="text-xs text-gray-400">
                  {(entry.file.size / 1024).toFixed(1)} KB
                </p>
                {entry.progress < 100 && (
                  <div className="mt-1 h-1 w-full rounded-full bg-gray-200 overflow-hidden">
                    <div
                      className="h-full bg-zapp-orange rounded-full transition-all duration-300"
                      style={{ width: `${entry.progress}%` }}
                    />
                  </div>
                )}
              </div>

              {/* Remove */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile(entry.id);
                }}
                className="p-1 rounded text-gray-400 hover:text-red-500 transition-colors shrink-0"
                aria-label={`Remove ${entry.file.name}`}
              >
                <X size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
