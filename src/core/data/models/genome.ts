// 基因组模型
import type { Genome as GenomeType, Track, Sequence, Feature } from '../../../types';
import { Track as TrackModel } from './track';
import { Sequence as SequenceModel } from './sequence';

/**
 * 基因组类
 * 表示完整的基因组数据
 */
export class Genome implements GenomeType {
  id?: string;
  name?: string;
  sequences: any[];
  tracks: any[];
  length: number;

  constructor(data: Partial<GenomeType>) {
    this.id = data.id || this.generateId();
    this.name = data.name || 'Unnamed Genome';
    this.sequences = data.sequences ? data.sequences.map(s => new SequenceModel(s)) : [];
    this.tracks = data.tracks ? data.tracks.map(t => new TrackModel(t)) : [];
    this.length = data.length || this.calculateLength();
  }

  /**
   * 生成唯一 ID
   */
  private generateId(): string {
    return `genome_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  }

  /**
   * 计算基因组长度
   */
  private calculateLength(): number {
    if (this.sequences.length === 0) return 0;
    return Math.max(...this.sequences.map(s => s.length));
  }

  /**
   * 添加序列
   */
  addSequence(sequence: Sequence): void {
    this.sequences.push(sequence);
    this.length = this.calculateLength();
  }

  /**
   * 移除序列
   */
  removeSequence(sequenceId: string): void {
    const index = this.sequences.findIndex(s => s.id === sequenceId);
    if (index > -1) {
      this.sequences.splice(index, 1);
      this.length = this.calculateLength();
    }
  }

  /**
   * 添加轨道
   */
  addTrack(track: Track): void {
    this.tracks.push(track);
  }

  /**
   * 移除轨道
   */
  removeTrack(trackId: string): void {
    const index = this.tracks.findIndex(t => t.id === trackId);
    if (index > -1) {
      this.tracks.splice(index, 1);
    }
  }

  /**
   * 获取特征
   */
  getFeature(featureId: string): Feature | undefined {
    // 从所有轨道中查找特征
    for (const track of this.tracks) {
      const feature = track.features.find((f: any) => f.id === featureId);
      if (feature) return feature;
    }
    // 从所有序列中查找特征
    for (const sequence of this.sequences) {
      const feature = sequence.features.find((f: any) => f.id === featureId);
      if (feature) return feature;
    }
    return undefined;
  }

  /**
   * 按类型获取特征
   */
  getFeaturesByType(type: string): Feature[] {
    const features: Feature[] = [];
    this.tracks.forEach(track => {
      features.push(...track.features.filter((f: any) => f.type === type));
    });
    return features;
  }

  /**
   * 搜索特征
   */
  searchFeatures(query: string): Feature[] {
    const lowerQuery = query.toLowerCase();
    const results: Feature[] = [];
    
    this.tracks.forEach(track => {
      track.features.forEach((feature: any) => {
        if (
          (feature.name && feature.name.toLowerCase().includes(lowerQuery)) ||
          (feature.attributes.Name && feature.attributes.Name.toLowerCase().includes(lowerQuery)) ||
          (feature.attributes.gene && feature.attributes.gene.toLowerCase().includes(lowerQuery)) ||
          feature.id.toLowerCase().includes(lowerQuery)
        ) {
          results.push(feature);
        }
      });
    });
    
    return results;
  }

  /**
   * 转换为 JSON
   */
  toJSON(): GenomeType {
    return {
      id: this.id,
      name: this.name,
      sequences: this.sequences.map(s => s.toJSON()),
      tracks: this.tracks.map(t => t.toJSON()),
      length: this.length
    };
  }

  /**
   * 从 JSON 创建 Genome 实例
   */
  static fromJSON(data: GenomeType): Genome {
    return new Genome({
      ...data,
      sequences: data.sequences.map(s => SequenceModel.fromJSON(s)),
      tracks: data.tracks.map(t => TrackModel.fromJSON(t))
    });
  }
}