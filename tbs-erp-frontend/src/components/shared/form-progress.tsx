import { cn } from '@/lib/utils';

interface FormProgressProps {
  formData: Record<string, unknown>;
  requiredFields?: string[];
  className?: string;
}

export function FormProgress({
  formData,
  requiredFields,
  className,
}: FormProgressProps) {
  const fields = requiredFields || Object.keys(formData);
  const filledFields = fields.filter((field) => {
    const value = formData[field];
    if (typeof value === 'string') return value.trim() !== '';
    if (Array.isArray(value)) return value.length > 0;
    return value !== null && value !== undefined && value !== '';
  }).length;

  const totalFields = fields.length;
  const progress = totalFields > 0 ? (filledFields / totalFields) * 100 : 0;

  return (
    <div className={cn('mb-6', className)}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">
          Tiến trình hoàn thành
        </span>
        <span className="text-sm text-gray-600">
          {filledFields}/{totalFields} trường
        </span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-gray-200"
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Tiến trình hoàn thành: ${Math.round(progress)}%`}
      >
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500 ease-out',
            progress < 30
              ? 'bg-red-500'
              : progress < 70
                ? 'bg-yellow-500'
                : 'bg-green-500'
          )}
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-gray-500">
        {progress === 100
          ? 'Hoàn thành! Vui lòng kiểm tra và gửi.'
          : progress > 50
            ? 'Gần xong rồi! Hãy điền thêm một vài thông tin.'
            : 'Hãy điền đầy đủ thông tin để tiếp tục.'}
      </p>
    </div>
  );
}
