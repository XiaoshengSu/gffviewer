import * as PIXI from 'pixi.js';
import * as d3 from 'd3';
import type { Feature, Genome } from '../../../types';
import { RENDER_CONFIG, COLORS } from './config';
import { canRenderLabel } from './utils';

export class LabelRenderer {
  private centerX: number;
  private centerY: number;
  private radius: number;
  private labelsVisible: boolean;
  private zoomLevel: number;
  private lodManager: any;
  
  constructor(centerX: number, centerY: number, radius: number, labelsVisible: boolean, zoomLevel: number, lodManager: any) {
    this.centerX = centerX;
    this.centerY = centerY;
    this.radius = radius;
    this.labelsVisible = labelsVisible;
    this.zoomLevel = zoomLevel;
    this.lodManager = lodManager;
  }
  
  /**
   * 渲染标签（Canvas）
   */
  renderCanvasLabels(genome: Genome | null, labelContainer: PIXI.Container | undefined): void {
    if (!genome || !this.labelsVisible || !labelContainer) return;
    
    const genomeLength = genome.length;
    
    // 计算可见轨道数量
    const nonGCTracks = genome.tracks.filter(track => track.type !== 'gc_content' && track.type !== 'gc_skew_plus' && track.type !== 'gc_skew_minus');
    const gcContentTrack = genome.tracks.find(track => track.type === 'gc_content');
    const gcSkewPlusTrack = genome.tracks.find(track => track.type === 'gc_skew_plus');
    const gcSkewMinusTrack = genome.tracks.find(track => track.type === 'gc_skew_minus');

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

    // 用于碰撞检测的已渲染标签角度范围
    const renderedLabelAngles: { start: number; end: number }[] = [];
    
    // 渲染每个轨道的标签
    let currentRadius = this.radius;
    genome.tracks.forEach((track) => {
      if (!track.visible) return;
      
      // 计算当前轨道的标签半径
      const labelRadius = currentRadius + RENDER_CONFIG.LABEL_RADIUS_OFFSET;
      
      // 使用 LOD 管理器过滤标签
      const featuresWithLabels = this.lodManager.getFeaturesWithLabels(track.features, this.zoomLevel);
      
      featuresWithLabels.forEach((feature: Feature) => {
        if (canRenderLabel(feature, genomeLength, renderedLabelAngles, RENDER_CONFIG.LABEL_ANGLE_WIDTH)) {
          this.renderCanvasLabel(feature, labelRadius, genomeLength, labelContainer);
        }
      });
      
      // 更新当前半径
      currentRadius -= trackHeight + trackSpacing;
    });
  }
  
  /**
   * 渲染标签（SVG）
   */
  renderSvgLabels(genome: Genome | null, svgContainer: d3.Selection<SVGElement, unknown, null, undefined> | undefined): void {
    if (!genome || !this.labelsVisible || !svgContainer) return;
    
    const genomeLength = genome.length;
    
    // 计算可见轨道数量
    const nonGCTracks = genome.tracks.filter(track => track.type !== 'gc_content' && track.type !== 'gc_skew_plus' && track.type !== 'gc_skew_minus');
    const gcContentTrack = genome.tracks.find(track => track.type === 'gc_content');
    const gcSkewPlusTrack = genome.tracks.find(track => track.type === 'gc_skew_plus');
    const gcSkewMinusTrack = genome.tracks.find(track => track.type === 'gc_skew_minus');

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

    // 用于碰撞检测的已渲染标签角度范围
    const renderedLabelAngles: { start: number; end: number }[] = [];
    
    // 渲染每个轨道的标签
    let currentRadius = this.radius;
    genome.tracks.forEach((track) => {
      if (!track.visible) return;
      
      // 计算当前轨道的标签半径
      const labelRadius = currentRadius + RENDER_CONFIG.LABEL_RADIUS_OFFSET;
      
      // 使用 LOD 管理器过滤标签
      const featuresWithLabels = this.lodManager.getFeaturesWithLabels(track.features, this.zoomLevel);
      
      featuresWithLabels.forEach((feature: Feature) => {
        if (canRenderLabel(feature, genomeLength, renderedLabelAngles, RENDER_CONFIG.LABEL_ANGLE_WIDTH)) {
          this.renderSvgLabel(feature, labelRadius, genomeLength, svgContainer);
        }
      });
      
      // 更新当前半径
      currentRadius -= trackHeight + trackSpacing;
    });
  }
  
  /**
   * 渲染单个标签（Canvas）
   */
  renderCanvasLabel(feature: Feature, radius: number, genomeLength: number, labelContainer: PIXI.Container | undefined): void {
    if (!feature.name || !labelContainer) return;
    
    const centerAngle = (feature.start + (feature.end - feature.start) / 2) / genomeLength * Math.PI * 2;
    
    // 计算标签位置，确保在圈图外围
    const x = this.centerX + Math.cos(centerAngle) * radius;
    const y = this.centerY + Math.sin(centerAngle) * radius;
    
    // 创建文本
    const text = new PIXI.Text({
      text: feature.name,
      style: {
        fontSize: RENDER_CONFIG.LABEL_FONT_SIZE,
        fill: COLORS.TEXT,
        align: 'center'
      }
    });
    
    // 统一朝外显示
    text.anchor.set(0.5, 1);
    text.position.set(x, y);
    
    // 调整旋转角度，确保文字始终朝外且方向一致
    // 对于所有角度，都使用顺时针旋转，确保文字方向一致
    text.rotation = centerAngle;
    
    labelContainer.addChild(text);
  }
  
  /**
   * 渲染单个标签（SVG）
   */
  renderSvgLabel(feature: Feature, radius: number, genomeLength: number, svgContainer: d3.Selection<SVGElement, unknown, null, undefined> | undefined): void {
    if (!feature.name || !svgContainer) return;
    
    const centerAngle = (feature.start + (feature.end - feature.start) / 2) / genomeLength * Math.PI * 2;
    
    // 计算标签位置，确保在圈图外围
    const x = this.centerX + Math.cos(centerAngle) * radius;
    const y = this.centerY + Math.sin(centerAngle) * radius;
    
    // 创建文本
    const textElement = svgContainer.select('g#labelContainer')
      .append('text')
      .text(feature.name)
      .attr('font-size', RENDER_CONFIG.LABEL_FONT_SIZE)
      .attr('fill', '#333333')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'hanging');
    
    // 统一朝外显示，使用与Canvas相同的旋转逻辑
    const rotationAngle = centerAngle * 180 / Math.PI;
    
    textElement
      .attr('x', x)
      .attr('y', y)
      .attr('transform', `rotate(${rotationAngle}, ${x}, ${y})`);
  }
  
  /**
   * 切换标签显示/隐藏
   */
  toggleLabels(visible: boolean): void {
    this.labelsVisible = visible;
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
