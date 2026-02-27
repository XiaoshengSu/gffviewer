// 浅色主题
import type { Theme } from '../../types';

export const lightTheme: Theme = {
  name: 'light',
  backgroundColor: '#ffffff',
  textColor: '#333333',
  borderColor: '#e0e0e0',
  primaryColor: '#2196F3',
  secondaryColor: '#607D8B',
  accentColor: '#FF9800',
  featureColors: {
    'CDS': '#800080',      // 紫色
    'tRNA': '#FF8C00',      // 橙色
    'rRNA': '#008000',      // 绿色
    'misc_RNA': '#A52A2A',  // 棕色
    'repeat_region': '#FFFF00', // 黄色
    'tmRNA': '#00FFFF'      // 青色
  }
};