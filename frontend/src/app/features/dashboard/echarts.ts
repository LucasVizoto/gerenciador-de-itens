/**
 * Registro enxuto do ECharts (só o que o Dashboard usa), carregado sob demanda pela rota
 * para não pesar no bundle inicial.
 */
import { BarChart, PieChart, ScatterChart } from 'echarts/charts';
import { GraphicComponent, GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([
  BarChart,
  PieChart,
  ScatterChart,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  GraphicComponent,
  CanvasRenderer,
]);

export default echarts;
