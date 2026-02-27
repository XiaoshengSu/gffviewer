// 环形渲染器
import * as PIXI from 'pixi.js';
import * as d3 from 'd3';
import { BaseRenderer } from '../base';
import type { RendererType } from '../../../types';
import type { PanOffset, Genome } from '../../../types';
import { LODManager } from '../../utils/lod-manager';
import { IntervalTree } from '../../utils/spatial-index';
import { RENDER_CONFIG } from './config';
import { FeatureRenderer } from './feature-renderer';
import { LabelRenderer } from './label-renderer';
import { GridScaleRenderer } from './grid-scale-renderer';
import { LegendRenderer } from './legend-renderer';
import { ZoomPanController } from './zoom-pan-controller';

/**
 * 环形渲染器类
 * 实现环形视图的渲染逻辑
 */
export class CircularRenderer extends BaseRenderer {
  /** 基因组数据 */
  private genome: Genome | null = null;
  /** 缩放级别 */
  private zoomLevel: number = 1;
  /** 渲染中心X坐标 */
  private centerX: number;
  /** 渲染中心Y坐标 */
  private centerY: number;
  /** 渲染半径 */
  private radius: number;
  /** 特征容器 */
  private featureContainer?: PIXI.Container;
  /** 标签容器 */
  private labelContainer?: PIXI.Container;
  /** 比例尺容器 */
  private scaleContainer?: PIXI.Container;
  /** 网格容器 */
  private gridContainer?: PIXI.Container;
  /** 图例容器 */
  private legendContainer?: PIXI.Container;
  /** 细节层级管理器 */
  private lodManager: LODManager;
  /** 空间索引 */
  private spatialIndex: IntervalTree;
  /** 标签是否可见 */
  private labelsVisible: boolean = true;
  /** SVG容器 */
  private svgContainer?: d3.Selection<SVGElement, unknown, null, undefined>;
  
  /** 渲染器实例 */
  private featureRenderer: FeatureRenderer;
  private labelRenderer: LabelRenderer;
  private gridScaleRenderer: GridScaleRenderer;
  private legendRenderer: LegendRenderer;
  private zoomPanController: ZoomPanController;
  
  constructor(container: HTMLElement, width: number, height: number, rendererType: RendererType = 'canvas') {
    // 调用父类构造函数
    super(container, width, height, rendererType);
    
    // 初始化 LOD 管理器和空间索引
    this.lodManager = new LODManager();
    this.spatialIndex = new IntervalTree();
    
    // 调整中心位置，为左侧操作栏和右侧图例留出空间
    const sidebarWidth = RENDER_CONFIG.SIDEBAR_WIDTH; // 左侧操作栏宽度
    const legendWidth = RENDER_CONFIG.LEGEND_WIDTH; // 右侧图例宽度
    this.centerX = sidebarWidth + (width - sidebarWidth - legendWidth) / 2;
    this.centerY = height / 2;
    // 调整半径，确保不与图例重叠
    this.radius = Math.min((width - sidebarWidth - legendWidth), height) / 2 - RENDER_CONFIG.MARGIN;
    
    // 初始化各个渲染器
    this.featureRenderer = new FeatureRenderer(this.centerX, this.centerY, this.radius, this.zoomLevel, this.lodManager, (feature) => {
      // 触发hover事件，显示或隐藏悬浮提示
      this.emit('hover', feature);
    });
    this.labelRenderer = new LabelRenderer(this.centerX, this.centerY, this.radius, this.labelsVisible, this.zoomLevel, this.lodManager);
    this.gridScaleRenderer = new GridScaleRenderer(this.centerX, this.centerY, this.radius);
    this.legendRenderer = new LegendRenderer(width);
    this.zoomPanController = new ZoomPanController(this.centerX, this.centerY, width, height, this.zoomLevel);
    
    console.log('CircularRenderer: Constructor called with width:', width, 'height:', height);
    console.log('CircularRenderer: Calculated center:', { x: this.centerX, y: this.centerY });
    console.log('CircularRenderer: Calculated radius:', this.radius);
    
    // 监听初始化完成事件
    this.on('initialized', () => {
      if (this.rendererType === 'canvas') {
        this.initializeCanvasContainers();
      } else {
        this.initializeSvgContainers();
      }
      // 初始化完成后重新渲染，确保所有元素都能正确显示
      this.render();
    });
    
    // 如果stage已经存在（同步初始化的情况）
    if (this.stage && this.rendererType === 'canvas') {
      this.initializeCanvasContainers();
    }
    
    // 如果svg已经存在（同步初始化的情况）
    if (this.svg && this.rendererType === 'svg') {
      this.initializeSvgContainers();
      // 初始化完成后重新渲染，确保所有元素都能正确显示
      this.render();
    }
  }
  
  /**
   * 初始化Canvas容器
   */
  private initializeCanvasContainers(): void {
    if (!this.stage) return;
    
    // 创建容器
    this.featureContainer = new PIXI.Container();
    this.labelContainer = new PIXI.Container();
    this.scaleContainer = new PIXI.Container();
    this.gridContainer = new PIXI.Container();
    this.legendContainer = new PIXI.Container();
    
    // 创建一个主容器来包含圈图相关的所有元素
    const circleContainer = new PIXI.Container();
    circleContainer.addChild(this.gridContainer);
    circleContainer.addChild(this.featureContainer);
    circleContainer.addChild(this.labelContainer);
    circleContainer.addChild(this.scaleContainer);
    
    // 添加交互性，使圈图可拖拽
    circleContainer.eventMode = 'dynamic';
    // 移除默认的移动鼠标效果，只有在拖拽时才显示
    
    // 拖拽逻辑
    let isDragging = false;
    let lastX = 0;
    let lastY = 0;
    
    circleContainer.on('pointerdown', (event) => {
      isDragging = true;
      lastX = event.data.global.x;
      lastY = event.data.global.y;
      // 只有在按住鼠标时才显示移动鼠标效果
      circleContainer.cursor = 'move';
    });
    
    circleContainer.on('pointermove', (event) => {
      if (isDragging) {
        const deltaX = event.data.global.x - lastX;
        const deltaY = event.data.global.y - lastY;
        lastX = event.data.global.x;
        lastY = event.data.global.y;
        
        // 移动整个圈图容器
        circleContainer.position.x += deltaX;
        circleContainer.position.y += deltaY;
      } else {
        // 非拖拽状态下，处理鼠标悬停
        const rect = this.canvas?.getBoundingClientRect();
        if (rect) {
          this.handleMouseMove({ clientX: event.data.global.x, clientY: event.data.global.y } as MouseEvent);
        }
      }
    });
    
    circleContainer.on('pointerup', () => {
      isDragging = false;
      // 释放鼠标时恢复默认鼠标效果
      circleContainer.cursor = 'default';
    });
    
    circleContainer.on('pointerupoutside', () => {
      isDragging = false;
      // 释放鼠标时恢复默认鼠标效果
      circleContainer.cursor = 'default';
      // 鼠标离开画布，触发空hover事件
      this.emit('hover', null);
    });
    
    circleContainer.on('pointerout', () => {
      // 鼠标离开容器，触发空hover事件
      this.emit('hover', null);
    });
    
    // 添加到舞台
    this.stage.addChild(circleContainer);
    this.stage.addChild(this.legendContainer);
    
    this.init();
  }
  
  /**
   * 初始化SVG容器
   */
  private initializeSvgContainers(): void {
    // 获取SVG元素
    const svgElement = this.svg;
    if (!svgElement) {
      console.error('CircularRenderer: svgElement is null, cannot initialize SVG containers');
      return;
    }
    
    console.log('CircularRenderer: Initializing SVG containers with svgElement:', svgElement);
    
    // 使用d3选择SVG元素
    this.svgContainer = d3.select(svgElement);
    
    // 清空SVG内容
    this.svgContainer.selectAll('*').remove();
    
    // 创建SVG组元素作为容器（注意顺序：网格在最底层，特征在中间，其他元素在上面）
    this.svgContainer.append('g').attr('id', 'gridContainer').style('z-index', '1');
    this.svgContainer.append('g').attr('id', 'featureContainer').style('z-index', '2');
    this.svgContainer.append('g').attr('id', 'labelContainer').style('z-index', '3');
    this.svgContainer.append('g').attr('id', 'scaleContainer').style('z-index', '4');
    this.svgContainer.append('g').attr('id', 'legendContainer').style('z-index', '5');
    
    console.log('CircularRenderer: SVG containers initialized successfully');
    console.log('SVG container:', this.svgContainer);
    
    // 添加交互性，使圈图可拖拽
    const circleContainer = this.svgContainer.select('g#featureContainer');
    
    // 拖拽逻辑
    let isDragging = false;
    let lastX = 0;
    let lastY = 0;
    
    // 使用D3.js的事件处理系统，确保事件处理的一致性
    const svg = this.svgContainer;
    
    svg.on('mousedown', (event) => {
      // 只在点击featureContainer时开始拖拽
      if (event.target.closest('#featureContainer')) {
        isDragging = true;
        lastX = event.clientX;
        lastY = event.clientY;
        circleContainer.style('cursor', 'move');
      }
    });
    
    svg.on('mousemove', (event) => {
      if (isDragging) {
        event.preventDefault(); // 防止默认行为
        const deltaX = event.clientX - lastX;
        const deltaY = event.clientY - lastY;
        lastX = event.clientX;
        lastY = event.clientY;
        
        // 只移动圈图相关的容器，不移动图例容器及其子元素
        svg.selectAll('g#gridContainer, g#featureContainer, g#labelContainer, g#scaleContainer').each(function() {
          const g = d3.select(this);
          const transform = g.attr('transform') || 'translate(0,0)';
          const match = transform.match(/translate\(([^,]+),([^\)]+)\)/);
          if (match) {
            const x = parseFloat(match[1]) + deltaX;
            const y = parseFloat(match[2]) + deltaY;
            g.attr('transform', `translate(${x},${y})`);
          } else {
            g.attr('transform', `translate(${deltaX},${deltaY})`);
          }
        });
      } else {
        // 非拖拽状态下，处理鼠标悬停
        this.handleMouseMove(event);
      }
    });
    
    svg.on('mouseup', () => {
      isDragging = false;
      circleContainer.style('cursor', 'default');
    });
    
    svg.on('mouseleave', () => {
      isDragging = false;
      circleContainer.style('cursor', 'default');
    });
    
    this.init();
  }
  
  /**
   * 初始化渲染器
   */
  init(): void {
    if (this.rendererType === 'canvas') {
      this.gridScaleRenderer.renderCanvasGrid(this.gridContainer);
      this.gridScaleRenderer.renderCanvasScale(this.genome, this.scaleContainer);
    } else {
      this.gridScaleRenderer.renderSvgGrid(this.svgContainer);
      this.gridScaleRenderer.renderSvgScale(this.genome, this.svgContainer);
    }
  }
  
  /**
   * 设置基因组数据
   */
  setGenome(genome: Genome): void {
    this.genome = genome;
    
    // 更新空间索引
    this.spatialIndex.clear();
    if (genome) {
      genome.tracks.forEach(track => {
        track.features.forEach(feature => {
          // 添加track信息到feature对象，以便在hover事件中使用
          feature.track = track;
          this.spatialIndex.insert(feature);
        });
      });
    }
    
    // 延迟一小段时间后再渲染，确保数据处理完成
    setTimeout(() => {
      this.render();
    }, 50);
  }
  
  /**
   * 渲染当前视图
   */
  render(): void {
    console.log('CircularRenderer.render() called');
    
    if (this.rendererType === 'canvas') {
      this.renderCanvas();
    } else {
      this.renderSvg();
    }
  }
  
  /**
   * 使用Canvas渲染
   */
  private renderCanvas(): void {
    // 只有当stage存在时才渲染
    if (!this.stage) {
      console.warn('CircularRenderer: stage is null, waiting for initialization');
      // 尝试使用fallback canvas绘制一些基本图形
      if ((this as any).canvas) {
        const ctx = (this as any).canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, (this as any).canvas.width, (this as any).canvas.height);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, (this as any).canvas.width, (this as any).canvas.height);
          ctx.fillStyle = '#333333';
          ctx.font = '12px Arial';
          ctx.textAlign = 'center';
          ctx.fillText('Initializing...', (this as any).canvas.width / 2, (this as any).canvas.height / 2);
        }
      }
      // 当stage为null时，添加一个短暂的延迟后再次尝试渲染
      setTimeout(() => {
        this.render();
      }, 100);
      return;
    }
    
    console.log('CircularRenderer: rendering with stage', this.stage);
    
    // 清空容器
    this.featureContainer?.removeChildren();
    this.labelContainer?.removeChildren();
    
    // 绘制一个简单的圆形，确认渲染系统正常工作
    const graphics = new PIXI.Graphics();
    graphics.circle(this.centerX, this.centerY, this.radius);
    graphics.fill({ color: 0xffffff });
    graphics.setStrokeStyle({ width: 2, color: 0x333333 });
    this.featureContainer?.addChild(graphics);
    
    // 渲染特征
    if (this.genome) {
      console.log('CircularRenderer: rendering features for genome with', this.genome.tracks.length, 'tracks');
      this.renderCanvasFeatures();
      this.labelRenderer.renderCanvasLabels(this.genome, this.labelContainer);
    } else {
      console.warn('CircularRenderer: genome is null, skipping feature rendering');
      // 绘制一个提示文本
      const text = new PIXI.Text({
        text: 'No genome data loaded yet',
        style: {
          fontSize: 16,
          fill: 0x333333,
          align: 'center'
        }
      });
      text.anchor.set(0.5);
      text.position.set(this.centerX, this.centerY);
      this.labelContainer?.addChild(text);
    }
    
    // 渲染网格、比例尺和图例
    this.gridScaleRenderer.renderCanvasGrid(this.gridContainer);
    this.gridScaleRenderer.renderCanvasScale(this.genome, this.scaleContainer);
    this.legendRenderer.renderCanvasLegend(this.genome, this.legendContainer);
    console.log('CircularRenderer.render() completed');
  }
  
  /**
   * 使用SVG渲染
   */
  private renderSvg(): void {
    if (!this.svgContainer) {
      console.warn('CircularRenderer: svgContainer is null, waiting for initialization');
      setTimeout(() => {
        this.render();
      }, 100);
      return;
    }
    
    console.log('CircularRenderer: rendering with SVG');
    
    // 清空容器
    this.svgContainer.select('g#featureContainer').selectAll('*').remove();
    this.svgContainer.select('g#labelContainer').selectAll('*').remove();
    this.svgContainer.select('g#gridContainer').selectAll('*').remove();
    this.svgContainer.select('g#scaleContainer').selectAll('*').remove();
    this.svgContainer.select('g#legendContainer').selectAll('*').remove();
    
    // 渲染网格（在最底层）
    this.gridScaleRenderer.renderSvgGrid(this.svgContainer);
    
    // 渲染特征
    if (this.genome) {
      console.log('CircularRenderer: rendering features for genome with', this.genome.tracks.length, 'tracks');
      this.renderSvgFeatures();
      this.labelRenderer.renderSvgLabels(this.genome, this.svgContainer);
      
      // 延迟一小段时间后再次渲染，确保GC轨道能够正确显示
      setTimeout(() => {
        console.log('CircularRenderer: re-rendering features to ensure GC tracks are displayed');
        // 只重新渲染特征，不重新渲染网格、比例尺和图例
        this.svgContainer?.select('g#featureContainer').selectAll('*').remove();
        this.renderSvgFeatures();
        // 确保图例在最后渲染，不会覆盖GC轨道
        this.legendRenderer.renderSvgLegend(this.genome, this.svgContainer);
        console.log('CircularRenderer: re-rendering completed');
      }, 100);
    } else {
      console.warn('CircularRenderer: genome is null, skipping feature rendering');
      // 绘制一个提示文本
      this.svgContainer.select('g#labelContainer')
        .append('text')
        .attr('x', this.centerX)
        .attr('y', this.centerY)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('font-size', '16px')
        .attr('fill', '#333333')
        .text('No genome data loaded yet');
    }
    
    // 渲染比例尺（在最上层）
    this.gridScaleRenderer.renderSvgScale(this.genome, this.svgContainer);
    console.log('CircularRenderer.render() completed');
  }
  
  /**
   * 渲染基因特征（Canvas）
   */
  private renderCanvasFeatures(): void {
    if (!this.genome) return;
    
    const genomeLength = this.genome.length;
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
    
    // 动态计算轨道高度，确保轨道之间有足够的空间
    const trackHeight = this.featureRenderer.calculateTrackHeight(visibleNonGCTracks.length, gcContentVisible, gcSkewVisible);
    const trackSpacing = RENDER_CONFIG.TRACK_SPACING;
    
    let currentRadius = this.radius;
    
    // 渲染非GC轨道
    currentRadius = this.featureRenderer.renderCanvasNonGCTracks(visibleNonGCTracks, currentRadius, trackHeight, trackSpacing, genomeLength, this.featureContainer);
    
    // 渲染GC Content轨道
    if (gcContentVisible) {
      currentRadius = this.featureRenderer.renderCanvasGCTrack(gcContentTrack!, currentRadius, trackHeight, trackSpacing, genomeLength, this.featureContainer);
    }
    
    // 渲染合并的GC Skew轨道
    if (gcSkewVisible) {
      currentRadius = this.featureRenderer.renderCanvasGCSkewTracks(gcSkewPlusTrack!, gcSkewMinusTrack!, gcSkewPlusVisible, gcSkewMinusVisible, currentRadius, trackHeight, trackSpacing, genomeLength, this.featureContainer);
    }
  }
  
  /**
   * 渲染基因特征（SVG）
   */
  private renderSvgFeatures(): void {
    if (!this.genome || !this.svgContainer) return;
    
    const genomeLength = this.genome.length;
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
    
    // 动态计算轨道高度，确保轨道之间有足够的空间
    const trackHeight = this.featureRenderer.calculateTrackHeight(visibleNonGCTracks.length, gcContentVisible, gcSkewVisible);
    const trackSpacing = RENDER_CONFIG.TRACK_SPACING;
    
    let currentRadius = this.radius;
    
    // 渲染非GC轨道
    currentRadius = this.featureRenderer.renderSvgNonGCTracks(visibleNonGCTracks, currentRadius, trackHeight, trackSpacing, genomeLength, this.svgContainer);
    
    // 渲染GC Content轨道
    if (gcContentVisible) {
      currentRadius = this.featureRenderer.renderSvgGCTrack(gcContentTrack!, currentRadius, trackHeight, trackSpacing, genomeLength, this.svgContainer);
    }
    
    // 渲染合并的GC Skew轨道
    if (gcSkewVisible) {
      currentRadius = this.featureRenderer.renderSvgGCSkewTracks(gcSkewPlusTrack!, gcSkewMinusTrack!, gcSkewPlusVisible, gcSkewMinusVisible, currentRadius, trackHeight, trackSpacing, genomeLength, this.svgContainer);
    }
  }
  
  /**
   * 切换标签显示/隐藏
   */
  toggleLabels(visible: boolean): void {
    this.labelsVisible = visible;
    this.labelRenderer.toggleLabels(visible);
    
    if (this.rendererType === 'canvas') {
      if (this.labelContainer) {
        this.labelContainer.visible = visible;
      }
    } else if (this.svgContainer) {
      const labelContainer = this.svgContainer.select('g#labelContainer');
      labelContainer.style('display', visible ? 'block' : 'none');
    }
    this.render();
  }
  
  /**
   * 切换参考圆线显示/隐藏
   */
  toggleGrid(visible: boolean): void {
    this.gridScaleRenderer.setGridVisible(visible);
    // 只重新渲染网格，而不是整个视图，避免legend重新绘制
    if (this.rendererType === 'canvas') {
      this.gridScaleRenderer.renderCanvasGrid(this.gridContainer);
    } else {
      this.gridScaleRenderer.renderSvgGrid(this.svgContainer);
    }
  }
  
  /**
   * 切换图例显示/隐藏
   */
  toggleLegend(visible: boolean): void {
    if (this.rendererType === 'canvas') {
      if (this.legendContainer) {
        this.legendContainer.visible = visible;
      }
    } else if (this.svgContainer) {
      const legendContainer = this.svgContainer.select('g#legendContainer');
      legendContainer.style('display', visible ? 'block' : 'none');
    }
  }

  /**
   * 处理鼠标移动事件
   */
  protected handleMouseMove(event: MouseEvent): void {
    if (!this.genome) return;

    const targetElement = this.rendererType === 'canvas' ? this.canvas : this.svg;
    if (!targetElement) return;

    const rect = targetElement.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // 检查鼠标是否在画布内
    if (x < 0 || x > rect.width || y < 0 || y > rect.height) {
      // 鼠标在画布外，触发空hover事件
      this.emit('hover', null);
      return;
    }

    // 检测鼠标是否悬停在基因特征上
    const hoveredFeature = this.detectHoveredFeature(x, y);
    
    // 无论是否检测到特征，都触发hover事件
    // 这样可以确保在鼠标移动到空白处时，tooltip会消失
    this.emit('hover', hoveredFeature);
  }

  /**
   * 处理鼠标离开画布事件
   */
  protected handleMouseLeave(_event: MouseEvent): void {
    // 鼠标离开画布，触发空hover事件
    this.emit('hover', null);
  }

  /**
   * 检测鼠标悬停的基因特征
   */
  private detectHoveredFeature(x: number, y: number): any | null {
    if (!this.genome) return null;

    // 考虑缩放和容器位置，计算实际的鼠标坐标
    let adjustedX = x;
    let adjustedY = y;

    if (this.rendererType === 'canvas' && this.stage && this.stage.children[0]) {
      // Canvas渲染器：获取circleContainer的位置和缩放
      const circleContainer = this.stage.children[0];
      const scale = this.zoomLevel;
      const containerX = circleContainer.position.x;
      const containerY = circleContainer.position.y;
      
      // 将鼠标坐标转换为容器内的坐标
      adjustedX = (x - containerX) / scale;
      adjustedY = (y - containerY) / scale;
    } else if (this.rendererType === 'svg' && this.svgContainer) {
      // SVG渲染器：获取容器的transform属性
      const featureContainer = this.svgContainer.select('g#featureContainer');
      const transform = featureContainer.attr('transform') || 'translate(0,0)';
      const match = transform.match(/translate\(([^,]+),([^\)]+)\) scale\(([^\)]+)\)/) || transform.match(/translate\(([^,]+),([^\)]+)\)/);
      
      if (match) {
        const containerX = parseFloat(match[1]) || 0;
        const containerY = parseFloat(match[2]) || 0;
        const scale = match[3] ? parseFloat(match[3]) : 1;
        
        // 将鼠标坐标转换为容器内的坐标
        adjustedX = (x - containerX) / scale;
        adjustedY = (y - containerY) / scale;
      }
    }

    // 计算鼠标到中心的距离和角度
    const dx = adjustedX - this.centerX;
    const dy = adjustedY - this.centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);

    // 确保角度为正值
    const normalizedAngle = angle < 0 ? angle + 2 * Math.PI : angle;

    // 计算基因组长度
    const genomeLength = this.genome.length;

    // 计算鼠标位置对应的基因组位置
    const genomePosition = (normalizedAngle / (2 * Math.PI)) * genomeLength;

    // 计算实际轨道高度和间距
    const nonGCTracks = this.genome.tracks.filter(track => track.type !== 'gc_content' && track.type !== 'gc_skew_plus' && track.type !== 'gc_skew_minus');
    const gcContentTrack = this.genome.tracks.find(track => track.type === 'gc_content');
    const gcSkewPlusTrack = this.genome.tracks.find(track => track.type === 'gc_skew_plus');
    const gcSkewMinusTrack = this.genome.tracks.find(track => track.type === 'gc_skew_minus');

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
    const trackHeight = Math.min(maxTrackHeight, Math.max(minTrackHeight, this.radius / (actualTrackCount + 2)));
    const trackSpacing = 5;

    // 检查鼠标是否在任何轨道范围内，并确定当前轨道
    let currentRadius = this.radius;
    let currentTrack = null;

    // 计算所有可见轨道的半径范围
    const trackRanges: { track: any; innerRadius: number; outerRadius: number }[] = [];

    // 遍历非GC轨道
    for (const track of visibleNonGCTracks) {
      const innerRadius = currentRadius - trackHeight;
      trackRanges.push({ track, innerRadius, outerRadius: currentRadius });
      currentRadius -= trackHeight + trackSpacing;
    }

    // 检查GC Content轨道
    if (gcContentVisible && gcContentTrack) {
      const innerRadius = currentRadius - trackHeight;
      trackRanges.push({ track: gcContentTrack, innerRadius, outerRadius: currentRadius });
      currentRadius -= trackHeight + trackSpacing;
    }

    // 检查GC Skew轨道
    if (gcSkewVisible) {
      const innerRadius = currentRadius - trackHeight;
      const track = gcSkewPlusVisible ? gcSkewPlusTrack : gcSkewMinusTrack;
      trackRanges.push({ track, innerRadius, outerRadius: currentRadius });
    }

    // 从内到外遍历轨道，确保内层轨道优先被检测
    for (const range of trackRanges.reverse()) {
      if (distance >= range.innerRadius && distance <= range.outerRadius) {
        currentTrack = range.track;
        break;
      }
    }

    // 如果鼠标不在任何轨道范围内，返回null
    if (!currentTrack) {
      return null;
    }

    // 从当前轨道中查找特征，而不是从空间索引中查询
    // 这样可以确保 hover 悬停展示的信息和点击到的一致
    let closestFeature = null;
    let minDistance = Infinity;

    currentTrack.features.forEach((feature: any) => {
      // 确保特征是可见的基因特征
      if (feature.type === 'gene' || feature.type === 'CDS' || feature.name || feature.id) {
        // 计算特征中心位置
        const featureCenter = (feature.start + feature.end) / 2;
        // 计算距离，考虑环形基因组的情况
        let distance = Math.abs(featureCenter - genomePosition);
        if (distance > genomeLength / 2) {
          distance = genomeLength - distance;
        }
        // 选择距离最近的特征
        if (distance < minDistance) {
          minDistance = distance;
          closestFeature = feature;
        }
      }
    });

    // 返回距离最近的特征
    return closestFeature;
  }
  
  /**
   * 高亮显示特定基因
   */
  highlightFeature(feature: any): void {
    // 调用featureRenderer的highlightFeature方法
    this.featureRenderer.highlightFeature(feature);
    // 只重新渲染特征，而不是整个视图，避免图例闪烁
    if (this.rendererType === 'canvas') {
      this.renderCanvasFeatures();
    } else {
      this.renderSvgFeatures();
    }
  }
  
  /**
   * 设置缩放级别
   */
  setZoomLevel(level: number, point?: { x: number; y: number }): void {
    this.zoomLevel = level;
    this.featureRenderer.updateZoomLevel(level);
    this.labelRenderer.updateZoomLevel(level);
    
    if (this.rendererType === 'canvas') {
      this.zoomPanController.setCanvasZoomLevel(level, point, this.stage || undefined);
    } else {
      this.zoomPanController.setSvgZoomLevel(level, point, this.svgContainer);
    }
  }
  
  /**
   * 设置平移偏移
   */
  setPanOffset(offset: PanOffset): void {
    this.zoomPanController.setPanOffset(offset, this.stage || undefined, this.svgContainer, this.rendererType);
  }
  
  /**
   * 更新尺寸
   */
  updateSize(width: number, height: number): void {
    // 重新计算中心位置和半径
    const sidebarWidth = RENDER_CONFIG.SIDEBAR_WIDTH;
    const legendWidth = RENDER_CONFIG.LEGEND_WIDTH;
    this.centerX = sidebarWidth + (width - sidebarWidth - legendWidth) / 2;
    this.centerY = height / 2;
    this.radius = Math.min((width - sidebarWidth - legendWidth), height) / 2 - RENDER_CONFIG.MARGIN;
    
    // 更新各个渲染器的位置和尺寸
    this.featureRenderer.updatePosition(this.centerX, this.centerY, this.radius);
    this.labelRenderer.updatePosition(this.centerX, this.centerY, this.radius);
    this.gridScaleRenderer.updatePosition(this.centerX, this.centerY, this.radius);
    this.legendRenderer.updateWidth(width);
    this.zoomPanController.updatePosition(this.centerX, this.centerY);
    this.zoomPanController.updateSize(width, height);
    
    // 重新初始化容器
    if (this.rendererType === 'canvas' && this.stage) {
      this.stage.removeChildren();
      this.initializeCanvasContainers();
    } else if (this.rendererType === 'svg' && this.svg) {
      this.initializeSvgContainers();
    }
    
    this.render();
  }
}
