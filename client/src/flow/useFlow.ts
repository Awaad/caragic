import { useContext } from 'react';
import { FlowContext } from './FlowContext';

export function useFlow() {
  const ctx = useContext(FlowContext);
  if (!ctx) {
    throw new Error('useFlow must be used within a FlowProvider');
  }
  return ctx;
}