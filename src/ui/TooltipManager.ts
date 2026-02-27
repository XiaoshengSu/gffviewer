import { CGView } from '../core';

/**
 * 工具提示管理类
 * 负责基因特征的悬停提示功能
 */
export class TooltipManager {
  private cgview: CGView | null = null;
  private tooltip: HTMLElement;

  constructor() {
    // 创建悬浮框元素
    this.tooltip = document.createElement('div');
    this.tooltip.id = 'cgview-tooltip';
    document.body.appendChild(this.tooltip);
  }

  /**
   * 初始化CGView实例
   */
  setCGView(cgview: CGView) {
    this.cgview = cgview;
    this.initHoverListener();
  }

  /**
   * 初始化悬停监听器
   */
  private initHoverListener() {
    if (!this.cgview) return;

    // 缓存容器元素
    const container = document.getElementById('cgview-container')!;
    
    // 监听鼠标移动，更新tooltip位置（使用节流）
    const updateTooltipPosition = (e: MouseEvent) => {
      this.tooltip.style.left = `${e.clientX + 10}px`;
      this.tooltip.style.top = `${e.clientY + 10}px`;
    }
    
    // 节流函数
    function throttle<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void {
      let timeout: number | null = null;
      return (...args: Parameters<T>) => {
        if (!timeout) {
          timeout = setTimeout(() => {
            func(...args);
            timeout = null;
          }, wait);
        }
      };
    }
    
    const throttledUpdatePosition = throttle(updateTooltipPosition, 16); // 约60fps
    
    // 隐藏tooltip的函数
    const hideTooltip = () => {
      this.tooltip.style.display = 'none';
      document.removeEventListener('mousemove', throttledUpdatePosition);
    }

    // 监听hover事件
    this.cgview.on('hover', (feature: any) => {
      if (!feature) {
        // 隐藏悬浮框
        hideTooltip();
        return;
      }
      
      // 只在gene特征上显示提示
      if (!feature.name && !feature.id && feature.type !== 'gene' && feature.type !== 'CDS') {
        hideTooltip();
        return;
      }
      
      // 显示悬浮框
      this.tooltip.style.display = 'block';
      
      // 构建tooltip内容
      let content = '<div style="font-weight: bold; margin-bottom: 5px;">Gene Information</div>';
      
      // 添加gene名称
      if (feature.name) {
        content += `<div><strong>Name:</strong> ${feature.name}</div>`;
      }
      
      // 添加gene ID
      if (feature.id) {
        content += `<div><strong>ID:</strong> ${feature.id}</div>`;
      }
      
      // 添加位置信息
      content += `<div><strong>Position:</strong> ${feature.start} - ${feature.end}</div>`;
      
      // 添加长度信息
      const length = feature.end - feature.start + 1;
      content += `<div><strong>Length:</strong> ${length} bp</div>`;
      
      // 添加方向信息
      if (feature.strand) {
        content += `<div><strong>Strand:</strong> ${feature.strand === '+' ? 'Forward' : 'Reverse'}</div>`;
      }
      
      // 添加track信息
      if (feature.track) {
        content += `<div><strong>Track:</strong> ${feature.track.name}</div>`;
      }
      
      // 添加产品信息
      if (feature.attributes && feature.attributes.product) {
        content += `<div><strong>Product:</strong> ${feature.attributes.product}</div>`;
      }
      
      // 添加contig信息
      if (feature.seqid) {
        content += `<div><strong>Contig:</strong> ${feature.seqid}</div>`;
      }
      
      // 使用requestAnimationFrame更新DOM
      requestAnimationFrame(() => {
        this.tooltip.innerHTML = content;
      });
      
      // 添加鼠标移动事件监听器
      document.addEventListener('mousemove', throttledUpdatePosition);
    });

    // 监听容器鼠标离开事件
    container.addEventListener('mouseleave', hideTooltip);
  }
}
