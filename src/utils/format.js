export const money = (n) => `$${(Number(n) || 0).toFixed(2)}`;
export const timeOf = (d) => (d ? new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '');
export const dateOf = (d) => (d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '');
export const dayLabel = (iso) => {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString('en-US', { weekday: 'short' });
};
export const ago = (d) => {
  if (!d) return '';
  const m = Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 60000));
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h ${m % 60}m ago` : dateOf(d);
};
export const apiError = (err, fallback = 'Something went wrong. Please try again.') => {
  if (err?.response?.data?.message) return err.response.data.message;
  if (err?.code === 'ECONNABORTED') return 'The server took too long to respond. Try again.';
  if (!err?.response) return 'Cannot reach the server. Check your internet connection.';
  return fallback;
};
export const normalizePhone = (raw) => {
  let p = String(raw || '').replace(/[^\d+]/g, '');
  if (p.startsWith('+')) p = p.slice(1);
  if (p.startsWith('00')) p = p.slice(2);
  if (p.startsWith('0')) p = `252${p.slice(1)}`;
  else if (p.length <= 9 && !p.startsWith('252')) p = `252${p}`;
  return p;
};
