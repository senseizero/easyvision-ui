import * as React from 'react';
import { createRoot } from 'react-dom/client';
import EasyVisionDemoPage from '../demo/EasyVisionDemoPage';
import '../easyvision.css';
import '../table/EasyVisionTable.css';

const root = createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <EasyVisionDemoPage />
  </React.StrictMode>
);
