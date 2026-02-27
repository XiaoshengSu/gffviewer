// 深色主题
import type { Theme } from '../../types';

export const darkTheme: Theme = {
  name: 'dark',
  backgroundColor: '#121212',
  textColor: '#e0e0e0',
  borderColor: '#333333',
  primaryColor: '#42a5f5',
  secondaryColor: '#90a4ae',
  accentColor: '#ffb74d',
  featureColors: {
    'CDS': '#ba68c8',      // 紫色
    'tRNA': '#ffb74d',      // 橙色
    'rRNA': '#66bb6a',      // 绿色
    'misc_RNA': '#d7ccc8',  // 棕色
    'repeat_region': '#fff176', // 黄色
    'tmRNA': '#4dd0e1'      // 青色
  }
};