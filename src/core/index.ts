// 核心引擎入口
import { CircularRenderer } from './renderer/circular';
import { DataManager, Genome } from './data';
import type { ViewMode, CGViewOptions, EventType, EventCallback, PanOffset, ExportOptions } from '../types';

/**
 * CGView 核心类
 * 整合渲染引擎和数据管理
 */
export class CGView {

  private options: CGViewOptions;
  private dataManager: DataManager;
  private circularRenderer: CircularRenderer;
  private currentRenderer: CircularRenderer;
  private viewMode: ViewMode;
  private genome: Genome | null = null;
  private eventListeners: Map<EventType, EventCallback[]> = new Map();
  private labelsVisible: boolean = true;
  
  constructor(container: HTMLElement, options: CGViewOptions = {}) {
    this.options = {
      width: 800,
      height: 600,
      theme: 'light',
      defaultViewMode: 'circular',
      showSidebar: true,
      showLegend: true,
      showToolbar: true,
      zoomEnabled: true,
      panEnabled: true,
      searchEnabled: true,
      rendererType: 'canvas',
      ...options
    };
    
    this.dataManager = new DataManager();
    
    // 创建渲染器
    this.circularRenderer = new CircularRenderer(
      container,
      this.options.width!,
      this.options.height!,
      this.options.rendererType
    );
    
    // 设置初始视图模式
    this.viewMode = 'circular';
    this.currentRenderer = this.circularRenderer;
    
    // 注册事件监听
    this.registerEventListeners();
  }
  
  /**
   * 注册事件监听
   */
  private registerEventListeners(): void {
    // 注册环形渲染器事件
    this.circularRenderer.on('zoom', (data) => this.emit('zoom', data));
    this.circularRenderer.on('pan', (data) => this.emit('pan', data));
    this.circularRenderer.on('click', (data) => this.emit('click', data));
    this.circularRenderer.on('hover', (data) => this.emit('hover', data));
  }
  
  /**
   * 加载基因组数据
   */
  async loadGenome(data: string | File, format: string = 'gff3'): Promise<void> {
    console.log('Loading genome data...');
    this.genome = await this.dataManager.loadGenome(data, format);
    console.log('Genome loaded successfully:', {
      tracks: this.genome.tracks.length,
      sequences: this.genome.sequences.length
    });
    
    // 设置基因组数据到渲染器
    this.circularRenderer.setGenome(this.genome);
    
    console.log('Genome set to renderers, rendering...');
    this.render();
    console.log('Rendering completed');
    this.emit('dataLoaded', this.genome);
  }
  
  /**
   * 设置视图模式（仅支持环形视图）
   */
  setViewMode(_mode: ViewMode): void {
    // 只支持环形视图
    this.viewMode = 'circular';
    this.currentRenderer = this.circularRenderer;
    
    this.circularRenderer.resize(this.options.width!, this.options.height!);
    this.circularRenderer.init();
    
    if (this.genome) {
      this.currentRenderer.setGenome(this.genome);
    }
    
    this.render();
    this.emit('viewModeChanged', 'circular');
  }
  
  /**
   * 缩放操作
   */
  zoomIn(): void {
    const currentZoom = 1.2;
    this.currentRenderer.setZoomLevel(currentZoom);
  }
  
  zoomOut(): void {
    const currentZoom = 0.8;
    this.currentRenderer.setZoomLevel(currentZoom);
  }
  
  /**
   * 设置缩放级别
   */
  setZoomLevel(level: number, point?: { x: number; y: number }): void {
    this.currentRenderer.setZoomLevel(level, point);
  }
  
  zoomTo(): void {
    // 实现缩放至特定区域
    // TODO: 实现具体逻辑
  }
  
  resetView(): void {
    this.currentRenderer.setZoomLevel(1);
    this.currentRenderer.setPanOffset({ x: 0, y: 0 });
  }
  
  
  /**
   * 平移操作
   */
  pan(deltaX: number, deltaY: number): void {
    // 这里需要实现累积平移的逻辑
    // 暂时简单实现
    this.currentRenderer.setPanOffset({ x: deltaX, y: deltaY });
  }
  
  /**
   * 切换图例显示/隐藏
   */
  toggleLegend(visible: boolean): void {
    // 检查当前渲染器是否有toggleLegend方法
    if ('toggleLegend' in this.currentRenderer) {
      (this.currentRenderer as any).toggleLegend(visible);
    }
  }
  
  /**
   * 切换标签显示/隐藏
   */
  toggleLabels(visible: boolean): void {
    this.labelsVisible = visible;
    this.currentRenderer.toggleLabels(visible);
  }
  
  /**
   * 切换参考圆线显示/隐藏
   */
  toggleGrid(visible: boolean): void {
    this.currentRenderer.toggleGrid(visible);
  }
  
  /**
   * 切换渲染模式
   */
  setRendererType(rendererType: 'canvas' | 'svg'): void {
    // 保存当前基因组数据
    const genome = this.genome;
    
    // 销毁当前渲染器
    this.currentRenderer.destroy();
    
    // 创建新的渲染器
    this.circularRenderer = new CircularRenderer(
      document.getElementById('cgview-container')!,
      this.options.width!,
      this.options.height!,
      rendererType
    );
    
    // 更新选项
    this.options.rendererType = rendererType;
    
    // 设置当前渲染器
    this.currentRenderer = this.circularRenderer;
    
    // 注册事件监听
    this.registerEventListeners();
    
    // 恢复基因组数据
    if (genome) {
      this.currentRenderer.setGenome(genome);
    }
    
    // 重新渲染
    this.render();
    this.emit('rendererTypeChanged', rendererType);
  }
  
  /**
   * 设置平移偏移
   */
  setPanOffset(offset: PanOffset): void {
    this.currentRenderer.setPanOffset(offset);
  }
  
  /**
   * 渲染当前视图
   */
  render(): void {
    this.currentRenderer.render();
  }
  
  /**
   * 调整大小
   */
  resize(width: number, height: number): void {
    this.options.width = width;
    this.options.height = height;
    this.currentRenderer.resize(width, height);
  }
  
  /**
   * 搜索特征
   */
  search(query: string): any[] {
    if (!this.genome) return [];
    return this.genome.searchFeatures(query);
  }
  
  /**
   * 高亮显示特定基因
   */
  highlightFeature(feature: any): void {
    // 调用渲染器的高亮方法
    this.currentRenderer.highlightFeature(feature);
  }
  
  /**
   * 导出
   */
  async export(format: 'svg' | 'png', options: ExportOptions = {}): Promise<Blob> {
    const { width = this.options.width!, height = this.options.height! } = options;
    
    if (format === 'png') {
      // 导出为PNG
      return this.exportPNG();
    } else if (format === 'svg') {
      // 导出为SVG
      return this.exportSVG(width, height);
    }
    
    throw new Error('Unsupported export format');
  }
  
  /**
   * 导出为PNG
   */
  private exportPNG(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      try {
        // 使用renderer的canvas属性
        const canvas = this.currentRenderer['canvas'];
        if (!canvas) {
          reject(new Error('Canvas is not available'));
          return;
        }
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create PNG blob'));
          }
        }, 'image/png');
      } catch (error) {
        reject(error);
      }
    });
  }
  
  /**
   * 导出为SVG
   */
  private exportSVG(width: number, height: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
      try {
        // 生成环形视图的SVG
        const svg = this.generateCircularSVG(width, height);
        const blob = new Blob([svg], { type: 'image/svg+xml' });
        resolve(blob);
      } catch (error) {
        reject(error);
      }
    });
  }
  
  /**
   * 生成环形视图的SVG
   */
  private generateCircularSVG(width: number, height: number): string {
    if (!this.genome) {
      return `
        <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
          <rect width="${width}" height="${height}" fill="white"/>
          <text x="${width/2}" y="${height/2}" text-anchor="middle" fill="black">
            No genome data available
          </text>
        </svg>
      `;
    }
    
    // 获取环形渲染器的参数
    const renderer = this.currentRenderer as any;
    const centerX = renderer.centerX || width / 2;
    const centerY = renderer.centerY || height / 2;
    const radius = renderer.radius || Math.min(width, height) / 3;
    const genomeLength = this.genome.length;
    
    let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="${height}" fill="white"/>
    `;
    
    // 渲染网格
    svg += this.generateGridSVG(centerX, centerY, radius);
    
    // 渲染轨道和特征
    svg += this.generateTracksSVG(centerX, centerY, radius, genomeLength);
    
    // 渲染比例尺
    svg += this.generateScaleSVG(centerX, centerY, radius, genomeLength);
    
    // 渲染标签
    svg += this.generateLabelsSVG(centerX, centerY, radius, genomeLength);
    
    // 渲染图例
    svg += this.generateLegendSVG(width, height);
    
    svg += `</svg>`;
    return svg;
  }
  
  /**
   * 生成标签的SVG
   */
  private generateLabelsSVG(centerX: number, centerY: number, radius: number, genomeLength: number): string {
    if (!this.genome || !this.labelsVisible) return '';
    
    let svg = '';
    const labelRadius = radius + 60; // 标签半径偏移
    const labelAngleWidth = 0.08; // 标签角度宽度
    
    // 用于碰撞检测的已渲染标签角度范围
    const renderedLabelAngles: { start: number; end: number }[] = [];
    
    // 渲染每个轨道的标签
    this.genome.tracks.forEach((track) => {
      if (!track.visible) return;
      
      track.features.forEach((feature: any) => {
        if (feature.name && this.canRenderLabel(feature, genomeLength, renderedLabelAngles, labelAngleWidth)) {
          const centerAngle = (feature.start + (feature.end - feature.start) / 2) / genomeLength * Math.PI * 2;
          const x = centerX + Math.cos(centerAngle) * labelRadius;
          const y = centerY + Math.sin(centerAngle) * labelRadius;
          
          // 计算文本旋转角度
          let rotation = centerAngle * 180 / Math.PI;
          let textAnchor = 'middle';
          let dominantBaseline = 'hanging';
          
          if (centerAngle >= Math.PI) {
            rotation += 180;
            dominantBaseline = 'bottom';
          }
          
          svg += `<text x="${x}" y="${y}" text-anchor="${textAnchor}" dominant-baseline="${dominantBaseline}" font-size="11px" fill="#333333" transform="rotate(${rotation}, ${x}, ${y})"><tspan>${feature.name}</tspan></text>
`;
        }
      });
    });
    
    return svg;
  }
  
  /**
   * 检查是否可以渲染标签（无碰撞）
   */
  private canRenderLabel(feature: any, genomeLength: number, renderedLabelAngles: { start: number; end: number }[], labelAngleWidth: number): boolean {
    // 计算特征的角度范围
    const featureStartAngle = (feature.start / genomeLength) * Math.PI * 2;
    const featureEndAngle = (feature.end / genomeLength) * Math.PI * 2;
    const featureCenterAngle = (featureStartAngle + featureEndAngle) / 2;
    
    // 计算标签所需的角度空间
    const labelStartAngle = featureCenterAngle - labelAngleWidth / 2;
    const labelEndAngle = featureCenterAngle + labelAngleWidth / 2;
    
    // 检查是否与已渲染的标签碰撞
    const isCollision = renderedLabelAngles.some(label => {
      return this.checkAngleCollision(labelStartAngle, labelEndAngle, label.start, label.end);
    });
    
    // 如果没有碰撞，记录标签角度范围
    if (!isCollision) {
      renderedLabelAngles.push({ start: labelStartAngle, end: labelEndAngle });
      return true;
    }
    
    return false;
  }
  
  /**
   * 检查角度范围是否碰撞
   */
  private checkAngleCollision(currentStart: number, currentEnd: number, labelStart: number, labelEnd: number): boolean {
    // 处理角度环绕的情况
    return (currentStart < labelEnd && currentEnd > labelStart) ||
           (currentStart + 2 * Math.PI < labelEnd && currentEnd + 2 * Math.PI > labelStart);
  }
  
  /**
   * 生成网格的SVG
   */
  private generateGridSVG(centerX: number, centerY: number, radius: number): string {
    let svg = '';
    
    // 绘制同心圆
    for (let i = 1; i <= 5; i++) {
      const r = radius * (i / 5);
      svg += `<circle cx="${centerX}" cy="${centerY}" r="${r}" fill="none" stroke="#e0e0e0" stroke-width="1"/>
`;
    }
    
    // 绘制径向线
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const x1 = centerX + Math.cos(angle) * radius;
      const y1 = centerY + Math.sin(angle) * radius;
      svg += `<line x1="${centerX}" y1="${centerY}" x2="${x1}" y2="${y1}" stroke="#e0e0e0" stroke-width="1"/>
`;
    }
    
    return svg;
  }
  
  /**
   * 生成轨道和特征的SVG
   */
  private generateTracksSVG(centerX: number, centerY: number, radius: number, genomeLength: number): string {
    if (!this.genome) return '';
    
    let svg = '';
    const allTracks = this.genome.tracks;
    
    // 分离轨道：非GC轨道和GC轨道
    const nonGCTracks = allTracks.filter(track => track.type !== 'gc_content' && track.type !== 'gc_skew_plus' && track.type !== 'gc_skew_minus');
    const gcContentTrack = allTracks.find(track => track.type === 'gc_content');
    const gcSkewPlusTrack = allTracks.find(track => track.type === 'gc_skew_plus');
    const gcSkewMinusTrack = allTracks.find(track => track.type === 'gc_skew_minus');
    
    // 计算可见轨道数量
    const visibleNonGCTracks = nonGCTracks.filter(track => track.visible);
    const gcContentVisible = gcContentTrack && gcContentTrack.visible;
    const gcSkewPlusVisible = gcSkewPlusTrack && gcSkewPlusTrack.visible;
    const gcSkewMinusVisible = gcSkewMinusTrack && gcSkewMinusTrack.visible;
    const gcSkewVisible = gcSkewPlusVisible || gcSkewMinusVisible;
    
    // 动态计算轨道高度
    const minTrackHeight = 15;
    const maxTrackHeight = 30;
    let actualTrackCount = visibleNonGCTracks.length;
    if (gcContentVisible) actualTrackCount++;
    if (gcSkewVisible) actualTrackCount++;
    const trackHeight = Math.min(maxTrackHeight, Math.max(minTrackHeight, radius / (actualTrackCount + 2)));
    const trackSpacing = 5;
    
    let currentRadius = radius;
    
    // 渲染非GC轨道
    visibleNonGCTracks.forEach((track) => {
      // 绘制轨道背景
      svg += this.generateTrackBackgroundSVG(centerX, centerY, currentRadius, trackHeight);
      
      // 绘制特征
      track.features.forEach((feature: any) => {
        svg += this.generateFeatureSVG(feature, track, centerX, centerY, currentRadius, trackHeight, genomeLength);
      });
      
      currentRadius -= trackHeight + trackSpacing;
    });
    
    // 渲染GC Content轨道
    if (gcContentVisible && gcContentTrack) {
      // 绘制轨道背景
      svg += this.generateTrackBackgroundSVG(centerX, centerY, currentRadius, trackHeight);
      
      // 绘制特征
      gcContentTrack.features.forEach((feature: any) => {
        svg += this.generateGCFeatureSVG(feature, gcContentTrack!, centerX, centerY, currentRadius, trackHeight, genomeLength);
      });
      
      currentRadius -= trackHeight + trackSpacing;
    }
    
    // 渲染GC Skew轨道
    if (gcSkewVisible) {
      // 绘制轨道背景
      svg += this.generateTrackBackgroundSVG(centerX, centerY, currentRadius, trackHeight);
      
      // 绘制GC Skew+特征
      if (gcSkewPlusVisible && gcSkewPlusTrack) {
        gcSkewPlusTrack.features.forEach((feature: any) => {
          const value = parseFloat(feature.attributes.value || '0');
          if (value > 0) {
            svg += this.generateGCFeatureSVG(feature, gcSkewPlusTrack!, centerX, centerY, currentRadius, trackHeight, genomeLength);
          }
        });
      }
      
      // 绘制GC Skew-特征
      if (gcSkewMinusVisible && gcSkewMinusTrack) {
        gcSkewMinusTrack.features.forEach((feature: any) => {
          const value = parseFloat(feature.attributes.value || '0');
          if (value < 0) {
            svg += this.generateGCFeatureSVG(feature, gcSkewMinusTrack!, centerX, centerY, currentRadius, trackHeight, genomeLength);
          }
        });
      }
      
      currentRadius -= trackHeight + trackSpacing;
    }
    
    return svg;
  }
  
  /**
   * 生成轨道背景的SVG
   */
  private generateTrackBackgroundSVG(centerX: number, centerY: number, radius: number, trackHeight: number): string {
    const innerRadius = radius - trackHeight;
    return `<path d="M ${centerX} ${centerY - radius} A ${radius} ${radius} 0 1 1 ${centerX - 0.1} ${centerY - radius} L ${centerX - 0.1} ${centerY - innerRadius} A ${innerRadius} ${innerRadius} 0 1 0 ${centerX} ${centerY - innerRadius} Z" fill="#f5f5f5" fill-opacity="0.5"/>
`;
  }
  
  /**
   * 生成特征的SVG
   */
  private generateFeatureSVG(feature: any, track: any, centerX: number, centerY: number, radius: number, trackHeight: number, genomeLength: number): string {
    // 计算基础角度
    let baseStartAngle = (feature.start / genomeLength) * Math.PI * 2;
    let baseEndAngle = (feature.end / genomeLength) * Math.PI * 2;
    let baseAngleWidth = baseEndAngle - baseStartAngle;
    
    // 确保即使是非常短的基因也能被渲染
    const minAngleWidth = 0.005;
    if (baseAngleWidth < minAngleWidth) {
      const centerAngle = (baseStartAngle + baseEndAngle) / 2;
      const halfMinAngle = minAngleWidth / 2;
      baseStartAngle = centerAngle - halfMinAngle;
      baseEndAngle = centerAngle + halfMinAngle;
      baseAngleWidth = minAngleWidth;
    }
    
    // 添加缝隙
    const minGapAngle = 0.0005;
    const maxGapAngle = 0.002;
    const gapAngle = Math.min(maxGapAngle, Math.max(minGapAngle, baseAngleWidth * 0.05));
    
    const startAngle = baseStartAngle + gapAngle;
    const endAngle = baseEndAngle - gapAngle;
    const angleWidth = endAngle - startAngle;
    
    if (angleWidth <= 0) return '';
    
    const innerRadius = radius - trackHeight;
    
    // 计算路径
    const startX1 = centerX + Math.cos(startAngle) * radius;
    const startY1 = centerY + Math.sin(startAngle) * radius;
    const endX1 = centerX + Math.cos(endAngle) * radius;
    const endY1 = centerY + Math.sin(endAngle) * radius;
    const startX2 = centerX + Math.cos(endAngle) * innerRadius;
    const startY2 = centerY + Math.sin(endAngle) * innerRadius;
    const endX2 = centerX + Math.cos(startAngle) * innerRadius;
    const endY2 = centerY + Math.sin(startAngle) * innerRadius;
    
    const largeArcFlag = angleWidth > Math.PI ? 1 : 0;
    
    return `<path d="M ${startX1} ${startY1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX1} ${endY1} L ${startX2} ${startY2} A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${endX2} ${endY2} Z" fill="${track.color}" fill-opacity="1"/>
`;
  }
  
  /**
   * 生成GC特征的SVG
   */
  private generateGCFeatureSVG(feature: any, track: any, centerX: number, centerY: number, radius: number, trackHeight: number, genomeLength: number): string {
    const value = parseFloat(feature.attributes.value || '0');
    const startAngle = (feature.start / genomeLength) * Math.PI * 2;
    const endAngle = (feature.end / genomeLength) * Math.PI * 2;
    const angleWidth = endAngle - startAngle;
    
    if (angleWidth <= 0) return '';
    
    let svg = '';
    
    if (track.type === 'gc_content') {
      const maxHeight = trackHeight * 0.8;
      const normalizedValue = (value - 50) / 20;
      const barHeight = Math.abs(normalizedValue) * maxHeight;
      
      if (normalizedValue > 0) {
        // 正向值：在圈外
        const outerRadius = radius + barHeight;
        const innerRadius = radius;
        
        const startX1 = centerX + Math.cos(startAngle) * outerRadius;
        const startY1 = centerY + Math.sin(startAngle) * outerRadius;
        const endX1 = centerX + Math.cos(endAngle) * outerRadius;
        const endY1 = centerY + Math.sin(endAngle) * outerRadius;
        const startX2 = centerX + Math.cos(endAngle) * innerRadius;
        const startY2 = centerY + Math.sin(endAngle) * innerRadius;
        const endX2 = centerX + Math.cos(startAngle) * innerRadius;
        const endY2 = centerY + Math.sin(startAngle) * innerRadius;
        
        const largeArcFlag = angleWidth > Math.PI ? 1 : 0;
        
        svg += `<path d="M ${startX1} ${startY1} A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${endX1} ${endY1} L ${startX2} ${startY2} A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${endX2} ${endY2} Z" fill="${track.color}" fill-opacity="0.8"/>
`;
      } else {
        // 负值：在圈内
        const outerRadius = radius;
        const innerRadius = radius - barHeight;
        
        const startX1 = centerX + Math.cos(startAngle) * outerRadius;
        const startY1 = centerY + Math.sin(startAngle) * outerRadius;
        const endX1 = centerX + Math.cos(endAngle) * outerRadius;
        const endY1 = centerY + Math.sin(endAngle) * outerRadius;
        const startX2 = centerX + Math.cos(endAngle) * innerRadius;
        const startY2 = centerY + Math.sin(endAngle) * innerRadius;
        const endX2 = centerX + Math.cos(startAngle) * innerRadius;
        const endY2 = centerY + Math.sin(startAngle) * innerRadius;
        
        const largeArcFlag = angleWidth > Math.PI ? 1 : 0;
        
        svg += `<path d="M ${startX1} ${startY1} A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${endX1} ${endY1} L ${startX2} ${startY2} A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${endX2} ${endY2} Z" fill="${track.color}" fill-opacity="0.8"/>
`;
      }
    } else if (track.type === 'gc_skew_plus') {
      // GC Skew+ 渲染：正向在圈外
      const maxHeight = trackHeight * 0.8;
      const barHeight = Math.abs(value) * maxHeight / 0.5;
      
      const outerRadius = radius + barHeight;
      const innerRadius = radius;
      
      const startX1 = centerX + Math.cos(startAngle) * outerRadius;
      const startY1 = centerY + Math.sin(startAngle) * outerRadius;
      const endX1 = centerX + Math.cos(endAngle) * outerRadius;
      const endY1 = centerY + Math.sin(endAngle) * outerRadius;
      const startX2 = centerX + Math.cos(endAngle) * innerRadius;
      const startY2 = centerY + Math.sin(endAngle) * innerRadius;
      const endX2 = centerX + Math.cos(startAngle) * innerRadius;
      const endY2 = centerY + Math.sin(startAngle) * innerRadius;
      
      const largeArcFlag = angleWidth > Math.PI ? 1 : 0;
      
      svg += `<path d="M ${startX1} ${startY1} A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${endX1} ${endY1} L ${startX2} ${startY2} A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${endX2} ${endY2} Z" fill="${track.color}" fill-opacity="0.8"/>
`;
    } else if (track.type === 'gc_skew_minus') {
      // GC Skew- 渲染：负向在圈内
      const maxHeight = trackHeight * 0.8;
      const barHeight = Math.abs(value) * maxHeight / 0.5;
      
      const outerRadius = radius - trackHeight;
      const innerRadius = radius - trackHeight - barHeight;
      
      const startX1 = centerX + Math.cos(startAngle) * outerRadius;
      const startY1 = centerY + Math.sin(startAngle) * outerRadius;
      const endX1 = centerX + Math.cos(endAngle) * outerRadius;
      const endY1 = centerY + Math.sin(endAngle) * outerRadius;
      const startX2 = centerX + Math.cos(endAngle) * innerRadius;
      const startY2 = centerY + Math.sin(endAngle) * innerRadius;
      const endX2 = centerX + Math.cos(startAngle) * innerRadius;
      const endY2 = centerY + Math.sin(startAngle) * innerRadius;
      
      const largeArcFlag = angleWidth > Math.PI ? 1 : 0;
      
      svg += `<path d="M ${startX1} ${startY1} A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${endX1} ${endY1} L ${startX2} ${startY2} A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${endX2} ${endY2} Z" fill="${track.color}" fill-opacity="0.8"/>
`;
    }
    
    return svg;
  }
  
  /**
   * 生成比例尺的SVG
   */
  private generateScaleSVG(_centerX: number, _centerY: number, _radius: number, _genomeLength: number): string {
    // 返回空字符串，不生成比例尺
    return '';
  }
  
  /**
   * 生成图例的SVG
   */
  private generateLegendSVG(width: number, _height: number): string {
    if (!this.genome) return '';
    
    // 图例位置：右侧，与圈图保持一定距离
    const legendX = width - 180;
    const legendY = 50;
    const itemHeight = 25;
    
    // 计算图例项数量
    const visibleTracks = this.genome.tracks.filter((track: any) => track.visible);
    const legendItemCount = visibleTracks.length;
    
    let svg = '';
    
    // 绘制图例背景
    svg += `<rect x="${legendX - 10}" y="${legendY - 10}" width="170" height="${30 + legendItemCount * itemHeight}" fill="#f5f5f5" fill-opacity="0.8" stroke="#e0e0e0" stroke-width="1"/>
`;
    
    // 绘制图例标题
    svg += `<text x="${legendX}" y="${legendY + 15}" font-size="14" font-weight="bold" fill="#333333">Tracks</text>
`;
    
    // 绘制所有可见轨道的图例项
    let currentItemIndex = 0;
    visibleTracks.forEach((track: any) => {
      const itemY = legendY + 30 + currentItemIndex * itemHeight;
      
      // 绘制颜色块
      svg += `<rect x="${legendX}" y="${itemY}" width="20" height="15" fill="${track.color}" stroke="#333333" stroke-width="1"/>
`;
      
      // 绘制轨道名称
      svg += `<text x="${legendX + 30}" y="${itemY + 12}" font-size="12" fill="#333333">${track.name}</text>
`;
      
      currentItemIndex++;
    });
    
    return svg;
  }
  
  /**
   * 注册事件监听器
   */
  on(event: EventType, callback: EventCallback): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)?.push(callback);
  }
  
  /**
   * 移除事件监听器
   */
  off(event: EventType, callback: EventCallback): void {
    if (this.eventListeners.has(event)) {
      const callbacks = this.eventListeners.get(event);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    }
  }
  
  /**
   * 触发事件
   */
  private emit(event: EventType, data?: any): void {
    if (this.eventListeners.has(event)) {
      const callbacks = this.eventListeners.get(event);
      callbacks?.forEach(callback => callback(data));
    }
  }
  
  /**
   * 销毁
   */
  destroy(): void {
    this.circularRenderer.destroy();
    this.eventListeners.clear();
  }
  
  /**
   * 获取当前视图模式
   */
  getViewMode(): ViewMode {
    return this.viewMode;
  }
  
  /**
   * 获取基因组数据
   */
  getGenome(): Genome | null {
    return this.genome;
  }
  
  /**
   * 获取选项
   */
  getOptions(): CGViewOptions {
    return { ...this.options };
  }
}

// 导出核心类和类型
export { CircularRenderer, DataManager, Genome };
export * from '../types';