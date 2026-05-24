/**
 * Format a date string into a clean, readable format.
 * E.g., "2026-05-23" -> "May 23, 2026"
 * 
 * @param {string | Date | null} date - Date to format
 * @param {boolean} [includeTime=false] - Whether to include time
 * @returns {string}
 */
export function formatDate(date: string | Date | null, includeTime = false): string {
  if (!date) return 'N/A';
  
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return 'Invalid Date';

  const options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...(includeTime && { hour: '2-digit', minute: '2-digit' }),
  };

  return new Intl.DateTimeFormat('en-US', options).format(d);
}

/** Short date for compact UI, e.g. "Jun 15" */
export function formatDateShort(date: string | Date | null): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(d);
}

/**
 * Format a byte size into human readable string (KB, MB).
 * E.g., 1048576 -> "1.0 MB"
 * 
 * @param {number} bytes - Number of bytes
 * @returns {string}
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  if (!bytes || isNaN(bytes)) return 'N/A';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Format duration string.
 * Converts duration (e.g. from minutes or raw string) to structured format.
 * E.g., 150 -> "2h 30m"
 * 
 * @param {number | string | null} duration - Duration in minutes or raw string
 * @returns {string}
 */
/**
 * Short destination for cards/badges (avoids multi-city strings overflowing on mobile).
 */
export function formatDestinationShort(
  destination: string | null | undefined,
  maxLen = 36
): string {
  if (!destination?.trim()) return 'Unknown';

  const cleaned = destination.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= maxLen) return cleaned;

  const segments = cleaned
    .split(/\s*(?:–|—|,|&|\|)\s*|\s+to\s+/i)
    .map((s) => s.trim())
    .filter(Boolean);

  if (segments.length > 2) {
    const head = `${segments[0]} → ${segments[1]}`;
    return head.length <= maxLen ? head : `${head.slice(0, maxLen - 1)}…`;
  }

  return `${cleaned.slice(0, maxLen - 1)}…`;
}

export function formatDuration(duration: number | string | null): string {
  if (duration === null || duration === undefined) return '';
  
  if (typeof duration === 'number') {
    const hours = Math.floor(duration / 60);
    const minutes = duration % 60;
    
    if (hours === 0) return `${minutes}m`;
    if (minutes === 0) return `${hours}h`;
    return `${hours}h ${minutes}m`;
  }

  return duration;
}
