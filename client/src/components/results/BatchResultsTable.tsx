import { CheckCircle2, Clock, XCircle, Loader2 } from 'lucide-react';
import { Badge } from '../shared/Badge';
import { type BatchItem } from '../../types';

interface BatchResultsTableProps {
  results: BatchItem[];
  isProcessing: boolean;
}

export const BatchResultsTable = ({ results, isProcessing }: BatchResultsTableProps) => {
  const completedCount = results.filter((r) => r.status === 'completed').length;
  const failedCount = results.filter((r) => r.status === 'failed').length;
  const totalCount = results.length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const getStatusIcon = (status: BatchItem['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 size={18} style={{ color: 'var(--success)' }} />;
      case 'failed':
        return <XCircle size={18} style={{ color: 'var(--error)' }} />;
      case 'scraping':
        return <Loader2 className="animate-spin" size={18} style={{ color: 'var(--accent)' }} />;
      default:
        return <Clock size={18} style={{ color: 'var(--text-tertiary)' }} />;
    }
  };

  const getStatusBadge = (status: BatchItem['status']) => {
    switch (status) {
      case 'completed':
        return <Badge variant="success">Done</Badge>;
      case 'failed':
        return <Badge variant="error">Failed</Badge>;
      case 'scraping':
        return <Badge variant="primary">Scanning</Badge>;
      default:
        return <Badge>Queued</Badge>;
    }
  };

  return (
    <div className="glass-card overflow-hidden fade-in">
      <div className="p-4" style={{ borderBottom: '1px solid var(--border-default)', background: 'var(--bg-elevated)' }}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Batch Progress</h3>
          {isProcessing && (
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Processing…</span>
          )}
        </div>

        <div className="flex items-center gap-4 text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>
          <span className="flex items-center gap-1">
            <CheckCircle2 size={14} style={{ color: 'var(--success)' }} />
            {completedCount} completed
          </span>
          {failedCount > 0 && (
            <span className="flex items-center gap-1">
              <XCircle size={14} style={{ color: 'var(--error)' }} />
              {failedCount} failed
            </span>
          )}
          <span>{totalCount - completedCount - failedCount} remaining</span>
        </div>

        <div className="w-full rounded-full h-1.5 overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
          <div
            className="h-full transition-all duration-500 rounded-full"
            style={{ width: `${progressPercent}%`, background: 'var(--accent)' }}
          />
        </div>
        <p className="text-[10px] mt-1 text-right" style={{ color: 'var(--text-tertiary)' }}>
          {progressPercent.toFixed(0)}%
        </p>
      </div>

      <div>
        {results.map((result, index) => (
          <div
            key={`${result.domain}-${index}`}
            className="p-4 flex items-center gap-4 transition-colors"
            style={{ borderBottom: '1px solid var(--border-default)' }}
          >
            <div className="flex-shrink-0">{getStatusIcon(result.status)}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-medium text-sm mono truncate" style={{ color: 'var(--text-primary)' }}>
                  {result.domain}
                </span>
                {getStatusBadge(result.status)}
              </div>

              {result.status === 'failed' && result.error && (
                <p className="text-xs truncate" style={{ color: 'var(--error)' }}>{result.error}</p>
              )}

              {result.status === 'completed' && (
                <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  <span>{result.adsFound} ads</span>
                  {result.advertiser && (
                    <>
                      <span style={{ color: 'var(--text-tertiary)' }}>•</span>
                      <span className="truncate">{result.advertiser.name}</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {results.length === 0 && (
          <div className="p-12 text-center">
            <Clock className="mx-auto mb-3" size={28} style={{ color: 'var(--text-tertiary)' }} />
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No domains queued</p>
          </div>
        )}
      </div>
    </div>
  );
};
