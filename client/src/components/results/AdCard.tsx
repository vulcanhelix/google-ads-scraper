import { type AdCreative, type AdFormat } from '../../types';
import { Calendar, Clock, ExternalLink, Type, Image, Video } from 'lucide-react';

interface AdCardProps {
  ad: AdCreative;
  onClick: () => void;
}

const formatIcons: Record<AdFormat, typeof Type> = {
  text: Type,
  image: Image,
  video: Video,
};

const formatColors: Record<AdFormat, string> = {
  text: 'var(--accent-light)',
  image: 'var(--success)',
  video: 'var(--warn)',
};

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

export const AdCard = ({ ad, onClick }: AdCardProps) => {
  const FormatIcon = formatIcons[ad.format] || Image;
  const fmtColor = formatColors[ad.format] || 'var(--text-secondary)';

  const previewContent = () => {
    if (ad.imageUrl) {
      return (
        <div className="aspect-[16/10] w-full overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
          <img
            src={ad.imageUrl}
            alt={ad.headline || 'Ad preview'}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        </div>
      );
    }

    if (ad.previewUrl) {
      return (
        <div className="aspect-[16/10] w-full overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
          <img
            src={ad.previewUrl}
            alt={ad.headline || 'Ad preview'}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        </div>
      );
    }

    // Text ad without image
    return (
      <div
        className="aspect-[16/10] w-full flex items-center justify-center p-6"
        style={{ background: 'linear-gradient(135deg, var(--bg-primary), var(--bg-elevated))' }}
      >
        <p className="text-sm font-medium text-center line-clamp-4" style={{ color: 'var(--accent-light)' }}>
          {ad.headline || ad.description || 'Text Ad'}
        </p>
      </div>
    );
  };

  return (
    <div
      className="glass-card group cursor-pointer overflow-hidden transition-all duration-300 hover:border-[rgba(255,255,255,0.12)] fade-in"
      onClick={onClick}
      style={{ borderColor: 'var(--border-default)' }}
    >
      <div className="relative">
        {previewContent()}

        {/* Format badge */}
        <div
          className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium backdrop-blur-md"
          style={{
            background: 'rgba(13, 15, 21, 0.75)',
            border: '1px solid var(--border-default)',
            color: fmtColor,
          }}
        >
          <FormatIcon size={12} />
          {ad.format.charAt(0).toUpperCase() + ad.format.slice(1)}
        </div>
      </div>

      <div className="p-4">
        {/* Headline */}
        <h3
          className="font-semibold line-clamp-1 mb-1 text-[15px]"
          style={{ color: ad.headline ? 'var(--text-primary)' : 'var(--text-tertiary)' }}
        >
          {ad.headline || 'No headline extracted'}
        </h3>

        {/* Description */}
        {ad.description && (
          <p className="text-sm line-clamp-2 mb-3" style={{ color: 'var(--text-secondary)' }}>
            {ad.description}
          </p>
        )}

        {/* Days shown chip */}
        {ad.totalDaysShown > 0 && (
          <div className="flex items-center gap-1.5 mb-3">
            <span
              className="tag-success text-[11px]"
            >
              <Clock size={10} />
              {ad.totalDaysShown} day{ad.totalDaysShown !== 1 ? 's' : ''} active
            </span>
          </div>
        )}

        {/* Date range */}
        <div className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
          <Calendar size={10} />
          <span>{formatDate(ad.firstShown)}</span>
          <span>→</span>
          <span>{formatDate(ad.lastShown)}</span>
        </div>

        {/* External link on hover */}
        {ad.detailsUrl && (
          <a
            href={ad.detailsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 flex items-center gap-1.5 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            style={{ color: 'var(--accent-light)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink size={11} />
            View on Google
          </a>
        )}
      </div>
    </div>
  );
};
