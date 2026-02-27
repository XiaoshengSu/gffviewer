import * as PIXI from 'pixi.js';
import * as d3 from 'd3';
import type { Feature, Track } from '../../../types';
import { RENDER_CONFIG } from './config';
import { hexToNumber, createArcPath, createAnnulusPath, mergeGCSkewFeatures } from './utils';

export class FeatureRenderer {
  private centerX: number;
  private centerY: number;
  private radius: number;
  private zoomLevel: number;
  private lodManager: any;
  private onHover?: (feature: any) => void;
  private highlightedFeature: any = null;
  
  constructor(centerX: number, centerY: number, radius: number, zoomLevel: number, lodManager: any, onHover?: (feature: any) => void) {
    this.centerX = centerX;
    this.centerY = centerY;
    this.radius = radius;
    this.zoomLevel = zoomLevel;
    this.lodManager = lodManager;
    this.onHover = onHover;
  }
  
  /**
   * 设置悬停回调函数
   */
  setOnHover(callback: (feature: any) => void): void {
    this.onHover = callback;
  }
  
  /**
   * 高亮显示特定基因
   */
  highlightFeature(feature: any): void {
    // 更新高亮的基因
    this.highlightedFeature = feature;
    // 触发hover回调，显示悬浮提示
    if (this.onHover) {
      this.onHover(feature);
    }
    // 这里可以触发重新渲染，确保高亮效果能够立即显示
  }
  
  /**
   * 计算轨道高度
   */
  calculateTrackHeight(nonGCTrackCount: number, gcContentVisible: boolean | undefined, gcSkewVisible: boolean | undefined): number {
    const minTrackHeight = RENDER_CONFIG.MIN_TRACK_HEIGHT;
    const maxTrackHeight = RENDER_CONFIG.MAX_TRACK_HEIGHT;
    let actualTrackCount = nonGCTrackCount;
    if (gcContentVisible) actualTrackCount++;
    if (gcSkewVisible) actualTrackCount++;
    return Math.min(maxTrackHeight, Math.max(minTrackHeight, this.radius / (actualTrackCount + 2)));
  }
  
  /**
   * 渲染非GC轨道（Canvas）
   */
  renderCanvasNonGCTracks(tracks: Track[], currentRadius: number, trackHeight: number, trackSpacing: number, genomeLength: number, featureContainer: PIXI.Container | undefined): number {
    tracks.forEach((track) => {
      // 绘制轨道背景圆圈，添加border
      this.renderCanvasTrackBackground(currentRadius, trackHeight, track.color, track.type, featureContainer);
      
      // 使用 LOD 管理器过滤特征
      const visibleFeatures = this.lodManager.filterFeatures(track.features, this.zoomLevel);
      
      visibleFeatures.forEach((feature: Feature) => {
        // 添加track信息到feature对象，以便在hover事件中使用
        feature.track = track;
        this.renderCanvasFeature(feature, track, currentRadius, trackHeight, genomeLength, featureContainer);
      });
      
      currentRadius -= trackHeight + trackSpacing;
    });
    return currentRadius;
  }
  
  /**
   * 渲染非GC轨道（SVG）
   */
  renderSvgNonGCTracks(tracks: Track[], currentRadius: number, trackHeight: number, trackSpacing: number, genomeLength: number, svgContainer: d3.Selection<SVGElement, unknown, null, undefined> | undefined): number {
    tracks.forEach((track) => {
      // 绘制轨道背景圆圈，添加border
      this.renderSvgTrackBackground(currentRadius, trackHeight, track.color, track.type, svgContainer);
      
      // 使用 LOD 管理器过滤特征
      const visibleFeatures = this.lodManager.filterFeatures(track.features, this.zoomLevel);
      
      visibleFeatures.forEach((feature: Feature) => {
        // 添加track信息到feature对象，以便在hover事件中使用
        feature.track = track;
        this.renderSvgFeature(feature, track, currentRadius, trackHeight, genomeLength, svgContainer);
      });
      
      currentRadius -= trackHeight + trackSpacing;
    });
    return currentRadius;
  }
  
  /**
   * 渲染GC Content轨道（Canvas）
   */
  renderCanvasGCTrack(track: Track, currentRadius: number, trackHeight: number, trackSpacing: number, genomeLength: number, featureContainer: PIXI.Container | undefined): number {
    // 绘制轨道背景圆圈，添加border
    this.renderCanvasTrackBackground(currentRadius, trackHeight, track.color, track.type, featureContainer);
    
    // 使用 LOD 管理器过滤特征
    const visibleFeatures = this.lodManager.filterFeatures(track.features, this.zoomLevel);
    
    visibleFeatures.forEach((feature: Feature) => {
      // 添加track信息到feature对象，以便在hover事件中使用
      feature.track = track;
      this.renderCanvasFeature(feature, track, currentRadius, trackHeight, genomeLength, featureContainer);
    });
    
    return currentRadius - trackHeight - trackSpacing;
  }
  
  /**
   * 渲染GC Content轨道（SVG）
   */
  renderSvgGCTrack(track: Track, currentRadius: number, trackHeight: number, trackSpacing: number, genomeLength: number, svgContainer: d3.Selection<SVGElement, unknown, null, undefined> | undefined): number {
    // 绘制轨道背景圆圈，添加border
    this.renderSvgTrackBackground(currentRadius, trackHeight, track.color, track.type, svgContainer);
    
    // 使用 LOD 管理器过滤特征
    const visibleFeatures = this.lodManager.filterFeatures(track.features, this.zoomLevel);
    
    visibleFeatures.forEach((feature: Feature) => {
      // 添加track信息到feature对象，以便在hover事件中使用
      feature.track = track;
      this.renderSvgFeature(feature, track, currentRadius, trackHeight, genomeLength, svgContainer);
    });
    
    return currentRadius - trackHeight - trackSpacing;
  }
  
  /**
   * 渲染GC Skew轨道（Canvas）
   */
  renderCanvasGCSkewTracks(gcSkewPlusTrack: Track, gcSkewMinusTrack: Track, gcSkewPlusVisible: boolean | undefined, gcSkewMinusVisible: boolean | undefined, currentRadius: number, trackHeight: number, trackSpacing: number, genomeLength: number, featureContainer: PIXI.Container | undefined): number {
    // 绘制轨道背景圆圈，添加border
    // 使用GC Skew+或GC Skew-的颜色作为背景
    const skewTrackColor = gcSkewPlusVisible ? gcSkewPlusTrack.color : gcSkewMinusTrack.color;
    const skewTrackType = gcSkewPlusVisible ? gcSkewPlusTrack.type : gcSkewMinusTrack.type;
    this.renderCanvasTrackBackground(currentRadius, trackHeight, skewTrackColor, skewTrackType, featureContainer);
    
    // 合并GC Skew+和GC Skew-的特征
    const gcSkewFeatures = mergeGCSkewFeatures(gcSkewPlusTrack, gcSkewMinusTrack, gcSkewPlusVisible, gcSkewMinusVisible, this.zoomLevel, this.lodManager);
    
    // 渲染合并后的GC Skew特征
    this.renderCanvasMergedGCSkewFeatures(gcSkewFeatures, gcSkewPlusTrack, gcSkewMinusTrack, currentRadius, trackHeight, genomeLength, featureContainer);
    
    return currentRadius - trackHeight - trackSpacing;
  }
  
  /**
   * 渲染GC Skew轨道（SVG）
   */
  renderSvgGCSkewTracks(gcSkewPlusTrack: Track, gcSkewMinusTrack: Track, gcSkewPlusVisible: boolean | undefined, gcSkewMinusVisible: boolean | undefined, currentRadius: number, trackHeight: number, trackSpacing: number, genomeLength: number, svgContainer: d3.Selection<SVGElement, unknown, null, undefined> | undefined): number {
    // 绘制轨道背景圆圈，添加border
    // 使用GC Skew+或GC Skew-的颜色作为背景
    const skewTrackColor = gcSkewPlusVisible ? gcSkewPlusTrack.color : gcSkewMinusTrack.color;
    const skewTrackType = gcSkewPlusVisible ? gcSkewPlusTrack.type : gcSkewMinusTrack.type;
    this.renderSvgTrackBackground(currentRadius, trackHeight, skewTrackColor, skewTrackType, svgContainer);
    
    // 合并GC Skew+和GC Skew-的特征
    const gcSkewFeatures = mergeGCSkewFeatures(gcSkewPlusTrack, gcSkewMinusTrack, gcSkewPlusVisible, gcSkewMinusVisible, this.zoomLevel, this.lodManager);
    
    // 渲染合并后的GC Skew特征
    this.renderSvgMergedGCSkewFeatures(gcSkewFeatures, gcSkewPlusTrack, gcSkewMinusTrack, currentRadius, trackHeight, genomeLength, svgContainer);
    
    return currentRadius - trackHeight - trackSpacing;
  }
  
  /**
   * 渲染合并后的GC Skew特征（Canvas）
   */
  renderCanvasMergedGCSkewFeatures(gcSkewFeatures: Array<{feature: any, value: number}>, gcSkewPlusTrack: Track, gcSkewMinusTrack: Track, currentRadius: number, trackHeight: number, genomeLength: number, featureContainer: PIXI.Container | undefined): void {
    gcSkewFeatures.forEach(({ feature, value }) => {
      const startAngle = (feature.start / genomeLength) * Math.PI * 2;
      const endAngle = (feature.end / genomeLength) * Math.PI * 2;
      
      const maxHeight = trackHeight * RENDER_CONFIG.GC_MAX_BAR_HEIGHT_RATIO;
      const barHeight = Math.abs(value) * maxHeight / RENDER_CONFIG.GC_SKEW_RANGE;
      
      const graphics = new PIXI.Graphics();
      
      if (value > 0) {
        // 正向值：在圈外
        const outerRadius = currentRadius + barHeight;
        const innerRadius = currentRadius;
        
        // 绘制向外的弧形
        graphics.arc(this.centerX, this.centerY, outerRadius, startAngle, endAngle, false);
        graphics.arc(this.centerX, this.centerY, innerRadius, endAngle, startAngle, true);
        graphics.fill({ color: hexToNumber(gcSkewPlusTrack.color), alpha: 0.8 });
      } else {
        // 负值：在圈内
        const outerRadius = currentRadius;
        const innerRadius = currentRadius - barHeight;
        
        // 绘制向内的弧形
        graphics.arc(this.centerX, this.centerY, outerRadius, startAngle, endAngle, false);
        graphics.arc(this.centerX, this.centerY, innerRadius, endAngle, startAngle, true);
        graphics.fill({ color: hexToNumber(gcSkewMinusTrack.color), alpha: 0.8 });
      }
      
      // GC Skew特征不需要交互
      // 只有gene特征才需要hover事件
      
      featureContainer?.addChild(graphics);
    });
  }
  
  /**
   * 渲染合并后的GC Skew特征（SVG）
   */
  renderSvgMergedGCSkewFeatures(gcSkewFeatures: Array<{feature: any, value: number}>, gcSkewPlusTrack: Track, gcSkewMinusTrack: Track, currentRadius: number, trackHeight: number, genomeLength: number, svgContainer: d3.Selection<SVGElement, unknown, null, undefined> | undefined): void {
    if (!svgContainer) return;
    
    // 确保颜色值是字符串形式
    const gcSkewPlusColor = typeof gcSkewPlusTrack.color === 'string' ? gcSkewPlusTrack.color : `#${(gcSkewPlusTrack.color as number).toString(16).padStart(6, '0')}`;
    const gcSkewMinusColor = typeof gcSkewMinusTrack.color === 'string' ? gcSkewMinusTrack.color : `#${(gcSkewMinusTrack.color as number).toString(16).padStart(6, '0')}`;
    
    gcSkewFeatures.forEach(({ feature, value }) => {
      const startAngle = (feature.start / genomeLength) * Math.PI * 2;
      const endAngle = (feature.end / genomeLength) * Math.PI * 2;
      
      const maxHeight = trackHeight * RENDER_CONFIG.GC_MAX_BAR_HEIGHT_RATIO;
      const barHeight = Math.abs(value) * maxHeight / RENDER_CONFIG.GC_SKEW_RANGE;
      
      if (value > 0) {
        // 正向值：在圈外
        const outerRadius = currentRadius + barHeight;
        const innerRadius = currentRadius;
        const path = createArcPath(this.centerX, this.centerY, outerRadius, innerRadius, startAngle, endAngle);
        svgContainer?.select('g#featureContainer')
          .append('path')
          .attr('d', path)
          .attr('fill', gcSkewPlusColor)
          .attr('fill-opacity', 0.8);
      } else {
        // 负值：在圈内
        const outerRadius = currentRadius;
        const innerRadius = currentRadius - barHeight;
        const path = createArcPath(this.centerX, this.centerY, outerRadius, innerRadius, startAngle, endAngle);
        svgContainer?.select('g#featureContainer')
          .append('path')
          .attr('d', path)
          .attr('fill', gcSkewMinusColor)
          .attr('fill-opacity', 0.8);
      }
    });
  }
  
  /**
   * 渲染轨道背景圆圈（Canvas）
   */
  renderCanvasTrackBackground(radius: number, trackHeight: number, _trackColor: string | number, trackType?: string, featureContainer?: PIXI.Container): void {
    const graphics = new PIXI.Graphics();
    
    // 绘制轨道背景（移除边框）
    graphics.arc(this.centerX, this.centerY, radius, 0, Math.PI * 2, false);
    graphics.arc(this.centerX, this.centerY, radius - trackHeight, Math.PI * 2, 0, true);
    graphics.fill({ color: 0xf5f5f5, alpha: 0.5 });
    
    // 为GC Skew轨道添加额外的参考线
    if (trackType === 'gc_skew_plus' || trackType === 'gc_skew_minus') { // GC Skew+ 和 GC Skew- 轨道
      // 添加中心参考线（零值线）
      graphics.arc(this.centerX, this.centerY, radius - trackHeight / 2, 0, Math.PI * 2, false);
      graphics.setStrokeStyle({ width: 1, color: 0x999999, alpha: 0.7 });
    }
    
    featureContainer?.addChild(graphics);
  }
  
  /**
   * 渲染轨道背景圆圈（SVG）
   */
  renderSvgTrackBackground(radius: number, trackHeight: number, _trackColor: string | number, trackType?: string, svgContainer?: d3.Selection<SVGElement, unknown, null, undefined>): void {
    if (!svgContainer) return;
    
    // 绘制轨道背景（移除边框）
    const backgroundPath = createAnnulusPath(this.centerX, this.centerY, radius, radius - trackHeight);
    svgContainer.select('g#featureContainer')
      .append('path')
      .attr('d', backgroundPath)
      .attr('fill', '#f5f5f5')
      .attr('fill-opacity', 0.5);
    
    // 为GC Skew轨道添加额外的参考线
    if (trackType === 'gc_skew_plus' || trackType === 'gc_skew_minus') { // GC Skew+ 和 GC Skew- 轨道
      // 添加中心参考线（零值线）
      svgContainer.select('g#featureContainer')
        .append('circle')
        .attr('cx', this.centerX)
        .attr('cy', this.centerY)
        .attr('r', radius - trackHeight / 2)
        .attr('fill', 'none')
        .attr('stroke', '#999999')
        .attr('stroke-width', 1)
        .attr('stroke-opacity', 0.7);
    }
  }
  
  /**
   * 渲染单个特征（Canvas）
   */
  renderCanvasFeature(feature: Feature, track: Track, radius: number, trackHeight: number, genomeLength: number, featureContainer?: PIXI.Container): void {
    // 计算基础角度
    let baseStartAngle = (feature.start / genomeLength) * Math.PI * 2;
    let baseEndAngle = (feature.end / genomeLength) * Math.PI * 2;
    let baseAngleWidth = baseEndAngle - baseStartAngle;
    
    // 确保即使是非常短的基因也能被渲染
    // 如果基因角度宽度太小，设置一个最小角度宽度
    const minAngleWidth = RENDER_CONFIG.MIN_ANGLE_WIDTH; // 最小角度宽度，确保短基因也能被看到
    if (baseAngleWidth < minAngleWidth) {
      // 对于短基因，以其中心为基准，向两边扩展到最小角度宽度
      const centerAngle = (baseStartAngle + baseEndAngle) / 2;
      const halfMinAngle = minAngleWidth / 2;
      baseStartAngle = centerAngle - halfMinAngle;
      baseEndAngle = centerAngle + halfMinAngle;
      baseAngleWidth = minAngleWidth;
    }
    
    // 添加缝隙：为每个特征的起始和结束位置添加小的角度偏移
    // 根据特征的角度宽度动态调整缝隙大小
    const minGapAngle = RENDER_CONFIG.MIN_GAP_ANGLE; // 最小缝隙大小
    const maxGapAngle = RENDER_CONFIG.MAX_GAP_ANGLE; // 最大缝隙大小
    // 缝隙大小与特征角度宽度成正比，但不超过最大值
    const gapAngle = Math.min(maxGapAngle, Math.max(minGapAngle, baseAngleWidth * RENDER_CONFIG.GAP_ANGLE_RATIO));
    
    // 计算实际绘制的角度
    const startAngle = baseStartAngle + gapAngle;
    const endAngle = baseEndAngle - gapAngle;
    const angleWidth = endAngle - startAngle;
    
    // 检查是否是GC相关轨道
    if (track.type === 'gc_content' || track.type === 'gc_skew_plus' || track.type === 'gc_skew_minus') {
      this.renderCanvasGCFeature(feature, track, radius, trackHeight, genomeLength, startAngle, endAngle, angleWidth, featureContainer);
    } else {
      // 常规轨道渲染
          // 只要角度宽度大于0就绘制
          if (angleWidth > 0) {
            const graphics = new PIXI.Graphics();
            graphics.arc(this.centerX, this.centerY, radius, startAngle, endAngle, false);
            graphics.arc(this.centerX, this.centerY, radius - trackHeight, endAngle, startAngle, true);
            graphics.fill({ color: hexToNumber(track.color), alpha: 1 });
            
            // 添加交互 - 只在gene特征上添加
            if (feature.type === 'gene' || feature.type === 'CDS' || feature.name || feature.id) {
              graphics.eventMode = 'dynamic';
              graphics.cursor = 'pointer';
              
              // 检查是否是高亮的基因
              const isHighlighted = this.highlightedFeature && 
                ((this.highlightedFeature.id && feature.id === this.highlightedFeature.id) || 
                 (this.highlightedFeature.name && feature.name === this.highlightedFeature.name) ||
                 (feature.start === this.highlightedFeature.start && feature.end === this.highlightedFeature.end));
              
              // 如果是高亮的基因，使用加粗加长的样式
              if (isHighlighted) {
                graphics.clear();
                const extendedStartAngle = startAngle - 0.01;
                const extendedEndAngle = endAngle + 0.01;
                graphics.arc(this.centerX, this.centerY, radius + 2, extendedStartAngle, extendedEndAngle, false);
                graphics.arc(this.centerX, this.centerY, radius - trackHeight - 2, extendedEndAngle, extendedStartAngle, true);
                graphics.fill({ color: hexToNumber(track.color), alpha: 1 });
                graphics.lineStyle(0); // 移除边框
              }
              
              graphics.on('pointerover', () => {
                // 高亮显示基因：加粗、变长，无边框
                graphics.clear();
                // 绘制变长的基因特征
                const extendedStartAngle = startAngle - 0.01;
                const extendedEndAngle = endAngle + 0.01;
                graphics.arc(this.centerX, this.centerY, radius + 2, extendedStartAngle, extendedEndAngle, false);
                graphics.arc(this.centerX, this.centerY, radius - trackHeight - 2, extendedEndAngle, extendedStartAngle, true);
                graphics.fill({ color: hexToNumber(track.color), alpha: 1 });
                graphics.lineStyle(0); // 移除边框
                // 触发hover回调，显示悬浮提示
                if (this.onHover) {
                  this.onHover(feature);
                }
              });
              graphics.on('pointerout', () => {
                // 检查是否是高亮的基因
                const isHighlighted = this.highlightedFeature && 
                  ((this.highlightedFeature.id && feature.id === this.highlightedFeature.id) || 
                   (this.highlightedFeature.name && feature.name === this.highlightedFeature.name) ||
                   (feature.start === this.highlightedFeature.start && feature.end === this.highlightedFeature.end));
                
                // 恢复原始样式，除非是高亮的基因
                graphics.clear();
                if (isHighlighted) {
                  const extendedStartAngle = startAngle - 0.01;
                  const extendedEndAngle = endAngle + 0.01;
                  graphics.arc(this.centerX, this.centerY, radius + 2, extendedStartAngle, extendedEndAngle, false);
                  graphics.arc(this.centerX, this.centerY, radius - trackHeight - 2, extendedEndAngle, extendedStartAngle, true);
                } else {
                  graphics.arc(this.centerX, this.centerY, radius, startAngle, endAngle, false);
                  graphics.arc(this.centerX, this.centerY, radius - trackHeight, endAngle, startAngle, true);
                }
                graphics.fill({ color: hexToNumber(track.color), alpha: 1 });
                graphics.lineStyle(0);
                // 触发hover回调，隐藏悬浮提示
                if (this.onHover && !isHighlighted) {
                  this.onHover(null);
                }
              });
              graphics.on('pointerdown', () => {
                // 点击事件
                console.log('Feature clicked:', feature);
              });
            }
            
            featureContainer?.addChild(graphics);
          }
    }
  }
  
  /**
   * 渲染单个特征（SVG）
   */
  renderSvgFeature(feature: Feature, track: Track, radius: number, trackHeight: number, genomeLength: number, svgContainer?: d3.Selection<SVGElement, unknown, null, undefined>): void {
    if (!svgContainer) return;
    
    // 计算基础角度
    let baseStartAngle = (feature.start / genomeLength) * Math.PI * 2;
    let baseEndAngle = (feature.end / genomeLength) * Math.PI * 2;
    let baseAngleWidth = baseEndAngle - baseStartAngle;
    
    // 确保即使是非常短的基因也能被渲染
    // 如果基因角度宽度太小，设置一个最小角度宽度
    const minAngleWidth = RENDER_CONFIG.MIN_ANGLE_WIDTH; // 最小角度宽度，确保短基因也能被看到
    if (baseAngleWidth < minAngleWidth) {
      // 对于短基因，以其中心为基准，向两边扩展到最小角度宽度
      const centerAngle = (baseStartAngle + baseEndAngle) / 2;
      const halfMinAngle = minAngleWidth / 2;
      baseStartAngle = centerAngle - halfMinAngle;
      baseEndAngle = centerAngle + halfMinAngle;
      baseAngleWidth = minAngleWidth;
    }
    
    // 添加缝隙：为每个特征的起始和结束位置添加小的角度偏移
    // 根据特征的角度宽度动态调整缝隙大小
    const minGapAngle = RENDER_CONFIG.MIN_GAP_ANGLE; // 最小缝隙大小
    const maxGapAngle = RENDER_CONFIG.MAX_GAP_ANGLE; // 最大缝隙大小
    // 缝隙大小与特征角度宽度成正比，但不超过最大值
    const gapAngle = Math.min(maxGapAngle, Math.max(minGapAngle, baseAngleWidth * RENDER_CONFIG.GAP_ANGLE_RATIO));
    
    // 计算实际绘制的角度
    const startAngle = baseStartAngle + gapAngle;
    const endAngle = baseEndAngle - gapAngle;
    const angleWidth = endAngle - startAngle;
    
    // 检查是否是GC相关轨道
    if (track.type === 'gc_content' || track.type === 'gc_skew_plus' || track.type === 'gc_skew_minus') {
      this.renderSvgGCFeature(feature, track, radius, trackHeight, genomeLength, startAngle, endAngle, angleWidth, svgContainer);
    } else {
      // 常规轨道渲染
          // 只要角度宽度大于0就绘制
          if (angleWidth > 0) {
            // 确保track.color是字符串形式的颜色值
            const fillColor = typeof track.color === 'string' ? track.color : `#${(track.color as number).toString(16).padStart(6, '0')}`;
            const path = createArcPath(this.centerX, this.centerY, radius, radius - trackHeight, startAngle, endAngle);
            const featureElement = svgContainer.select('g#featureContainer')
              .append('path')
              .attr('d', path)
              .attr('fill', fillColor)
              .attr('fill-opacity', 1);
            
            // 添加交互 - 只在gene特征上添加
            if (feature.type === 'gene' || feature.type === 'CDS' || feature.name || feature.id) {
              // 检查是否是高亮的基因
              const isHighlighted = this.highlightedFeature && 
                ((this.highlightedFeature.id && feature.id === this.highlightedFeature.id) || 
                 (this.highlightedFeature.name && feature.name === this.highlightedFeature.name) ||
                 (feature.start === this.highlightedFeature.start && feature.end === this.highlightedFeature.end));
              
              // 如果是高亮的基因，使用加粗加长的样式
              if (isHighlighted) {
                const extendedStartAngle = startAngle - 0.01;
                const extendedEndAngle = endAngle + 0.01;
                const extendedPath = createArcPath(this.centerX, this.centerY, radius + 2, radius - trackHeight - 2, extendedStartAngle, extendedEndAngle);
                featureElement
                  .attr('d', extendedPath)
                  .attr('fill-opacity', 1)
                  .attr('stroke', 'none'); // 移除边框
              }
              
              featureElement
                .style('cursor', 'pointer')
                .on('mouseover', () => {
                  // 高亮显示基因：加粗、变长，无边框
                  const extendedStartAngle = startAngle - 0.01;
                  const extendedEndAngle = endAngle + 0.01;
                  const extendedPath = createArcPath(this.centerX, this.centerY, radius + 2, radius - trackHeight - 2, extendedStartAngle, extendedEndAngle);
                  featureElement
                    .attr('d', extendedPath)
                    .attr('fill-opacity', 1)
                    .attr('stroke', 'none'); // 移除边框
                  // 触发hover回调，显示悬浮提示
                  if (this.onHover) {
                    this.onHover(feature);
                  }
                })
                .on('mouseout', () => {
                  // 检查是否是高亮的基因
                  const isHighlighted = this.highlightedFeature && 
                    ((this.highlightedFeature.id && feature.id === this.highlightedFeature.id) || 
                     (this.highlightedFeature.name && feature.name === this.highlightedFeature.name) ||
                     (feature.start === this.highlightedFeature.start && feature.end === this.highlightedFeature.end));
                  
                  // 恢复原始样式，除非是高亮的基因
                  if (isHighlighted) {
                    const extendedStartAngle = startAngle - 0.01;
                    const extendedEndAngle = endAngle + 0.01;
                    const extendedPath = createArcPath(this.centerX, this.centerY, radius + 2, radius - trackHeight - 2, extendedStartAngle, extendedEndAngle);
                    featureElement
                      .attr('d', extendedPath)
                      .attr('fill-opacity', 1)
                      .attr('stroke', 'none'); // 移除边框
                  } else {
                    const originalPath = createArcPath(this.centerX, this.centerY, radius, radius - trackHeight, startAngle, endAngle);
                    featureElement
                      .attr('d', originalPath)
                      .attr('fill-opacity', 1)
                      .attr('stroke', 'none');
                  }
                  // 触发hover回调，隐藏悬浮提示
                  if (this.onHover && !isHighlighted) {
                    this.onHover(null);
                  }
                })
                .on('mousedown', () => {
                  // 点击事件
                  console.log('Feature clicked:', feature);
                });
            }
          }
    }
  }
  
  /**
   * 渲染GC相关特征（Canvas）
   */
  renderCanvasGCFeature(feature: Feature, track: Track, radius: number, trackHeight: number, _genomeLength: number, startAngle: number, endAngle: number, _angleWidth: number, featureContainer?: PIXI.Container): void {
    const value = parseFloat(feature.attributes.value || '0');
    
    if (track.type === 'gc_content') {
      this.renderCanvasGCContentFeature(feature, track, radius, trackHeight, startAngle, endAngle, value, featureContainer);
    } else if (track.type === 'gc_skew_plus') {
      this.renderCanvasGCSkewPlusFeature(feature, track, radius, trackHeight, startAngle, endAngle, value, featureContainer);
    } else if (track.type === 'gc_skew_minus') {
      this.renderCanvasGCSkewMinusFeature(feature, track, radius, trackHeight, startAngle, endAngle, value, featureContainer);
    }
  }
  
  /**
   * 渲染GC相关特征（SVG）
   */
  renderSvgGCFeature(feature: Feature, track: Track, radius: number, trackHeight: number, _genomeLength: number, startAngle: number, endAngle: number, _angleWidth: number, svgContainer?: d3.Selection<SVGElement, unknown, null, undefined>): void {
    if (!svgContainer) return;
    
    const value = parseFloat(feature.attributes.value || '0');
    
    if (track.type === 'gc_content') {
      this.renderSvgGCContentFeature(feature, track, radius, trackHeight, startAngle, endAngle, value, svgContainer);
    } else if (track.type === 'gc_skew_plus') {
      this.renderSvgGCSkewPlusFeature(feature, track, radius, trackHeight, startAngle, endAngle, value, svgContainer);
    } else if (track.type === 'gc_skew_minus') {
      this.renderSvgGCSkewMinusFeature(feature, track, radius, trackHeight, startAngle, endAngle, value, svgContainer);
    }
  }
  
  /**
   * 渲染GC Content特征（Canvas）
   */
  renderCanvasGCContentFeature(_feature: Feature, track: Track, radius: number, trackHeight: number, startAngle: number, endAngle: number, value: number, featureContainer?: PIXI.Container): void {
    const graphics = new PIXI.Graphics();
    const maxHeight = trackHeight * RENDER_CONFIG.GC_MAX_BAR_HEIGHT_RATIO;
    const normalizedValue = (value - RENDER_CONFIG.GC_CONTENT_MIDPOINT) / RENDER_CONFIG.GC_CONTENT_NORMALIZATION;
    const barHeight = Math.abs(normalizedValue) * maxHeight;
    
    if (normalizedValue > 0) {
      // 正向值：在圈外
      const outerRadius = radius + barHeight;
      const innerRadius = radius;
      this.drawCanvasArc(graphics, outerRadius, innerRadius, startAngle, endAngle, track.color);
    } else {
      // 负值：在圈内
      const outerRadius = radius;
      const innerRadius = radius - barHeight;
      this.drawCanvasArc(graphics, outerRadius, innerRadius, startAngle, endAngle, track.color);
    }
    
    featureContainer?.addChild(graphics);
  }
  
  /**
   * 渲染GC Content特征（SVG）
   */
  renderSvgGCContentFeature(_feature: Feature, track: Track, radius: number, trackHeight: number, startAngle: number, endAngle: number, value: number, svgContainer?: d3.Selection<SVGElement, unknown, null, undefined>): void {
    if (!svgContainer) return;
    
    // 确保track.color是字符串形式的颜色值
    const fillColor = typeof track.color === 'string' ? track.color : `#${(track.color as number).toString(16).padStart(6, '0')}`;
    
    const maxHeight = trackHeight * RENDER_CONFIG.GC_MAX_BAR_HEIGHT_RATIO;
    const normalizedValue = (value - RENDER_CONFIG.GC_CONTENT_MIDPOINT) / RENDER_CONFIG.GC_CONTENT_NORMALIZATION;
    const barHeight = Math.abs(normalizedValue) * maxHeight;
    
    if (normalizedValue > 0) {
      // 正向值：在圈外
      const outerRadius = radius + barHeight;
      const innerRadius = radius;
      const path = createArcPath(this.centerX, this.centerY, outerRadius, innerRadius, startAngle, endAngle);
      svgContainer.select('g#featureContainer')
        .append('path')
        .attr('d', path)
        .attr('fill', fillColor)
        .attr('fill-opacity', 0.8);
    } else {
      // 负值：在圈内
      const outerRadius = radius;
      const innerRadius = radius - barHeight;
      const path = createArcPath(this.centerX, this.centerY, outerRadius, innerRadius, startAngle, endAngle);
      svgContainer.select('g#featureContainer')
        .append('path')
        .attr('d', path)
        .attr('fill', fillColor)
        .attr('fill-opacity', 0.8);
    }
  }
  
  /**
   * 渲染GC Skew+特征（Canvas）
   */
  renderCanvasGCSkewPlusFeature(_feature: Feature, track: Track, radius: number, trackHeight: number, startAngle: number, endAngle: number, value: number, featureContainer?: PIXI.Container): void {
    const graphics = new PIXI.Graphics();
    const maxHeight = trackHeight * RENDER_CONFIG.GC_MAX_BAR_HEIGHT_RATIO;
    const barHeight = Math.abs(value) * maxHeight / RENDER_CONFIG.GC_SKEW_RANGE;
    
    // 正向值：在圈外
    const outerRadius = radius + barHeight;
    const innerRadius = radius;
    this.drawCanvasArc(graphics, outerRadius, innerRadius, startAngle, endAngle, track.color);
    
    featureContainer?.addChild(graphics);
  }
  
  /**
   * 渲染GC Skew-特征（Canvas）
   */
  renderCanvasGCSkewMinusFeature(_feature: Feature, track: Track, radius: number, trackHeight: number, startAngle: number, endAngle: number, value: number, featureContainer?: PIXI.Container): void {
    const graphics = new PIXI.Graphics();
    const maxHeight = trackHeight * RENDER_CONFIG.GC_MAX_BAR_HEIGHT_RATIO;
    const barHeight = Math.abs(value) * maxHeight / RENDER_CONFIG.GC_SKEW_RANGE;
    
    // 负值：在圈内
    const outerRadius = radius - trackHeight;
    const innerRadius = radius - trackHeight - barHeight;
    this.drawCanvasArc(graphics, outerRadius, innerRadius, startAngle, endAngle, track.color);
    
    featureContainer?.addChild(graphics);
  }
  
  /**
   * 渲染GC Skew+特征（SVG）
   */
  renderSvgGCSkewPlusFeature(_feature: Feature, track: Track, radius: number, trackHeight: number, startAngle: number, endAngle: number, value: number, svgContainer?: d3.Selection<SVGElement, unknown, null, undefined>): void {
    if (!svgContainer) return;
    
    // 确保track.color是字符串形式的颜色值
    const fillColor = typeof track.color === 'string' ? track.color : `#${(track.color as number).toString(16).padStart(6, '0')}`;
    
    const maxHeight = trackHeight * RENDER_CONFIG.GC_MAX_BAR_HEIGHT_RATIO;
    const barHeight = Math.abs(value) * maxHeight / RENDER_CONFIG.GC_SKEW_RANGE;
    
    // 正向值：在圈外
    const outerRadius = radius + barHeight;
    const innerRadius = radius;
    const path = createArcPath(this.centerX, this.centerY, outerRadius, innerRadius, startAngle, endAngle);
    svgContainer.select('g#featureContainer')
      .append('path')
      .attr('d', path)
      .attr('fill', fillColor)
      .attr('fill-opacity', 0.8);
  }
  
  /**
   * 渲染GC Skew-特征（SVG）
   */
  renderSvgGCSkewMinusFeature(_feature: Feature, track: Track, radius: number, trackHeight: number, startAngle: number, endAngle: number, value: number, svgContainer?: d3.Selection<SVGElement, unknown, null, undefined>): void {
    if (!svgContainer) return;
    
    // 确保track.color是字符串形式的颜色值
    const fillColor = typeof track.color === 'string' ? track.color : `#${(track.color as number).toString(16).padStart(6, '0')}`;
    
    const maxHeight = trackHeight * RENDER_CONFIG.GC_MAX_BAR_HEIGHT_RATIO;
    const barHeight = Math.abs(value) * maxHeight / RENDER_CONFIG.GC_SKEW_RANGE;
    
    // 负值：在圈内
    const outerRadius = radius - trackHeight;
    const innerRadius = radius - trackHeight - barHeight;
    const path = createArcPath(this.centerX, this.centerY, outerRadius, innerRadius, startAngle, endAngle);
    svgContainer.select('g#featureContainer')
      .append('path')
      .attr('d', path)
      .attr('fill', fillColor)
      .attr('fill-opacity', 0.8);
  }
  
  /**
   * 绘制弧形（Canvas）
   */
  drawCanvasArc(graphics: PIXI.Graphics, outerRadius: number, innerRadius: number, startAngle: number, endAngle: number, color: string | number): void {
    graphics.arc(this.centerX, this.centerY, outerRadius, startAngle, endAngle, false);
    graphics.arc(this.centerX, this.centerY, innerRadius, endAngle, startAngle, true);
    graphics.fill({ color: hexToNumber(color), alpha: 0.8 });
  }
  
  /**
   * 更新缩放级别
   */
  updateZoomLevel(zoomLevel: number): void {
    this.zoomLevel = zoomLevel;
  }
  
  /**
   * 更新中心位置和半径
   */
  updatePosition(centerX: number, centerY: number, radius: number): void {
    this.centerX = centerX;
    this.centerY = centerY;
    this.radius = radius;
  }
}
