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

  // 每侧固定缝隙（屏幕像素），从基因自身弧长中扣除
  // private static readonly GAP_PX = 1.5;
  // 短基因最小显示宽度（屏幕像素）
  private static readonly MIN_DISPLAY_PX = 2.0;

  constructor(
    centerX: number, centerY: number, radius: number,
    zoomLevel: number, lodManager: any,
    onHover?: (feature: any) => void
  ) {
    this.centerX = centerX;
    this.centerY = centerY;
    this.radius = radius;
    this.zoomLevel = zoomLevel;
    this.lodManager = lodManager;
    this.onHover = onHover;
  }

  setOnHover(callback: (feature: any) => void): void { this.onHover = callback; }

  highlightFeature(feature: any): void {
    this.highlightedFeature = feature;
    if (this.onHover) this.onHover(feature);
  }

  calculateTrackHeight(nonGCTrackCount: number, gcContentVisible?: boolean, gcSkewVisible?: boolean): number {
    let count = nonGCTrackCount;
    if (gcContentVisible) count++;
    if (gcSkewVisible) count++;
    return Math.min(RENDER_CONFIG.MAX_TRACK_HEIGHT, Math.max(RENDER_CONFIG.MIN_TRACK_HEIGHT, this.radius / (count + 2)));
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  核心：弧长计算
  //
  //  trackRadius: 当前轨道外缘半径（每条轨道不同，随缩放变化）
  //  必须用这个值换算像素，不能用 this.radius
  // ─────────────────────────────────────────────────────────────────────────
  private computeFeatureAngles(
    feature: Feature,
    genomeLength: number,
    trackRadius: number
  ): { startAngle: number; endAngle: number } {

    const rawStart = (feature.start / genomeLength) * Math.PI * 2;
    const rawEnd   = (feature.end   / genomeLength) * Math.PI * 2;
    const rawWidth = rawEnd - rawStart;

    // 参考GCContent的间隙计算方式
    const gap = Math.min(
      RENDER_CONFIG.MAX_GAP_ANGLE,
      Math.max(
        RENDER_CONFIG.MIN_GAP_ANGLE,
        rawWidth * RENDER_CONFIG.GAP_ANGLE_RATIO
      )
    );

    // 计算调整后的角度，确保基因之间有足够的间隙
    let adjustedStart = rawStart + gap;
    let adjustedEnd = rawEnd - gap;

    // 确保基因至少有最小显示宽度
    const minDisplayPx = FeatureRenderer.MIN_DISPLAY_PX;
    const minAngle = minDisplayPx / trackRadius;
    const minWidth = minAngle + gap * 2;

    if (rawWidth < minWidth) {
      // 短基因：居中对齐到最小宽度
      const center = (rawStart + rawEnd) / 2;
      adjustedStart = center - minAngle / 2;
      adjustedEnd = center + minAngle / 2;
    }

    return {
      startAngle: adjustedStart,
      endAngle: adjustedEnd
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  渲染非GC轨道（Canvas）
  // ─────────────────────────────────────────────────────────────────────────
  renderCanvasNonGCTracks(
    tracks: Track[], currentRadius: number, trackHeight: number,
    trackSpacing: number, genomeLength: number,
    featureContainer: PIXI.Container | undefined
  ): number {
    tracks.forEach((track) => {
      this.renderCanvasTrackBackground(currentRadius, trackHeight, track.color, track.type, featureContainer);

      const visible = this.lodManager.filterFeatures(track.features, this.zoomLevel);
      const sorted  = [...visible].sort((a: Feature, b: Feature) => a.start - b.start);

      sorted.forEach((feature: Feature) => {
        feature.track = track;
        this.renderCanvasAnnotationFeature(feature, track, currentRadius, trackHeight, genomeLength, featureContainer);
    });

    currentRadius -= trackHeight + trackSpacing;
  });
  return currentRadius;
}

// ─────────────────────────────────────────────────────────────────────────
//  渲染非GC轨道（SVG）
// ─────────────────────────────────────────────────────────────────────────
renderSvgNonGCTracks(
  tracks: Track[], currentRadius: number, trackHeight: number,
  trackSpacing: number, genomeLength: number,
  svgContainer: d3.Selection<SVGElement, unknown, null, undefined> | undefined
): number {
  tracks.forEach((track) => {
    this.renderSvgTrackBackground(currentRadius, trackHeight, track.color, track.type, svgContainer);

    const visible = this.lodManager.filterFeatures(track.features, this.zoomLevel);
    const sorted  = [...visible].sort((a: Feature, b: Feature) => a.start - b.start);

    sorted.forEach((feature: Feature) => {
      feature.track = track;
      this.renderSvgAnnotationFeature(feature, track, currentRadius, trackHeight, genomeLength, svgContainer);
    });

    currentRadius -= trackHeight + trackSpacing;
  });
  return currentRadius;
}

// ─────────────────────────────────────────────────────────────────────────
//  渲染单个注解特征（Canvas）
//  采用线条方式渲染，类似GC Content，避免基因重叠
// ─────────────────────────────────────────────────────────────────────────
private renderCanvasAnnotationFeature(
  feature: Feature, track: Track,
  trackOuterRadius: number, trackHeight: number,
  genomeLength: number,
  featureContainer?: PIXI.Container
): void {
  const { startAngle, endAngle } =
    this.computeFeatureAngles(feature, genomeLength, trackOuterRadius);

    if (endAngle <= startAngle) return;

    const color         = hexToNumber(track.color);
    const isHighlighted = this.checkHighlighted(feature);
    const graphics      = new PIXI.Graphics();

    // 计算线条长度，基因越长线条越长，以轨道内环为起点朝外
    // 为短基因（如misc_RNA、tRNA、rRNA）设置最小长度，确保清晰可见
    const featureLength = feature.end - feature.start;
    const normalizedLength = featureLength / genomeLength;
    const maxLineHeight = trackHeight;
    // 为短基因设置最小长度，同时考虑轨道半径（越中心的轨道需要更长的线条）
    const minLineHeight = Math.max(3, trackHeight * 0.5); // 最小线条高度为轨道高度的一半
    const lineHeight = Math.min(maxLineHeight, Math.max(minLineHeight, normalizedLength * maxLineHeight * 150)); // 放大150倍使线条更明显，且不超出轨道高度

    // 计算轨道内半径作为起点
    const trackInnerRadius = trackOuterRadius - trackHeight;

    // 绘制线条（弧形路径）
    this.drawLineArc(graphics, trackInnerRadius, lineHeight, startAngle, endAngle, color, isHighlighted);

    if (feature.type === 'gene' || feature.type === 'CDS' || feature.name || feature.id) {
      graphics.eventMode = 'dynamic';
      graphics.cursor = 'pointer';

      graphics.on('pointerover', () => {
        graphics.clear();
        this.drawLineArc(graphics, trackInnerRadius, lineHeight, startAngle, endAngle, color, true);
        if (this.onHover) this.onHover(feature);
      });
      graphics.on('pointerout', () => {
        const still = this.checkHighlighted(feature);
        graphics.clear();
        this.drawLineArc(graphics, trackInnerRadius, lineHeight, startAngle, endAngle, color, still);
        if (this.onHover && !still) this.onHover(null);
      });
      graphics.on('pointerdown', () => console.log('Feature clicked:', feature));
    }

    featureContainer?.addChild(graphics);
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  渲染单个注解特征（SVG）
  //  采用线条方式渲染，类似GC Content，避免基因重叠
  // ─────────────────────────────────────────────────────────────────────────
  private renderSvgAnnotationFeature(
    feature: Feature, track: Track,
    trackOuterRadius: number, trackHeight: number,
    genomeLength: number,
    svgContainer?: d3.Selection<SVGElement, unknown, null, undefined>
  ): void {
    if (!svgContainer) return;

    const { startAngle, endAngle } =
      this.computeFeatureAngles(feature, genomeLength, trackOuterRadius);

    if (endAngle <= startAngle) return;

    const fillColor     = this.ensureColorString(track.color);
    const isHighlighted = this.checkHighlighted(feature);

    // 计算线条长度，基因越长线条越长，以轨道内环为起点朝外
    // 为短基因（如misc_RNA、tRNA、rRNA）设置最小长度，确保清晰可见
    const featureLength = feature.end - feature.start;
    const normalizedLength = featureLength / genomeLength;
    const maxLineHeight = trackHeight;
    // 为短基因设置最小长度，同时考虑轨道半径（越中心的轨道需要更长的线条）
    const minLineHeight = Math.max(3, trackHeight * 0.5); // 最小线条高度为轨道高度的一半
    const lineHeight = Math.min(maxLineHeight, Math.max(minLineHeight, normalizedLength * maxLineHeight * 150)); // 放大150倍使线条更明显，且不超出轨道高度

    // 计算轨道内半径作为起点
    const trackInnerRadius = trackOuterRadius - trackHeight;

    // 绘制线条（弧形路径）
    const normalPath    = createArcPath(this.centerX, this.centerY,
      trackInnerRadius, trackInnerRadius + lineHeight, startAngle, endAngle);
    const highlightPath = createArcPath(this.centerX, this.centerY,
      trackInnerRadius + 2, trackInnerRadius + lineHeight + 2, startAngle - 0.003, endAngle + 0.003);

    const el = svgContainer.select('g#featureContainer')
      .append('path')
      .attr('d', isHighlighted ? highlightPath : normalPath)
      .attr('fill', fillColor).attr('fill-opacity', 1).attr('stroke', 'none');

    if (feature.type === 'gene' || feature.type === 'CDS' || feature.name || feature.id) {
      el.style('cursor', 'pointer')
        .on('mouseover', () => {
          el.attr('d', highlightPath).attr('fill-opacity', 1).attr('stroke', 'none');
          if (this.onHover) this.onHover(feature);
        })
        .on('mouseout', () => {
          const still = this.checkHighlighted(feature);
          el.attr('d', still ? highlightPath : normalPath)
            .attr('fill-opacity', 1).attr('stroke', 'none');
          if (this.onHover && !still) this.onHover(null);
        })
        .on('mousedown', () => console.log('Feature clicked:', feature));
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  绘制弧段（高亮时径向扩展 +2px）
  // ─────────────────────────────────────────────────────────────────────────
  /*
  private drawArc(
    graphics: PIXI.Graphics,
    outerRadius: number, trackHeight: number,
    startAngle: number, endAngle: number,
    color: number, highlighted: boolean
  ): void {
    const oR = highlighted ? outerRadius + 2       : outerRadius;
    const iR = highlighted ? outerRadius - trackHeight - 2 : outerRadius - trackHeight;
    const sA = highlighted ? startAngle - 0.003    : startAngle;
    const eA = highlighted ? endAngle   + 0.003    : endAngle;
    graphics.arc(this.centerX, this.centerY, oR, sA, eA, false);
    graphics.arc(this.centerX, this.centerY, iR, eA, sA, true);
    graphics.fill({ color, alpha: 1 });
  }
  */

  // ─────────────────────────────────────────────────────────────────────────
  //  绘制线条弧段（用于基因渲染，类似GC Content）
  // ─────────────────────────────────────────────────────────────────────────
  private drawLineArc(
    graphics: PIXI.Graphics,
    outerRadius: number, lineHeight: number,
    startAngle: number, endAngle: number,
    color: number, highlighted: boolean
  ): void {
    const oR = highlighted ? outerRadius + 2       : outerRadius;
    const iR = highlighted ? outerRadius + lineHeight + 2 : outerRadius + lineHeight;
    const sA = highlighted ? startAngle - 0.003    : startAngle;
    const eA = highlighted ? endAngle   + 0.003    : endAngle;
    graphics.arc(this.centerX, this.centerY, oR, sA, eA, false);
    graphics.arc(this.centerX, this.centerY, iR, eA, sA, true);
    graphics.fill({ color, alpha: 1 });
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  GC 轨道
  // ─────────────────────────────────────────────────────────────────────────
  renderCanvasGCTrack(track: Track, currentRadius: number, trackHeight: number, trackSpacing: number, genomeLength: number, featureContainer: PIXI.Container | undefined): number {
    this.renderCanvasTrackBackground(currentRadius, trackHeight, track.color, track.type, featureContainer);
    const visible = this.lodManager.filterFeatures(track.features, this.zoomLevel);
    visible.forEach((feature: Feature) => {
      feature.track = track;
      this.renderCanvasFeature(feature, track, currentRadius, trackHeight, genomeLength, visible.length, featureContainer);
    });
    return currentRadius - trackHeight - trackSpacing;
  }

  renderSvgGCTrack(track: Track, currentRadius: number, trackHeight: number, trackSpacing: number, genomeLength: number, svgContainer: d3.Selection<SVGElement, unknown, null, undefined> | undefined): number {
    this.renderSvgTrackBackground(currentRadius, trackHeight, track.color, track.type, svgContainer);
    const visible = this.lodManager.filterFeatures(track.features, this.zoomLevel);
    visible.forEach((feature: Feature) => {
      feature.track = track;
      this.renderSvgFeature(feature, track, currentRadius, trackHeight, genomeLength, visible.length, svgContainer);
    });
    return currentRadius - trackHeight - trackSpacing;
  }

  renderCanvasGCSkewTracks(gcSkewPlusTrack: Track, gcSkewMinusTrack: Track, gcSkewPlusVisible: boolean | undefined, gcSkewMinusVisible: boolean | undefined, currentRadius: number, trackHeight: number, trackSpacing: number, genomeLength: number, featureContainer: PIXI.Container | undefined): number {
    const color = gcSkewPlusVisible ? gcSkewPlusTrack.color : gcSkewMinusTrack.color;
    const type  = gcSkewPlusVisible ? gcSkewPlusTrack.type  : gcSkewMinusTrack.type;
    this.renderCanvasTrackBackground(currentRadius, trackHeight, color, type, featureContainer);
    const gcSkewFeatures = mergeGCSkewFeatures(gcSkewPlusTrack, gcSkewMinusTrack, gcSkewPlusVisible, gcSkewMinusVisible, this.zoomLevel, this.lodManager);
    this.renderCanvasMergedGCSkewFeatures(gcSkewFeatures, gcSkewPlusTrack, gcSkewMinusTrack, currentRadius, trackHeight, genomeLength, featureContainer);
    return currentRadius - trackHeight - trackSpacing;
  }

  renderSvgGCSkewTracks(gcSkewPlusTrack: Track, gcSkewMinusTrack: Track, gcSkewPlusVisible: boolean | undefined, gcSkewMinusVisible: boolean | undefined, currentRadius: number, trackHeight: number, trackSpacing: number, genomeLength: number, svgContainer: d3.Selection<SVGElement, unknown, null, undefined> | undefined): number {
    const color = gcSkewPlusVisible ? gcSkewPlusTrack.color : gcSkewMinusTrack.color;
    const type  = gcSkewPlusVisible ? gcSkewPlusTrack.type  : gcSkewMinusTrack.type;
    this.renderSvgTrackBackground(currentRadius, trackHeight, color, type, svgContainer);
    const gcSkewFeatures = mergeGCSkewFeatures(gcSkewPlusTrack, gcSkewMinusTrack, gcSkewPlusVisible, gcSkewMinusVisible, this.zoomLevel, this.lodManager);
    this.renderSvgMergedGCSkewFeatures(gcSkewFeatures, gcSkewPlusTrack, gcSkewMinusTrack, currentRadius, trackHeight, genomeLength, svgContainer);
    return currentRadius - trackHeight - trackSpacing;
  }

  renderCanvasMergedGCSkewFeatures(gcSkewFeatures: Array<{feature: any, value: number}>, gcSkewPlusTrack: Track, gcSkewMinusTrack: Track, currentRadius: number, trackHeight: number, genomeLength: number, featureContainer: PIXI.Container | undefined): void {
    const middleRadius = currentRadius - trackHeight / 2;
    const maxH = (trackHeight / 2) * RENDER_CONFIG.GC_MAX_BAR_HEIGHT_RATIO;
    const plusColor = hexToNumber(gcSkewPlusTrack.color);
    const minusColor = hexToNumber(gcSkewMinusTrack.color);

    gcSkewFeatures.forEach(({ feature, value }) => {
      const rawStart = (feature.start / genomeLength) * Math.PI * 2;
      const rawEnd   = (feature.end   / genomeLength) * Math.PI * 2;
      const rawWidth = rawEnd - rawStart;

      // 使用较小的gap，确保能够正常渲染，参考 GC Content 的处理
      let gap = Math.min(RENDER_CONFIG.MAX_GAP_ANGLE, Math.max(RENDER_CONFIG.MIN_GAP_ANGLE, rawWidth * RENDER_CONFIG.GAP_ANGLE_RATIO));
      gap = Math.min(gap, rawWidth * 0.1);

      const sA = rawStart + gap;
      const eA = rawEnd - gap;

      if (eA <= sA) return;

      const barH = Math.abs(value) * maxH / RENDER_CONFIG.GC_SKEW_RANGE;
      const g   = new PIXI.Graphics();
      const color = value > 0 ? plusColor : minusColor;
      
      const draw = (graphics: PIXI.Graphics, highlighted: boolean) => {
        const hOffset = highlighted ? 2 : 0;
        // 移除角度偏移，避免视觉上的晃动
        const aOffset = 0;
        const start = sA - aOffset;
        const end = eA + aOffset;

        if (value > 0) {
          graphics.arc(this.centerX, this.centerY, middleRadius + barH + hOffset, start, end, false);
          graphics.arc(this.centerX, this.centerY, middleRadius - hOffset, end, start, true);
        } else {
          graphics.arc(this.centerX, this.centerY, middleRadius + hOffset, start, end, false);
          graphics.arc(this.centerX, this.centerY, middleRadius - barH - hOffset, end, start, true);
        }
        graphics.fill({ color: color, alpha: highlighted ? 1 : 0.8 });
      };

      draw(g, this.checkHighlighted(feature));
      this.addCanvasInteraction(g, feature, draw);
      featureContainer?.addChild(g);
    });
  }

  renderSvgMergedGCSkewFeatures(gcSkewFeatures: Array<{feature: any, value: number}>, gcSkewPlusTrack: Track, gcSkewMinusTrack: Track, currentRadius: number, trackHeight: number, genomeLength: number, svgContainer: d3.Selection<SVGElement, unknown, null, undefined> | undefined): void {
    if (!svgContainer) return;
    const middleRadius = currentRadius - trackHeight / 2;
    const plusC  = this.ensureColorString(gcSkewPlusTrack.color);
    const minusC = this.ensureColorString(gcSkewMinusTrack.color);
    const maxH = (trackHeight / 2) * RENDER_CONFIG.GC_MAX_BAR_HEIGHT_RATIO;

    gcSkewFeatures.forEach(({ feature, value }) => {
      const rawStart = (feature.start / genomeLength) * Math.PI * 2;
      const rawEnd   = (feature.end   / genomeLength) * Math.PI * 2;
      const rawWidth = rawEnd - rawStart;

      // 使用较小的gap，确保能够正常渲染，参考 GC Content 的处理
      let gap = Math.min(RENDER_CONFIG.MAX_GAP_ANGLE, Math.max(RENDER_CONFIG.MIN_GAP_ANGLE, rawWidth * RENDER_CONFIG.GAP_ANGLE_RATIO));
      gap = Math.min(gap, rawWidth * 0.1);

      const sA = rawStart + gap;
      const eA = rawEnd - gap;

      if (eA <= sA) return;

      const barH = Math.abs(value) * maxH / RENDER_CONFIG.GC_SKEW_RANGE;
      const color = value > 0 ? plusC : minusC;

      const getPath = (highlighted: boolean) => {
        const hOffset = highlighted ? 2 : 0;
        // 移除角度偏移，避免视觉上的晃动
        const aOffset = 0;
        const start = sA - aOffset;
        const end = eA + aOffset;

        if (value > 0) {
          return createArcPath(this.centerX, this.centerY, middleRadius + barH + hOffset, middleRadius - hOffset, start, end);
        } else {
          return createArcPath(this.centerX, this.centerY, middleRadius + hOffset, middleRadius - barH - hOffset, start, end);
        }
      };

      const el = svgContainer.select('g#featureContainer').append('path')
        .attr('d', getPath(this.checkHighlighted(feature)))
        .attr('fill', color).attr('fill-opacity', this.checkHighlighted(feature) ? 1 : 0.8);
      
      this.addSvgInteraction(el, feature, getPath);
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  轨道背景（白色描边清晰区分轨道层次）
  // ─────────────────────────────────────────────────────────────────────────
  renderCanvasTrackBackground(radius: number, trackHeight: number, _color: string | number, _trackType?: string, featureContainer?: PIXI.Container): void {
    const g = new PIXI.Graphics();
    const innerRadius = radius - trackHeight;
    
    // 背景底色
    if (innerRadius > 10) {
      // 当innerRadius足够大时，绘制完整的环形
      g.arc(this.centerX, this.centerY, radius, 0, Math.PI * 2, false);
      g.arc(this.centerX, this.centerY, innerRadius, Math.PI * 2, 0, true);
    } else {
      // 当innerRadius太小时，绘制一个实心圆
      g.arc(this.centerX, this.centerY, radius, 0, Math.PI * 2, false);
    }
    g.fill({ color: 0xf5f5f5, alpha: 0.5 });
    
    // 外边缘白色描边（区分轨道）
    g.arc(this.centerX, this.centerY, radius, 0, Math.PI * 2);
    g.setStrokeStyle({ width: 1.5, color: 0xffffff, alpha: 1.0 });
    g.stroke();
    
    // 移除GC Skew零值参考线，用户认为它是多余的
    featureContainer?.addChild(g);
  }

  renderSvgTrackBackground(radius: number, trackHeight: number, _color: string | number, _trackType?: string, svgContainer?: d3.Selection<SVGElement, unknown, null, undefined>): void {
    if (!svgContainer) return;
    const g = svgContainer.select('g#featureContainer');
    const innerRadius = radius - trackHeight;
    
    if (innerRadius > 10) {
      // 当innerRadius足够大时，绘制完整的环形
      g.append('path')
        .attr('d', createAnnulusPath(this.centerX, this.centerY, radius, innerRadius))
        .attr('fill', '#f5f5f5').attr('fill-opacity', 0.5);
    } else {
      // 当innerRadius太小时，绘制一个实心圆
      g.append('circle')
        .attr('cx', this.centerX).attr('cy', this.centerY).attr('r', radius)
        .attr('fill', '#f5f5f5').attr('fill-opacity', 0.5);
    }
    
    // 外边缘白色描边
    g.append('circle')
      .attr('cx', this.centerX).attr('cy', this.centerY).attr('r', radius)
      .attr('fill', 'none').attr('stroke', '#ffffff').attr('stroke-width', 1.5);
    
    // 移除GC Skew零值参考线，用户认为它是多余的
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  公开接口（GC轨道调用）
  // ─────────────────────────────────────────────────────────────────────────
  renderCanvasFeature(feature: Feature, track: Track, radius: number, trackHeight: number, genomeLength: number, _n: number, featureContainer?: PIXI.Container): void {
    const rawStart = (feature.start / genomeLength) * Math.PI * 2;
    const rawEnd   = (feature.end   / genomeLength) * Math.PI * 2;
    const rawWidth = rawEnd - rawStart;
    
    // 确保角度范围正确
    if (rawWidth <= 0) return;
    
    // 对于GC Content特征，使用较小的gap，确保能够正常渲染
    let gap = Math.min(RENDER_CONFIG.MAX_GAP_ANGLE, Math.max(RENDER_CONFIG.MIN_GAP_ANGLE, rawWidth * RENDER_CONFIG.GAP_ANGLE_RATIO));
    if (track.type === 'gc_content') {
      gap = Math.min(gap, rawWidth * 0.1); // 对于GC Content，使用更小的gap
    }
    
    const adjustedStart = rawStart + gap;
    const adjustedEnd = rawEnd - gap;
    
    // 对于GC Content特征，即使调整后的角度范围很小，也尝试渲染
    if (adjustedEnd <= adjustedStart && track.type !== 'gc_content') return;
    
    this.renderCanvasGCFeature(feature, track, radius, trackHeight, genomeLength, adjustedStart, adjustedEnd, adjustedEnd - adjustedStart, featureContainer);
  }

  renderSvgFeature(feature: Feature, track: Track, radius: number, trackHeight: number, genomeLength: number, _n: number, svgContainer?: d3.Selection<SVGElement, unknown, null, undefined>): void {
    if (!svgContainer) return;
    const rawStart = (feature.start / genomeLength) * Math.PI * 2;
    const rawEnd   = (feature.end   / genomeLength) * Math.PI * 2;
    const rawWidth = rawEnd - rawStart;
    const gap = Math.min(RENDER_CONFIG.MAX_GAP_ANGLE, Math.max(RENDER_CONFIG.MIN_GAP_ANGLE, rawWidth * RENDER_CONFIG.GAP_ANGLE_RATIO));
    this.renderSvgGCFeature(feature, track, radius, trackHeight, genomeLength, rawStart + gap, rawEnd - gap, rawWidth - gap * 2, svgContainer);
  }

  renderCanvasGCFeature(feature: Feature, track: Track, radius: number, trackHeight: number, _gl: number, sA: number, eA: number, _aw: number, c?: PIXI.Container): void {
    const v = parseFloat(feature.attributes?.value || '0');
    if      (track.type === 'gc_content')    this.renderCanvasGCContentFeature(feature, track, radius, trackHeight, sA, eA, v, c);
    else if (track.type === 'gc_skew_plus')  this.renderCanvasGCSkewPlusFeature(feature, track, radius, trackHeight, sA, eA, v, c);
    else if (track.type === 'gc_skew_minus') this.renderCanvasGCSkewMinusFeature(feature, track, radius, trackHeight, sA, eA, v, c);
  }

  renderSvgGCFeature(feature: Feature, track: Track, radius: number, trackHeight: number, _gl: number, sA: number, eA: number, _aw: number, svg?: d3.Selection<SVGElement, unknown, null, undefined>): void {
    if (!svg) return;
    const v = parseFloat(feature.attributes?.value || '0');
    if      (track.type === 'gc_content')    this.renderSvgGCContentFeature(feature, track, radius, trackHeight, sA, eA, v, svg);
    else if (track.type === 'gc_skew_plus')  this.renderSvgGCSkewPlusFeature(feature, track, radius, trackHeight, sA, eA, v, svg);
    else if (track.type === 'gc_skew_minus') this.renderSvgGCSkewMinusFeature(feature, track, radius, trackHeight, sA, eA, v, svg);
  }

  renderCanvasGCContentFeature(_f: Feature, track: Track, radius: number, trackHeight: number, sA: number, eA: number, value: number, c?: PIXI.Container): void {
    const g = new PIXI.Graphics();
    const middleRadius = radius - trackHeight / 2;
    // 使用轨道高度的一半作为最大高度
    const maxH = (trackHeight / 2) * RENDER_CONFIG.GC_MAX_BAR_HEIGHT_RATIO;
    const norm = (value - RENDER_CONFIG.GC_CONTENT_MIDPOINT) / RENDER_CONFIG.GC_CONTENT_NORMALIZATION;
    const barH = Math.abs(norm) * maxH;
    
    // 确保barH大于一个最小阈值，避免绘制实心圆环
    const minBarHeight = 0.1; // 最小条形高度阈值
    if (barH > minBarHeight) {
      const draw = (graphics: PIXI.Graphics, highlighted: boolean) => {
        const hOffset = highlighted ? 2 : 0;
        // 移除角度偏移，避免视觉上的晃动
        const aOffset = 0;
        const start = sA - aOffset;
        const end = eA + aOffset;

        if (norm > 0) {
          const outerRadius = middleRadius + barH + hOffset;
          const innerRadius = middleRadius - hOffset;
          this.drawCanvasArc(graphics, outerRadius, innerRadius, start, end, track.color);
        } else {
          const outerRadius = middleRadius + hOffset;
          const innerRadius = middleRadius - barH - hOffset;
          this.drawCanvasArc(graphics, outerRadius, innerRadius, start, end, track.color);
        }
      };

      draw(g, this.checkHighlighted(_f));
      this.addCanvasInteraction(g, _f, draw);
      c?.addChild(g);
    }
  }

  renderSvgGCContentFeature(_f: Feature, track: Track, radius: number, trackHeight: number, sA: number, eA: number, value: number, svg?: d3.Selection<SVGElement, unknown, null, undefined>): void {
    if (!svg) return;
    const fill = this.ensureColorString(track.color);
    const middleRadius = radius - trackHeight / 2;
    // 使用轨道高度的一半作为最大高度
    const maxH = (trackHeight / 2) * RENDER_CONFIG.GC_MAX_BAR_HEIGHT_RATIO;
    const norm = (value - RENDER_CONFIG.GC_CONTENT_MIDPOINT) / RENDER_CONFIG.GC_CONTENT_NORMALIZATION;
    const barH = Math.abs(norm) * maxH;
    
    const getPath = (highlighted: boolean) => {
      const hOffset = highlighted ? 2 : 0;
      // 移除角度偏移，避免视觉上的晃动
      const aOffset = 0;
      const start = sA - aOffset;
      const end = eA + aOffset;
      
      const [oR, iR] = norm > 0 
        ? [middleRadius + barH + hOffset, middleRadius - hOffset] 
        : [middleRadius + hOffset, middleRadius - barH - hOffset];
      return createArcPath(this.centerX, this.centerY, oR, iR, start, end);
    };

    const el = svg.select('g#featureContainer').append('path')
      .attr('d', getPath(this.checkHighlighted(_f)))
      .attr('fill', fill).attr('fill-opacity', this.checkHighlighted(_f) ? 1 : 0.8);
      
    this.addSvgInteraction(el, _f, getPath);
  }

  renderCanvasGCSkewPlusFeature(_f: Feature, track: Track, radius: number, trackHeight: number, sA: number, eA: number, value: number, c?: PIXI.Container): void {
    const g = new PIXI.Graphics();
    const middleRadius = radius - trackHeight / 2;
    // 使用轨道高度的一半作为最大高度
    const maxH = (trackHeight / 2) * RENDER_CONFIG.GC_MAX_BAR_HEIGHT_RATIO;
    const h = Math.abs(value) * maxH / RENDER_CONFIG.GC_SKEW_RANGE;
    
    const draw = (graphics: PIXI.Graphics, highlighted: boolean) => {
      const hOffset = highlighted ? 2 : 0;
      // 移除角度偏移，避免视觉上的晃动
      const aOffset = 0;
      const start = sA - aOffset;
      const end = eA + aOffset;
      this.drawCanvasArc(graphics, middleRadius + h + hOffset, middleRadius - hOffset, start, end, track.color);
    };

    draw(g, this.checkHighlighted(_f));
    this.addCanvasInteraction(g, _f, draw);
    c?.addChild(g);
  }

  renderCanvasGCSkewMinusFeature(_f: Feature, track: Track, radius: number, trackHeight: number, sA: number, eA: number, value: number, c?: PIXI.Container): void {
    const g = new PIXI.Graphics();
    const middleRadius = radius - trackHeight / 2;
    // 使用轨道高度的一半作为最大高度
    const maxH = (trackHeight / 2) * RENDER_CONFIG.GC_MAX_BAR_HEIGHT_RATIO;
    const h = Math.abs(value) * maxH / RENDER_CONFIG.GC_SKEW_RANGE;
    
    const draw = (graphics: PIXI.Graphics, highlighted: boolean) => {
      const hOffset = highlighted ? 2 : 0;
      // 移除角度偏移，避免视觉上的晃动
      const aOffset = 0;
      const start = sA - aOffset;
      const end = eA + aOffset;
      this.drawCanvasArc(graphics, middleRadius + hOffset, middleRadius - h - hOffset, start, end, track.color);
    };

    draw(g, this.checkHighlighted(_f));
    this.addCanvasInteraction(g, _f, draw);
    c?.addChild(g);
  }

  renderSvgGCSkewPlusFeature(_f: Feature, track: Track, radius: number, trackHeight: number, sA: number, eA: number, value: number, svg?: d3.Selection<SVGElement, unknown, null, undefined>): void {
    if (!svg) return;
    const middleRadius = radius - trackHeight / 2;
    // 使用轨道高度的一半作为最大高度
    const maxH = (trackHeight / 2) * RENDER_CONFIG.GC_MAX_BAR_HEIGHT_RATIO;
    const h = Math.abs(value) * maxH / RENDER_CONFIG.GC_SKEW_RANGE;
    
    const getPath = (highlighted: boolean) => {
      const hOffset = highlighted ? 2 : 0;
      // 移除角度偏移，避免视觉上的晃动
      const aOffset = 0;
      const start = sA - aOffset;
      const end = eA + aOffset;
      return createArcPath(this.centerX, this.centerY, middleRadius + h + hOffset, middleRadius - hOffset, start, end);
    };

    const el = svg.select('g#featureContainer').append('path')
      .attr('d', getPath(this.checkHighlighted(_f)))
      .attr('fill', this.ensureColorString(track.color)).attr('fill-opacity', this.checkHighlighted(_f) ? 1 : 0.8);
      
    this.addSvgInteraction(el, _f, getPath);
  }

  renderSvgGCSkewMinusFeature(_f: Feature, track: Track, radius: number, trackHeight: number, sA: number, eA: number, value: number, svg?: d3.Selection<SVGElement, unknown, null, undefined>): void {
    if (!svg) return;
    const middleRadius = radius - trackHeight / 2;
    // 使用轨道高度的一半作为最大高度
    const maxH = (trackHeight / 2) * RENDER_CONFIG.GC_MAX_BAR_HEIGHT_RATIO;
    const h = Math.abs(value) * maxH / RENDER_CONFIG.GC_SKEW_RANGE;
    
    const getPath = (highlighted: boolean) => {
      const hOffset = highlighted ? 2 : 0;
      // 移除角度偏移，避免视觉上的晃动
      const aOffset = 0;
      const start = sA - aOffset;
      const end = eA + aOffset;
      return createArcPath(this.centerX, this.centerY, middleRadius + hOffset, middleRadius - h - hOffset, start, end);
    };

    const el = svg.select('g#featureContainer').append('path')
      .attr('d', getPath(this.checkHighlighted(_f)))
      .attr('fill', this.ensureColorString(track.color)).attr('fill-opacity', this.checkHighlighted(_f) ? 1 : 0.8);
      
    this.addSvgInteraction(el, _f, getPath);
  }

  drawCanvasArc(graphics: PIXI.Graphics, oR: number, iR: number, sA: number, eA: number, color: string | number): void {
    // 确保角度范围正确
    const startAngle = sA;
    const endAngle = eA;
    
    // 确保角度范围是正数
    let angleRange = endAngle - startAngle;
    if (angleRange <= 0) return;
    
    // 计算路径点
    const startOuterX = this.centerX + Math.cos(startAngle) * oR;
    const startOuterY = this.centerY + Math.sin(startAngle) * oR;
    const endInnerX = this.centerX + Math.cos(endAngle) * iR;
    const endInnerY = this.centerY + Math.sin(endAngle) * iR;
    
    // 绘制路径
    graphics.beginFill(hexToNumber(color), 0.8);
    
    // 使用lineTo绘制路径，避免arc方法的连接问题
    graphics.moveTo(startOuterX, startOuterY);
    
    // 绘制外弧的近似多边形
    const segments = Math.max(4, Math.ceil(angleRange * 180 / Math.PI)); // 至少4个段，确保平滑
    for (let i = 1; i <= segments; i++) {
      const angle = startAngle + (angleRange * i / segments);
      graphics.lineTo(
        this.centerX + Math.cos(angle) * oR,
        this.centerY + Math.sin(angle) * oR
      );
    }
    
    // 绘制到内弧的终点
    graphics.lineTo(endInnerX, endInnerY);
    
    // 绘制内弧的近似多边形
    for (let i = segments; i >= 0; i--) {
      const angle = startAngle + (angleRange * i / segments);
      graphics.lineTo(
        this.centerX + Math.cos(angle) * iR,
        this.centerY + Math.sin(angle) * iR
      );
    }
    
    // 绘制回到外弧的起点
    graphics.lineTo(startOuterX, startOuterY);
    
    graphics.endFill();
  }

  private addCanvasInteraction(g: PIXI.Graphics, feature: Feature, drawFn: (g: PIXI.Graphics, highlighted: boolean) => void) {
    g.eventMode = 'dynamic';
    g.cursor = 'pointer';
    g.on('pointerover', () => {
      g.clear();
      drawFn(g, true);
      if (this.onHover) this.onHover(feature);
    });
    g.on('pointerout', () => {
      const still = this.checkHighlighted(feature);
      g.clear();
      drawFn(g, still);
      if (this.onHover && !still) this.onHover(null);
    });
    g.on('pointerdown', () => console.log('Feature clicked:', feature));
  }

  private addSvgInteraction(el: d3.Selection<any, unknown, null, undefined>, feature: Feature, getPathFn: (highlighted: boolean) => string) {
    el.style('cursor', 'pointer')
      .on('mouseover', () => {
        el.attr('d', getPathFn(true)).attr('fill-opacity', 1).attr('stroke', 'none');
        if (this.onHover) this.onHover(feature);
      })
      .on('mouseout', () => {
        const still = this.checkHighlighted(feature);
        el.attr('d', getPathFn(still)).attr('fill-opacity', still ? 1 : 0.8).attr('stroke', 'none');
        if (this.onHover && !still) this.onHover(null);
      })
      .on('mousedown', () => console.log('Feature clicked:', feature));
  }

  private checkHighlighted(feature: Feature): boolean {
    if (!this.highlightedFeature) return false;
    return (
      (this.highlightedFeature.id   && feature.id   === this.highlightedFeature.id)   ||
      (this.highlightedFeature.name && feature.name === this.highlightedFeature.name) ||
      (feature.start === this.highlightedFeature.start && feature.end === this.highlightedFeature.end)
    );
  }

  private ensureColorString(color: string | number): string {
    return typeof color === 'string' ? color : '#' + (color as number).toString(16).padStart(6, '0');
  }

  updateZoomLevel(zoomLevel: number): void { this.zoomLevel = zoomLevel; }

  updatePosition(centerX: number, centerY: number, radius: number): void {
    this.centerX = centerX;
    this.centerY = centerY;
    this.radius  = radius;
  }
}