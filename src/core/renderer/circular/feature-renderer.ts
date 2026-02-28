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

  setOnHover(callback: (feature: any) => void): void {
    this.onHover = callback;
  }

  highlightFeature(feature: any): void {
    this.highlightedFeature = feature;
    if (this.onHover) this.onHover(feature);
  }

  calculateTrackHeight(nonGCTrackCount: number, gcContentVisible: boolean | undefined, gcSkewVisible: boolean | undefined): number {
    let actualTrackCount = nonGCTrackCount;
    if (gcContentVisible) actualTrackCount++;
    if (gcSkewVisible) actualTrackCount++;
    return Math.min(RENDER_CONFIG.MAX_TRACK_HEIGHT, Math.max(RENDER_CONFIG.MIN_TRACK_HEIGHT, this.radius / (actualTrackCount + 2)));
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  核心缝隙计算
  //
  //  修复要点：
  //  1. 用传入的 trackRadius（轨道所在圆的半径）而非 this.radius 计算缝隙角度
  //     - 轨道在最外圈时 trackRadius ≈ 350px
  //     - gapAngle = GAP_PIXELS / trackRadius = 1.5 / 350 ≈ 0.0043 rad ✓
  //
  //  2. GAP_PIXELS 目标屏幕像素宽度
  //     - 在 trackRadius=350 的圆弧上，0.0043 rad 对应弧长 = 350 × 0.0043 ≈ 1.5px
  //     - 两侧合计约 3px，CDS 轨道上 4686 个基因之间都会有清晰可见的白缝
  //
  //  3. 极短基因保护：当基因弧长 < 2×GAP，收缩至最小 0.5px 可见宽度
  // ─────────────────────────────────────────────────────────────────────────
  private computeAnnotationAngles(
    feature: Feature,
    genomeLength: number,
    trackRadius: number,          // ← 关键：用轨道半径，不用 this.radius
  ): { startAngle: number; endAngle: number; valid: boolean } {

    const rawStart = (feature.start / genomeLength) * Math.PI * 2;
    const rawEnd   = (feature.end   / genomeLength) * Math.PI * 2;
    const rawWidth = rawEnd - rawStart;

    // 目标：每侧留 GAP_PIXELS 个屏幕像素的间距
    // 弧长 = radius × 角度  =>  角度 = 弧长 / radius
    const GAP_PIXELS = 1.5;
    const gapAngle   = GAP_PIXELS / trackRadius;

    // 极短基因：缝隙会把基因"吃掉"，改为保留最小 0.5px 可见宽度
    if (rawWidth < gapAngle * 2) {
      const center           = (rawStart + rawEnd) / 2;
      const minVisibleAngle  = Math.max(rawWidth * 0.5, 0.5 / trackRadius);
      return {
        startAngle: center - minVisibleAngle,
        endAngle:   center + minVisibleAngle,
        valid: true,
      };
    }

    return {
      startAngle: rawStart + gapAngle,
      endAngle:   rawEnd   - gapAngle,
      valid: true,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  渲染非GC轨道
  // ─────────────────────────────────────────────────────────────────────────
  renderCanvasNonGCTracks(tracks: Track[], currentRadius: number, trackHeight: number, trackSpacing: number, genomeLength: number, featureContainer: PIXI.Container | undefined): number {
    tracks.forEach((track) => {
      this.renderCanvasTrackBackground(currentRadius, trackHeight, track.color, track.type, featureContainer);
      const visibleFeatures = this.lodManager.filterFeatures(track.features, this.zoomLevel);
      const sortedFeatures  = [...visibleFeatures].sort((a, b) => a.start - b.start);
      sortedFeatures.forEach((feature: Feature) => {
        feature.track = track;
        this.renderCanvasFeature(feature, track, currentRadius, trackHeight, genomeLength, sortedFeatures.length, featureContainer);
      });
      currentRadius -= trackHeight + trackSpacing;
    });
    return currentRadius;
  }

  renderSvgNonGCTracks(tracks: Track[], currentRadius: number, trackHeight: number, trackSpacing: number, genomeLength: number, svgContainer: d3.Selection<SVGElement, unknown, null, undefined> | undefined): number {
    tracks.forEach((track) => {
      this.renderSvgTrackBackground(currentRadius, trackHeight, track.color, track.type, svgContainer);
      const visibleFeatures = this.lodManager.filterFeatures(track.features, this.zoomLevel);
      const sortedFeatures  = [...visibleFeatures].sort((a, b) => a.start - b.start);
      sortedFeatures.forEach((feature: Feature) => {
        feature.track = track;
        this.renderSvgFeature(feature, track, currentRadius, trackHeight, genomeLength, sortedFeatures.length, svgContainer);
      });
      currentRadius -= trackHeight + trackSpacing;
    });
    return currentRadius;
  }

  renderCanvasGCTrack(track: Track, currentRadius: number, trackHeight: number, trackSpacing: number, genomeLength: number, featureContainer: PIXI.Container | undefined): number {
    this.renderCanvasTrackBackground(currentRadius, trackHeight, track.color, track.type, featureContainer);
    const visibleFeatures = this.lodManager.filterFeatures(track.features, this.zoomLevel);
    visibleFeatures.forEach((feature: Feature) => {
      feature.track = track;
      this.renderCanvasFeature(feature, track, currentRadius, trackHeight, genomeLength, visibleFeatures.length, featureContainer);
    });
    return currentRadius - trackHeight - trackSpacing;
  }

  renderSvgGCTrack(track: Track, currentRadius: number, trackHeight: number, trackSpacing: number, genomeLength: number, svgContainer: d3.Selection<SVGElement, unknown, null, undefined> | undefined): number {
    this.renderSvgTrackBackground(currentRadius, trackHeight, track.color, track.type, svgContainer);
    const visibleFeatures = this.lodManager.filterFeatures(track.features, this.zoomLevel);
    visibleFeatures.forEach((feature: Feature) => {
      feature.track = track;
      this.renderSvgFeature(feature, track, currentRadius, trackHeight, genomeLength, visibleFeatures.length, svgContainer);
    });
    return currentRadius - trackHeight - trackSpacing;
  }

  renderCanvasGCSkewTracks(gcSkewPlusTrack: Track, gcSkewMinusTrack: Track, gcSkewPlusVisible: boolean | undefined, gcSkewMinusVisible: boolean | undefined, currentRadius: number, trackHeight: number, trackSpacing: number, genomeLength: number, featureContainer: PIXI.Container | undefined): number {
    const skewTrackColor = gcSkewPlusVisible ? gcSkewPlusTrack.color : gcSkewMinusTrack.color;
    const skewTrackType  = gcSkewPlusVisible ? gcSkewPlusTrack.type  : gcSkewMinusTrack.type;
    this.renderCanvasTrackBackground(currentRadius, trackHeight, skewTrackColor, skewTrackType, featureContainer);
    const gcSkewFeatures = mergeGCSkewFeatures(gcSkewPlusTrack, gcSkewMinusTrack, gcSkewPlusVisible, gcSkewMinusVisible, this.zoomLevel, this.lodManager);
    this.renderCanvasMergedGCSkewFeatures(gcSkewFeatures, gcSkewPlusTrack, gcSkewMinusTrack, currentRadius, trackHeight, genomeLength, featureContainer);
    return currentRadius - trackHeight - trackSpacing;
  }

  renderSvgGCSkewTracks(gcSkewPlusTrack: Track, gcSkewMinusTrack: Track, gcSkewPlusVisible: boolean | undefined, gcSkewMinusVisible: boolean | undefined, currentRadius: number, trackHeight: number, trackSpacing: number, genomeLength: number, svgContainer: d3.Selection<SVGElement, unknown, null, undefined> | undefined): number {
    const skewTrackColor = gcSkewPlusVisible ? gcSkewPlusTrack.color : gcSkewMinusTrack.color;
    const skewTrackType  = gcSkewPlusVisible ? gcSkewPlusTrack.type  : gcSkewMinusTrack.type;
    this.renderSvgTrackBackground(currentRadius, trackHeight, skewTrackColor, skewTrackType, svgContainer);
    const gcSkewFeatures = mergeGCSkewFeatures(gcSkewPlusTrack, gcSkewMinusTrack, gcSkewPlusVisible, gcSkewMinusVisible, this.zoomLevel, this.lodManager);
    this.renderSvgMergedGCSkewFeatures(gcSkewFeatures, gcSkewPlusTrack, gcSkewMinusTrack, currentRadius, trackHeight, genomeLength, svgContainer);
    return currentRadius - trackHeight - trackSpacing;
  }

  renderCanvasMergedGCSkewFeatures(gcSkewFeatures: Array<{feature: any, value: number}>, gcSkewPlusTrack: Track, gcSkewMinusTrack: Track, currentRadius: number, trackHeight: number, genomeLength: number, featureContainer: PIXI.Container | undefined): void {
    gcSkewFeatures.forEach(({ feature, value }) => {
      const startAngle = (feature.start / genomeLength) * Math.PI * 2;
      const endAngle   = (feature.end   / genomeLength) * Math.PI * 2;
      const maxHeight  = trackHeight * RENDER_CONFIG.GC_MAX_BAR_HEIGHT_RATIO;
      const barHeight  = Math.abs(value) * maxHeight / RENDER_CONFIG.GC_SKEW_RANGE;
      const graphics   = new PIXI.Graphics();
      if (value > 0) {
        graphics.arc(this.centerX, this.centerY, currentRadius + barHeight, startAngle, endAngle, false);
        graphics.arc(this.centerX, this.centerY, currentRadius, endAngle, startAngle, true);
        graphics.fill({ color: hexToNumber(gcSkewPlusTrack.color), alpha: 0.8 });
      } else {
        graphics.arc(this.centerX, this.centerY, currentRadius, startAngle, endAngle, false);
        graphics.arc(this.centerX, this.centerY, currentRadius - barHeight, endAngle, startAngle, true);
        graphics.fill({ color: hexToNumber(gcSkewMinusTrack.color), alpha: 0.8 });
      }
      featureContainer?.addChild(graphics);
    });
  }

  renderSvgMergedGCSkewFeatures(gcSkewFeatures: Array<{feature: any, value: number}>, gcSkewPlusTrack: Track, gcSkewMinusTrack: Track, currentRadius: number, trackHeight: number, genomeLength: number, svgContainer: d3.Selection<SVGElement, unknown, null, undefined> | undefined): void {
    if (!svgContainer) return;
    const plusColor  = this.ensureColorString(gcSkewPlusTrack.color);
    const minusColor = this.ensureColorString(gcSkewMinusTrack.color);
    gcSkewFeatures.forEach(({ feature, value }) => {
      const startAngle = (feature.start / genomeLength) * Math.PI * 2;
      const endAngle   = (feature.end   / genomeLength) * Math.PI * 2;
      const maxHeight  = trackHeight * RENDER_CONFIG.GC_MAX_BAR_HEIGHT_RATIO;
      const barHeight  = Math.abs(value) * maxHeight / RENDER_CONFIG.GC_SKEW_RANGE;
      if (value > 0) {
        svgContainer.select('g#featureContainer').append('path')
          .attr('d', createArcPath(this.centerX, this.centerY, currentRadius + barHeight, currentRadius, startAngle, endAngle))
          .attr('fill', plusColor).attr('fill-opacity', 0.8);
      } else {
        svgContainer.select('g#featureContainer').append('path')
          .attr('d', createArcPath(this.centerX, this.centerY, currentRadius, currentRadius - barHeight, startAngle, endAngle))
          .attr('fill', minusColor).attr('fill-opacity', 0.8);
      }
    });
  }

  renderCanvasTrackBackground(radius: number, trackHeight: number, _trackColor: string | number, trackType?: string, featureContainer?: PIXI.Container): void {
    const graphics = new PIXI.Graphics();
    graphics.arc(this.centerX, this.centerY, radius, 0, Math.PI * 2, false);
    graphics.arc(this.centerX, this.centerY, radius - trackHeight, Math.PI * 2, 0, true);
    graphics.fill({ color: 0xf5f5f5, alpha: 0.5 });
    if (trackType === 'gc_skew_plus' || trackType === 'gc_skew_minus') {
      graphics.arc(this.centerX, this.centerY, radius - trackHeight / 2, 0, Math.PI * 2, false);
      graphics.setStrokeStyle({ width: 1, color: 0x999999, alpha: 0.7 });
    }
    featureContainer?.addChild(graphics);
  }

  renderSvgTrackBackground(radius: number, trackHeight: number, _trackColor: string | number, trackType?: string, svgContainer?: d3.Selection<SVGElement, unknown, null, undefined>): void {
    if (!svgContainer) return;
    svgContainer.select('g#featureContainer').append('path')
      .attr('d', createAnnulusPath(this.centerX, this.centerY, radius, radius - trackHeight))
      .attr('fill', '#f5f5f5').attr('fill-opacity', 0.5);
    if (trackType === 'gc_skew_plus' || trackType === 'gc_skew_minus') {
      svgContainer.select('g#featureContainer').append('circle')
        .attr('cx', this.centerX).attr('cy', this.centerY).attr('r', radius - trackHeight / 2)
        .attr('fill', 'none').attr('stroke', '#999999').attr('stroke-width', 1).attr('stroke-opacity', 0.7);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  渲染单个特征（Canvas）
  //  注意：radius 参数就是当前轨道的外边缘半径，直接传给 computeAnnotationAngles
  // ─────────────────────────────────────────────────────────────────────────
  renderCanvasFeature(feature: Feature, track: Track, radius: number, trackHeight: number, genomeLength: number, totalGenes: number, featureContainer?: PIXI.Container): void {
    const isGCTrack = track.type === 'gc_content' || track.type === 'gc_skew_plus' || track.type === 'gc_skew_minus';

    if (isGCTrack) {
      const rawStart = (feature.start / genomeLength) * Math.PI * 2;
      const rawEnd   = (feature.end   / genomeLength) * Math.PI * 2;
      const rawWidth = rawEnd - rawStart;
      const gapAngle = Math.min(RENDER_CONFIG.MAX_GAP_ANGLE, Math.max(RENDER_CONFIG.MIN_GAP_ANGLE, rawWidth * RENDER_CONFIG.GAP_ANGLE_RATIO));
      this.renderCanvasGCFeature(feature, track, radius, trackHeight, genomeLength, rawStart + gapAngle, rawEnd - gapAngle, rawWidth - gapAngle * 2, featureContainer);
      return;
    }

    // 注解轨道：传入 radius（轨道外缘半径）作为计算缝隙的基准
    const { startAngle, endAngle, valid } = this.computeAnnotationAngles(feature, genomeLength, radius);
    if (!valid) return;

    const color         = hexToNumber(track.color);
    const isHighlighted = this.checkHighlighted(feature);
    const graphics      = new PIXI.Graphics();

    if (isHighlighted) {
      graphics.arc(this.centerX, this.centerY, radius + 2, startAngle - 0.004, endAngle + 0.004, false);
      graphics.arc(this.centerX, this.centerY, radius - trackHeight - 2, endAngle + 0.004, startAngle - 0.004, true);
    } else {
      graphics.arc(this.centerX, this.centerY, radius, startAngle, endAngle, false);
      graphics.arc(this.centerX, this.centerY, radius - trackHeight, endAngle, startAngle, true);
    }
    graphics.fill({ color, alpha: 1 });

    if (feature.type === 'gene' || feature.type === 'CDS' || feature.name || feature.id) {
      graphics.eventMode = 'dynamic';
      graphics.cursor = 'pointer';

      graphics.on('pointerover', () => {
        graphics.clear();
        graphics.arc(this.centerX, this.centerY, radius + 2, startAngle - 0.004, endAngle + 0.004, false);
        graphics.arc(this.centerX, this.centerY, radius - trackHeight - 2, endAngle + 0.004, startAngle - 0.004, true);
        graphics.fill({ color, alpha: 1 });
        if (this.onHover) this.onHover(feature);
      });

      graphics.on('pointerout', () => {
        const stillHighlighted = this.checkHighlighted(feature);
        graphics.clear();
        if (stillHighlighted) {
          graphics.arc(this.centerX, this.centerY, radius + 2, startAngle - 0.004, endAngle + 0.004, false);
          graphics.arc(this.centerX, this.centerY, radius - trackHeight - 2, endAngle + 0.004, startAngle - 0.004, true);
        } else {
          graphics.arc(this.centerX, this.centerY, radius, startAngle, endAngle, false);
          graphics.arc(this.centerX, this.centerY, radius - trackHeight, endAngle, startAngle, true);
        }
        graphics.fill({ color, alpha: 1 });
        if (this.onHover && !stillHighlighted) this.onHover(null);
      });

      graphics.on('pointerdown', () => console.log('Feature clicked:', feature));
    }

    featureContainer?.addChild(graphics);
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  渲染单个特征（SVG）
  // ─────────────────────────────────────────────────────────────────────────
  renderSvgFeature(feature: Feature, track: Track, radius: number, trackHeight: number, genomeLength: number, totalGenes: number, svgContainer?: d3.Selection<SVGElement, unknown, null, undefined>): void {
    if (!svgContainer) return;

    const isGCTrack = track.type === 'gc_content' || track.type === 'gc_skew_plus' || track.type === 'gc_skew_minus';

    if (isGCTrack) {
      const rawStart = (feature.start / genomeLength) * Math.PI * 2;
      const rawEnd   = (feature.end   / genomeLength) * Math.PI * 2;
      const rawWidth = rawEnd - rawStart;
      const gapAngle = Math.min(RENDER_CONFIG.MAX_GAP_ANGLE, Math.max(RENDER_CONFIG.MIN_GAP_ANGLE, rawWidth * RENDER_CONFIG.GAP_ANGLE_RATIO));
      this.renderSvgGCFeature(feature, track, radius, trackHeight, genomeLength, rawStart + gapAngle, rawEnd - gapAngle, rawWidth - gapAngle * 2, svgContainer);
      return;
    }

    // 注解轨道：传入 radius（轨道外缘半径）作为计算缝隙的基准
    const { startAngle, endAngle, valid } = this.computeAnnotationAngles(feature, genomeLength, radius);
    if (!valid) return;

    const fillColor     = this.ensureColorString(track.color);
    const isHighlighted = this.checkHighlighted(feature);
    const normalPath    = createArcPath(this.centerX, this.centerY, radius, radius - trackHeight, startAngle, endAngle);
    const highlightPath = createArcPath(this.centerX, this.centerY, radius + 2, radius - trackHeight - 2, startAngle - 0.004, endAngle + 0.004);

    const featureElement = svgContainer.select('g#featureContainer')
      .append('path')
      .attr('d', isHighlighted ? highlightPath : normalPath)
      .attr('fill', fillColor).attr('fill-opacity', 1).attr('stroke', 'none');

    if (feature.type === 'gene' || feature.type === 'CDS' || feature.name || feature.id) {
      featureElement.style('cursor', 'pointer')
        .on('mouseover', () => {
          featureElement.attr('d', highlightPath).attr('fill-opacity', 1).attr('stroke', 'none');
          if (this.onHover) this.onHover(feature);
        })
        .on('mouseout', () => {
          const stillHighlighted = this.checkHighlighted(feature);
          featureElement.attr('d', stillHighlighted ? highlightPath : normalPath)
            .attr('fill-opacity', 1).attr('stroke', 'none');
          if (this.onHover && !stillHighlighted) this.onHover(null);
        })
        .on('mousedown', () => console.log('Feature clicked:', feature));
    }
  }

  renderCanvasGCFeature(feature: Feature, track: Track, radius: number, trackHeight: number, _genomeLength: number, startAngle: number, endAngle: number, _angleWidth: number, featureContainer?: PIXI.Container): void {
    const value = parseFloat(feature.attributes.value || '0');
    if      (track.type === 'gc_content')    this.renderCanvasGCContentFeature(feature, track, radius, trackHeight, startAngle, endAngle, value, featureContainer);
    else if (track.type === 'gc_skew_plus')  this.renderCanvasGCSkewPlusFeature(feature, track, radius, trackHeight, startAngle, endAngle, value, featureContainer);
    else if (track.type === 'gc_skew_minus') this.renderCanvasGCSkewMinusFeature(feature, track, radius, trackHeight, startAngle, endAngle, value, featureContainer);
  }

  renderSvgGCFeature(feature: Feature, track: Track, radius: number, trackHeight: number, _genomeLength: number, startAngle: number, endAngle: number, _angleWidth: number, svgContainer?: d3.Selection<SVGElement, unknown, null, undefined>): void {
    if (!svgContainer) return;
    const value = parseFloat(feature.attributes.value || '0');
    if      (track.type === 'gc_content')    this.renderSvgGCContentFeature(feature, track, radius, trackHeight, startAngle, endAngle, value, svgContainer);
    else if (track.type === 'gc_skew_plus')  this.renderSvgGCSkewPlusFeature(feature, track, radius, trackHeight, startAngle, endAngle, value, svgContainer);
    else if (track.type === 'gc_skew_minus') this.renderSvgGCSkewMinusFeature(feature, track, radius, trackHeight, startAngle, endAngle, value, svgContainer);
  }

  renderCanvasGCContentFeature(_feature: Feature, track: Track, radius: number, trackHeight: number, startAngle: number, endAngle: number, value: number, featureContainer?: PIXI.Container): void {
    const graphics        = new PIXI.Graphics();
    const maxHeight       = trackHeight * RENDER_CONFIG.GC_MAX_BAR_HEIGHT_RATIO;
    const normalizedValue = (value - RENDER_CONFIG.GC_CONTENT_MIDPOINT) / RENDER_CONFIG.GC_CONTENT_NORMALIZATION;
    const barHeight       = Math.abs(normalizedValue) * maxHeight;
    if (normalizedValue > 0) this.drawCanvasArc(graphics, radius + barHeight, radius, startAngle, endAngle, track.color);
    else                     this.drawCanvasArc(graphics, radius, radius - barHeight, startAngle, endAngle, track.color);
    featureContainer?.addChild(graphics);
  }

  renderSvgGCContentFeature(_feature: Feature, track: Track, radius: number, trackHeight: number, startAngle: number, endAngle: number, value: number, svgContainer?: d3.Selection<SVGElement, unknown, null, undefined>): void {
    if (!svgContainer) return;
    const fillColor       = this.ensureColorString(track.color);
    const maxHeight       = trackHeight * RENDER_CONFIG.GC_MAX_BAR_HEIGHT_RATIO;
    const normalizedValue = (value - RENDER_CONFIG.GC_CONTENT_MIDPOINT) / RENDER_CONFIG.GC_CONTENT_NORMALIZATION;
    const barHeight       = Math.abs(normalizedValue) * maxHeight;
    const outerR = normalizedValue > 0 ? radius + barHeight : radius;
    const innerR = normalizedValue > 0 ? radius : radius - barHeight;
    svgContainer.select('g#featureContainer').append('path')
      .attr('d', createArcPath(this.centerX, this.centerY, outerR, innerR, startAngle, endAngle))
      .attr('fill', fillColor).attr('fill-opacity', 0.8);
  }

  renderCanvasGCSkewPlusFeature(_feature: Feature, track: Track, radius: number, trackHeight: number, startAngle: number, endAngle: number, value: number, featureContainer?: PIXI.Container): void {
    const graphics  = new PIXI.Graphics();
    const barHeight = Math.abs(value) * trackHeight * RENDER_CONFIG.GC_MAX_BAR_HEIGHT_RATIO / RENDER_CONFIG.GC_SKEW_RANGE;
    this.drawCanvasArc(graphics, radius + barHeight, radius, startAngle, endAngle, track.color);
    featureContainer?.addChild(graphics);
  }

  renderCanvasGCSkewMinusFeature(_feature: Feature, track: Track, radius: number, trackHeight: number, startAngle: number, endAngle: number, value: number, featureContainer?: PIXI.Container): void {
    const graphics  = new PIXI.Graphics();
    const barHeight = Math.abs(value) * trackHeight * RENDER_CONFIG.GC_MAX_BAR_HEIGHT_RATIO / RENDER_CONFIG.GC_SKEW_RANGE;
    this.drawCanvasArc(graphics, radius - trackHeight, radius - trackHeight - barHeight, startAngle, endAngle, track.color);
    featureContainer?.addChild(graphics);
  }

  renderSvgGCSkewPlusFeature(_feature: Feature, track: Track, radius: number, trackHeight: number, startAngle: number, endAngle: number, value: number, svgContainer?: d3.Selection<SVGElement, unknown, null, undefined>): void {
    if (!svgContainer) return;
    const barHeight = Math.abs(value) * trackHeight * RENDER_CONFIG.GC_MAX_BAR_HEIGHT_RATIO / RENDER_CONFIG.GC_SKEW_RANGE;
    svgContainer.select('g#featureContainer').append('path')
      .attr('d', createArcPath(this.centerX, this.centerY, radius + barHeight, radius, startAngle, endAngle))
      .attr('fill', this.ensureColorString(track.color)).attr('fill-opacity', 0.8);
  }

  renderSvgGCSkewMinusFeature(_feature: Feature, track: Track, radius: number, trackHeight: number, startAngle: number, endAngle: number, value: number, svgContainer?: d3.Selection<SVGElement, unknown, null, undefined>): void {
    if (!svgContainer) return;
    const barHeight = Math.abs(value) * trackHeight * RENDER_CONFIG.GC_MAX_BAR_HEIGHT_RATIO / RENDER_CONFIG.GC_SKEW_RANGE;
    svgContainer.select('g#featureContainer').append('path')
      .attr('d', createArcPath(this.centerX, this.centerY, radius - trackHeight, radius - trackHeight - barHeight, startAngle, endAngle))
      .attr('fill', this.ensureColorString(track.color)).attr('fill-opacity', 0.8);
  }

  drawCanvasArc(graphics: PIXI.Graphics, outerRadius: number, innerRadius: number, startAngle: number, endAngle: number, color: string | number): void {
    graphics.arc(this.centerX, this.centerY, outerRadius, startAngle, endAngle, false);
    graphics.arc(this.centerX, this.centerY, innerRadius, endAngle, startAngle, true);
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