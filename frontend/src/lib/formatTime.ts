export function formatLastSeen(dateString: string | Date | undefined): string {
    if (!dateString) return '';

    const date = new Date(dateString);
    // Safety check for invalid dates
    if (isNaN(date.getTime())) return '';

    const now = new Date();

    // Handle future dates (clock skew protection)
    if (date > now) return 'Last seen just now';

    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    const diffInDays = Math.floor((startOfToday.getTime() - new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()) / (1000 * 60 * 60 * 24));

    // 1. Ultra-recent (Minutes & Hours)
    if (diffInSeconds < 60) return 'Last seen just now';
    if (diffInSeconds < 3600) return `Last seen ${Math.floor(diffInSeconds / 60)}m ago`;

    // If it is today, show hours. If it was "yesterday" (even if < 24h ago), let it fall through to "Yesterday"
    if (diffInSeconds < 86400 && date > startOfToday) {
        return `Last seen ${Math.floor(diffInSeconds / 3600)}h ago`;
    }

    // 2. Daily (Yesterday & Days of the week)
    if (diffInDays === 1) return 'Last seen yesterday';
    if (diffInDays < 7) {
        // Use Intl for cleaner day names (optional, handles locales)
        const dayName = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(date);
        return `Last seen on ${dayName}`;
    }

    // 3. Weekly Scaling
    const diffInWeeks = Math.floor(diffInDays / 7);
    if (diffInWeeks === 1) return 'Last seen a week ago';
    if (diffInWeeks < 4) return `Last seen ${diffInWeeks} weeks ago`;

    // 4. Monthly/Yearly Scaling
    const diffInMonths = (now.getFullYear() - date.getFullYear()) * 12 + (now.getMonth() - date.getMonth());
    const diffInYears = now.getFullYear() - date.getFullYear();

    if (diffInMonths <= 1) return 'Last seen a month ago';
    if (diffInMonths < 12) return `Last seen ${diffInMonths} months ago`;

    if (diffInYears === 1) return 'Last seen a year ago';
    // Added specific year count support
    if (diffInYears > 1) return `Last seen ${diffInYears} years ago`;

    return 'Last seen a long time ago';
}