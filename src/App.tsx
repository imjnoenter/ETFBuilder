import { MotionConfig } from 'motion/react';
import { BuilderLayout } from './components/BuilderLayout';

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <BuilderLayout />
    </MotionConfig>
  );
}
