// Extracts a user-facing message from an API error, falling back to a
// generic message when the server didn't send one (e.g. network failure).
export const getErrorMessage = (err, fallback = 'Something went wrong') =>
  err?.response?.data?.message || fallback;
