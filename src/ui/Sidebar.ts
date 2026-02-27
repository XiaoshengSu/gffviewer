import { CGView } from '../core';

/**
 * 侧边栏管理类
 * 负责侧边栏的初始化和功能管理
 */
export class SidebarManager {
  private cgview: CGView | null = null;
  private sidebar: HTMLElement;
  private trackList: HTMLElement;
  private sidebarExpandBtn: HTMLElement;
  private sidebarCollapseBtn: HTMLElement;
  private geneSearchInput: HTMLElement;
  private searchResults: HTMLElement;

  constructor() {
    this.sidebar = document.getElementById('sidebar')!;
    this.trackList = document.getElementById('track-list')!;
    this.sidebarExpandBtn = document.getElementById('sidebar-expand-btn')!;
    this.sidebarCollapseBtn = document.getElementById('sidebar-collapse-btn')!;
    this.geneSearchInput = document.getElementById('gene-search-input')!;
    this.searchResults = document.getElementById('search-results')!;
    this.initSidebarToggle();
    this.initSidebarExpand();
    this.initSidebarCollapse();
    this.initControls();
  }

  /**
   * 初始化CGView实例
   */
  setCGView(cgview: CGView) {
    this.cgview = cgview;
    this.initTrackList();
    this.initControls();
  }

  /**
   * 初始化轨道列表
   */
  private initTrackList() {
    if (!this.cgview) return;

    this.cgview.on('dataLoaded', (genome: any) => {
      this.trackList.innerHTML = '';
      
      // 添加轨道列表
      genome.tracks.forEach((track: any) => {
        const trackItem = document.createElement('div');
        trackItem.className = 'track-item';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = track.visible;
        checkbox.addEventListener('change', (e: any) => {
          track.visible = (e.target as HTMLInputElement).checked;
          this.cgview?.render();
        });
        
        const colorBlock = document.createElement('div');
        colorBlock.className = 'track-color';
        colorBlock.style.backgroundColor = track.color;
        
        const label = document.createElement('span');
        label.className = 'track-label';
        label.textContent = track.name;
        
        trackItem.appendChild(checkbox);
        trackItem.appendChild(colorBlock);
        trackItem.appendChild(label);
        this.trackList.appendChild(trackItem);
      });
    });
  }
  
  /**
   * 初始化渲染模式切换
   */
  private initRenderModeToggle() {
    if (!this.cgview) return;
    
    const renderModeButtons = document.querySelectorAll('.render-mode-btn');
    renderModeButtons.forEach(button => {
      button.addEventListener('click', () => {
        const mode = (button as HTMLElement).dataset.mode as 'svg' | 'canvas';
        this.cgview?.setRendererType(mode);
        
        // 更新按钮状态
        renderModeButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
      });
    });
  }
  
  /**
   * 初始化控制选项
   */
  private initControls() {
    // 初始化渲染模式切换
    this.initRenderModeToggle();
    
    // 初始化图例和标签切换
    this.initLegendToggle();
    this.initLabelsToggle();
    
    // 初始化参考圆线切换
    this.initGridToggle();
    
    // 初始化基因搜索
    this.initGeneSearch();
  }
  
  /**
   * 初始化参考圆线切换
   */
  private initGridToggle() {
    if (!this.cgview) return;
    
    const gridToggle = document.getElementById('grid-toggle');
    if (gridToggle) {
      // 初始状态：grid是显示的，所以按钮应该显示"Hide Grid"
      const toggleText = gridToggle.querySelector('.toggle-text') as HTMLElement;
      if (toggleText) {
        toggleText.textContent = 'Hide Grid';
        gridToggle.classList.add('active');
      }
      
      gridToggle.addEventListener('click', () => {
        const toggleText = gridToggle.querySelector('.toggle-text') as HTMLElement;
        if (toggleText) {
          if (toggleText.textContent === 'Hide Grid') {
            toggleText.textContent = 'Show Grid';
            gridToggle.classList.remove('active');
            this.cgview?.toggleGrid(false);
          } else {
            toggleText.textContent = 'Hide Grid';
            gridToggle.classList.add('active');
            this.cgview?.toggleGrid(true);
          }
        }
      });
    }
  }
  
  /**
   * 初始化基因搜索功能
   */
  private initGeneSearch() {
    if (!this.cgview) return;
    
    // 输入框回车事件
    this.geneSearchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.performSearch();
      }
    });
  }
  
  /**
   * 执行基因搜索
   */
  private performSearch() {
    if (!this.cgview) return;
    
    const query = (this.geneSearchInput as HTMLInputElement).value.trim();
    if (!query) {
      this.searchResults.innerHTML = '';
      return;
    }
    
    // 搜索基因
    const results = this.cgview.search(query);
    this.displaySearchResults(results);
  }
  
  /**
   * 显示搜索结果
   */
  private displaySearchResults(results: any[]) {
    this.searchResults.innerHTML = '';
    
    if (results.length === 0) {
      const noResult = document.createElement('div');
      noResult.className = 'search-result-item';
      noResult.textContent = 'No results found';
      this.searchResults.appendChild(noResult);
      return;
    }
    
    results.forEach((feature) => {
      const resultItem = document.createElement('div');
      resultItem.className = 'search-result-item';
      
      const geneName = feature.name || feature.id || 'Unnamed gene';
      const position = `${feature.start} - ${feature.end}`;
      
      resultItem.innerHTML = `
        <div class="result-name">${geneName}</div>
        <div class="result-position">${position}</div>
      `;
      
      // 点击结果项时，触发hover效果
      resultItem.addEventListener('click', () => {
        // 触发hover事件，显示高亮效果
        this.cgview?.highlightFeature(feature);
      });
      
      this.searchResults.appendChild(resultItem);
    });
  }
  
  /**
   * 初始化图例切换
   */
  private initLegendToggle() {
    if (!this.cgview) return;
    
    const legendToggle = document.getElementById('legend-toggle');
    if (legendToggle) {
      legendToggle.addEventListener('click', () => {
        const toggleText = legendToggle.querySelector('.toggle-text') as HTMLElement;
        if (toggleText) {
          if (toggleText.textContent === 'Hide Legend') {
            toggleText.textContent = 'Show Legend';
            legendToggle.classList.remove('active');
            // 这里可以添加实际的图例隐藏逻辑
            // this.cgview?.hideLegend();
          } else {
            toggleText.textContent = 'Hide Legend';
            legendToggle.classList.add('active');
            // 这里可以添加实际的图例显示逻辑
            // this.cgview?.showLegend();
          }
        }
      });
    }
  }
  
  /**
   * 初始化标签切换
   */
  private initLabelsToggle() {
    if (!this.cgview) return;
    
    const labelsToggle = document.getElementById('labels-toggle');
    if (labelsToggle) {
      labelsToggle.addEventListener('click', () => {
        const toggleText = labelsToggle.querySelector('.toggle-text') as HTMLElement;
        if (toggleText) {
          if (toggleText.textContent === 'Hide Labels') {
            toggleText.textContent = 'Show Labels';
            labelsToggle.classList.remove('active');
            // 这里可以添加实际的标签隐藏逻辑
            // this.cgview?.hideLabels();
          } else {
            toggleText.textContent = 'Hide Labels';
            labelsToggle.classList.add('active');
            // 这里可以添加实际的标签显示逻辑
            // this.cgview?.showLabels();
          }
        }
      });
    }
  }

  /**
   * 初始化侧边栏切换功能
   */
  private initSidebarToggle() {
    // 由于我们移除了侧边栏内部的切换按钮，这个方法可能不再需要
    // 但为了向后兼容，我们保留它
  }
  
  /**
   * 初始化侧边栏展开按钮
   */
  private initSidebarExpand() {
    this.sidebarExpandBtn.addEventListener('click', () => {
      this.sidebar.classList.remove('collapsed');
      
      // 使用requestAnimationFrame优化布局更新
      requestAnimationFrame(() => {
        // 等待动画完成后再调整大小
        setTimeout(() => {
          if ((window as any).cgview) {
            const container = document.getElementById('cgview-container')!;
            (window as any).cgview.resize(container.clientWidth, container.clientHeight);
          }
        }, 300);
      });
    });
  }
  
  /**
   * 初始化侧边栏收起按钮
   */
  private initSidebarCollapse() {
    this.sidebarCollapseBtn.addEventListener('click', () => {
      this.collapseSidebar();
    });
  }
  
  /**
   * 收起侧边栏
   */
  collapseSidebar() {
    this.sidebar.classList.add('collapsed');
    
    // 使用requestAnimationFrame优化布局更新
    requestAnimationFrame(() => {
      // 等待动画完成后再调整大小
      setTimeout(() => {
        if ((window as any).cgview) {
          const container = document.getElementById('cgview-container')!;
          (window as any).cgview.resize(container.clientWidth, container.clientHeight);
        }
      }, 300);
    });
  }
}
