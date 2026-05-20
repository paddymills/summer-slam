export function checkAuth(request, env) {
  if (!env.ADMIN_PASSWORD) return false;
  const header = request.headers.get('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  return token === env.ADMIN_PASSWORD;
}

// Accepts both admin and operator passwords — for actions operators need at the sign-up table
export function checkOperatorAuth(request, env) {
  const header = request.headers.get('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return false;
  return token === env.ADMIN_PASSWORD || token === (env.OPERATOR_PASSWORD ?? '');
}
