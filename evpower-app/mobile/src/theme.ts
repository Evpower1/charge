export const colors = {
  blue:'#0754de', cyan:'#00cde8', navy:'#10243e', muted:'#6b7d94', line:'#e2ebf5',
  background:'#f3f8fd', white:'#ffffff', danger:'#bd3349', success:'#127f73', pale:'#eaf8fd',
};
export const money = (minor:number) => `ETB ${(minor / 100).toLocaleString('en-ET', {minimumFractionDigits:2,maximumFractionDigits:2})}`;
