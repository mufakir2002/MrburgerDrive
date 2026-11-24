export const C = {
  bg: '#F6F7F9', card: '#FFFFFF', ink: '#111827', sub: '#6B7280', mute: '#9CA3AF',
  line: '#EEF0F3', dark: '#111827', dark2: '#1F2937', accent: '#FFC107',
  green: '#16A34A', greenBg: '#DCFCE7', red: '#DC2626', redBg: '#FEE2E2',
  blue: '#2563EB', blueBg: '#DBEAFE', amber: '#D97706', amberBg: '#FEF3C7',
};
export const shadow = {
  shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2,
};
export const STATUS = {
  ASSIGNED: { label: 'Assigned', color: C.blue, bg: C.blueBg },
  ON_THE_WAY: { label: 'On the way', color: C.amber, bg: C.amberBg },
  DELIVERED: { label: 'Delivered', color: C.green, bg: C.greenBg },
  CANCELLED: { label: 'Cancelled', color: C.red, bg: C.redBg },
};
