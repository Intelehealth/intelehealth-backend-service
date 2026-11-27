// Values documented in the Mobilab External API reference

const SCOPES = [
    'catalog:read',
    'users:read',
    'users:write',
    'bookings:read',
    'bookings:write',
    'clinics:read',
    'clinics:write',
    'results:read',
    'results:write'
];

const KEY_MODES = ['live', 'test'];

const BOOKING_STATUS = [
    'pending',
    'in_progress',
    'completed',
    'in_review',
    'review_completed',
    'report_generated',
    'rejected',
    'retest_required',
    'archived'
];

const GENDERS = ['male', 'female'];

const CLINIC_STATUS = ['active', 'inactive'];

const CLINIC_SORT_BY = ['latest', 'oldest', 'name_asc', 'name_desc'];

const CLINIC_FILE_TYPES = ['license', 'gst', 'logo'];

const ROLE_CATEGORIES = ['business', 'research', 'system'];

const USER_SORT_BY = ['name', '-name', 'email', '-email', 'created', '-created'];

const READING_ACTIONS = ['approve', 'reject', 'repeat'];

// Max page size per endpoint, as documented
const PAGE_LIMITS = {
    CATALOG: 200,
    ROLES: 200,
    CLINICS: 100,
    USERS: 100,
    BOOKINGS: 100
};

// Mobilab rate-limit headers forwarded to our callers
const RATE_LIMIT_HEADERS = ['retry-after', 'x-ratelimit-remaining'];

module.exports = {
    SCOPES,
    KEY_MODES,
    BOOKING_STATUS,
    GENDERS,
    CLINIC_STATUS,
    CLINIC_SORT_BY,
    CLINIC_FILE_TYPES,
    ROLE_CATEGORIES,
    USER_SORT_BY,
    READING_ACTIONS,
    PAGE_LIMITS,
    RATE_LIMIT_HEADERS
};
