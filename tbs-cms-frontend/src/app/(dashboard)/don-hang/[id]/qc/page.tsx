'use client';

import { useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Plus,
  Play,
  Send,
  Upload,
  Star,
  Camera,
  AlertTriangle,
  ClipboardCheck,
  Loader2,
  X,
  Image as ImageIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { LoadingOverlay } from '@/components/shared/loading-overlay';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  useQCInspections,
  useQCStatistics,
  useCreateQCInspection,
  useStartQCInspection,
  useSendCustomerReview,
  useUploadQCPhotos,
} from '@/lib/hooks/use-qc';
import { formatDate } from '@/lib/utils/format';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const QC_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Ch\u1edd ki\u1ec3m',
  INSPECTING: '\u0110ang ki\u1ec3m',
  PASSED: '\u0110\u1ea1t',
  FAILED: 'Kh\u00f4ng \u0111\u1ea1t',
  PARTIAL: '\u0110\u1ea1t m\u1ed9t ph\u1ea7n',
  CUSTOMER_REVIEW: 'Ch\u1edd KH duy\u1ec7t',
  CUSTOMER_APPROVED: 'KH \u0111\u1ed3ng \u00fd',
  CUSTOMER_REJECTED: 'KH t\u1eeb ch\u1ed1i',
};

const QC_STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-gray-100 text-gray-700',
  INSPECTING: 'bg-blue-100 text-blue-700',
  PASSED: 'bg-green-100 text-green-700',
  FAILED: 'bg-red-100 text-red-700',
  PARTIAL: 'bg-yellow-100 text-yellow-700',
  CUSTOMER_REVIEW: 'bg-purple-100 text-purple-700',
  CUSTOMER_APPROVED: 'bg-green-100 text-green-700',
  CUSTOMER_REJECTED: 'bg-red-100 text-red-700',
};

// ---------------------------------------------------------------------------
// Types (inline — matches project pattern of keeping lightweight)
// ---------------------------------------------------------------------------

interface QCChecklistItem {
  id: string;
  name: string;
  passed: boolean;
  note?: string;
}

interface QCInspection {
  id: string;
  code: string;
  orderId: string;
  packageId?: string;
  packageCode?: string;
  status: string;
  inspectedQuantity: number;
  passedQuantity: number;
  failedQuantity: number;
  overallRating: number;
  photoUrls: string[];
  detailPhotoUrls: string[];
  defectPhotoUrls: string[];
  checklist: QCChecklistItem[];
  inspectorNotes?: string;
  customerNotes?: string;
  inspectedAt?: string;
  createdAt: string;
  inspector?: { fullName: string };
}

// ---------------------------------------------------------------------------
// Helper: Star rating display
// ---------------------------------------------------------------------------

function StarRating({ rating, max = 5 }: { rating: number; max?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }, (_, i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${
            i < rating
              ? 'fill-yellow-400 text-yellow-400'
              : 'fill-none text-gray-300'
          }`}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helper: Photo gallery section
// ---------------------------------------------------------------------------

function PhotoGallery({
  title,
  urls,
  icon,
}: {
  title: string;
  urls: string[];
  icon: React.ReactNode;
}) {
  if (!urls || urls.length === 0) return null;
  return (
    <div>
      <h5 className="text-sm font-medium mb-2 flex items-center gap-1.5">
        {icon}
        {title} ({urls.length})
      </h5>
      <div className="flex flex-wrap gap-2">
        {urls.map((url, idx) => (
          <a
            key={idx}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="block h-20 w-20 overflow-hidden rounded-md border hover:opacity-80 transition-opacity"
          >
            <img
              src={url}
              alt={`${title} ${idx + 1}`}
              className="h-full w-full object-cover"
            />
          </a>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create QC Form
// ---------------------------------------------------------------------------

function CreateQCForm({
  orderId,
  onClose,
}: {
  orderId: string;
  onClose: () => void;
}) {
  const createMutation = useCreateQCInspection();
  const [packageId, setPackageId] = useState('');
  const [note, setNote] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(
      {
        orderId,
        packageId: packageId || undefined,
        inspectorNotes: note || undefined,
      },
      {
        onSuccess: () => {
          onClose();
        },
      },
    );
  };

  return (
    <Card className="mb-6">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">T\u1ea1o phi\u1ebfu QC m\u1edbi</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="qc-package-id">M\u00e3 ki\u1ec7n h\u00e0ng</Label>
              <Input
                id="qc-package-id"
                placeholder="Nh\u1eadp m\u00e3 ki\u1ec7n h\u00e0ng (t\u00f9y ch\u1ecdn)"
                value={packageId}
                onChange={(e) => setPackageId(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="qc-note">Ghi ch\u00fa</Label>
              <Input
                id="qc-note"
                placeholder="Ghi ch\u00fa cho phi\u1ebfu QC"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-2">
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              T\u1ea1o phi\u1ebfu QC
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              H\u1ee7y
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Upload Photos Form
// ---------------------------------------------------------------------------

function UploadPhotosForm({
  inspectionId,
  onClose,
}: {
  inspectionId: string;
  onClose: () => void;
}) {
  const uploadMutation = useUploadQCPhotos();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [photoType, setPhotoType] = useState<string>('photo');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(Array.from(e.target.files));
    }
  };

  const handleUpload = () => {
    if (selectedFiles.length === 0) {
      toast.error('Vui l\u00f2ng ch\u1ecdn \u1ea3nh');
      return;
    }

    const formData = new FormData();
    formData.append('type', photoType);
    selectedFiles.forEach((file) => {
      formData.append('photos', file);
    });

    uploadMutation.mutate(
      { id: inspectionId, formData },
      {
        onSuccess: () => {
          setSelectedFiles([]);
          onClose();
        },
      },
    );
  };

  return (
    <div className="rounded-md border border-blue-200 bg-blue-50 p-4 space-y-3 mt-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-blue-800">Upload \u1ea3nh QC</p>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-6 w-6">
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-blue-800">Lo\u1ea1i \u1ea3nh</Label>
          <select
            value={photoType}
            onChange={(e) => setPhotoType(e.target.value)}
            className="h-9 rounded-md border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="photo">\u1ea2nh t\u1ed5ng quan</option>
            <option value="detail">\u1ea2nh chi ti\u1ebft</option>
            <option value="defect">\u1ea2nh l\u1ed7i</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-blue-800">Ch\u1ecdn \u1ea3nh</Label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
            className="text-sm file:mr-2 file:rounded-md file:border-0 file:bg-blue-600 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white hover:file:bg-blue-700"
          />
        </div>
      </div>
      {selectedFiles.length > 0 && (
        <p className="text-xs text-blue-700">
          \u0110\u00e3 ch\u1ecdn {selectedFiles.length} \u1ea3nh
        </p>
      )}
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={handleUpload}
          disabled={uploadMutation.isPending || selectedFiles.length === 0}
        >
          {uploadMutation.isPending && (
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          )}
          Upload
        </Button>
        <Button size="sm" variant="outline" onClick={onClose}>
          H\u1ee7y
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inspection Row (expandable)
// ---------------------------------------------------------------------------

function InspectionRow({ inspection }: { inspection: QCInspection }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);

  const startMutation = useStartQCInspection();
  const sendReviewMutation = useSendCustomerReview();

  const status = inspection.status || '';
  const canStart = status === 'PENDING';
  const canSendReview = status === 'PASSED' || status === 'FAILED' || status === 'PARTIAL';
  const canUpload = status !== 'CUSTOMER_APPROVED' && status !== 'CUSTOMER_REJECTED';

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      {/* Row header */}
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-3 flex-wrap">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          <span className="font-semibold">{inspection.code}</span>
          {inspection.packageCode && (
            <span className="text-sm text-muted-foreground">
              Ki\u1ec7n: {inspection.packageCode}
            </span>
          )}
          <StatusBadge
            label={QC_STATUS_LABELS[status] || status || '---'}
            colorClass={QC_STATUS_COLORS[status] || 'bg-gray-100 text-gray-700'}
          />
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-muted-foreground whitespace-nowrap">
            {inspection.inspectedQuantity}/{inspection.passedQuantity}/{inspection.failedQuantity}
          </span>
          <StarRating rating={inspection.overallRating} />
          <span className="text-muted-foreground whitespace-nowrap">
            {inspection.inspectedAt ? formatDate(inspection.inspectedAt) : '---'}
          </span>
        </div>
      </button>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="border-t px-6 py-4 space-y-4">
          {/* Action buttons */}
          <div className="flex items-center gap-2 pb-2 border-b flex-wrap">
            {canStart && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => startMutation.mutate(inspection.id)}
                disabled={startMutation.isPending}
              >
                {startMutation.isPending ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : (
                  <Play className="mr-1 h-3 w-3" />
                )}
                B\u1eaft \u0111\u1ea7u ki\u1ec3m
              </Button>
            )}
            {canSendReview && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => sendReviewMutation.mutate(inspection.id)}
                disabled={sendReviewMutation.isPending}
              >
                {sendReviewMutation.isPending ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : (
                  <Send className="mr-1 h-3 w-3" />
                )}
                G\u1eedi KH duy\u1ec7t
              </Button>
            )}
            {canUpload && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowUploadForm((prev) => !prev)}
              >
                <Upload className="mr-1 h-3 w-3" />
                Upload \u1ea3nh
              </Button>
            )}
          </div>

          {/* Upload form */}
          {showUploadForm && (
            <UploadPhotosForm
              inspectionId={inspection.id}
              onClose={() => setShowUploadForm(false)}
            />
          )}

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div>
              <span className="text-muted-foreground">SL Ki\u1ec3m:</span>{' '}
              <span className="font-medium">{inspection.inspectedQuantity}</span>
            </div>
            <div>
              <span className="text-muted-foreground">SL \u0110\u1ea1t:</span>{' '}
              <span className="font-medium text-green-600">{inspection.passedQuantity}</span>
            </div>
            <div>
              <span className="text-muted-foreground">SL L\u1ed7i:</span>{' '}
              <span className="font-medium text-red-600">{inspection.failedQuantity}</span>
            </div>
            <div>
              <span className="text-muted-foreground">\u0110\u00e1nh gi\u00e1:</span>{' '}
              <StarRating rating={inspection.overallRating} />
            </div>
            {inspection.inspector && (
              <div className="col-span-2">
                <span className="text-muted-foreground">Ng\u01b0\u1eddi ki\u1ec3m:</span>{' '}
                <span className="font-medium">{inspection.inspector.fullName}</span>
              </div>
            )}
            {inspection.inspectedAt && (
              <div className="col-span-2">
                <span className="text-muted-foreground">Ng\u00e0y ki\u1ec3m:</span>{' '}
                <span className="font-medium">{formatDate(inspection.inspectedAt)}</span>
              </div>
            )}
          </div>

          {/* Photo galleries */}
          <div className="space-y-3">
            <PhotoGallery
              title="\u1ea2nh t\u1ed5ng quan"
              urls={inspection.photoUrls}
              icon={<Camera className="h-4 w-4 text-blue-600" />}
            />
            <PhotoGallery
              title="\u1ea2nh chi ti\u1ebft"
              urls={inspection.detailPhotoUrls}
              icon={<ImageIcon className="h-4 w-4 text-cyan-600" />}
            />
            <PhotoGallery
              title="\u1ea2nh l\u1ed7i"
              urls={inspection.defectPhotoUrls}
              icon={<AlertTriangle className="h-4 w-4 text-red-600" />}
            />
          </div>

          {/* Checklist */}
          {inspection.checklist && inspection.checklist.length > 0 && (
            <div>
              <h5 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                <ClipboardCheck className="h-4 w-4 text-primary" />
                Checklist ({inspection.checklist.length})
              </h5>
              <div className="space-y-1">
                {inspection.checklist.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-2 text-sm rounded-md px-3 py-1.5 bg-muted/40"
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        item.passed ? 'bg-green-500' : 'bg-red-500'
                      }`}
                    />
                    <span className="flex-1">{item.name}</span>
                    <span
                      className={`text-xs font-medium ${
                        item.passed ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {item.passed ? '\u0110\u1ea1t' : 'L\u1ed7i'}
                    </span>
                    {item.note && (
                      <span className="text-xs text-muted-foreground">
                        — {item.note}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {inspection.inspectorNotes && (
            <div>
              <h5 className="text-sm font-medium mb-1">Ghi ch\u00fa ki\u1ec3m tra</h5>
              <p className="text-sm text-muted-foreground bg-muted/40 rounded-md px-3 py-2">
                {inspection.inspectorNotes}
              </p>
            </div>
          )}
          {inspection.customerNotes && (
            <div>
              <h5 className="text-sm font-medium mb-1">Ghi ch\u00fa kh\u00e1ch h\u00e0ng</h5>
              <p className="text-sm text-muted-foreground bg-muted/40 rounded-md px-3 py-2">
                {inspection.customerNotes}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function QCInspectionPage() {
  const params = useParams();
  const orderId = params.id as string;

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');

  const queryParams: Record<string, unknown> = { orderId };
  if (statusFilter) {
    queryParams.status = statusFilter;
  }

  const { data, isLoading, isError } = useQCInspections(queryParams);
  const { data: stats } = useQCStatistics({ orderId });

  const inspections: QCInspection[] = (data?.data as QCInspection[]) ?? [];
  const statistics = stats as any;

  if (isLoading) return <LoadingOverlay className="h-[60vh]" />;
  if (isError) {
    return (
      <div className="text-center py-20">
        <p className="text-destructive font-medium">L\u1ed7i t\u1ea3i d\u1eef li\u1ec7u</p>
        <p className="text-sm text-muted-foreground mt-1">
          Kh\u00f4ng th\u1ec3 t\u1ea3i th\u00f4ng tin QC. Vui l\u00f2ng th\u1eed l\u1ea1i.
        </p>
        <Link
          href={`/don-hang/${orderId}`}
          className="text-primary hover:underline mt-2 inline-block"
        >
          Quay l\u1ea1i \u0111\u01a1n h\u00e0ng
        </Link>
      </div>
    );
  }

  const ALL_QC_STATUSES = [
    'PENDING',
    'INSPECTING',
    'PASSED',
    'FAILED',
    'PARTIAL',
    'CUSTOMER_REVIEW',
    'CUSTOMER_APPROVED',
    'CUSTOMER_REJECTED',
  ] as const;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href={`/don-hang/${orderId}`}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border hover:bg-accent"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <PageHeader
            title="Ki\u1ec3m tra QC"
            description={`Qu\u1ea3n l\u00fd ki\u1ec3m tra ch\u1ea5t l\u01b0\u1ee3ng cho \u0111\u01a1n h\u00e0ng`}
            className="pb-0 border-b-0 mb-0"
          >
            <Button onClick={() => setShowCreateForm((prev) => !prev)}>
              <Plus className="mr-2 h-4 w-4" />
              T\u1ea1o QC
            </Button>
          </PageHeader>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">T\u1ed5ng QC</p>
          <p className="text-2xl font-bold">{statistics?.total ?? inspections.length}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">\u0110\u1ea1t</p>
          <p className="text-2xl font-bold text-green-600">
            {statistics?.byStatus?.PASSED ?? inspections.filter((i) => i.status === 'PASSED').length}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Kh\u00f4ng \u0111\u1ea1t</p>
          <p className="text-2xl font-bold text-red-600">
            {statistics?.byStatus?.FAILED ?? inspections.filter((i) => i.status === 'FAILED').length}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Ch\u1edd KH duy\u1ec7t</p>
          <p className="text-2xl font-bold text-purple-600">
            {statistics?.byStatus?.CUSTOMER_REVIEW ?? inspections.filter((i) => i.status === 'CUSTOMER_REVIEW').length}
          </p>
        </div>
      </div>

      {/* Create form */}
      {showCreateForm && (
        <CreateQCForm
          orderId={orderId}
          onClose={() => setShowCreateForm(false)}
        />
      )}

      {/* Status filter */}
      <div className="flex items-center gap-2">
        <Label htmlFor="qc-status-filter" className="whitespace-nowrap">
          L\u1ecdc tr\u1ea1ng th\u00e1i:
        </Label>
        <select
          id="qc-status-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <option value="">T\u1ea5t c\u1ea3</option>
          {ALL_QC_STATUSES.map((s) => (
            <option key={s} value={s}>
              {QC_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      {/* Table header */}
      <div className="hidden sm:flex items-center gap-3 px-6 py-2 text-xs font-medium text-muted-foreground border-b">
        <span className="w-5" />
        <span className="flex-1">M\u00e3 QC / Ki\u1ec7n h\u00e0ng / Tr\u1ea1ng th\u00e1i</span>
        <span className="w-32 text-center">SL Ki\u1ec3m/\u0110\u1ea1t/L\u1ed7i</span>
        <span className="w-28 text-center">\u0110\u00e1nh gi\u00e1</span>
        <span className="w-36 text-right">Ng\u00e0y ki\u1ec3m</span>
      </div>

      {/* Inspection list */}
      <div className="space-y-3">
        {inspections.length === 0 ? (
          <div className="text-center py-12">
            <ClipboardCheck className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground mt-3">Ch\u01b0a c\u00f3 phi\u1ebfu QC n\u00e0o</p>
            <p className="text-sm text-muted-foreground mt-1">
              Nh\u1ea5n &quot;T\u1ea1o QC&quot; \u0111\u1ec3 b\u1eaft \u0111\u1ea7u ki\u1ec3m tra ch\u1ea5t l\u01b0\u1ee3ng.
            </p>
          </div>
        ) : (
          inspections.map((inspection) => (
            <InspectionRow key={inspection.id} inspection={inspection} />
          ))
        )}
      </div>
    </div>
  );
}
