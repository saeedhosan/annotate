import './style.css';

import { AnnotationApp } from './AnnotationApp';

const canvas = document.querySelector<HTMLCanvasElement>('#canvas');
if (canvas) new AnnotationApp(canvas).bootstrap();
