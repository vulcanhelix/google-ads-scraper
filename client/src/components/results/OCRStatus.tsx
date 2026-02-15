import { CheckCircle2, Loader2, Clock } from 'lucide-react';
import { Badge } from '../shared/Badge';
import { type OCRJob } from '../../types';

interface OCRStatusProps {
  job: OCRJob | null;
  isPolling: boolean;
  error: string | null;
}

export const OCRStatus = ({ job, isPolling, error }: OCRStatusProps) => {
  if (!job && !isPolling && !error) return null;

  const getStatusBadge = (status: OCRJob['status']) => {
    switch (status) {
      case 'completed':
        return <Badge variant="success">Complete</Badge>;
      case 'failed':
        return <Badge variant="error">Failed</Badge>;
      case 'processing':
        return <Badge variant="primary">Processing</Badge>;
      default:
        return <Badge>Queued</Badge>;
    }
  };

  const progress = job?.processed && job?.total
    ? (job.processed / job.total) * 100
    : 0;

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-900 flex items-center gap-2">
            <Loader2 className={`text-indigo-500 ${isPolling ? 'animate-spin' : ''}`} size={20} />
            OCR Processing
          </h3>
          {job && getStatusBadge(job.status)}
        </div>
      </div>

      <div className="p-4">
        {job && job.status === 'processing' && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-600">
                Processing {job.processed || 0} of {job.total || 0} ads
              </span>
              <span className="text-sm font-medium text-slate-900">
                {progress.toFixed(0)}%
              </span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-indigo-500 to-violet-500 h-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {job && job.results && Object.keys(job.results).length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-slate-700 mb-3">
              Processed Ads
            </h4>
            <div className="space-y-2">
              {Object.entries(job.results).map(([adId, result]) => (
                <div
                  key={adId}
                  className="p-3 bg-slate-50 rounded-lg border border-slate-100"
                >
                  <div className="flex items-start gap-2 mb-2">
                    <CheckCircle2 className="text-emerald-500 flex-shrink-0 mt-0.5" size={16} />
                    <div className="flex-1 min-w-0">
                      {result.headline && (
                        <p className="font-medium text-slate-900 line-clamp-1">
                          {result.headline}
                        </p>
                      )}
                      {result.description && (
                        <p className="text-sm text-slate-600 line-clamp-2">
                          {result.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-slate-400">{adId}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {job && job.status === 'queued' && (
          <div className="text-center py-8">
            <Clock className="mx-auto mb-3 text-slate-300" size={32} />
            <p className="text-slate-600">OCR job is queued and will start soon</p>
          </div>
        )}
      </div>
    </div>
  );
};
