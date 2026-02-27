// 特征模型
import type { Feature as FeatureType, FeatureAttributes, Strand } from '../../../types';

/**
 * 特征类
 * 表示一个基因或其他注释特征
 */
export class Feature implements FeatureType {
  id: string;
  name?: string;
  type: string;
  start: number;
  end: number;
  strand: Strand;
  attributes: FeatureAttributes;
  sequenceId?: string;

  constructor(data: Partial<FeatureType>) {
    this.id = data.id || this.generateId();
    this.name = data.name;
    this.type = data.type || 'CDS';
    this.start = data.start || 0;
    this.end = data.end || 0;
    this.strand = data.strand || '.';
    this.attributes = data.attributes || {};
    this.sequenceId = data.sequenceId;

    // 确保 start <= end
    if (this.start > this.end) {
      [this.start, this.end] = [this.end, this.start];
    }
  }

  /**
   * 生成唯一 ID
   */
  private generateId(): string {
    return `feature_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  }

  /**
   * 获取特征长度
   */
  getLength(): number {
    return this.end - this.start + 1;
  }

  /**
   * 获取特征中心位置
   */
  getCenter(): number {
    return Math.floor((this.start + this.end) / 2);
  }

  /**
   * 检查特征是否可见
   */
  isVisible(viewportStart: number, viewportEnd: number): boolean {
    return this.end >= viewportStart && this.start <= viewportEnd;
  }

  /**
   * 转换为 JSON
   */
  toJSON(): FeatureType {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      start: this.start,
      end: this.end,
      strand: this.strand,
      attributes: { ...this.attributes },
      sequenceId: this.sequenceId
    };
  }

  /**
   * 从 JSON 创建 Feature 实例
   */
  static fromJSON(data: FeatureType): Feature {
    return new Feature(data);
  }
}