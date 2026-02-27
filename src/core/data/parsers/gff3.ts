// GFF3 解析器
import { Genome } from '../models/genome';
import { Sequence } from '../models/sequence';
import { Feature } from '../models/feature';
import { Track } from '../models/track';

/**
 * GFF3 解析器类
 * 用于解析 GFF3 格式的基因组注释文件
 */
export class GFF3Parser {
  /**
   * 解析 GFF3 文件内容
   */
  parse(content: string): Genome {
    const lines = content.trim().split('\n');
    const genome = new Genome({});
    const sequences: Map<string, Sequence> = new Map();
    const featureTypes: Set<string> = new Set();
    const sequenceData: Map<string, string> = new Map();
    
    // 解析每一行
    let inFastaSection = false;
    let currentSequenceId = '';
    let currentSequence = '';
    
    for (const line of lines) {
      // 检查是否进入FASTA部分
      if (line.startsWith('##FASTA')) {
        inFastaSection = true;
        continue;
      }
      
      // 解析FASTA序列
      if (inFastaSection) {
        if (line.startsWith('>')) {
          // 保存之前的序列
          if (currentSequenceId && currentSequence) {
            sequenceData.set(currentSequenceId, currentSequence);
          }
          // 开始新序列
          currentSequenceId = line.substring(1).trim();
          currentSequence = '';
        } else if (currentSequenceId) {
          currentSequence += line.trim();
        }
        continue;
      }
      
      // 跳过注释行和空行
      if (line.startsWith('#') || line.trim() === '') {
        // 解析序列区域定义
        if (line.startsWith('##sequence-region')) {
          this.parseSequenceRegion(line, sequences, genome);
        }
        continue;
      }
      
      // 解析特征行
      const feature = this.parseFeatureLine(line);
      if (feature) {
        // 添加特征到对应的序列
        if (feature.sequenceId) {
          const sequence = sequences.get(feature.sequenceId);
          if (sequence) {
            sequence.addFeature(feature);
          }
        }
        
        // 记录特征类型
        featureTypes.add(feature.type);
      }
    }
    
    // 保存最后一个FASTA序列
    if (currentSequenceId && currentSequence) {
      sequenceData.set(currentSequenceId, currentSequence);
    }
    
    // 创建轨道
    this.createTracks(genome, sequences, featureTypes, sequenceData);
    
    return genome;
  }
  
  /**
   * 解析序列区域定义
   */
  private parseSequenceRegion(line: string, sequences: Map<string, Sequence>, genome: Genome): void {
    const parts = line.split(/\s+/);
    if (parts.length >= 4) {
      const sequenceId = parts[1];
      const end = parseInt(parts[3]);
      
      const sequence = new Sequence({
        id: sequenceId,
        name: sequenceId,
        length: end,
        features: []
      });
      
      sequences.set(sequenceId, sequence);
      genome.addSequence(sequence);
    }
  }
  
  /**
   * 解析特征行
   */
  private parseFeatureLine(line: string): Feature | null {
    const parts = line.split('\t');
    if (parts.length < 9) {
      return null;
    }
    
    const [sequenceId, , type, start, end, , strand, , attributesStr] = parts;
    
    const attributes = this.parseAttributes(attributesStr);
    const name = attributes.Name || attributes.gene || attributes.locus_tag;
    
    return new Feature({
      id: attributes.ID || `feature_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
      name: name,
      type: type,
      start: parseInt(start),
      end: parseInt(end),
      strand: strand as '+' | '-' | '.',
      attributes: attributes,
      sequenceId: sequenceId
    });
  }
  
  /**
   * 解析特征属性
   */
  private parseAttributes(attributesStr: string): Record<string, string> {
    const attributes: Record<string, string> = {};
    const pairs = attributesStr.split(';');
    
    for (const pair of pairs) {
      const [key, value] = pair.split('=');
      if (key && value) {
        // 移除引号
        const cleanValue = value.replace(/^"|"$/g, '');
        attributes[key.trim()] = cleanValue;
      }
    }
    
    return attributes;
  }
  
  /**
   * 创建轨道
   */
  private createTracks(genome: Genome, sequences: Map<string, Sequence>, featureTypes: Set<string>, sequenceData: Map<string, string>): void {
    // 为每种特征类型创建一个轨道
    const colorMap: Record<string, string> = {
      'CDS': '#800080',      // 紫色
      'tRNA': '#FF8C00',      // 橙色
      'rRNA': '#008000',      // 绿色
      'misc_RNA': '#A52A2A',  // 棕色
      'repeat_region': '#FFFF00', // 黄色
      'tmRNA': '#00FFFF'      // 青色
    };
    
    featureTypes.forEach(type => {
      const track = new Track({
        name: type,
        type: type,
        color: colorMap[type] || '#607D8B', // 默认颜色
        visible: true,
        height: 30,
        features: []
      });
      
      // 收集所有该类型的特征
      sequences.forEach(sequence => {
        sequence.features.forEach(feature => {
          if (feature.type === type) {
            track.addFeature(feature);
          }
        });
      });
      
      if (track.features.length > 0) {
        genome.addTrack(track);
      }
    });
    
    // 添加 GC 相关轨道
    this.addGCTracks(genome, sequences, sequenceData);
  }
  
  /**
   * 添加 GC 相关轨道
   */
  private addGCTracks(genome: Genome, sequences: Map<string, Sequence>, sequenceData: Map<string, string>): void {
    // 只有当有序列数据时才计算 GC 轨道
    if (sequenceData.size === 0) {
      console.warn('No sequence data found, skipping GC track calculation');
      return;
    }
    
    const gcTracks = [
      { name: 'GC Content', type: 'gc_content', color: '#4CAF50' },
      { name: 'GC Skew+', type: 'gc_skew_plus', color: '#2196F3' },
      { name: 'GC Skew-', type: 'gc_skew_minus', color: '#F44336' }
    ];
    
    // 为每个轨道创建空轨道，然后异步填充数据
    gcTracks.forEach(trackInfo => {
      const track = new Track({
        name: trackInfo.name,
        type: trackInfo.type,
        color: trackInfo.color,
        visible: true,
        height: 30,
        features: []
      });
      
      // 立即添加轨道到基因组
      genome.addTrack(track);
      
      // 异步计算 GC 特征，避免阻塞主线程
      this.calculateGCTrackData(track, sequences, sequenceData, trackInfo.type);
    });
  }
  
  /**
   * 异步计算 GC 轨道数据
   */
  private calculateGCTrackData(track: Track, sequences: Map<string, Sequence>, sequenceData: Map<string, string>, trackType: string): void {
    // 使用 setTimeout 来避免阻塞主线程
    setTimeout(() => {
      // 为每个序列生成 GC 相关特征
      sequences.forEach(sequence => {
        const sequenceStr = sequenceData.get(sequence.id);
        if (!sequenceStr) return;
        
        // 假设每 1000 个碱基为一个窗口
        const windowSize = 1000;
        const steps = Math.ceil(sequence.length / windowSize);
        
        // 分步计算，避免页面卡顿
        for (let i = 0; i < steps; i++) {
          const start = i * windowSize + 1;
          const end = Math.min((i + 1) * windowSize, sequence.length);
          
          // 计算实际的 GC 值
          const value = this.calculateGCValue(trackType, sequenceStr, start - 1, end - 1);
          
          // 创建 GC 特征
          const feature = new Feature({
            id: `gc_${trackType}_${sequence.id}_${start}`,
            name: `${track.name} ${start}-${end}`,
            type: trackType,
            start: start,
            end: end,
            strand: '.',
            attributes: { value: value.toString() },
            sequenceId: sequence.id
          });
          
          track.addFeature(feature);
        }
      });
    }, 0);
  }
  
  /**
   * 计算 GC 相关值
   */
  private calculateGCValue(type: string, sequence: string, start: number, end: number): number {
    const windowSequence = sequence.substring(start, end + 1);
    const length = windowSequence.length;
    
    if (length === 0) return 0;
    
    let gCount = 0;
    let cCount = 0;
    let aCount = 0;
    let tCount = 0;
    
    // 统计碱基数量
    for (const base of windowSequence) {
      switch (base.toUpperCase()) {
        case 'G': gCount++;
          break;
        case 'C': cCount++;
          break;
        case 'A': aCount++;
          break;
        case 'T': tCount++;
          break;
      }
    }
    
    switch (type) {
      case 'gc_content':
        // GC 含量 = (G + C) / 总碱基数 * 100
        return ((gCount + cCount) / length) * 100;
      case 'gc_skew_plus':
        // GC Skew+ = (G - C) / (G + C) (正值部分)
        const skew = (gCount - cCount) / (gCount + cCount || 1);
        return Math.max(0, skew);
      case 'gc_skew_minus':
        // GC Skew- = (G - C) / (G + C) (负值部分)
        const skewMinus = (gCount - cCount) / (gCount + cCount || 1);
        return Math.min(0, skewMinus);
      default:
        return 0;
    }
  }
  
  /**
   * 验证 GFF3 格式
   */
  validate(content: string): boolean {
    const lines = content.trim().split('\n');
    
    // 检查是否以 GFF3 版本头开始
    if (!lines[0].startsWith('##gff-version 3')) {
      return false;
    }
    
    // 检查至少有一个特征行
    let hasFeatureLine = false;
    for (const line of lines) {
      if (!line.startsWith('#') && line.trim() !== '') {
        const parts = line.split('\t');
        if (parts.length >= 9) {
          hasFeatureLine = true;
          break;
        }
      }
    }
    
    return hasFeatureLine;
  }
}