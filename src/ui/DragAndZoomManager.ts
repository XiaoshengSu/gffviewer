import { CGView } from '../core';

/**
 * 拖拽和缩放管理类
 * 负责画布的拖拽和缩放功能
 */
export class DragAndZoomManager {
  private cgview: CGView | null = null;
  private container: HTMLElement;
  private isDragging = false;
  private lastX = 0;
  private lastY = 0;
  private currentZoom = 1;

  constructor() {
    this.container = document.getElementById('cgview-container')!;
    this.initEventListeners();
  }

  /**
   * 初始化CGView实例
   */
  setCGView(cgview: CGView) {
    this.cgview = cgview;
  }

  /**
   * 设置当前缩放级别
   */
  setCurrentZoom(zoom: number) {
    this.currentZoom = zoom;
  }

  /**
   * 获取当前缩放级别
   */
  getCurrentZoom(): number {
    return this.currentZoom;
  }

  /**
   * 初始化事件监听器
   */
  private initEventListeners() {
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

    // 鼠标按下事件
    this.container.addEventListener('mousedown', (e: any) => {
      this.isDragging = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    });
    
    // 鼠标移动事件（使用节流）
    const throttledMouseMove = throttle((e: any) => {
      if (this.isDragging && this.cgview) {
        const deltaX = e.clientX - this.lastX;
        const deltaY = e.clientY - this.lastY;
        this.lastX = e.clientX;
        this.lastY = e.clientY;
        
        // 实现平移功能
        this.cgview.pan(deltaX, deltaY);
      }
    }, 16); // 约60fps
    
    this.container.addEventListener('mousemove', throttledMouseMove);
    
    // 鼠标释放事件
    this.container.addEventListener('mouseup', () => {
      this.isDragging = false;
    });
    
    // 鼠标离开事件
    this.container.addEventListener('mouseleave', () => {
      this.isDragging = false;
    });
    
    // 鼠标滚轮事件（缩放）（使用节流）
    const throttledWheel = throttle((e: any) => {
      if (!this.cgview) return;
      
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      this.currentZoom *= delta;
      // 限制缩放范围
      this.currentZoom = Math.max(0.1, Math.min(this.currentZoom, 10));
      // 计算鼠标在容器内的相对位置
      const rect = this.container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      // 实现缩放功能，传递鼠标位置信息
      this.cgview.setZoomLevel(this.currentZoom, { x, y });
    }, 16); // 约60fps
    
    this.container.addEventListener('wheel', throttledWheel);
  }
}
