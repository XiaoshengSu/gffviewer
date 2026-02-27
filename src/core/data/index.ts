// 数据管理入口
import { Genome } from './models/genome';
import { Sequence } from './models/sequence';
import { Track } from './models/track';
import { Feature } from './models/feature';
import { GFF3Parser } from './parsers/gff3';

/**
 * 数据管理类
 * 负责数据的加载、解析和管理
 */
export class DataManager {
  private parsers: Map<string, any> = new Map();
  
  constructor() {
    // 注册解析器
    this.parsers.set('gff3', new GFF3Parser());
  }
  
  /**
   * 加载基因组数据
   */
  async loadGenome(data: string | File, format: string = 'gff3'): Promise<Genome> {
    let content: string;
    
    // 处理文件对象
    if (data instanceof File) {
      content = await this.readFile(data);
    } else {
      content = data;
    }
    
    // 选择解析器
    const parser = this.parsers.get(format.toLowerCase());
    if (!parser) {
      throw new Error(`Unsupported format: ${format}`);
    }
    
    // 解析数据
    return parser.parse(content);
  }
  
  /**
   * 读取文件内容
   */
  private readFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        resolve(content);
      };
      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };
      reader.readAsText(file);
    });
  }
  
  /**
   * 注册自定义解析器
   */
  registerParser(format: string, parser: any): void {
    this.parsers.set(format.toLowerCase(), parser);
  }
  
  /**
   * 获取支持的格式列表
   */
  getSupportedFormats(): string[] {
    return Array.from(this.parsers.keys());
  }
}

// 导出模型和解析器
export { Genome, Sequence, Track, Feature, GFF3Parser };