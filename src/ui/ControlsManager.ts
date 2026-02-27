import { CGView } from '../core';

/**
 * 控制管理器类
 * 负责图例、标签和缩放控制等功能
 */
export class ControlsManager {
  private cgview: CGView | null = null;
  private legendToggle: HTMLButtonElement;
  private labelsToggle: HTMLButtonElement;
  private zoomInBtn: HTMLElement;
  private zoomOutBtn: HTMLElement;
  private resetZoomBtn: HTMLElement;
  private fullscreenBtn: HTMLElement;
  private exportSvgBtn: HTMLElement;
  private gffFileInput: HTMLInputElement;
  private dropArea: HTMLElement;
  private legendVisible = true;
  private labelsVisible = true;
  private currentZoom = 1;

  constructor() {
    this.legendToggle = document.getElementById('legend-toggle')! as HTMLButtonElement;
    this.labelsToggle = document.getElementById('labels-toggle')! as HTMLButtonElement;
    this.zoomInBtn = document.getElementById('zoom-in-btn')!;
    this.zoomOutBtn = document.getElementById('zoom-out-btn')!;
    this.resetZoomBtn = document.getElementById('reset-zoom-btn')!;
    this.fullscreenBtn = document.getElementById('fullscreen-btn')!;
    this.exportSvgBtn = document.getElementById('export-svg-btn')!;
    this.gffFileInput = document.getElementById('gff-file-input')! as HTMLInputElement;
    this.dropArea = document.getElementById('drop-area')!;

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
    // 图例切换
    this.legendToggle.addEventListener('click', () => {
      this.legendVisible = !this.legendVisible;
      this.toggleLegend(this.legendVisible);
      // 更新按钮文本
      const legendToggleText = this.legendToggle.querySelector('.toggle-text') as HTMLElement;
      if (legendToggleText) {
        legendToggleText.textContent = this.legendVisible ? 'Hide Legend' : 'Show Legend';
      }
      // 更新按钮样式
      this.legendToggle.classList.toggle('hide', !this.legendVisible);
    });
    
    // 标签切换
    this.labelsToggle.addEventListener('click', () => {
      this.labelsVisible = !this.labelsVisible;
      this.cgview?.toggleLabels(this.labelsVisible);
      // 更新按钮文本
      const labelsToggleText = this.labelsToggle.querySelector('.toggle-text') as HTMLElement;
      if (labelsToggleText) {
        labelsToggleText.textContent = this.labelsVisible ? 'Hide Labels' : 'Show Labels';
      }
      // 更新按钮样式
      this.labelsToggle.classList.toggle('hide', !this.labelsVisible);
    });

    // 缩放控制
    // 放大功能
    this.zoomInBtn.addEventListener('click', () => {
      this.currentZoom *= 1.2; // 放大20%
      // 限制缩放范围
      this.currentZoom = Math.min(this.currentZoom, 10);
      this.cgview?.setZoomLevel(this.currentZoom);
    });
    
    // 缩小功能
    this.zoomOutBtn.addEventListener('click', () => {
      this.currentZoom *= 0.8; // 缩小20%
      // 限制缩放范围
      this.currentZoom = Math.max(this.currentZoom, 0.1);
      this.cgview?.setZoomLevel(this.currentZoom);
    });
    
    // 重置缩放功能
    this.resetZoomBtn.addEventListener('click', () => {
      this.currentZoom = 1; // 重置为原始大小
      this.cgview?.setZoomLevel(this.currentZoom);
      // 重置平移位置
      this.cgview?.setPanOffset({ x: 0, y: 0 });
    });

    // 全屏按钮
    this.fullscreenBtn.addEventListener('click', () => {
      const container = document.getElementById('cgview-container')!;
      if (!document.fullscreenElement) {
        container.requestFullscreen().catch(err => {
          console.error(`Error attempting to enable fullscreen: ${err.message}`);
        });
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        }
      }
    });

    // 导出SVG按钮
    this.exportSvgBtn.addEventListener('click', async () => {
      if (!this.cgview) return;
      
      try {
        const blob = await this.cgview.export('svg');
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'cgview.svg';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (error) {
        console.error('Error exporting SVG:', error);
      }
    });

    // GFF 文件选择
    this.gffFileInput.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      if (target.files && target.files[0]) {
        const file = target.files[0];
        this.handleGffFile(file);
      }
    });
    
    // 拖放区域
    // 阻止默认拖放行为
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      this.dropArea.addEventListener(eventName, this.preventDefaults, false);
    });
    
    // 高亮拖放区域
    ['dragenter', 'dragover'].forEach(eventName => {
      this.dropArea.addEventListener(eventName, this.highlight, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
      this.dropArea.addEventListener(eventName, this.unhighlight, false);
    });
    
    // 处理拖放的文件
    this.dropArea.addEventListener('drop', this.handleDrop.bind(this), false);
    
    // 点击拖放区域打开文件选择
    this.dropArea.addEventListener('click', () => {
      this.gffFileInput.click();
    });
  }

  /**
   * 阻止默认拖放行为
   */
  private preventDefaults(e: Event) {
    e.preventDefault();
    e.stopPropagation();
  }

  /**
   * 高亮拖放区域
   */
  private highlight() {
    this.dropArea.classList.add('highlight');
  }

  /**
   * 取消高亮拖放区域
   */
  private unhighlight() {
    this.dropArea.classList.remove('highlight');
  }

  /**
   * 处理拖放的文件
   */
  private handleDrop(e: DragEvent) {
    const dt = e.dataTransfer;
    if (dt && dt.files) {
      const file = dt.files[0];
      if (file.name.endsWith('.gff') || file.name.endsWith('.gff3')) {
        this.handleGffFile(file);
      } else {
        alert('请选择 GFF 或 GFF3 格式的文件');
      }
    }
  }

  /**
   * 处理 GFF 文件
   */
  private async handleGffFile(file: File) {
    try {
      const container = document.getElementById('cgview-container')!;
      // 显示加载中状态
      container.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%; font-size: 18px; color: #666;">Loading genome data...</div>';
      
      // 读取文件内容
      const content = await file.text();
      console.log('Loaded GFF file content length:', content.length);
      console.log('First 100 characters:', content.substring(0, 100) + '...');
      
      // 清空容器，准备重新初始化
      container.innerHTML = '';
      
      // 触发文件加载事件
      document.dispatchEvent(new CustomEvent('gffFileLoaded', { detail: { content } }));
    } catch (error) {
      console.error('Error loading GFF file:', error);
      const container = document.getElementById('cgview-container')!;
      container.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%; font-size: 18px; color: #f44336;">Error loading GFF file. Please check the console for details.</div>';
    }
  }

  /**
   * 切换图例显示/隐藏
   */
  private toggleLegend(visible: boolean) {
    this.cgview?.toggleLegend(visible);
  }
}
