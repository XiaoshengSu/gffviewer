// 序列模型
import type { Sequence as SequenceType } from '../../../types';
import { Feature as FeatureModel } from './feature';

/**
 * 序列类
 * 表示基因组中的一个序列
 */
export class Sequence implements SequenceType {
  id: string;
  name: string;
  length: number;
  features: FeatureModel[];

  constructor(data: Partial<SequenceType>) {
    this.id = data.id || this.generateId();
    this.name = data.name || 'Unnamed Sequence';
    this.length = data.length || 0;
    this.features = data.features ? data.features.map(f => new FeatureModel(f)) : [];
  }

  /**
   * 生成唯一 ID
   */
  private generateId(): string {
    return `sequence_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
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
  toJSON(): SequenceType {
    return {
      id: this.id,
      name: this.name,
      length: this.length,
      features: this.features.map(f => f.toJSON())
    };
  }

  /**
   * 从 JSON 创建 Sequence 实例
   */
  static fromJSON(data: SequenceType): Sequence {
    return new Sequence({
      ...data,
      features: data.features.map(f => FeatureModel.fromJSON(f))
    });
  }
}