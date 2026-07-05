'use client'
import { useState, useCallback, useRef, useEffect } from 'react'
import Image from 'next/image'
import imageCompression from 'browser-image-compression'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, rectSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

type PhotoStatus = 'pending' | 'compressing' | 'uploading' | 'done' | 'error'

interface PhotoItem {
  id:         string
  file?:      File
  url?:       string       // final Cloudinary URL
  previewUrl: string       // local blob URL for display
  progress:   number       // 0-100
  status:     PhotoStatus
  error?:     string
}

export interface BulkPhotoUploadProps {
  existingImages?: string[]
  onChange:        (urls: string[], isUploading: boolean) => void
  maxPhotos?:      number
}

async function compressAndUpload(
  file:       File,
  onProgress: (p: number) => void,
): Promise<string> {
  onProgress(5)
  const compressed = await imageCompression(file, {
    maxSizeMB:        1.5,
    maxWidthOrHeight: 1920,
    useWebWorker:     true,
    onProgress:       p => onProgress(5 + Math.round(p * 0.45)),
  })
  onProgress(52)
  const fd = new FormData()
  fd.append('file', compressed, file.name)
  const res = await fetch('/api/v1/upload/listing', { method: 'POST', body: fd })
  onProgress(96)
  const data = await res.json() as { url?: string; error?: string }
  if (!data.url) throw new Error(data.error ?? 'Upload ilishindwa')
  return data.url
}

export function BulkPhotoUpload({
  existingImages = [],
  onChange,
  maxPhotos = 15,
}: BulkPhotoUploadProps) {
  const [photos, setPhotos] = useState<PhotoItem[]>(() =>
    existingImages.map((url, i) => ({
      id:         `existing-${i}`,
      url,
      previewUrl: url,
      progress:   100,
      status:     'done' as PhotoStatus,
    }))
  )
  const [isDragOver, setIsDragOver] = useState(false)
  const [addError, setAddError]     = useState('')
  const fileRef     = useRef<HTMLInputElement>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    const urls      = photos.filter(p => p.status === 'done' && p.url).map(p => p.url!)
    const uploading = photos.some(p => p.status !== 'done' && p.status !== 'error')
    onChangeRef.current(urls, uploading)
  }, [photos])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  )

  function patchPhoto(id: string, patch: Partial<PhotoItem>) {
    setPhotos(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p))
  }

  async function uploadOne(item: PhotoItem) {
    if (!item.file) return
    patchPhoto(item.id, { status: 'compressing', progress: 5 })
    try {
      const url = await compressAndUpload(item.file, p =>
        patchPhoto(item.id, { status: p >= 52 ? 'uploading' : 'compressing', progress: p })
      )
      patchPhoto(item.id, { status: 'done', progress: 100, url })
    } catch (err: unknown) {
      patchPhoto(item.id, {
        status: 'error',
        error:  err instanceof Error ? err.message : 'Imeshindwa',
      })
    }
  }

  const addFiles = useCallback((rawFiles: File[]) => {
    const images = rawFiles.filter(f => f.type.startsWith('image/'))
    if (!images.length) return
    setAddError('')

    const sized = images.filter(f => {
      if (f.size > 20 * 1024 * 1024) {
        setAddError(`"${f.name}" ni kubwa mno (max 20MB kwa kila picha)`)
        return false
      }
      return true
    })
    if (!sized.length) return

    // Build new items — assigned inside updater so they match committed state
    let newItems: PhotoItem[] = []

    setPhotos(prev => {
      const canAdd = Math.max(0, maxPhotos - prev.length)
      if (!canAdd) {
        setAddError(`Unaweza kupakia picha ${maxPhotos} tu kwa jumla`)
        return prev
      }
      newItems = sized.slice(0, canAdd).map(file => ({
        id:         `new-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        previewUrl: URL.createObjectURL(file),
        progress:   0,
        status:     'pending' as PhotoStatus,
      }))
      return [...prev, ...newItems]
    })

    // Start uploads after React commits the state update
    setTimeout(() => {
      Promise.all(newItems.map(item => uploadOne(item)))
    }, 0)
  }, [maxPhotos]) // eslint-disable-line react-hooks/exhaustive-deps

  function removePhoto(id: string) {
    setPhotos(prev => prev.filter(p => p.id !== id))
  }

  function retryPhoto(item: PhotoItem) {
    patchPhoto(item.id, { status: 'pending', progress: 0, error: undefined })
    uploadOne(item)
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    setPhotos(prev =>
      arrayMove(
        prev,
        prev.findIndex(p => p.id === active.id),
        prev.findIndex(p => p.id === over.id),
      )
    )
  }

  const doneCount    = photos.filter(p => p.status === 'done').length
  const loadingCount = photos.filter(p => p.status !== 'done' && p.status !== 'error').length
  const errorCount   = photos.filter(p => p.status === 'error').length

  return (
    <div className="space-y-3">

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setIsDragOver(true) }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={e => {
          e.preventDefault()
          setIsDragOver(false)
          addFiles(Array.from(e.dataTransfer.files))
        }}
        onClick={() => fileRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
          isDragOver
            ? 'border-primary-500 bg-primary-50'
            : 'border-gray-200 hover:border-gray-300 bg-gray-50'
        }`}
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={e => {
            if (e.target.files?.length) {
              addFiles(Array.from(e.target.files))
              e.target.value = ''
            }
          }}
        />
        <i className="ti ti-camera text-3xl mb-1.5 text-gray-400" aria-hidden="true" />
        <p className="text-sm font-medium text-gray-700">
          Buruta picha hapa au{' '}
          <span className="text-primary-600 underline">bonyeza kuchagua</span>
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Chagua picha nyingi kwa pamoja · Max {maxPhotos} picha · PNG, JPG
        </p>
      </div>

      {/* Validation error */}
      {addError && (
        <p className="text-xs text-red-500 flex items-center gap-1 -mt-1">
          <i className="ti ti-alert-triangle" aria-hidden="true" /> {addError}
        </p>
      )}

      {/* Status line */}
      {photos.length > 0 && (
        <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-xs">
          <span className="text-gray-500">{photos.length}/{maxPhotos} picha</span>
          {loadingCount > 0 && (
            <span className="flex items-center gap-1 text-blue-600">
              <span className="w-3 h-3 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />
              Inapakia {loadingCount}...
            </span>
          )}
          {doneCount > 0 && loadingCount === 0 && errorCount === 0 && (
            <span className="text-primary-600 flex items-center gap-1"><i className="ti ti-circle-check" aria-hidden="true" />{doneCount} zimekamilika</span>
          )}
          {errorCount > 0 && (
            <span className="text-red-500 flex items-center gap-1"><i className="ti ti-x" aria-hidden="true" />{errorCount} zimeshindwa — bonyeza picha kujaribu tena</span>
          )}
        </div>
      )}

      {/* Sortable grid */}
      {photos.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          <SortableContext items={photos.map(p => p.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {photos.map((photo, index) => (
                <SortablePhoto
                  key={photo.id}
                  photo={photo}
                  isCover={index === 0}
                  onRemove={() => removePhoto(photo.id)}
                  onRetry={() => retryPhoto(photo)}
                />
              ))}
              {photos.length < maxPhotos && (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="aspect-square rounded-xl border-2 border-dashed border-gray-200
                             flex items-center justify-center text-2xl text-gray-300
                             hover:border-gray-300 transition-colors"
                >
                  +
                </button>
              )}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {photos.length > 0 && (
        <p className="text-xs text-gray-400">
          <i className="ti ti-bulb" aria-hidden="true" /> Picha ya kwanza (Kuu) ndiyo cover photo — buruta kubadilisha mpangilio.
        </p>
      )}
    </div>
  )
}

function SortablePhoto({
  photo, isCover, onRemove, onRetry,
}: {
  photo:    PhotoItem
  isCover:  boolean
  onRemove: () => void
  onRetry:  () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: photo.id })

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{
        transform:   CSS.Transform.toString(transform),
        transition,
        opacity:     isDragging ? 0.45 : 1,
        touchAction: 'none',
      }}
      className="relative aspect-square rounded-xl overflow-hidden bg-gray-100
                 border-2 border-transparent group cursor-grab active:cursor-grabbing"
    >
      <Image
        fill
        src={photo.previewUrl}
        alt=""
        className="object-cover"
        sizes="25vw"
        unoptimized
      />

      {/* Cover badge */}
      {isCover && photo.status === 'done' && (
        <span className="absolute top-1 left-1 bg-amber-500 text-white text-[9px] font-bold
                         px-1.5 py-0.5 rounded-full pointer-events-none">
          <i className="ti ti-star-filled" aria-hidden="true" /> Kuu
        </span>
      )}

      {/* Upload progress overlay */}
      {(photo.status === 'pending' || photo.status === 'compressing' || photo.status === 'uploading') && (
        <div className="absolute inset-0 bg-black/55 flex flex-col items-center justify-center gap-1 pointer-events-none">
          <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          {photo.progress > 0 && (
            <span className="text-white text-[10px] font-medium">{photo.progress}%</span>
          )}
        </div>
      )}

      {/* Error overlay */}
      {photo.status === 'error' && (
        <div className="absolute inset-0 bg-red-500/80 flex flex-col items-center justify-center gap-1 p-1">
          <i className="ti ti-alert-triangle text-white text-base" aria-hidden="true" />
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onRetry() }}
            className="text-white text-[10px] underline font-medium"
          >
            Jaribu tena
          </button>
        </div>
      )}

      {/* Remove button */}
      {photo.status !== 'compressing' && photo.status !== 'uploading' && (
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onRemove() }}
          className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full
                     flex items-center justify-center text-white text-[10px]
                     opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
        >
          <i className="ti ti-x" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
