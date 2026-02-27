// 轨道模型
import type { Track as TrackType } from '../../../types';
import { Feature as FeatureModel } from './feature';

/**
 * 轨道类
 * 表示基因组的一个轨道
 */
export class Track implements TrackType {
  id: string;
  name: string;
  type: string;
  color: string | number;
  visible: boolean;
  height: number;
  features: FeatureModel[];

  constructor(data: Partial<TrackType>) {
    this.id = data.id || this.generateId();
    this.name = data.name || 'Unnamed Track';
    this.type = data.type || 'generic';
    this.color = data.color || this.getDefaultColor();
    this.visible = data.visible !== false;
    this.height = data.height || 30;
    this.features = data.features ? data.features.map(f => new FeatureModel(f)) : [];
  }

  /**
   * 生成唯一 ID
   */
  private generateId(): string {
    return `track_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  }

  /**
   * 获取默认颜色
   */
  private getDefaultColor(): string {
    const colors = ['#4CAF50', '#2196F3', '#FF9800', '#9C27B0', '#F44336', '#607D8B'];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  /**
   * 添加特征
   */
  addFeature(feature: FeatureModel): void {
    this.features.push(feature);
  }

  /**
   * 移除特征
   */
  removeFeature(featureId: string): void {
    const index = this.features.findIndex(f => f.id === featureId);
    if (index > -1) {
      this.features.splice(index, 1);
    }
  }

  /**
   * 过滤特征
   */
  filterFeatures(predicate: (feature: FeatureModel) => boolean): FeatureModel[] {
    return this.features.filter(predicate);
  }

  /**
   * 获取可见特征
   */
  getVisibleFeatures(viewportStart: number, viewportEnd: number): FeatureModel[] {
    return this.features.filter(feature => {
      return feature.end >= viewportStart && feature.start <= viewportEnd;
    });
  }

  /**
   * 转换为 JSON
   */
  toJSON(): TrackType {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      color: this.color,
      visible: this.visible,
      height: this.height,
      features: this.features.map(f => f.toJSON())
    };
  }

  /**
   * 从 JSON 创建 Track 实例
   */
  static fromJSON(data: TrackType): Track {
    return new Track({
      ...data,
      features: data.features.map(f => FeatureModel.fromJSON(f))
    });
  }
}