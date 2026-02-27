import { CGView } from '../core';

/**
 * 配色方案管理类
 * 负责配色方案的选择和应用
 */
export class ColorSchemeManager {
  private cgview: CGView | null = null;
  private colorSchemes: Record<string, string[]>;
  private colorSchemeSelected: HTMLElement;
  private colorSchemeOptions: HTMLElement;
  private selectedSchemePreview: HTMLElement;
  private selectedSchemeName: HTMLElement;

  constructor() {
    this.colorSchemes = {
      default: ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'],
      viridis: ['#440154', '#482878', '#3e4989', '#31688e', '#26828e', '#1f9e89', '#35b779', '#6ece58', '#b5de2b', '#fde725'],
      plasma: ['#0d0887', '#46039f', '#7201a8', '#9c179e', '#bd3786', '#d8576b', '#ed7953', '#fb9f3a', '#fdca26', '#f0f921'],
      inferno: ['#000004', '#160b39', '#420a68', '#6a176e', '#932667', '#ba3655', '#dd513a', '#f37819', '#fca50a', '#f6d746'],
      magma: ['#000004', '#140c3a', '#3b0f70', '#641a80', '#8c2981', '#b5367a', '#dd467a', '#fb6953', '#fd9a46', '#fec524'],
      cividis: ['#00203f', '#005662', '#008775', '#00b894', '#55e9c1', '#a3f7bf'],
      category10: ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'],
      set1: ['#e41a1c', '#377eb8', '#4daf4a', '#984ea3', '#ff7f00', '#ffff33', '#a65628', '#f781bf', '#999999'],
      set2: ['#66c2a5', '#fc8d62', '#8da0cb', '#e78ac3', '#a6d854', '#ffd92f', '#e5c494', '#b3b3b3'],
      set3: ['#8dd3c7', '#ffffb3', '#bebada', '#fb8072', '#80b1d3', '#fdb462', '#b3de69', '#fccde5', '#d9d9d9', '#bc80bd', '#ccebc5', '#ffed6f']
    };

    this.colorSchemeSelected = document.getElementById('color-scheme-selected')!;
    this.colorSchemeOptions = document.getElementById('color-scheme-options')!;
    this.selectedSchemePreview = document.getElementById('selected-scheme-preview')!;
    this.selectedSchemeName = document.getElementById('selected-scheme-name')!;

    this.initEventListeners();
  }

  /**
   * 初始化CGView实例
   */
  setCGView(cgview: CGView) {
    this.cgview = cgview;
  }

  /**
   * 初始化事件监听器
   */
  private initEventListeners() {
    // 切换下拉框显示/隐藏
    this.colorSchemeSelected.addEventListener('click', (e) => {
      e.stopPropagation();
      this.colorSchemeOptions.classList.toggle('show');
    });
    
    // 点击页面其他地方关闭下拉框
    document.addEventListener('click', () => {
      this.colorSchemeOptions.classList.remove('show');
    });
    
    // 阻止下拉框内部点击事件冒泡
    this.colorSchemeOptions.addEventListener('click', (e) => {
      e.stopPropagation();
    });
    
    // 选择配色方案
    const schemeOptions = document.querySelectorAll('.scheme-option');
    schemeOptions.forEach(option => {
      option.addEventListener('click', () => {
        const schemeValue = option.getAttribute('data-value')!;
        const schemeText = option.querySelector('span')!.textContent!;
        
        // 更新选中状态
        this.selectedSchemeName.textContent = schemeText;
        
        // 更新选中方案的预览
        const colors = this.colorSchemes[schemeValue] || this.colorSchemes.default;
        this.selectedSchemePreview.innerHTML = '';
        colors.slice(0, 4).forEach(color => {
          const colorBlock = document.createElement('div');
          colorBlock.className = 'scheme-color-block';
          colorBlock.style.backgroundColor = color;
          this.selectedSchemePreview.appendChild(colorBlock);
        });
        
        // 应用配色方案
        this.applyColorScheme(schemeValue);
        
        // 关闭下拉框
        this.colorSchemeOptions.classList.remove('show');
      });
    });
  }

  /**
   * 应用配色方案
   */
  private applyColorScheme(schemeName: string) {
    if (!this.cgview) return;

    const genome = this.cgview.getGenome();
    if (!genome) return;

    const colors = this.colorSchemes[schemeName] || this.colorSchemes.default;
    
    genome.tracks.forEach((track: any, index: number) => {
      track.color = colors[index % colors.length];
    });

    this.cgview.render();
  }
}
