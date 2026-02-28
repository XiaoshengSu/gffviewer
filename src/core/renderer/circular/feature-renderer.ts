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
  private static readonly GAP_PX = 1.0;
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
    trackRadius: number,
  ): { startAngle: number; endAngle: number } {

    const rawStart = (feature.start / genomeLength) * Math.PI * 2;
    const rawEnd   = (feature.end   / genomeLength) * Math.PI * 2;
    const realPx   = trackRadius * (rawEnd - rawStart); // 真实弧长（像素）

    const gapAngle     = FeatureRenderer.GAP_PX / trackRadius;
    const minAngle     = FeatureRenderer.MIN_DISPLAY_PX / trackRadius;
    const threshold    = FeatureRenderer.MIN_DISPLAY_PX + FeatureRenderer.GAP_PX * 2;

    if (realPx <= threshold) {
      // 短基因：居中对齐到最小宽度，不减gap
      const center = (rawStart + rawEnd) / 2;
      return {
        startAngle: center - minAngle / 2,
        endAngle:   center + minAngle / 2,
      };
    }

    // 长基因：两端各减 GAP_PX，弧长差异得以体现
    return {
      startAngle: rawStart + gapAngle,
      endAngle:   rawEnd   - gapAngle,
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
  //  trackHeight 全高渲染，弧长体现基因长度
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

    this.drawArc(graphics, trackOuterRadius, trackHeight, startAngle, endAngle, color, isHighlighted);

    if (feature.type === 'gene' || feature.type === 'CDS' || feature.name || feature.id) {
      graphics.eventMode = 'dynamic';
      graphics.cursor = 'pointer';

      graphics.on('pointerover', () => {
        graphics.clear();
        this.drawArc(graphics, trackOuterRadius, trackHeight, startAngle, endAngle, color, true);
        if (this.onHover) this.onHover(feature);
      });
      graphics.on('pointerout', () => {
        const still = this.checkHighlighted(feature);
        graphics.clear();
        this.drawArc(graphics, trackOuterRadius, trackHeight, startAngle, endAngle, color, still);
        if (this.onHover && !still) this.onHover(null);
      });
      graphics.on('pointerdown', () => console.log('Feature clicked:', feature));
    }

    featureContainer?.addChild(graphics);
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  渲染单个注解特征（SVG）
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

    const normalPath    = createArcPath(this.centerX, this.centerY,
      trackOuterRadius, trackOuterRadius - trackHeight, startAngle, endAngle);
    const highlightPath = createArcPath(this.centerX, this.centerY,
      trackOuterRadius + 2, trackOuterRadius - trackHeight - 2, startAngle - 0.003, endAngle + 0.003);

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
    gcSkewFeatures.forEach(({ feature, value }) => {
      const sA = (feature.start / genomeLength) * Math.PI * 2;
      const eA = (feature.end   / genomeLength) * Math.PI * 2;
      const maxH = trackHeight * RENDER_CONFIG.GC_MAX_BAR_HEIGHT_RATIO;
      const barH = Math.abs(value) * maxH / RENDER_CONFIG.GC_SKEW_RANGE;
      const g   = new PIXI.Graphics();
      if (value > 0) {
        g.arc(this.centerX, this.centerY, currentRadius + barH, sA, eA, false);
        g.arc(this.centerX, this.centerY, currentRadius, eA, sA, true);
        g.fill({ color: hexToNumber(gcSkewPlusTrack.color), alpha: 0.8 });
      } else {
        g.arc(this.centerX, this.centerY, currentRadius, sA, eA, false);
        g.arc(this.centerX, this.centerY, currentRadius - barH, eA, sA, true);
        g.fill({ color: hexToNumber(gcSkewMinusTrack.color), alpha: 0.8 });
      }
      featureContainer?.addChild(g);
    });
  }

  renderSvgMergedGCSkewFeatures(gcSkewFeatures: Array<{feature: any, value: number}>, gcSkewPlusTrack: Track, gcSkewMinusTrack: Track, currentRadius: number, trackHeight: number, genomeLength: number, svgContainer: d3.Selection<SVGElement, unknown, null, undefined> | undefined): void {
    if (!svgContainer) return;
    const plusC  = this.ensureColorString(gcSkewPlusTrack.color);
    const minusC = this.ensureColorString(gcSkewMinusTrack.color);
    gcSkewFeatures.forEach(({ feature, value }) => {
      const sA = (feature.start / genomeLength) * Math.PI * 2;
      const eA = (feature.end   / genomeLength) * Math.PI * 2;
      const maxH = trackHeight * RENDER_CONFIG.GC_MAX_BAR_HEIGHT_RATIO;
      const barH = Math.abs(value) * maxH / RENDER_CONFIG.GC_SKEW_RANGE;
      if (value > 0) {
        svgContainer.select('g#featureContainer').append('path')
          .attr('d', createArcPath(this.centerX, this.centerY, currentRadius + barH, currentRadius, sA, eA))
          .attr('fill', plusC).attr('fill-opacity', 0.8);
      } else {
        svgContainer.select('g#featureContainer').append('path')
          .attr('d', createArcPath(this.centerX, this.centerY, currentRadius, currentRadius - barH, sA, eA))
          .attr('fill', minusC).attr('fill-opacity', 0.8);
      }
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  轨道背景（白色描边清晰区分轨道层次）
  // ─────────────────────────────────────────────────────────────────────────
  renderCanvasTrackBackground(radius: number, trackHeight: number, _color: string | number, trackType?: string, featureContainer?: PIXI.Container): void {
    const g = new PIXI.Graphics();
    // 背景底色
    g.arc(this.centerX, this.centerY, radius, 0, Math.PI * 2, false);
    g.arc(this.centerX, this.centerY, radius - trackHeight, Math.PI * 2, 0, true);
    g.fill({ color: 0xf5f5f5, alpha: 0.5 });
    // 外边缘白色描边（区分轨道）
    g.arc(this.centerX, this.centerY, radius, 0, Math.PI * 2);
    g.setStrokeStyle({ width: 1.5, color: 0xffffff, alpha: 1.0 });
    g.stroke();
    // GC Skew 零值参考线
    if (trackType === 'gc_skew_plus' || trackType === 'gc_skew_minus') {
      g.arc(this.centerX, this.centerY, radius - trackHeight / 2, 0, Math.PI * 2);
      g.setStrokeStyle({ width: 1, color: 0x999999, alpha: 0.7 });
      g.stroke();
    }
    featureContainer?.addChild(g);
  }

  renderSvgTrackBackground(radius: number, trackHeight: number, _color: string | number, trackType?: string, svgContainer?: d3.Selection<SVGElement, unknown, null, undefined>): void {
    if (!svgContainer) return;
    const g = svgContainer.select('g#featureContainer');
    g.append('path')
      .attr('d', createAnnulusPath(this.centerX, this.centerY, radius, radius - trackHeight))
      .attr('fill', '#f5f5f5').attr('fill-opacity', 0.5);
    // 外边缘白色描边
    g.append('circle')
      .attr('cx', this.centerX).attr('cy', this.centerY).attr('r', radius)
      .attr('fill', 'none').attr('stroke', '#ffffff').attr('stroke-width', 1.5);
    if (trackType === 'gc_skew_plus' || trackType === 'gc_skew_minus') {
      g.append('circle')
        .attr('cx', this.centerX).attr('cy', this.centerY).attr('r', radius - trackHeight / 2)
        .attr('fill', 'none').attr('stroke', '#999999').attr('stroke-width', 1).attr('stroke-opacity', 0.7);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  公开接口（GC轨道调用）
  // ─────────────────────────────────────────────────────────────────────────
  renderCanvasFeature(feature: Feature, track: Track, radius: number, trackHeight: number, genomeLength: number, _n: number, featureContainer?: PIXI.Container): void {
    const rawStart = (feature.start / genomeLength) * Math.PI * 2;
    const rawEnd   = (feature.end   / genomeLength) * Math.PI * 2;
    const rawWidth = rawEnd - rawStart;
    const gap = Math.min(RENDER_CONFIG.MAX_GAP_ANGLE, Math.max(RENDER_CONFIG.MIN_GAP_ANGLE, rawWidth * RENDER_CONFIG.GAP_ANGLE_RATIO));
    this.renderCanvasGCFeature(feature, track, radius, trackHeight, genomeLength, rawStart + gap, rawEnd - gap, rawWidth - gap * 2, featureContainer);
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
    const maxH = trackHeight * RENDER_CONFIG.GC_MAX_BAR_HEIGHT_RATIO;
    const norm = (value - RENDER_CONFIG.GC_CONTENT_MIDPOINT) / RENDER_CONFIG.GC_CONTENT_NORMALIZATION;
    const barH = Math.abs(norm) * maxH;
    if (norm > 0) this.drawCanvasArc(g, radius + barH, radius, sA, eA, track.color);
    else          this.drawCanvasArc(g, radius, radius - barH, sA, eA, track.color);
    c?.addChild(g);
  }

  renderSvgGCContentFeature(_f: Feature, track: Track, radius: number, trackHeight: number, sA: number, eA: number, value: number, svg?: d3.Selection<SVGElement, unknown, null, undefined>): void {
    if (!svg) return;
    const fill = this.ensureColorString(track.color);
    const maxH = trackHeight * RENDER_CONFIG.GC_MAX_BAR_HEIGHT_RATIO;
    const norm = (value - RENDER_CONFIG.GC_CONTENT_MIDPOINT) / RENDER_CONFIG.GC_CONTENT_NORMALIZATION;
    const barH = Math.abs(norm) * maxH;
    const [oR, iR] = norm > 0 ? [radius + barH, radius] : [radius, radius - barH];
    svg.select('g#featureContainer').append('path')
      .attr('d', createArcPath(this.centerX, this.centerY, oR, iR, sA, eA))
      .attr('fill', fill).attr('fill-opacity', 0.8);
  }

  renderCanvasGCSkewPlusFeature(_f: Feature, track: Track, radius: number, trackHeight: number, sA: number, eA: number, value: number, c?: PIXI.Container): void {
    const g = new PIXI.Graphics();
    const h = Math.abs(value) * trackHeight * RENDER_CONFIG.GC_MAX_BAR_HEIGHT_RATIO / RENDER_CONFIG.GC_SKEW_RANGE;
    this.drawCanvasArc(g, radius + h, radius, sA, eA, track.color);
    c?.addChild(g);
  }

  renderCanvasGCSkewMinusFeature(_f: Feature, track: Track, radius: number, trackHeight: number, sA: number, eA: number, value: number, c?: PIXI.Container): void {
    const g = new PIXI.Graphics();
    const h = Math.abs(value) * trackHeight * RENDER_CONFIG.GC_MAX_BAR_HEIGHT_RATIO / RENDER_CONFIG.GC_SKEW_RANGE;
    this.drawCanvasArc(g, radius - trackHeight, radius - trackHeight - h, sA, eA, track.color);
    c?.addChild(g);
  }

  renderSvgGCSkewPlusFeature(_f: Feature, track: Track, radius: number, trackHeight: number, sA: number, eA: number, value: number, svg?: d3.Selection<SVGElement, unknown, null, undefined>): void {
    if (!svg) return;
    const h = Math.abs(value) * trackHeight * RENDER_CONFIG.GC_MAX_BAR_HEIGHT_RATIO / RENDER_CONFIG.GC_SKEW_RANGE;
    svg.select('g#featureContainer').append('path')
      .attr('d', createArcPath(this.centerX, this.centerY, radius + h, radius, sA, eA))
      .attr('fill', this.ensureColorString(track.color)).attr('fill-opacity', 0.8);
  }

  renderSvgGCSkewMinusFeature(_f: Feature, track: Track, radius: number, trackHeight: number, sA: number, eA: number, value: number, svg?: d3.Selection<SVGElement, unknown, null, undefined>): void {
    if (!svg) return;
    const h = Math.abs(value) * trackHeight * RENDER_CONFIG.GC_MAX_BAR_HEIGHT_RATIO / RENDER_CONFIG.GC_SKEW_RANGE;
    svg.select('g#featureContainer').append('path')
      .attr('d', createArcPath(this.centerX, this.centerY, radius - trackHeight, radius - trackHeight - h, sA, eA))
      .attr('fill', this.ensureColorString(track.color)).attr('fill-opacity', 0.8);
  }

  drawCanvasArc(graphics: PIXI.Graphics, oR: number, iR: number, sA: number, eA: number, color: string | number): void {
    graphics.arc(this.centerX, this.centerY, oR, sA, eA, false);
    graphics.arc(this.centerX, this.centerY, iR, eA, sA, true);
    graphics.fill({ color: hexToNumber(color), alpha: 0.8 });
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